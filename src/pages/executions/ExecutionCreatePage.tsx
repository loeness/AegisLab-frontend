import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import {
  CloseOutlined,
  DatabaseOutlined,
  FunctionOutlined,
  PlayCircleOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import type {
  ContainerDetailResp,
  ContainerResp,
  ContainerVersionResp,
  DatasetDetailResp,
  DatasetResp,
  ExecutionSpec,
  GenericResponseContainerDetailResp,
  InjectionResp,
  LabelItem,
  ListContainerResp,
  ListDatasetResp,
  SubmitExecutionResp,
} from '@rcabench/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  message,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';

import { containerApi } from '@/api/containers';
import { datasetApi } from '@/api/datasets';
import { projectApi } from '@/api/projects';
import type { ProjectOutletContext } from '@/hooks/useProjectContext';

const { Title, Text } = Typography;

/**
 * Algorithm Benchmark Page (Workflow B)
 *
 * Two modes:
 * - Datapack mode: select algorithm + multiple datapacks → one ExecutionSpec per datapack
 * - Dataset mode: select algorithm + dataset(+version) → one ExecutionSpec with dataset ref
 */
const ExecutionCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { teamName, projectName, projectId } =
    useOutletContext<ProjectOutletContext>();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'datapack' | 'dataset'>('datapack');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<
    ContainerDetailResp | ContainerResp | null
  >(null);
  const [algorithmName, setAlgorithmName] = useState('');
  const [algorithmVersion, setAlgorithmVersion] = useState('');
  const [selectedDatapackIds, setSelectedDatapackIds] = useState<number[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    null
  );
  const [selectedDatasetVersion, setSelectedDatasetVersion] = useState('');
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [labelInput, setLabelInput] = useState('');

  // Fetch algorithms (type=algorithm → ContainerType.Algorithm = 0)
  const { data: algorithmsData } = useQuery<ListContainerResp>({
    queryKey: ['containers', 'algorithm'],
    queryFn: () => containerApi.getContainers({ type: 0, size: 100 }),
  });

  // Fetch project datapacks
  const { data: datapacksData, isLoading: datapacksLoading } = useQuery({
    queryKey: ['project-datapacks', projectId],
    queryFn: () => {
      if (!projectId) return Promise.resolve({ items: [], total: 0 });
      return projectApi.listProjectInjections(projectId, {
        page: 1,
        size: 200,
      });
    },
    enabled: !!projectId,
  });

  // Fetch datasets
  const { data: datasetsData } = useQuery<ListDatasetResp>({
    queryKey: ['datasets'],
    queryFn: () => datasetApi.getDatasets({ size: 100 }),
  });

  // Fetch dataset versions when a dataset is selected
  const { data: datasetVersionsData } = useQuery({
    queryKey: ['dataset-versions', selectedDatasetId],
    queryFn: () => {
      if (!selectedDatasetId) return Promise.resolve({ items: [], total: 0 });
      return datasetApi.getVersions(selectedDatasetId, { size: 50 });
    },
    enabled: !!selectedDatasetId,
  });

  const datapacks = useMemo(() => datapacksData?.items ?? [], [datapacksData]);
  const datasets = useMemo(() => datasetsData?.items ?? [], [datasetsData]);
  const datasetVersions = datasetVersionsData?.items ?? [];
  const algorithms = useMemo(
    () => algorithmsData?.items ?? [],
    [algorithmsData]
  );

  // Handle algorithm selection
  const handleAlgorithmChange = useCallback(
    async (name: string) => {
      setAlgorithmName(name);
      setAlgorithmVersion('');
      const algo = algorithms.find((a: ContainerResp) => a.name === name);
      if (algo?.id) {
        try {
          const detail = (await containerApi.getContainer(
            algo.id
          )) as unknown as GenericResponseContainerDetailResp;
          setSelectedAlgorithm(detail.data || null);
          if (detail.data?.versions?.[0]?.name) {
            setAlgorithmVersion(detail.data.versions[0].name);
          }
        } catch {
          setSelectedAlgorithm(algo);
        }
      } else {
        setSelectedAlgorithm(null);
      }
    },
    [algorithms]
  );

  // Build SubmitExecutionReq specs
  const specs = useMemo((): ExecutionSpec[] => {
    if (!algorithmName || !algorithmVersion) return [];

    const algorithmSpec = { name: algorithmName, version: algorithmVersion };

    if (mode === 'datapack') {
      return selectedDatapackIds.map((dpId) => {
        const dp = datapacks.find((d: InjectionResp) => d.id === dpId);
        return {
          algorithm: algorithmSpec,
          datapack: dp?.name ?? String(dpId),
        };
      });
    }

    // Dataset mode
    if (selectedDatasetId && selectedDatasetVersion) {
      const ds = datasets.find((d: DatasetResp) => d.id === selectedDatasetId);
      return [
        {
          algorithm: algorithmSpec,
          dataset: {
            name: ds?.name ?? String(selectedDatasetId),
            version: selectedDatasetVersion,
          },
        },
      ];
    }

    return [];
  }, [
    mode,
    algorithmName,
    algorithmVersion,
    selectedDatapackIds,
    datapacks,
    selectedDatasetId,
    selectedDatasetVersion,
    datasets,
  ]);

  const canSubmit = specs.length > 0;

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: () => {
      if (!projectId) return Promise.reject(new Error('No project context'));
      return projectApi.executeAlgorithm(projectId, {
        project_name: projectName,
        specs,
        labels: labels.filter(
          (l): l is { key: string; value?: string } => !!l.key
        ),
      }) as Promise<SubmitExecutionResp | undefined>;
    },
    onSuccess: (data: SubmitExecutionResp | undefined) => {
      message.success('Execution started successfully');
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      const groupId = data?.group_id;
      navigate(
        `/${teamName}/${projectName}/executions${groupId ? `?group_id=${groupId}` : ''}`
      );
    },
    onError: () => {
      message.error('Failed to start execution');
    },
  });

  const handleSubmit = () => {
    if (!canSubmit) return;
    submitMutation.mutate();
  };

  const handleCancel = () => {
    navigate(`/${teamName}/${projectName}/executions`);
  };

  // Label helpers
  const addLabel = () => {
    if (!labelInput.trim()) return;
    const [key, value] = labelInput.split(':').map((s) => s.trim());
    if (!key || !value) {
      message.warning('Please enter label in format: key:value');
      return;
    }
    if (labels.some((l) => l.key === key)) {
      message.warning('Label key already exists');
      return;
    }
    setLabels([...labels, { key, value }]);
    setLabelInput('');
  };

  const removeLabel = (key: string) => {
    setLabels(labels.filter((l) => l.key !== key));
  };

  // Datapack toggle
  const toggleDatapack = (id: number) => {
    setSelectedDatapackIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllDatapacks = () => {
    if (selectedDatapackIds.length === datapacks.length) {
      setSelectedDatapackIds([]);
    } else {
      setSelectedDatapackIds(
        datapacks.map((d: InjectionResp) => d.id ?? 0).filter(Boolean)
      );
    }
  };

  // No algorithms available
  if (algorithms.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <Empty
            description='No algorithms available. Please register an algorithm container first.'
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type='primary'
              onClick={() => navigate(`/${teamName}/${projectName}/algorithms`)}
            >
              Go to Algorithms
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <Space
        style={{
          width: '100%',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Run Algorithm
        </Title>
        <Button icon={<CloseOutlined />} onClick={handleCancel}>
          Cancel
        </Button>
      </Space>

      {/* Step 1: Select Algorithm */}
      <Card
        title={
          <Space>
            <FunctionOutlined />
            <span>Step 1: Select Algorithm</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Form layout='vertical'>
          <Space size='large' align='start'>
            <Form.Item label='Algorithm' style={{ minWidth: 240 }}>
              <Select
                placeholder='Select algorithm'
                value={algorithmName || undefined}
                onChange={handleAlgorithmChange}
                options={algorithms.map((a: ContainerResp) => ({
                  value: a.name,
                  label: a.name,
                }))}
              />
            </Form.Item>
            {selectedAlgorithm && (
              <Form.Item label='Version' style={{ minWidth: 180 }}>
                <Select
                  placeholder='Select version'
                  value={algorithmVersion || undefined}
                  onChange={setAlgorithmVersion}
                  options={(
                    (selectedAlgorithm as ContainerDetailResp).versions ?? []
                  ).map((v: ContainerVersionResp) => ({
                    value: v.name,
                    label: v.name,
                  }))}
                />
              </Form.Item>
            )}
          </Space>
        </Form>
      </Card>

      {/* Step 2: Select Data Source */}
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            <span>Step 2: Select Data Source</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Tabs
          activeKey={mode}
          onChange={(key) => {
            setMode(key as 'datapack' | 'dataset');
            setSelectedDatapackIds([]);
            setSelectedDatasetId(null);
            setSelectedDatasetVersion('');
          }}
          items={[
            {
              key: 'datapack',
              label: 'Datapacks',
              children: (
                <div>
                  {datapacks.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        datapacksLoading
                          ? 'Loading datapacks...'
                          : 'No datapacks available. Create an injection first.'
                      }
                    />
                  ) : (
                    <>
                      <Space
                        style={{
                          width: '100%',
                          justifyContent: 'space-between',
                          marginBottom: 12,
                        }}
                      >
                        <Text type='secondary'>
                          Showing {datapacks.length} datapacks
                          {selectedDatapackIds.length > 0 &&
                            ` · ${selectedDatapackIds.length} selected`}
                        </Text>
                        <Space>
                          <Button size='small' onClick={toggleAllDatapacks}>
                            {selectedDatapackIds.length === datapacks.length
                              ? 'Clear'
                              : 'Select All'}
                          </Button>
                        </Space>
                      </Space>
                      <div
                        style={{
                          maxHeight: 320,
                          overflow: 'auto',
                          border: '1px solid var(--ant-color-border, #d9d9d9)',
                          borderRadius: 6,
                        }}
                      >
                        {datapacks.map((dp: InjectionResp) => (
                          <div
                            key={dp.id}
                            style={{
                              padding: '8px 12px',
                              borderBottom:
                                '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                              cursor: 'pointer',
                              background: selectedDatapackIds.includes(
                                dp.id ?? 0
                              )
                                ? 'var(--ant-color-primary-bg, #e6f4ff)'
                                : undefined,
                            }}
                            onClick={() => dp.id && toggleDatapack(dp.id)}
                          >
                            <Checkbox
                              checked={selectedDatapackIds.includes(dp.id ?? 0)}
                              style={{ marginRight: 8 }}
                            />
                            <Text strong>{dp.name}</Text>
                            <Text
                              type='secondary'
                              style={{ marginLeft: 8, fontSize: 12 }}
                            >
                              {dp.fault_type}
                              {dp.benchmark_name
                                ? ` | ${dp.benchmark_name}`
                                : ''}
                            </Text>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ),
            },
            {
              key: 'dataset',
              label: 'Dataset',
              children: (
                <Form layout='vertical'>
                  <Space size='large' align='start'>
                    <Form.Item label='Dataset' style={{ minWidth: 240 }}>
                      <Select
                        placeholder='Select dataset'
                        value={selectedDatasetId ?? undefined}
                        onChange={(val) => {
                          setSelectedDatasetId(val);
                          setSelectedDatasetVersion('');
                        }}
                        options={datasets.map((d: DatasetResp) => ({
                          value: d.id,
                          label: d.name,
                        }))}
                      />
                    </Form.Item>
                    {selectedDatasetId && (
                      <Form.Item label='Version' style={{ minWidth: 180 }}>
                        <Select
                          placeholder='Select version'
                          value={selectedDatasetVersion || undefined}
                          onChange={setSelectedDatasetVersion}
                          options={datasetVersions.map(
                            (v: DatasetDetailResp) => ({
                              value: v.name,
                              label: v.name,
                            })
                          )}
                        />
                      </Form.Item>
                    )}
                  </Space>
                  {selectedDatasetId && selectedDatasetVersion && (
                    <Text type='secondary'>
                      The algorithm will run on all datapacks in this dataset
                      version.
                    </Text>
                  )}
                </Form>
              ),
            },
          ]}
        />
      </Card>

      {/* Step 3: Labels (optional) */}
      <Card
        title={
          <Space>
            <TagsOutlined />
            <span>Step 3: Labels (optional)</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Space direction='vertical' style={{ width: '100%' }}>
          <Space.Compact style={{ width: '100%', maxWidth: 400 }}>
            <Input
              placeholder='Enter label (key:value)'
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onPressEnter={addLabel}
            />
            <Button onClick={addLabel} icon={<TagsOutlined />}>
              Add
            </Button>
          </Space.Compact>
          {labels.length > 0 && (
            <div>
              {labels.map((label) => (
                <Tag
                  key={label.key}
                  closable
                  onClose={() => label.key && removeLabel(label.key)}
                  style={{ marginBottom: 4 }}
                >
                  {label.key}: {label.value}
                </Tag>
              ))}
            </div>
          )}
        </Space>
      </Card>

      {/* Submit */}
      <Space>
        <Button
          type='primary'
          icon={<PlayCircleOutlined />}
          size='large'
          disabled={!canSubmit}
          loading={submitMutation.isPending}
          onClick={handleSubmit}
        >
          {mode === 'datapack'
            ? `Run ${specs.length} Execution${specs.length !== 1 ? 's' : ''}`
            : 'Run on Dataset'}
        </Button>
        <Button size='large' onClick={handleCancel}>
          Cancel
        </Button>
      </Space>
    </div>
  );
};

export default ExecutionCreatePage;

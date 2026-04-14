import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  DeleteOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { ContainerResp, ContainerVersionResp } from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Steps,
  Tag,
  Tooltip,
  Typography,
} from 'antd';

import { containerApi } from '@/api/containers';
import { projectApi } from '@/api/projects';
import { useProjectContext } from '@/hooks/useProjectContext';

const { Text, Title } = Typography;

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

interface FaultEntry {
  action: string;
  mode: string;
  duration: string;
  params: Record<string, string>;
}

interface AlgorithmSelection {
  containerId: number;
  name: string;
  version: string;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_ITEMS = [
  { title: 'Pedestal' },
  { title: 'Benchmark' },
  { title: 'Faults' },
  { title: 'Timing' },
  { title: 'Algorithms' },
  { title: 'Review' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tiny key-value pair editor for fault params. */
function ParamEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const entries = Object.entries(value);

  const handleAdd = () => {
    onChange({ ...value, '': '' });
  };

  const handleRemove = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const handleChange = (
    oldKey: string,
    field: 'key' | 'value',
    newVal: string
  ) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === oldKey) {
        if (field === 'key') next[newVal] = v;
        else next[k] = newVal;
      } else {
        next[k] = v;
      }
    }
    onChange(next);
  };

  return (
    <div>
      {entries.map(([k, v], idx) => (
        <Space key={idx} style={{ display: 'flex', marginBottom: 4 }}>
          <Input
            placeholder='key'
            value={k}
            onChange={(e) => handleChange(k, 'key', e.target.value)}
            style={{ width: 140 }}
          />
          <Input
            placeholder='value'
            value={v}
            onChange={(e) => handleChange(k, 'value', e.target.value)}
            style={{ width: 200 }}
          />
          <Button
            type='text'
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemove(k)}
          />
        </Space>
      ))}
      <Button
        type='dashed'
        size='small'
        icon={<PlusOutlined />}
        onClick={handleAdd}
      >
        Add parameter
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container + Version selector (shared by pedestal / benchmark steps)
// ---------------------------------------------------------------------------

function ContainerVersionStep({
  containerType,
  label,
  selectedContainer,
  selectedVersion,
  onContainerChange,
  onVersionChange,
}: {
  containerType: 0 | 1 | 2;
  label: string;
  selectedContainer: ContainerResp | null;
  selectedVersion: string;
  onContainerChange: (c: ContainerResp | null) => void;
  onVersionChange: (v: string) => void;
}) {
  const { data: containersData, isLoading: containersLoading } = useQuery({
    queryKey: ['containers', containerType],
    queryFn: () =>
      containerApi.getContainers({ type: containerType, size: 100 }),
  });

  const containers = containersData?.items ?? [];

  const containerId = selectedContainer?.id;
  const { data: versionsData, isLoading: versionsLoading } = useQuery({
    queryKey: ['containerVersions', containerId],
    queryFn: () => containerApi.getVersions(containerId as number),
    enabled: !!containerId,
  });

  const versions: ContainerVersionResp[] = versionsData?.items ?? [];

  const handleContainerSelect = (containerId: number) => {
    const found = containers.find((c) => c.id === containerId) ?? null;
    onContainerChange(found);
    onVersionChange('');
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <Title level={5}>Select {label}</Title>
      <Form layout='vertical'>
        <Form.Item label={`${label} Container`} required>
          <Select
            placeholder={`Choose a ${label.toLowerCase()}...`}
            loading={containersLoading}
            value={selectedContainer?.id ?? undefined}
            onChange={handleContainerSelect}
            showSearch
            optionFilterProp='label'
            options={containers.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
          />
        </Form.Item>

        {selectedContainer && (
          <Form.Item label='Version' required>
            <Select
              placeholder='Choose a version...'
              loading={versionsLoading}
              value={selectedVersion || undefined}
              onChange={(v: string) => onVersionChange(v)}
              options={versions.map((v) => ({
                value: v.name,
                label: v.name,
              }))}
            />
          </Form.Item>
        )}
      </Form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

const InjectionWizard: React.FC = () => {
  const navigate = useNavigate();
  const { teamName, projectName, projectId, project, isLoading } =
    useProjectContext();

  // Step state
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 - Pedestal
  const [pedestalContainer, setPedestalContainer] =
    useState<ContainerResp | null>(null);
  const [pedestalVersion, setPedestalVersion] = useState('');

  // Step 2 - Benchmark
  const [benchmarkContainer, setBenchmarkContainer] =
    useState<ContainerResp | null>(null);
  const [benchmarkVersion, setBenchmarkVersion] = useState('');

  // Step 3 - Faults
  const [faultSpecs, setFaultSpecs] = useState<FaultEntry[]>([
    { action: '', mode: '', duration: '30s', params: {} },
  ]);

  // Step 4 - Timing
  const [injectionInterval, setInjectionInterval] = useState(5);
  const [preDuration, setPreDuration] = useState(3);

  // Step 5 - Algorithms
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<
    AlgorithmSelection[]
  >([]);

  // Submit state
  const [submitting, setSubmitting] = useState(false);

  // ---- Validation per step ----
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0:
        return !!pedestalContainer && !!pedestalVersion;
      case 1:
        return !!benchmarkContainer && !!benchmarkVersion;
      case 2:
        return (
          faultSpecs.length > 0 &&
          faultSpecs.every((f) => f.action && f.mode && f.duration)
        );
      case 3:
        return injectionInterval > 0 && preDuration >= 0;
      case 4:
        return true; // algorithms are optional
      default:
        return true;
    }
  }, [
    currentStep,
    pedestalContainer,
    pedestalVersion,
    benchmarkContainer,
    benchmarkVersion,
    faultSpecs,
    injectionInterval,
    preDuration,
  ]);

  const next = useCallback(() => {
    if (!canProceed) {
      message.warning('Please complete all required fields before proceeding.');
      return;
    }
    setCurrentStep((s) => Math.min(s + 1, 5));
  }, [canProceed]);

  const prev = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  // ---- Fault helpers ----
  const addFault = () => {
    setFaultSpecs((prev) => [
      ...prev,
      { action: '', mode: '', duration: '30s', params: {} },
    ]);
  };

  const removeFault = (idx: number) => {
    setFaultSpecs((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateFault = (idx: number, patch: Partial<FaultEntry>) => {
    setFaultSpecs((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    );
  };

  // ---- Submit ----
  const handleSubmit = async () => {
    if (!projectId || !pedestalContainer || !benchmarkContainer) return;

    setSubmitting(true);
    try {
      // Build specs as ChaosNode[][] — single fault group with all entries
      const specs = [
        faultSpecs.map((f) => ({
          action: f.action,
          mode: f.mode,
          duration: f.duration,
          params: f.params,
        })),
      ];

      const reqData = {
        project_name: project?.name ?? projectName ?? '',
        pedestal: {
          name: pedestalContainer.name,
          version: pedestalVersion,
        },
        benchmark: {
          name: benchmarkContainer.name,
          version: benchmarkVersion,
        },
        interval: injectionInterval,
        pre_duration: preDuration,
        specs,
        ...(selectedAlgorithms.length > 0 && {
          algorithms: selectedAlgorithms.map((a) => ({
            name: a.name,
            version: a.version,
          })),
        }),
      };

      const result = await projectApi.submitInjection(projectId, reqData);

      const traceId =
        result && typeof result === 'object' && 'trace_id' in result
          ? (result as Record<string, unknown>).trace_id
          : undefined;

      message.success(
        traceId
          ? `Injection submitted successfully (trace: ${traceId})`
          : 'Injection submitted successfully'
      );

      navigate(`/${teamName}/${projectName}?tab=datapacks`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to submit injection';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Step renderers ----
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <ContainerVersionStep
            containerType={2}
            label='Pedestal'
            selectedContainer={pedestalContainer}
            selectedVersion={pedestalVersion}
            onContainerChange={setPedestalContainer}
            onVersionChange={setPedestalVersion}
          />
        );

      case 1:
        return (
          <ContainerVersionStep
            containerType={1}
            label='Benchmark'
            selectedContainer={benchmarkContainer}
            selectedVersion={benchmarkVersion}
            onContainerChange={setBenchmarkContainer}
            onVersionChange={setBenchmarkVersion}
          />
        );

      case 2:
        return (
          <div>
            <Title level={5}>Configure Fault Specifications</Title>
            <Text
              type='secondary'
              style={{ display: 'block', marginBottom: 16 }}
            >
              Define one or more fault nodes. Each fault requires an action,
              mode, and duration. You can also add custom parameters.
            </Text>
            {faultSpecs.map((fault, idx) => (
              <Card
                key={idx}
                size='small'
                title={`Fault #${idx + 1}`}
                extra={
                  faultSpecs.length > 1 ? (
                    <Button
                      type='text'
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeFault(idx)}
                    />
                  ) : null
                }
                style={{ marginBottom: 12 }}
              >
                <Form layout='vertical'>
                  <Space
                    wrap
                    style={{ display: 'flex', gap: 12, marginBottom: 8 }}
                  >
                    <Form.Item
                      label='Action'
                      required
                      style={{ marginBottom: 0, minWidth: 180 }}
                    >
                      <Input
                        placeholder='e.g. pod-kill'
                        value={fault.action}
                        onChange={(e) =>
                          updateFault(idx, { action: e.target.value })
                        }
                      />
                    </Form.Item>
                    <Form.Item
                      label='Mode'
                      required
                      style={{ marginBottom: 0, minWidth: 140 }}
                    >
                      <Input
                        placeholder='e.g. one'
                        value={fault.mode}
                        onChange={(e) =>
                          updateFault(idx, { mode: e.target.value })
                        }
                      />
                    </Form.Item>
                    <Form.Item
                      label='Duration'
                      required
                      style={{ marginBottom: 0, minWidth: 120 }}
                    >
                      <Input
                        placeholder='e.g. 30s'
                        value={fault.duration}
                        onChange={(e) =>
                          updateFault(idx, { duration: e.target.value })
                        }
                      />
                    </Form.Item>
                  </Space>
                  <Form.Item label='Parameters' style={{ marginBottom: 0 }}>
                    <ParamEditor
                      value={fault.params}
                      onChange={(params) => updateFault(idx, { params })}
                    />
                  </Form.Item>
                </Form>
              </Card>
            ))}
            <Button type='dashed' icon={<PlusOutlined />} onClick={addFault}>
              Add Fault
            </Button>
          </div>
        );

      case 3:
        return (
          <div style={{ maxWidth: 480 }}>
            <Title level={5}>Timing Configuration</Title>
            <Form layout='vertical'>
              <Form.Item
                label={
                  <span>
                    Interval (minutes)&nbsp;
                    <Tooltip title='Time between consecutive fault injections'>
                      <InfoCircleOutlined />
                    </Tooltip>
                  </span>
                }
                required
              >
                <InputNumber
                  min={1}
                  value={injectionInterval}
                  onChange={(v) => setInjectionInterval(v ?? 5)}
                  style={{ width: '100%' }}
                  addonAfter='min'
                />
              </Form.Item>
              <Form.Item
                label={
                  <span>
                    Pre-duration (minutes)&nbsp;
                    <Tooltip title='How long to collect normal (non-fault) data before beginning injections'>
                      <InfoCircleOutlined />
                    </Tooltip>
                  </span>
                }
                required
              >
                <InputNumber
                  min={0}
                  value={preDuration}
                  onChange={(v) => setPreDuration(v ?? 3)}
                  style={{ width: '100%' }}
                  addonAfter='min'
                />
              </Form.Item>
            </Form>
          </div>
        );

      case 4:
        return (
          <AlgorithmStep
            value={selectedAlgorithms}
            onChange={setSelectedAlgorithms}
          />
        );

      case 5:
        return (
          <div>
            <Title level={5}>Review Injection Configuration</Title>
            <Descriptions bordered column={1} size='small'>
              <Descriptions.Item label='Project'>
                {project?.name ?? projectName ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label='Pedestal'>
                {pedestalContainer?.name ?? '-'}{' '}
                {pedestalVersion && <Tag>{pedestalVersion}</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label='Benchmark'>
                {benchmarkContainer?.name ?? '-'}{' '}
                {benchmarkVersion && <Tag>{benchmarkVersion}</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label='Interval'>
                {injectionInterval} min
              </Descriptions.Item>
              <Descriptions.Item label='Pre-duration'>
                {preDuration} min
              </Descriptions.Item>
              <Descriptions.Item label='Faults'>
                {faultSpecs.length} fault(s) in 1 group
              </Descriptions.Item>
              {selectedAlgorithms.length > 0 && (
                <Descriptions.Item label='Algorithms'>
                  {selectedAlgorithms.map((a) => (
                    <Tag key={`${a.name}-${a.version}`}>
                      {a.name}:{a.version}
                    </Tag>
                  ))}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation='left' plain>
              Fault Details
            </Divider>
            {faultSpecs.map((f, idx) => (
              <Card key={idx} size='small' style={{ marginBottom: 8 }}>
                <Text strong>Fault #{idx + 1}</Text>
                <br />
                <Text>
                  Action: <Tag>{f.action}</Tag> Mode: <Tag>{f.mode}</Tag>{' '}
                  Duration: <Tag>{f.duration}</Tag>
                </Text>
                {Object.keys(f.params).length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    Params:{' '}
                    {Object.entries(f.params).map(([k, v]) => (
                      <Tag key={k}>
                        {k}={v}
                      </Tag>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return <Card loading />;
  }

  return (
    <Card>
      <Steps
        current={currentStep}
        items={STEP_ITEMS}
        style={{ marginBottom: 24 }}
      />
      <div style={{ minHeight: 300 }}>{renderStepContent()}</div>
      <div
        style={{
          marginTop: 24,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <div>{currentStep > 0 && <Button onClick={prev}>Previous</Button>}</div>
        <div>
          {currentStep < 5 && (
            <Button type='primary' onClick={next} disabled={!canProceed}>
              Next
            </Button>
          )}
          {currentStep === 5 && (
            <Button type='primary' onClick={handleSubmit} loading={submitting}>
              Submit Injection
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Algorithm step (separate component for its own query hooks)
// ---------------------------------------------------------------------------

function AlgorithmStep({
  value,
  onChange,
}: {
  value: AlgorithmSelection[];
  onChange: (v: AlgorithmSelection[]) => void;
}) {
  const { data: algorithmsData, isLoading } = useQuery({
    queryKey: ['containers', 0],
    queryFn: () => containerApi.getContainers({ type: 0, size: 100 }),
  });

  const algorithmContainers = algorithmsData?.items ?? [];

  // Track which container is being version-selected
  const [pendingContainerId, setPendingContainerId] = useState<number | null>(
    null
  );

  const { data: versionsData, isLoading: versionsLoading } = useQuery({
    queryKey: ['containerVersions', pendingContainerId],
    queryFn: () => containerApi.getVersions(pendingContainerId as number),
    enabled: !!pendingContainerId,
  });

  const pendingVersions: ContainerVersionResp[] = versionsData?.items ?? [];

  const handleAddAlgorithm = (containerId: number) => {
    setPendingContainerId(containerId);
  };

  const handleSelectVersion = (versionName: string) => {
    if (!pendingContainerId) return;
    const container = algorithmContainers.find(
      (c) => c.id === pendingContainerId
    );
    if (!container) return;

    // Avoid duplicates
    const exists = value.some(
      (a) => a.name === container.name && a.version === versionName
    );
    if (exists) {
      message.info('This algorithm version is already selected.');
      setPendingContainerId(null);
      return;
    }

    onChange([
      ...value,
      {
        containerId: container.id as number,
        name: container.name as string,
        version: versionName,
      },
    ]);
    setPendingContainerId(null);
  };

  const handleRemove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <Title level={5}>Select Algorithms (Optional)</Title>
      <Text type='secondary' style={{ display: 'block', marginBottom: 16 }}>
        Optionally choose algorithms to auto-run after data collection
        completes.
      </Text>

      {value.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {value.map((a, idx) => (
            <Tag
              key={`${a.name}-${a.version}`}
              closable
              onClose={() => handleRemove(idx)}
              style={{ marginBottom: 4 }}
            >
              {a.name}:{a.version}
            </Tag>
          ))}
        </div>
      )}

      <Form layout='vertical'>
        <Form.Item label='Algorithm'>
          <Select
            placeholder='Choose an algorithm to add...'
            loading={isLoading}
            value={pendingContainerId ?? undefined}
            onChange={handleAddAlgorithm}
            showSearch
            optionFilterProp='label'
            options={algorithmContainers.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
          />
        </Form.Item>

        {pendingContainerId && (
          <Form.Item label='Version'>
            <Select
              placeholder='Choose a version...'
              loading={versionsLoading}
              onChange={handleSelectVersion}
              options={pendingVersions.map((v) => ({
                value: v.name,
                label: v.name,
              }))}
            />
          </Form.Item>
        )}
      </Form>

      {value.length === 0 && !pendingContainerId && (
        <Alert
          type='info'
          showIcon
          message='No algorithms selected. You can skip this step.'
        />
      )}
    </div>
  );
}

export default InjectionWizard;

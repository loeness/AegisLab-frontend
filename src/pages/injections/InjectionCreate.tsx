import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  ChaosNode,
  ContainerResp,
  ContainerSpec,
  LabelItem,
  ProjectResp,
  SubmitInjectionReq,
} from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  Space,
} from 'antd';

import { useProjectContext } from '@/hooks/useProjectContext';
import { useProjects } from '@/hooks/useProjects';

import { AlgorithmSelector } from './components/AlgorithmSelector';
import { TagManager } from './components/TagManager';

import { containerApi } from '../../api/containers';
import { injectionApi } from '../../api/injections';
import { projectApi } from '../../api/projects';
import type { FaultParameter, FaultTypeConfig } from '../../types/api';

import './InjectionCreate.css';

const { Option } = Select;

interface InjectionFormData {
  project_id: number;
  name: string;
  description?: string;
  container_config: {
    pedestal_container_id: number;
    benchmark_container_id: number;
    algorithm_container_ids: number[];
  };
  fault_matrix: FaultTypeConfig[][];
  experiment_params: {
    duration: number;
    interval: number;
    parallel: boolean;
  };
  tags?: string[];
}

const InjectionCreate: React.FC = () => {
  const navigate = useNavigate();
  const { teamName, projectName, projectId } = useProjectContext();
  const [form] = Form.useForm<InjectionFormData>();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedFaultType, setSelectedFaultType] =
    useState<FaultTypeConfig | null>(null);
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<number[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [faultConfig, setFaultConfig] = useState<
    Record<string, string | number | boolean>
  >({});

  // Fetch projects
  const { data: projectsData, isLoading: projectsLoading } = useProjects({
    page: 1,
    size: 50,
  });
  const projects = projectsData?.items || [];

  // Fetch containers when project is selected
  const { data: containers = [], isLoading: containersLoading } = useQuery({
    queryKey: ['containers', selectedProject],
    queryFn: () => {
      if (!selectedProject) {
        return Promise.resolve({ items: [] });
      }
      return containerApi.getContainers({
        page: 1,
        size: 50,
      });
    },
    enabled: !!selectedProject,
    select: (data: { items?: ContainerResp[] }) => data.items || [],
  });

  // Fetch fault types metadata
  const { data: faultMetadata } = useQuery({
    queryKey: ['faultMetadata'],
    queryFn: () => injectionApi.getMetadata({ system: 'ts' }),
  });

  // Convert fault metadata to fault types array
  const faultTypes = useMemo(() => {
    if (!faultMetadata?.fault_type_map) return [];
    const configChildren = faultMetadata.config?.children || {};

    return Object.entries(
      faultMetadata.fault_type_map as Record<string, string>
    ).map(([key, description], index) => {
      const faultConfig = configChildren[key];
      const parameters = faultConfig?.children
        ? (
            Object.entries(faultConfig.children) as Array<[string, ChaosNode]>
          ).map(([paramName, paramNode]) => {
            // Filter out sentinel values like -999999 which indicate "no default"
            const defaultValue =
              paramNode.value === -999999 ? undefined : paramNode.value;

            return {
              name: paramName,
              type: (paramNode.range
                ? 'range'
                : typeof paramNode.value === 'number'
                  ? 'number'
                  : 'string') as FaultParameter['type'],
              label: paramNode.description || paramName,
              description: paramNode.description,
              required: false,
              default: defaultValue,
              min: paramNode.range?.[0],
              max: paramNode.range?.[1],
            };
          })
        : [];

      return {
        id: index,
        name: key,
        type: key,
        description: description || key,
        parameters,
      };
    });
  }, [faultMetadata]);

  // Group containers by type (API returns type as string: "algorithm", "benchmark", "pedestal")
  const groupedContainers = containers.reduce(
    (
      acc: {
        pedestals: ContainerResp[];
        benchmarks: ContainerResp[];
        algorithms: ContainerResp[];
      },
      container: ContainerResp
    ) => {
      if (container.type === 'pedestal') {
        acc.pedestals.push(container);
      } else if (container.type === 'benchmark') {
        acc.benchmarks.push(container);
      } else if (container.type === 'algorithm') {
        acc.algorithms.push(container);
      }
      return acc;
    },
    { pedestals: [], benchmarks: [], algorithms: [] }
  );

  const handleProjectChange = (projectId: number) => {
    setSelectedProject(projectId);
    form.setFieldsValue({
      container_config: {
        pedestal_container_id: undefined,
        benchmark_container_id: undefined,
        algorithm_container_ids: [],
      },
    });
  };

  const handleFaultTypeChange = (faultTypeName: string) => {
    const faultType = faultTypes.find((f) => f.name === faultTypeName);
    setSelectedFaultType(faultType || null);
    setFaultConfig({});
  };

  const handleAlgorithmChange = (algorithms: number[]) => {
    setSelectedAlgorithms(algorithms);
  };

  const handleTagChange = (newTags: string[]) => {
    setTags(newTags);
  };

  // Helper function to find container by ID
  const findContainerById = (
    containerId: number
  ): ContainerResp | undefined => {
    return containers.find((c: ContainerResp) => c.id === containerId);
  };

  // Helper function to convert container to ContainerSpec
  // Note: ContainerResp doesn't include version, using empty string (backend allows optional version)
  const toContainerSpec = (container: ContainerResp): ContainerSpec => ({
    name: container.name || '',
    version: '', // Empty string is valid - backend allows optional version
  });
  const handleSubmit = async (values: InjectionFormData) => {
    try {
      // Validate that a fault type has been selected
      if (!selectedFaultType) {
        message.error('Please select a fault type');
        return;
      }

      // Find the selected project
      const selectedProjectData = projects.find(
        (p: ProjectResp) => p.id === values.project_id
      );
      if (!selectedProjectData) {
        message.error('Please select a project');
        return;
      }

      // Find the selected containers
      const pedestalContainer = findContainerById(
        values.container_config.pedestal_container_id
      );
      const benchmarkContainer = findContainerById(
        values.container_config.benchmark_container_id
      );

      if (!pedestalContainer || !benchmarkContainer) {
        message.error('Please select pedestal and benchmark containers');
        return;
      }

      // Build algorithm specs
      const algorithmSpecs: ContainerSpec[] = selectedAlgorithms
        .map((id) => findContainerById(id))
        .filter((c): c is ContainerResp => c !== undefined)
        .map(toContainerSpec);

      // Convert tags to LabelItem format
      const labels: LabelItem[] = tags.map((tag) => ({
        key: tag,
        value: tag,
      }));

      // Build fault spec with configuration
      const faultSpec: ChaosNode = {
        name: selectedFaultType.name,
        description: selectedFaultType.type,
        children:
          Object.keys(faultConfig).length > 0
            ? Object.entries(faultConfig).reduce(
                (acc, [key, value]) => {
                  acc[key] = {
                    name: key,
                    value: typeof value === 'number' ? value : undefined,
                  };
                  return acc;
                },
                {} as { [key: string]: ChaosNode }
              )
            : undefined,
      };

      // Build the SDK request
      const payload: SubmitInjectionReq = {
        project_name: selectedProjectData.name || '',
        pedestal: toContainerSpec(pedestalContainer),
        benchmark: toContainerSpec(benchmarkContainer),
        algorithms: algorithmSpecs.length > 0 ? algorithmSpecs : undefined,
        // UI accepts seconds; API expects minutes, so convert with Math.ceil
        interval: Math.ceil(values.experiment_params.interval / 60),
        pre_duration: Math.ceil(values.experiment_params.duration / 60),
        labels: labels.length > 0 ? labels : undefined,
        specs: [[faultSpec]], // Single fault in a single batch
      };

      if (!projectId) {
        message.error('Project context not available');
        return;
      }
      await projectApi.submitInjection(projectId, payload);
      message.success('Fault injection submitted successfully');
      navigate(`/${teamName}/${projectName}/injections`);
    } catch (error) {
      message.error('Failed to submit fault injection');
      console.error('Submit injection error:', error);
    }
  };

  return (
    <div className='injection-create'>
      <Form
        form={form}
        layout='vertical'
        onFinish={handleSubmit}
        initialValues={{
          experiment_params: {
            duration: 300,
            interval: 60,
            parallel: false,
          },
        }}
      >
        <Row gutter={16}>
          {/* Left Panel - Configuration */}
          <Col span={12}>
            <Card size='small' title='Configuration'>
              <Form.Item
                name='project_id'
                label='Project'
                rules={[{ required: true, message: 'Required' }]}
              >
                <Select
                  placeholder='Select project'
                  loading={projectsLoading}
                  onChange={handleProjectChange}
                  size='small'
                >
                  {projects.map((project: ProjectResp) => (
                    <Option key={project.id} value={project.id}>
                      {project.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name={['container_config', 'pedestal_container_id']}
                label='Pedestal'
                rules={[{ required: true, message: 'Required' }]}
              >
                <Select
                  placeholder='Select'
                  loading={containersLoading}
                  disabled={!selectedProject}
                  size='small'
                >
                  {groupedContainers.pedestals.map(
                    (container: ContainerResp) => (
                      <Option key={container.id} value={container.id}>
                        {container.name}
                      </Option>
                    )
                  )}
                </Select>
              </Form.Item>

              <Form.Item
                name={['container_config', 'benchmark_container_id']}
                label='Benchmark'
                rules={[{ required: true, message: 'Required' }]}
              >
                <Select
                  placeholder='Select'
                  loading={containersLoading}
                  disabled={!selectedProject}
                  size='small'
                >
                  {groupedContainers.benchmarks.map(
                    (container: ContainerResp) => (
                      <Option key={container.id} value={container.id}>
                        {container.name}
                      </Option>
                    )
                  )}
                </Select>
              </Form.Item>

              <AlgorithmSelector
                algorithms={groupedContainers.algorithms}
                value={selectedAlgorithms}
                onChange={handleAlgorithmChange}
              />

              <Form.Item
                name={['experiment_params', 'duration']}
                label='Duration (s)'
                rules={[{ required: true }]}
              >
                <InputNumber
                  min={60}
                  max={3600}
                  style={{ width: '100%' }}
                  size='small'
                />
              </Form.Item>

              <Form.Item
                name={['experiment_params', 'interval']}
                label='Interval (s)'
                rules={[{ required: true }]}
              >
                <InputNumber
                  min={10}
                  max={600}
                  style={{ width: '100%' }}
                  size='small'
                />
              </Form.Item>

              <TagManager value={tags} onChange={handleTagChange} />
            </Card>
          </Col>

          {/* Right Panel - Fault Type & Configuration */}
          <Col span={12}>
            <Card size='small' title='Fault Injection'>
              <Form.Item label='Fault Type'>
                <Select
                  placeholder='Select fault type'
                  onChange={handleFaultTypeChange}
                  size='small'
                  showSearch
                  filterOption={(input, option) =>
                    String(option?.label || '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {faultTypes.map((fault) => (
                    <Option key={fault.name} value={fault.name}>
                      {fault.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {selectedFaultType &&
                selectedFaultType.parameters &&
                selectedFaultType.parameters.length > 0 && (
                  <>
                    {selectedFaultType.parameters.map((param) => (
                      <Form.Item
                        key={param.name}
                        label={param.label}
                        help={param.description}
                      >
                        {param.type === 'range' || param.type === 'number' ? (
                          <InputNumber
                            min={param.min}
                            max={param.max}
                            defaultValue={param.default as number}
                            style={{ width: '100%' }}
                            size='small'
                            onChange={(value) =>
                              setFaultConfig({
                                ...faultConfig,
                                [param.name]: value || 0,
                              })
                            }
                          />
                        ) : (
                          <Input
                            defaultValue={param.default as string}
                            size='small'
                            onChange={(e) =>
                              setFaultConfig({
                                ...faultConfig,
                                [param.name]: e.target.value,
                              })
                            }
                          />
                        )}
                      </Form.Item>
                    ))}
                  </>
                )}

              {selectedFaultType &&
                (!selectedFaultType.parameters ||
                  selectedFaultType.parameters.length === 0) && (
                  <div
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: 'var(--color-secondary-400)',
                      fontSize: '12px',
                    }}
                  >
                    No configurable parameters for this fault type
                  </div>
                )}
            </Card>
          </Col>
        </Row>

        {/* Submit Button */}
        <Row style={{ marginTop: 16 }}>
          <Col span={24}>
            <Space>
              <Button type='primary' htmlType='submit'>
                Create Injection
              </Button>
              <Button
                onClick={() =>
                  navigate(`/${teamName}/${projectName}/injections`)
                }
              >
                Cancel
              </Button>
            </Space>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default InjectionCreate;

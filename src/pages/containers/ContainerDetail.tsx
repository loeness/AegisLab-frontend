import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  ArrowLeftOutlined,
  BuildOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import type { ContainerVersionResp, LabelItem } from '@rcabench/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  message,
  Modal,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { containerApi } from '@/api/containers';

const { Title, Text } = Typography;

const ContainerDetail = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const containerId = Number(id);
  const [activeTab, setActiveTab] = useState('overview');
  const [helmUploadVersionId, setHelmUploadVersionId] = useState<number | null>(
    null
  );
  const [helmUploadType, setHelmUploadType] = useState<'chart' | 'values'>(
    'chart'
  );
  const [helmModalVisible, setHelmModalVisible] = useState(false);

  // Fetch container details
  const { data: container, isLoading } = useQuery({
    queryKey: ['container', containerId],
    queryFn: () => containerApi.getContainer(containerId),
    enabled: !!containerId,
  });

  // Fetch versions
  const { data: versionsData, isLoading: versionsLoading } = useQuery({
    queryKey: ['container-versions', containerId],
    queryFn: () => containerApi.getVersions(containerId),
    enabled: !!containerId,
  });
  const versions = versionsData?.items || [];

  // Build container mutation
  const buildMutation = useMutation({
    mutationFn: () =>
      containerApi.buildContainer({ container_id: containerId }),
    onSuccess: () => {
      message.success('Container build started');
      queryClient.invalidateQueries({
        queryKey: ['container', containerId],
      });
    },
    onError: () => {
      message.error('Failed to start container build');
    },
  });

  // Helm chart upload mutation
  const helmChartMutation = useMutation({
    mutationFn: ({
      versionId,
      formData,
    }: {
      versionId: number;
      formData: FormData;
    }) => containerApi.uploadHelmChart(containerId, versionId, formData),
    onSuccess: () => {
      message.success('Helm chart uploaded successfully');
      setHelmModalVisible(false);
      queryClient.invalidateQueries({
        queryKey: ['container-versions', containerId],
      });
    },
    onError: () => {
      message.error('Failed to upload Helm chart');
    },
  });

  // Helm values upload mutation
  const helmValuesMutation = useMutation({
    mutationFn: ({
      versionId,
      formData,
    }: {
      versionId: number;
      formData: FormData;
    }) => containerApi.uploadHelmValues(containerId, versionId, formData),
    onSuccess: () => {
      message.success('Helm values uploaded successfully');
      setHelmModalVisible(false);
      queryClient.invalidateQueries({
        queryKey: ['container-versions', containerId],
      });
    },
    onError: () => {
      message.error('Failed to upload Helm values');
    },
  });

  const handleBuild = () => {
    Modal.confirm({
      title: 'Build Container',
      content: `Are you sure you want to build container "${container?.name}"?`,
      okText: 'Build',
      onOk: () => buildMutation.mutate(),
    });
  };

  const handleHelmUpload = (file: File) => {
    if (!helmUploadVersionId) return;
    const formData = new FormData();
    formData.append('file', file);
    if (helmUploadType === 'chart') {
      helmChartMutation.mutate({ versionId: helmUploadVersionId, formData });
    } else {
      helmValuesMutation.mutate({ versionId: helmUploadVersionId, formData });
    }
  };

  const openHelmUpload = (versionId: number, type: 'chart' | 'values') => {
    setHelmUploadVersionId(versionId);
    setHelmUploadType(type);
    setHelmModalVisible(true);
  };

  const handleEdit = () => {
    navigate(`/containers/${containerId}/edit`);
  };

  const handleDelete = () => {
    Modal.confirm({
      title: '删除容器',
      content: `确定要删除容器 "${container?.name}" 吗？此操作不可撤销。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await containerApi.deleteContainer(containerId);
          message.success('容器删除成功');
          navigate('/containers');
        } catch (error) {
          message.error('容器删除失败');
        }
      },
    });
  };

  const getTypeColor = (type: string | undefined) => {
    switch (type) {
      case 'Pedestal':
        return 'blue';
      case 'Benchmark':
        return 'green';
      case 'Algorithm':
        return 'purple';
      default:
        return 'default';
    }
  };

  const versionColumns: ColumnsType<ContainerVersionResp> = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (version: string) => (
        <Badge
          count={version}
          style={{
            backgroundColor: 'var(--color-primary-500)',
            fontWeight: 'bold',
          }}
        />
      ),
    },
    {
      title: '镜像仓库',
      dataIndex: 'registry',
      key: 'registry',
      render: (registry: string) => (
        <Text code style={{ fontSize: '0.875rem' }}>
          {registry}
        </Text>
      ),
    },
    {
      title: '仓库名',
      dataIndex: 'repository',
      key: 'repository',
      render: (repository: string) => (
        <Tooltip title={repository}>
          <Text ellipsis style={{ maxWidth: 200 }}>
            {repository}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tag',
      key: 'tag',
      width: 120,
      render: (tag: string) => <Tag color='blue'>{tag}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => (
        <Space>
          <ClockCircleOutlined />
          <Text>{dayjs(date).format('YYYY-MM-DD HH:mm')}</Text>
        </Space>
      ),
    },
    {
      title: 'Helm',
      key: 'helm',
      width: 200,
      render: (_: unknown, record: ContainerVersionResp) => (
        <Space>
          <Button
            size='small'
            icon={<CloudUploadOutlined />}
            onClick={() =>
              record.id != null && openHelmUpload(record.id, 'chart')
            }
          >
            Chart
          </Button>
          <Button
            size='small'
            icon={<CloudUploadOutlined />}
            onClick={() =>
              record.id != null && openHelmUpload(record.id, 'values')
            }
          >
            Values
          </Button>
        </Space>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Card loading>
          <div style={{ minHeight: 400 }} />
        </Card>
      </div>
    );
  }

  if (!container) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type='secondary'>容器未找到</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/containers')}
          >
            返回列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {container.name}
          </Title>
        </Space>
      </div>

      {/* Actions */}
      <Card style={{ marginBottom: 24 }}>
        <Row justify='space-between' align='middle'>
          <Col>
            <Space>
              <Button
                type='primary'
                icon={<EditOutlined />}
                onClick={handleEdit}
              >
                编辑容器
              </Button>
              <Button
                icon={<BuildOutlined />}
                onClick={handleBuild}
                loading={buildMutation.isPending}
              >
                Build
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => navigate(`/containers/${containerId}/versions`)}
              >
                管理版本
              </Button>
            </Space>
          </Col>
          <Col>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              删除容器
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: '概览',
            children: (
              <>
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={16}>
                    <Card title='容器信息'>
                      <Descriptions column={2} bordered>
                        <Descriptions.Item label='ID'>
                          {container.id}
                        </Descriptions.Item>
                        <Descriptions.Item label='类型'>
                          <Tag
                            color={getTypeColor(container.type)}
                            style={{ fontWeight: 500, fontSize: '1rem' }}
                          >
                            {container.type}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label='可见性'>
                          <Tag color={container.is_public ? 'green' : 'orange'}>
                            {container.is_public ? '公开' : '私有'}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label='创建时间'>
                          <Space>
                            <ClockCircleOutlined />
                            {dayjs(container.created_at).format(
                              'YYYY-MM-DD HH:mm'
                            )}
                          </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label='更新时间'>
                          <Space>
                            <ClockCircleOutlined />
                            {dayjs(container.updated_at).format(
                              'YYYY-MM-DD HH:mm'
                            )}
                          </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label='标签'>
                          {container.labels?.length ? (
                            <Space wrap>
                              {container.labels.map(
                                (label: LabelItem, index: number) => (
                                  <Tag key={index} icon={<TagsOutlined />}>
                                    {label.key}: {label.value}
                                  </Tag>
                                )
                              )}
                            </Space>
                          ) : (
                            <Text type='secondary'>无标签</Text>
                          )}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                  <Col xs={24} lg={8}>
                    <Card title='快速统计'>
                      <Space direction='vertical' style={{ width: '100%' }}>
                        <div>
                          <Text type='secondary'>版本总数</Text>
                          <br />
                          <Title
                            level={5}
                            style={{
                              margin: 0,
                              color: 'var(--color-primary-500)',
                            }}
                          >
                            {versions.length}
                          </Title>
                        </div>
                        <Divider />
                        <div>
                          <Text type='secondary'>最新版本</Text>
                          <br />
                          <Text strong style={{ fontSize: '1.25rem' }}>
                            {versions[0]?.name || 'N/A'}
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  </Col>
                </Row>

                {container.readme && (
                  <Card title='README' style={{ marginTop: 16 }}>
                    <Text>{container.readme}</Text>
                  </Card>
                )}
              </>
            ),
          },
          {
            key: 'versions',
            label: '版本列表',
            children: (
              <Card
                title='容器版本'
                extra={
                  <Button
                    type='primary'
                    icon={<PlusOutlined />}
                    onClick={() =>
                      navigate(`/containers/${containerId}/versions`)
                    }
                  >
                    管理版本
                  </Button>
                }
              >
                <Table
                  rowKey='id'
                  columns={versionColumns}
                  dataSource={versions}
                  loading={versionsLoading}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) =>
                      `${range[0]}-${range[1]} / ${total} 个版本`,
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'usage',
            label: '使用说明',
            children: (
              <Card title='容器使用说明'>
                <Text>此容器可用于实验和评估。</Text>
                <Divider />
                <Text strong>如何使用此容器：</Text>
                <ul style={{ marginTop: 8 }}>
                  <li>在创建实验时选择此容器</li>
                  <li>选择适当的版本进行部署</li>
                  <li>容器将在执行期间自动加载</li>
                  <li>可以与其他容器和数据集组合使用</li>
                </ul>
              </Card>
            ),
          },
        ]}
      />

      {/* Helm Upload Modal */}
      <Modal
        title={`Upload Helm ${helmUploadType === 'chart' ? 'Chart' : 'Values'}`}
        open={helmModalVisible}
        onCancel={() => setHelmModalVisible(false)}
        footer={null}
      >
        <Upload.Dragger
          accept={helmUploadType === 'chart' ? '.tgz,.tar.gz' : '.yaml,.yml'}
          beforeUpload={(file) => {
            handleHelmUpload(file);
            return false; // Prevent auto upload
          }}
          showUploadList={false}
        >
          <p className='ant-upload-drag-icon'>
            <CloudUploadOutlined />
          </p>
          <p className='ant-upload-text'>
            Click or drag{' '}
            {helmUploadType === 'chart' ? 'chart (.tgz)' : 'values (.yaml)'}{' '}
            file to upload
          </p>
        </Upload.Dragger>
      </Modal>
    </div>
  );
};

export default ContainerDetail;

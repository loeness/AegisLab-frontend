import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import {
  DeleteOutlined,
  PlusOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import type { ContainerResp, ContainerVersionResp } from '@rcabench/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { containerApi } from '@/api/containers';
import type { ProjectOutletContext } from '@/hooks/useProjectContext';

const { Title, Text } = Typography;

/**
 * Algorithm List Page
 * Lists algorithm containers (type=algorithm) and supports registration + version management.
 */
const AlgorithmListPage: React.FC = () => {
  const { teamName, projectName } = useOutletContext<ProjectOutletContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] =
    useState<ContainerResp | null>(null);
  const [registerForm] = Form.useForm();
  const [versionForm] = Form.useForm();

  // Fetch algorithm containers (ContainerType.Algorithm = 0)
  const { data, isLoading } = useQuery({
    queryKey: ['containers', 'algorithm-list'],
    queryFn: () => containerApi.getContainers({ type: 0, size: 100 }),
  });

  const algorithms = data?.items ?? [];

  // Create algorithm container
  const createMutation = useMutation({
    mutationFn: (values: { name: string; readme?: string }) =>
      containerApi.createContainer({
        name: values.name,
        type: 0 as never, // ContainerType.Algorithm
        readme: values.readme,
        is_public: true,
      }),
    onSuccess: () => {
      message.success('Algorithm registered successfully');
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      setRegisterModalOpen(false);
      registerForm.resetFields();
    },
    onError: () => {
      message.error('Failed to register algorithm');
    },
  });

  // Create version
  const createVersionMutation = useMutation({
    mutationFn: (values: {
      containerId: number;
      name: string;
      image_ref: string;
      command?: string;
    }) =>
      containerApi.createVersion(values.containerId, {
        name: values.name,
        image_ref: values.image_ref,
        command: values.command,
      }),
    onSuccess: () => {
      message.success('Version created successfully');
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      setVersionModalOpen(false);
      versionForm.resetFields();
      setSelectedContainer(null);
    },
    onError: () => {
      message.error('Failed to create version');
    },
  });

  // Delete algorithm
  const deleteMutation = useMutation({
    mutationFn: (id: number) => containerApi.deleteContainer(id),
    onSuccess: () => {
      message.success('Algorithm deleted');
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
    onError: () => {
      message.error('Failed to delete algorithm');
    },
  });

  const columns: ColumnsType<ContainerResp> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Public',
      dataIndex: 'is_public',
      key: 'is_public',
      width: 80,
      align: 'center',
      render: (v: boolean) => (v ? 'Yes' : 'No'),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) =>
        date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      align: 'right',
      render: (_: unknown, record: ContainerResp) => (
        <Space>
          <Button
            size='small'
            onClick={() => {
              setSelectedContainer(record);
              setVersionModalOpen(true);
            }}
          >
            Add Version
          </Button>
          <Button
            size='small'
            onClick={() => navigate(`/admin/containers/${record.id}`)}
          >
            Detail
          </Button>
          <Popconfirm
            title='Delete this algorithm?'
            onConfirm={() => record.id && deleteMutation.mutate(record.id)}
            okText='Delete'
            okButtonProps={{ danger: true }}
          >
            <Button size='small' danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Expandable row to show versions
  const expandedRowRender = (record: ContainerResp) => {
    if (!record.id) return null;
    return <AlgorithmVersions containerId={record.id} />;
  };

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
          Algorithms
        </Title>
        <Space>
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => setRegisterModalOpen(true)}
          >
            Register Algorithm
          </Button>
          <Button
            icon={<RocketOutlined />}
            onClick={() =>
              navigate(`/${teamName}/${projectName}/executions/new`)
            }
          >
            Run Benchmark
          </Button>
        </Space>
      </Space>

      {/* Table */}
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : algorithms.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description='No algorithms registered yet'
          >
            <Button
              type='primary'
              icon={<PlusOutlined />}
              onClick={() => setRegisterModalOpen(true)}
            >
              Register Your First Algorithm
            </Button>
          </Empty>
        </Card>
      ) : (
        <Table
          dataSource={algorithms}
          columns={columns}
          rowKey='id'
          pagination={{ pageSize: 20, showSizeChanger: true }}
          expandable={{ expandedRowRender }}
        />
      )}

      {/* Register Algorithm Modal */}
      <Modal
        title='Register Algorithm'
        open={registerModalOpen}
        onCancel={() => {
          setRegisterModalOpen(false);
          registerForm.resetFields();
        }}
        onOk={() => registerForm.submit()}
        confirmLoading={createMutation.isPending}
        okText='Register'
      >
        <Form
          form={registerForm}
          layout='vertical'
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            name='name'
            label='Algorithm Name'
            rules={[
              { required: true, message: 'Please enter the algorithm name' },
            ]}
          >
            <Input placeholder='e.g. MicroRCA' />
          </Form.Item>
          <Form.Item name='readme' label='Description'>
            <Input.TextArea
              rows={3}
              placeholder='Brief description of the algorithm'
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Version Modal */}
      <Modal
        title={`Add Version — ${selectedContainer?.name ?? ''}`}
        open={versionModalOpen}
        onCancel={() => {
          setVersionModalOpen(false);
          versionForm.resetFields();
          setSelectedContainer(null);
        }}
        onOk={() => versionForm.submit()}
        confirmLoading={createVersionMutation.isPending}
        okText='Create Version'
      >
        <Form
          form={versionForm}
          layout='vertical'
          onFinish={(values) => {
            if (!selectedContainer?.id) return;
            createVersionMutation.mutate({
              containerId: selectedContainer.id,
              ...values,
            });
          }}
        >
          <Form.Item
            name='name'
            label='Version Name'
            rules={[
              { required: true, message: 'Please enter the version name' },
            ]}
          >
            <Input placeholder='e.g. 1.0.0' />
          </Form.Item>
          <Form.Item
            name='image_ref'
            label='Docker Image'
            rules={[
              {
                required: true,
                message: 'Please enter the Docker image reference',
              },
            ]}
          >
            <Input placeholder='e.g. registry.example.com/microrca:1.0.0' />
          </Form.Item>
          <Form.Item name='command' label='Command (optional)'>
            <Input placeholder='e.g. python main.py' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

/**
 * Inline component showing versions for an expanded algorithm row.
 */
const AlgorithmVersions: React.FC<{ containerId: number }> = ({
  containerId,
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ['container-versions', containerId],
    queryFn: () => containerApi.getVersions(containerId, { size: 50 }),
  });

  const versions = data?.items ?? [];

  if (isLoading) return <Skeleton active paragraph={{ rows: 1 }} />;

  if (versions.length === 0) {
    return <Text type='secondary'>No versions registered yet.</Text>;
  }

  const cols: ColumnsType<ContainerVersionResp> = [
    { title: 'Version', dataIndex: 'name', key: 'name', width: 120 },
    {
      title: 'Image',
      dataIndex: 'image_ref',
      key: 'image_ref',
      render: (v: string) => (
        <Text code style={{ fontSize: 12 }}>
          {v}
        </Text>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (d: string) => (d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'),
    },
  ];

  return (
    <Table
      dataSource={versions}
      columns={cols}
      rowKey='id'
      pagination={false}
      size='small'
    />
  );
};

export default AlgorithmListPage;

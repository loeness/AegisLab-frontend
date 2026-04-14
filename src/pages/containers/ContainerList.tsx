import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ContainerResp, ContainerType } from '@rcabench/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Input,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { containerApi } from '@/api/containers';

const { Title } = Typography;

const ContainerList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  // Fetch containers
  const { data, isLoading } = useQuery({
    queryKey: ['containers', { page, size, type: typeFilter }],
    queryFn: () =>
      containerApi.getContainers({
        page,
        size,
        type: typeFilter as ContainerType | undefined,
      }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => containerApi.deleteContainer(id),
    onSuccess: () => {
      message.success('Container deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
    onError: () => {
      message.error('Failed to delete container');
    },
  });

  const columns: ColumnsType<ContainerResp> = [
    {
      title: 'Container Name',
      dataIndex: 'name',
      key: 'name',
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) =>
        record.name?.toLowerCase().includes((value as string).toLowerCase()) ??
        false,
      render: (text: string) => (
        <Typography.Text strong style={{ color: 'var(--color-primary-600)' }}>
          {text}
        </Typography.Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          Pedestal: 'blue',
          Benchmark: 'green',
          Algorithm: 'purple',
        };
        return <Tag color={colorMap[type] || 'default'}>{type}</Tag>;
      },
    },
    {
      title: 'Visibility',
      dataIndex: 'is_public',
      key: 'is_public',
      width: 100,
      render: (isPublic: boolean) => (
        <Tag color={isPublic ? 'green' : 'orange'}>
          {isPublic ? 'Public' : 'Private'}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status || '-'}
        </Tag>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type='link'
            size='small'
            onClick={() => navigate(`/containers/${record.id}`)}
          >
            View
          </Button>
          <Button
            type='link'
            size='small'
            onClick={() => navigate(`/containers/${record.id}/edit`)}
          >
            Edit
          </Button>
          <Popconfirm
            title='Confirm Deletion'
            description='Are you sure you want to delete this container?'
            onConfirm={() =>
              record.id !== undefined && deleteMutation.mutate(record.id)
            }
            okText='Confirm'
            cancelText='Cancel'
          >
            <Button
              type='link'
              size='small'
              danger
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className='container-list page-container'>
      <div
        className='page-header'
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <Title level={4} className='page-title' style={{ margin: 0 }}>
          Containers
        </Title>
        <Space>
          <Select
            placeholder='Container Type'
            style={{ width: 150 }}
            allowClear
            value={typeFilter}
            onChange={(value) => setTypeFilter(value)}
            options={[
              { label: 'Pedestal', value: 'Pedestal' },
              { label: 'Benchmark', value: 'Benchmark' },
              { label: 'Algorithm', value: 'Algorithm' },
            ]}
          />
          <Input
            placeholder='Search container name'
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => navigate('/containers/new')}
          >
            Create Container
          </Button>
        </Space>
      </div>

      <Card className='table-card'>
        <Table
          columns={columns}
          dataSource={data?.items || []}
          rowKey='id'
          loading={isLoading}
          className='containers-table'
          pagination={{
            current: page,
            pageSize: size,
            total: data?.pagination?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Total ${total} containers`,
            onChange: (newPage, newSize) => {
              setPage(newPage);
              setSize(newSize);
            },
          }}
        />
      </Card>
    </div>
  );
};

export default ContainerList;

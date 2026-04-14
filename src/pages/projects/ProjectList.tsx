import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ProjectResp } from '@rcabench/client';
import {
  Button,
  Card,
  Col,
  Input,
  message,
  Popconfirm,
  Row,
  Space,
  Table,
  type TablePaginationConfig,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';

import { projectApi } from '@/api/projects';
import { useProjects } from '@/hooks/useProjects';

import CreateProjectModal from './CreateProjectModal';

import './ProjectList.css';

const { Title, Text } = Typography;
const { Search } = Input;

const ProjectList = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const {
    data: projectsData,
    isLoading,
    refetch,
  } = useProjects({
    page: pagination.current,
    size: pagination.pageSize,
    queryKey: [
      'projects',
      String(pagination.current),
      String(pagination.pageSize),
      searchText,
    ],
  });

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    setPagination({
      ...pagination,
      current: newPagination.current || 1,
      pageSize: newPagination.pageSize || 10,
    });
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    setPagination({ ...pagination, current: 1 });
  };

  const handleDelete = async (id: number) => {
    try {
      await projectApi.deleteProject(id);
      message.success('Project deleted');
      void refetch();
    } catch {
      message.error('Failed to delete project');
    }
  };

  const handleCreateSuccess = (project: ProjectResp) => {
    setCreateModalOpen(false);
    if (project.id) {
      navigate(`/projects/${project.id}`);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ProjectResp) => (
        <Button
          type='link'
          style={{ padding: 0 }}
          onClick={() => navigate(`/projects/${record.id}`)}
        >
          <Text strong>{name}</Text>
        </Button>
      ),
    },
    {
      title: 'Visibility',
      dataIndex: 'is_public',
      key: 'is_public',
      width: 120,
      render: (isPublic: boolean) =>
        isPublic ? (
          <Tag icon={<EyeOutlined />} color='blue'>
            Public
          </Tag>
        ) : (
          <Tag icon={<EyeInvisibleOutlined />}>Private</Tag>
        ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => (
        <Text>{date ? dayjs(date).format('MMM D, YYYY') : '-'}</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: ProjectResp) => (
        <Space>
          <Button
            type='text'
            icon={<EditOutlined />}
            onClick={() => navigate(`/projects/${record.id}?tab=settings`)}
            title='Edit Project'
          />
          <Popconfirm
            title='Delete this project?'
            description='This action cannot be undone.'
            onConfirm={() => record.id && handleDelete(record.id)}
            okText='Delete'
            okButtonProps={{ danger: true }}
          >
            <Button
              type='text'
              danger
              icon={<DeleteOutlined />}
              title='Delete Project'
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className='project-list'>
      {/* Page Header */}
      <div className='page-header'>
        <div className='page-header-left'>
          <Title level={4} className='page-title'>
            Projects
          </Title>
          <Text type='secondary'>Manage your RCA benchmarking projects</Text>
        </div>
        <Button
          type='primary'
          size='large'
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
          className='create-button'
        >
          New Project
        </Button>
      </div>

      {/* Search */}
      <Card className='search-card'>
        <Row align='middle'>
          <Col flex='auto'>
            <Search
              placeholder='Search projects by name...'
              allowClear
              enterButton={<SearchOutlined />}
              size='large'
              onSearch={handleSearch}
              style={{ maxWidth: 400 }}
            />
          </Col>
        </Row>
      </Card>

      {/* Projects Table */}
      <Card className='table-card'>
        <Table
          columns={columns}
          dataSource={projectsData?.items || []}
          loading={isLoading}
          pagination={{
            ...pagination,
            total: projectsData?.pagination?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Total ${total} projects`,
          }}
          onChange={handleTableChange}
          rowKey='id'
          className='projects-table'
          rowClassName='project-row'
        />
      </Card>

      {/* Create Project Modal */}
      <CreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};

export default ProjectList;

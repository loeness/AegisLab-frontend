import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { PageSize } from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { teamApi } from '@/api/teams';
import type { ProjectResp, Team } from '@/types/api';

const { Text, Title } = Typography;
const { Search } = Input;

interface ProjectsTabProps {
  team: Team;
}

const ProjectsTab: React.FC<ProjectsTabProps> = ({ team }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Fetch team projects
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['team', 'projects', team.id, page, search],
    queryFn: () =>
      teamApi.listTeamProjects(team.id, {
        page,
        size: PageSize.Small,
      }),
  });

  const handleCreateProject = () => {
    navigate('/projects/new');
  };

  const columns: ColumnsType<ProjectResp> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Text
          strong
          style={{ cursor: 'pointer', color: 'var(--color-primary)' }}
          onClick={() => navigate(`/${team.name}/${name}/workspace`)}
        >
          {name}
        </Text>
      ),
    },
    {
      title: 'Last Injection',
      dataIndex: 'last_injection_at',
      key: 'last_injection_at',
      render: (_: unknown, record: ProjectResp) => {
        if (!record.last_injection_at) return '-';
        const d = new Date(record.last_injection_at);
        return d.toLocaleDateString('en-CA');
      },
    },
    {
      title: 'Last Execution',
      dataIndex: 'last_execution_at',
      key: 'last_execution_at',
      render: (_: unknown, record: ProjectResp) => {
        if (!record.last_execution_at) return '-';
        const d = new Date(record.last_execution_at);
        return d.toLocaleDateString('en-CA');
      },
    },
    {
      title: 'Project Visibility',
      dataIndex: 'visibility',
      key: 'visibility',
      render: (visibility: string) => (
        <Tag
          icon={<TeamOutlined />}
          color={
            visibility === 'team'
              ? 'blue'
              : visibility === 'public'
                ? 'green'
                : 'default'
          }
        >
          {visibility === 'team'
            ? 'Team'
            : visibility === 'public'
              ? 'Public'
              : 'Private'}
        </Tag>
      ),
    },
    {
      title: 'Runs',
      dataIndex: 'run_count',
      key: 'run_count',
      render: (_: unknown, record: ProjectResp) => {
        const injectionCount = record.injection_count || 0;
        const executionCount = record.execution_count || 0;
        const totalRuns = injectionCount + executionCount;
        return (
          <Text>
            {totalRuns} ({injectionCount}/{executionCount})
          </Text>
        );
      },
    },
  ];

  return (
    <div className='projects-tab'>
      {/* Header */}
      <Title level={5} style={{ marginBottom: 16 }}>
        Projects
      </Title>

      {/* Search and Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Search
          placeholder='Search by project name'
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ width: 300 }}
          allowClear
        />
        <Button
          type='primary'
          icon={<PlusOutlined />}
          onClick={handleCreateProject}
        >
          New project
        </Button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={projectsData?.items || []}
        rowKey='id'
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: PageSize.Small,
          total: projectsData?.total || 0,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (total) => `showing ${total}`,
        }}
      />
    </div>
  );
};

export default ProjectsTab;

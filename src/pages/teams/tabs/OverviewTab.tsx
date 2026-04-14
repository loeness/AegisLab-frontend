import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FileTextOutlined, FolderOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Empty, Input, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import { teamApi } from '@/api/teams';
import type { ProjectResp, Team } from '@/types/api';

const { Text, Title, Paragraph } = Typography;
const { Search } = Input;

interface OverviewTabProps {
  team: Team;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ team }) => {
  const navigate = useNavigate();
  const [projectsSearch, setProjectsSearch] = useState('');
  const [projectsPage, setProjectsPage] = useState(1);
  const pageSize = 10;

  // Fetch team projects
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['team', 'projects', team.id, projectsPage],
    queryFn: () =>
      teamApi.listTeamProjects(team.id, {
        page: projectsPage,
        size: pageSize,
      }),
  });

  // Fetch team members
  const { data: membersData } = useQuery({
    queryKey: ['team', 'members', team.id, 1],
    queryFn: () => teamApi.getTeamMembers(team.id, { page: 1, size: 5 }),
  });

  const projectColumns: ColumnsType<ProjectResp> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Text
          strong
          style={{ cursor: 'pointer', color: 'var(--color-primary)' }}
          onClick={() => navigate(`/${team.name}/${name}`)}
        >
          {name}
        </Text>
      ),
    },
    {
      title: 'Visibility',
      dataIndex: 'is_public',
      key: 'is_public',
      render: (isPublic: boolean) => (
        <span>{isPublic ? 'Public' : 'Private'}</span>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const months = Math.floor(days / 30);
        if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        return 'Today';
      },
    },
  ];

  const filteredProjects = (projectsData?.items || []).filter(
    (p) =>
      !projectsSearch ||
      p.name?.toLowerCase().includes(projectsSearch.toLowerCase())
  );

  return (
    <div className='overview-tab'>
      {/* About Section */}
      <Card style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            About
          </Title>
          <Button type='link' size='small'>
            Edit
          </Button>
        </div>
        <Card
          style={{
            background: 'var(--color-bg-secondary, #fafafa)',
            border: 'none',
          }}
        >
          {team.description ? (
            <div className='markdown-content'>
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                {team.description}
              </Paragraph>
            </div>
          ) : (
            <Empty
              image={
                <FileTextOutlined
                  style={{ fontSize: 48, color: 'var(--color-secondary-300)' }}
                />
              }
              description={
                <span>
                  <Text strong>Add a team description</Text>
                  <br />
                  <Text type='secondary'>
                    Describe what your team works on and its mission.
                  </Text>
                </span>
              }
            >
              <Button type='link'>Add description</Button>
            </Empty>
          )}
        </Card>
      </Card>

      {/* Members Preview */}
      {membersData && membersData.items.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>
            Members ({membersData.total})
          </Title>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {membersData.items.map((member) => (
              <div key={member.user_id} style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: 13 }}>
                  {member.full_name || member.username}
                </Text>
                <br />
                <Text type='secondary' style={{ fontSize: 12 }}>
                  {member.role_name}
                </Text>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Projects Section */}
      <Card>
        <Title level={5} style={{ marginBottom: 16 }}>
          <FolderOutlined style={{ marginRight: 8 }} />
          Projects
        </Title>
        <div style={{ marginBottom: 16 }}>
          <Search
            placeholder='Search projects'
            value={projectsSearch}
            onChange={(e) => setProjectsSearch(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </div>
        {filteredProjects.length > 0 || projectsLoading ? (
          <Table
            columns={projectColumns}
            dataSource={filteredProjects}
            rowKey='id'
            loading={projectsLoading}
            pagination={{
              current: projectsPage,
              pageSize,
              total: projectsData?.total || 0,
              onChange: setProjectsPage,
              showSizeChanger: false,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total}`,
            }}
          />
        ) : (
          <Empty
            image={
              <FolderOutlined
                style={{ fontSize: 48, color: 'var(--color-secondary-300)' }}
              />
            }
            description={
              <span>
                <Text strong>No projects yet</Text>
                <br />
                <Text type='secondary'>Create a project to get started.</Text>
              </span>
            }
          >
            <Button
              type='link'
              onClick={() => navigate(`/${team.name}/projects`)}
            >
              View all projects
            </Button>
          </Empty>
        )}
      </Card>
    </div>
  );
};

export default OverviewTab;

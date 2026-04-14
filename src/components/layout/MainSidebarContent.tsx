import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ContainerOutlined,
  DatabaseOutlined,
  FolderOutlined,
  HomeOutlined,
  OrderedListOutlined,
  PlusOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { type ProjectResp } from '@rcabench/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Form,
  Input,
  Menu,
  type MenuProps,
  message,
  Modal,
} from 'antd';

import { teamApi } from '@/api/teams';
import { useProjects } from '@/hooks/useProjects';
import { useProjectTeamMap } from '@/hooks/useProjectTeamMap';
import { useTeams } from '@/hooks/useTeams';
import { useAuthStore } from '@/store/auth';

import './MainSidebarContent.css';

interface MainSidebarContentProps {
  onNavigate?: () => void;
}

/**
 * Main sidebar content component
 * Reusable sidebar content for both MainLayout and WorkspaceLayout drawer
 */
const MainSidebarContent: React.FC<MainSidebarContentProps> = ({
  onNavigate,
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [createTeamModalVisible, setCreateTeamModalVisible] = useState(false);
  const [createTeamForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch recent projects
  const { data: projectsData } = useProjects({
    page: 1,
    size: 5,
    queryKey: ['projects', 'sidebar'],
  });

  // Fetch teams
  const { data: teamsData } = useTeams({
    queryKey: ['teams', 'sidebar'],
  });

  // Project name → team name mapping for navigation
  const projectTeamMap = useProjectTeamMap();

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      teamApi.createTeam(data),
    onSuccess: () => {
      message.success('Team created successfully');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setCreateTeamModalVisible(false);
      createTeamForm.resetFields();
    },
    onError: () => {
      message.error('Failed to create team');
    },
  });

  const recentProjects = useMemo(
    () => projectsData?.items || [],
    [projectsData?.items]
  );

  const teams = useMemo(() => teamsData?.items || [], [teamsData?.items]);

  // Check if user has admin privileges
  // TODO: Update this check once the UserInfo type exposes a role/is_superuser field
  const isAdmin = !!(user as Record<string, unknown>)?.is_superuser;

  // Menu items
  const menuItems: MenuProps['items'] = [
    {
      key: '/home',
      icon: <HomeOutlined />,
      label: 'Home',
    },
    {
      type: 'divider',
      style: { margin: '12px 0 8px' },
    },
    // Projects section header
    {
      key: 'projects-header',
      type: 'group',
      label: (
        <span
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            padding: '0 8px',
          }}
        >
          <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Projects
          </span>
          <Button
            type='link'
            size='small'
            onClick={(e) => {
              e.stopPropagation();
              navigate('/projects');
              onNavigate?.();
            }}
            style={{ padding: 0, fontSize: 12, height: 'auto' }}
          >
            View all
          </Button>
        </span>
      ),
    },
    ...recentProjects.map((project: ProjectResp) => ({
      key: `/project:${project.name}`,
      icon: <FolderOutlined />,
      label: project.name,
    })),
    {
      type: 'divider',
      style: { margin: '12px 0 8px' },
    },
    // Teams section header
    {
      key: 'teams-header',
      type: 'group',
      label: (
        <span
          style={{
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            padding: '0 8px',
          }}
        >
          Teams
        </span>
      ),
    },
    // Teams list
    ...teams.map((team) => ({
      key: `/${team.name}`,
      icon: <TeamOutlined />,
      label: team.name,
    })),
    {
      key: 'action:create-team',
      icon: <PlusOutlined />,
      label: 'Create a team',
    },
    {
      type: 'divider',
      style: { margin: '12px 0 8px' },
    },
    {
      key: '/tasks',
      icon: <OrderedListOutlined />,
      label: 'Tasks',
    },
    // Admin section (conditionally visible)
    ...(isAdmin
      ? [
          {
            type: 'divider' as const,
            style: { margin: '12px 0 8px' },
          },
          {
            key: 'admin-header',
            type: 'group' as const,
            label: (
              <span
                style={{
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  padding: '0 8px',
                }}
              >
                Admin
              </span>
            ),
          },
          {
            key: '/admin/users',
            icon: <UserOutlined />,
            label: 'Users',
          },
          {
            key: '/admin/containers',
            icon: <ContainerOutlined />,
            label: 'Containers',
          },
          {
            key: '/admin/datasets',
            icon: <DatabaseOutlined />,
            label: 'Datasets',
          },
          {
            key: '/admin/system',
            icon: <SettingOutlined />,
            label: 'System',
          },
        ]
      : []),
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key.startsWith('action:')) {
      // Handle action items
      if (key === 'action:create-team') {
        setCreateTeamModalVisible(true);
      }
      return;
    }
    if (key.startsWith('/project:')) {
      // Project items use a special prefix to avoid route conflicts
      const projectName = key.replace('/project:', '');
      const teamName = projectTeamMap.get(projectName);
      if (teamName) {
        navigate(`/${teamName}/${projectName}`);
      } else {
        // Fallback: navigate to projects list if team is unknown
        navigate('/projects');
      }
      onNavigate?.();
      return;
    }
    if (key.startsWith('/')) {
      navigate(key);
      onNavigate?.();
    }
  };

  return (
    <div className='main-sidebar-content'>
      <Menu
        mode='inline'
        items={menuItems}
        onClick={handleMenuClick}
        className='main-sidebar-menu'
      />
      <div className='main-sidebar-footer'>
        <div className='system-status'>
          <div className='status-indicator' />
          <span className='status-text'>System Online</span>
        </div>
      </div>

      {/* Create Team Modal */}
      <Modal
        title='Create a Team'
        open={createTeamModalVisible}
        onCancel={() => {
          setCreateTeamModalVisible(false);
          createTeamForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={createTeamForm}
          layout='vertical'
          onFinish={(values: { name: string; description?: string }) => {
            createTeamMutation.mutate(values);
          }}
        >
          <Form.Item
            name='name'
            label='Team Name'
            rules={[
              { required: true, message: 'Please enter a team name' },
              { max: 128, message: 'Team name must be at most 128 characters' },
            ]}
          >
            <Input placeholder='my-team' />
          </Form.Item>
          <Form.Item name='description' label='Description'>
            <Input.TextArea
              placeholder='Optional description for your team'
              rows={3}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button
              onClick={() => {
                setCreateTeamModalVisible(false);
                createTeamForm.resetFields();
              }}
              style={{ marginRight: 8 }}
            >
              Cancel
            </Button>
            <Button
              type='primary'
              htmlType='submit'
              loading={createTeamMutation.isPending}
            >
              Create
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MainSidebarContent;

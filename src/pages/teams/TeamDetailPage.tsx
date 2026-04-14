import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  AppstoreOutlined,
  FolderOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Result,
  Select,
  Space,
  Spin,
  Tabs,
} from 'antd';

import { roleApi } from '@/api/roles';
import { teamApi } from '@/api/teams';
import TeamSidebar from '@/components/teams/TeamSidebar';
import { useTeamContext } from '@/hooks/useTeamContext';

import OverviewTab from './tabs/OverviewTab';
import ProjectsTab from './tabs/ProjectsTab';
import SettingsTab from './tabs/SettingsTab';
import UsersTab from './tabs/UsersTab';

import './TeamDetailPage.css';

const TeamDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamName } = useParams<{ teamName: string }>();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { team, isLoading, error } = useTeamContext();

  // Fetch available roles for the invite form
  const { data: rolesData } = useQuery({
    queryKey: ['roles', 'team-scope'],
    queryFn: () => roleApi.getRoles({ page: 1, size: 100, scope: 'team' }),
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: (data: { username: string; role_id: number }) =>
      teamApi.addMember(team?.id || 0, data),
    onSuccess: () => {
      message.success('Member invited successfully');
      queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
      setInviteModalVisible(false);
      inviteForm.resetFields();
    },
    onError: () => {
      message.error('Failed to invite member');
    },
  });

  const handleInviteSubmit = (values: {
    username: string;
    role_id: number;
  }) => {
    addMemberMutation.mutate(values);
  };

  // Get active tab from URL path
  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTab = pathParts[1] || 'overview'; // /:teamName/:tab

  const handleTabChange = (key: string) => {
    navigate(`/${teamName}/${key}`);
  };

  const handleInvite = () => {
    // Navigate to users tab
    navigate(`/${teamName}/users`);
    setInviteModalVisible(true);
  };

  const handleNavigateToSettings = () => {
    navigate(`/${teamName}/settings`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='team-detail-page'>
        <div className='team-detail-loading'>
          <Spin size='large' />
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !team) {
    return (
      <div className='team-detail-page'>
        <div className='team-not-found'>
          <Result
            status='404'
            title='Team not found'
            subTitle="The team you are looking for does not exist or you don't have access to it."
            extra={
              <Button type='primary' onClick={() => navigate('/home')}>
                Go Home
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <AppstoreOutlined />
          Overview
        </span>
      ),
      children: <OverviewTab team={team} />,
    },
    {
      key: 'projects',
      label: (
        <span>
          <FolderOutlined />
          Projects
        </span>
      ),
      children: <ProjectsTab team={team} />,
    },
    {
      key: 'users',
      label: (
        <span>
          <TeamOutlined />
          Users
        </span>
      ),
      children: <UsersTab team={team} onInvite={handleInvite} />,
    },
    {
      key: 'settings',
      label: (
        <span>
          <SettingOutlined />
          Settings
        </span>
      ),
      children: <SettingsTab team={team} />,
    },
  ];

  return (
    <div className='team-detail-page'>
      {/* Sidebar */}
      <TeamSidebar
        team={team}
        onInvite={handleInvite}
        onNavigateToSettings={handleNavigateToSettings}
      />

      {/* Main Content */}
      <div className='team-detail-content'>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          className='team-detail-tabs'
        />
      </div>

      {/* Invite Modal */}
      <Modal
        title='Invite Team Members'
        open={inviteModalVisible}
        onCancel={() => {
          setInviteModalVisible(false);
          inviteForm.resetFields();
        }}
        footer={null}
      >
        <Form form={inviteForm} layout='vertical' onFinish={handleInviteSubmit}>
          <Form.Item
            name='username'
            label='Username'
            rules={[{ required: true, message: 'Please enter the username' }]}
          >
            <Input placeholder='username' />
          </Form.Item>
          <Form.Item
            name='role_id'
            label='Role'
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select
              placeholder='Select a role'
              options={
                rolesData?.items?.length
                  ? rolesData.items.map(
                      (role: {
                        id?: number;
                        display_name?: string;
                        name?: string;
                      }) => ({
                        value: role.id,
                        label:
                          role.display_name || role.name || `Role ${role.id}`,
                      })
                    )
                  : [
                      // Fallback when roles API is unavailable
                      { value: 1, label: 'Admin' },
                      { value: 2, label: 'Member' },
                    ]
              }
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setInviteModalVisible(false);
                  inviteForm.resetFields();
                }}
              >
                Cancel
              </Button>
              <Button
                type='primary'
                htmlType='submit'
                loading={addMemberMutation.isPending}
              >
                Invite
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TeamDetailPage;

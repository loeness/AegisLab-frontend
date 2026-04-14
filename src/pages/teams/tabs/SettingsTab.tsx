import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, message, Modal, Typography } from 'antd';

import { teamApi } from '@/api/teams';
import type { Team } from '@/types/api';

const { Text, Title, Paragraph } = Typography;

interface SettingsTabProps {
  team: Team;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ team }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [teamForm] = Form.useForm();

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: (data: {
      name?: string;
      description?: string;
      is_public?: boolean;
    }) => teamApi.updateTeam(team.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'byName'] });
      message.success('Team settings updated');
    },
    onError: () => {
      message.error('Failed to update team settings');
    },
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: () => teamApi.deleteTeam(team.id),
    onSuccess: () => {
      message.success('Team deleted');
      navigate('/home');
    },
    onError: () => {
      message.error('Failed to delete team');
    },
  });

  const handleUpdateTeam = (values: { name: string; description: string }) => {
    updateTeamMutation.mutate({
      name: values.name,
      description: values.description,
    });
  };

  const handleDeleteTeam = () => {
    if (deleteConfirmText === team.name) {
      deleteTeamMutation.mutate();
    }
  };

  return (
    <div className='settings-tab'>
      {/* Header */}
      <Title level={4}>
        Team Settings for {team.display_name || team.name}
      </Title>
      <Paragraph type='secondary' style={{ marginBottom: 24 }}>
        Only admins can update team settings
      </Paragraph>

      {/* Team Profile Section */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={5} style={{ marginBottom: 16 }}>
          Team profile
        </Title>
        <Form
          form={teamForm}
          layout='vertical'
          onFinish={handleUpdateTeam}
          initialValues={{
            name: team.name,
            description: team.description || '',
          }}
        >
          <Form.Item
            label='Team Name'
            name='name'
            rules={[{ required: true, message: 'Please enter team name' }]}
          >
            <Input placeholder='Team name' />
          </Form.Item>
          <Form.Item label='Description' name='description'>
            <Input.TextArea rows={4} placeholder='Describe your team' />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type='primary'
              htmlType='submit'
              loading={updateTeamMutation.isPending}
            >
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Danger Zone */}
      <Card
        style={{
          borderColor: 'var(--color-error)',
        }}
      >
        <Title
          level={5}
          style={{ color: 'var(--color-error)', marginBottom: 16 }}
        >
          <ExclamationCircleOutlined style={{ marginRight: 8 }} />
          Danger Zone
        </Title>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0',
            borderTop: '1px solid var(--color-secondary-100)',
          }}
        >
          <div>
            <Text strong>Delete Team</Text>
            <br />
            <Text type='secondary'>
              Once deleted, all team data will be permanently removed.
            </Text>
          </div>
          <Button danger onClick={() => setDeleteModalVisible(true)}>
            Delete Team
          </Button>
        </div>
      </Card>

      {/* Delete Team Modal */}
      <Modal
        title='Delete Team'
        open={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setDeleteConfirmText('');
        }}
        footer={[
          <Button
            key='cancel'
            onClick={() => {
              setDeleteModalVisible(false);
              setDeleteConfirmText('');
            }}
          >
            Cancel
          </Button>,
          <Button
            key='delete'
            danger
            type='primary'
            disabled={deleteConfirmText !== team.name}
            loading={deleteTeamMutation.isPending}
            onClick={handleDeleteTeam}
          >
            Delete Team
          </Button>,
        ]}
      >
        <Paragraph>
          This action cannot be undone. This will permanently delete the{' '}
          <Text strong>{team.name}</Text> team and all associated data.
        </Paragraph>
        <Paragraph>
          Please type <Text strong>{team.name}</Text> to confirm.
        </Paragraph>
        <Input
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder={team.name}
        />
      </Modal>
    </div>
  );
};

export default SettingsTab;

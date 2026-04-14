import { useNavigate, useOutletContext } from 'react-router-dom';

import {
  DeleteOutlined,
  ExclamationCircleOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ProjectDetailResp } from '@rcabench/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Space,
  Switch,
  Typography,
} from 'antd';

import { projectApi } from '@/api/projects';
import type { ProjectOutletContext } from '@/hooks/useProjectContext';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * Project Settings Page
 * Manage project configuration, visibility, and danger zone actions
 */
const ProjectSettings: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { project, projectId, projectName, teamName } =
    useOutletContext<ProjectOutletContext>();
  const [form] = Form.useForm();

  // Update project mutation
  const updateMutation = useMutation({
    mutationFn: (data: {
      name?: string;
      description?: string;
      is_public?: boolean;
    }) => projectApi.updateProject(projectId, data),
    onSuccess: () => {
      message.success('Project updated successfully');
      queryClient.invalidateQueries({
        queryKey: ['project', 'byName', projectName],
      });
    },
    onError: () => {
      message.error('Failed to update project');
    },
  });

  // Delete project mutation
  const deleteMutation = useMutation({
    mutationFn: () => projectApi.deleteProject(projectId),
    onSuccess: () => {
      message.success('Project deleted successfully');
      navigate(`/${teamName}`);
    },
    onError: () => {
      message.error('Failed to delete project');
    },
  });

  // Handle form submit
  const handleSubmit = (values: {
    name: string;
    description: string;
    is_public: boolean;
  }) => {
    updateMutation.mutate(values);
  };

  // Handle delete confirmation
  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Project',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <Text>
            Are you sure you want to delete project{' '}
            <strong>{project.name}</strong>?
          </Text>
          <br />
          <Text type='danger'>
            This action cannot be undone. All associated data will be
            permanently deleted.
          </Text>
        </div>
      ),
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => deleteMutation.mutate(),
    });
  };

  return (
    <div className='project-settings'>
      <Title level={4}>
        <SettingOutlined style={{ marginRight: 8 }} />
        Project Settings
      </Title>

      {/* General Settings */}
      <Card title='General' style={{ marginTop: 24 }}>
        <Form
          form={form}
          layout='vertical'
          initialValues={{
            name: project.name,
            description:
              (project as ProjectDetailResp & { description?: string })
                .description || '',
            is_public: project.is_public || false,
          }}
          onFinish={handleSubmit}
        >
          <Form.Item
            name='name'
            label='Project Name'
            rules={[{ required: true, message: 'Please enter project name' }]}
          >
            <Input placeholder='Enter project name' />
          </Form.Item>

          <Form.Item name='description' label='Description'>
            <TextArea rows={4} placeholder='Enter project description' />
          </Form.Item>

          <Form.Item
            name='is_public'
            label='Public Project'
            valuePropName='checked'
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Button
              type='primary'
              htmlType='submit'
              icon={<SaveOutlined />}
              loading={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Danger Zone */}
      <Card
        title={<Text type='danger'>Danger Zone</Text>}
        style={{ marginTop: 24 }}
        styles={{ header: { borderBottom: '1px solid var(--color-error)' } }}
      >
        <Space direction='vertical' style={{ width: '100%' }}>
          <div>
            <Text strong>Delete this project</Text>
            <br />
            <Text type='secondary'>
              Once you delete a project, there is no going back. Please be
              certain.
            </Text>
          </div>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            Delete Project
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default ProjectSettings;

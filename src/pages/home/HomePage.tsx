import { useNavigate } from 'react-router-dom';

import {
  ArrowRightOutlined,
  ExperimentOutlined,
  FolderOutlined,
  PlusOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ProjectResp } from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  List,
  Row,
  Skeleton,
  Space,
  Spin,
  Statistic,
  Typography,
} from 'antd';
import dayjs from 'dayjs';

import { metricsApi } from '@/api/metrics';
import { systemApi } from '@/api/system';
import { useProjects } from '@/hooks/useProjects';
import { useProjectTeamMap } from '@/hooks/useProjectTeamMap';
import { useAuthStore } from '@/store/auth';

import './HomePage.css';

const { Title, Text, Paragraph } = Typography;

/**
 * Home Page
 * Personal dashboard showing recent projects, metrics, and quick actions
 */
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Fetch recent projects
  const { data: projectsData, isLoading } = useProjects({
    page: 1,
    size: 5,
    queryKey: ['projects', 'recent'],
  });

  // Fetch metrics
  const { data: injectionMetrics } = useQuery({
    queryKey: ['metrics', 'injections'],
    queryFn: () => metricsApi.getInjectionMetrics(),
  });

  const { data: executionMetrics } = useQuery({
    queryKey: ['metrics', 'executions'],
    queryFn: () => metricsApi.getExecutionMetrics(),
  });

  // Fetch system status
  const { data: systemMetrics } = useQuery({
    queryKey: ['system', 'metrics'],
    queryFn: () => systemApi.getSystemMetrics(),
    refetchInterval: 60000, // Refresh every minute
  });

  const recentProjects = projectsData?.items || [];

  // Project name → team name mapping for navigation
  const projectTeamMap = useProjectTeamMap();

  // Determine system health
  const systemHealthy =
    systemMetrics?.status === 'healthy' ||
    systemMetrics?.status === 'ok' ||
    (systemMetrics && !systemMetrics.status);

  return (
    <div className='home-page'>
      {/* Welcome Section */}
      <div className='welcome-section'>
        <Title level={4}>Welcome back, {user?.username || 'User'}</Title>
        <Paragraph type='secondary'>
          Manage your RCA benchmarking projects and experiments
        </Paragraph>
      </div>

      {/* Quick Actions */}
      <Card className='quick-actions-card' style={{ marginBottom: 24 }}>
        <Space size='large' wrap>
          <Button
            type='primary'
            size='large'
            icon={<PlusOutlined />}
            onClick={() => navigate('/projects/new')}
          >
            Create Project
          </Button>
          <Button
            size='large'
            icon={<FolderOutlined />}
            onClick={() => navigate('/projects')}
          >
            View All Projects
          </Button>
        </Space>
      </Card>

      {/* Metrics Cards — 3 cards: Injections, Executions, System Status */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title='Total Injections'
              value={injectionMetrics?.total ?? '-'}
              prefix={<ExperimentOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title='Total Executions'
              value={executionMetrics?.total ?? '-'}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Space direction='vertical' size={4}>
              <Text type='secondary'>System Status</Text>
              {systemMetrics ? (
                <Badge
                  status={systemHealthy ? 'success' : 'error'}
                  text={
                    <Text strong style={{ fontSize: 16 }}>
                      {systemHealthy ? 'Healthy' : 'Degraded'}
                    </Text>
                  }
                />
              ) : (
                <Badge status='default' text={<Spin size='small' />} />
              )}
              {systemMetrics?.cpu_usage != null && (
                <Text type='secondary' style={{ fontSize: 12 }}>
                  CPU: {systemMetrics.cpu_usage}% | Mem:{' '}
                  {systemMetrics.memory_usage}%
                </Text>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* Recent Projects */}
        <Col xs={24} lg={recentProjects.length === 0 ? 16 : 24}>
          <Card
            title={
              <Space>
                <FolderOutlined />
                <span>Recent Projects</span>
              </Space>
            }
            extra={
              <Button type='link' onClick={() => navigate('/projects')}>
                View all <ArrowRightOutlined />
              </Button>
            }
          >
            {isLoading ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : recentProjects.length > 0 ? (
              <List
                itemLayout='horizontal'
                dataSource={recentProjects}
                renderItem={(project: ProjectResp) => (
                  <List.Item
                    className='project-list-item'
                    onClick={() => {
                      const teamName = projectTeamMap.get(project.name ?? '');
                      if (teamName) {
                        navigate(`/${teamName}/${project.name}`);
                      } else {
                        navigate('/projects');
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                    actions={[
                      <Button
                        type='link'
                        key='open'
                        icon={<ArrowRightOutlined />}
                      >
                        Open
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <FolderOutlined
                          style={{
                            fontSize: 24,
                            color: 'var(--color-primary-500)',
                          }}
                        />
                      }
                      title={<Text strong>{project.name}</Text>}
                      description={
                        <Space size='small'>
                          <Text type='secondary'>
                            Created {dayjs(project.created_at).fromNow()}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description='No projects yet'
              >
                <Button
                  type='primary'
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/projects/new')}
                >
                  Create Your First Project
                </Button>
              </Empty>
            )}
          </Card>
        </Col>

        {/* Getting Started — only shown when user has no projects */}
        {recentProjects.length === 0 && (
          <Col xs={24} lg={8}>
            <Card
              title={
                <Space>
                  <RocketOutlined />
                  <span>Getting Started</span>
                </Space>
              }
            >
              <Space direction='vertical' style={{ width: '100%' }}>
                <div className='getting-started-item'>
                  <Text strong>1. Create a Project</Text>
                  <br />
                  <Text type='secondary'>
                    Projects help organize your experiments
                  </Text>
                </div>
                <div className='getting-started-item'>
                  <Text strong>2. Create Injections</Text>
                  <br />
                  <Text type='secondary'>
                    Configure fault injection scenarios
                  </Text>
                </div>
                <div className='getting-started-item'>
                  <Text strong>3. Run Executions</Text>
                  <br />
                  <Text type='secondary'>
                    Execute RCA algorithms on your data
                  </Text>
                </div>
                <div className='getting-started-item'>
                  <Text strong>4. Analyze Results</Text>
                  <br />
                  <Text type='secondary'>Review artifacts and evaluations</Text>
                </div>
              </Space>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default HomePage;

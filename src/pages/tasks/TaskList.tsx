import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DashboardOutlined,
  DeleteOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { ListTasksTaskType, type TaskResp, TaskState } from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  message,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  type TablePaginationConfig,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { taskApi } from '@/api/tasks';
import { createTraceStream } from '@/api/traces';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

/** Human-readable task type names */
const taskTypeNames: Record<string, string> = {
  '0': 'Build Container',
  '1': 'Restart Pedestal',
  '2': 'Fault Injection',
  '3': 'Run Algorithm',
  '4': 'Build Datapack',
  '5': 'Collect Result',
  '6': 'Cron Job',
};

const getTaskTypeName = (
  type: ListTasksTaskType | string | undefined
): string => {
  if (type === undefined || type === null) return 'Unknown';
  return taskTypeNames[String(type)] ?? String(type);
};

const TaskList = () => {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<ListTasksTaskType | undefined>();
  const [stateFilter, setStateFilter] = useState<TaskState | undefined>();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval] = useState(5000);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Fetch tasks with real-time updates
  const {
    data: tasksData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      'tasks',
      pagination.current,
      pagination.pageSize,
      typeFilter,
      stateFilter,
    ],
    queryFn: () =>
      taskApi.getTasks({
        page: pagination.current,
        size: pagination.pageSize,
        taskType: typeFilter as string | undefined,
        state: stateFilter,
      }),
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  // Real-time updates via SSE for running tasks
  useEffect(() => {
    if (!autoRefresh) return;

    const runningTasks = tasksData?.items?.filter(
      (t: TaskResp) =>
        String(t.state) === String(TaskState.Running) ||
        t.state === '2' ||
        t.state === 'RUNNING'
    ); // RUNNING
    if (!runningTasks?.length) return;

    // Create SSE connections for each running task
    const eventSources: EventSource[] = [];

    runningTasks.forEach((task) => {
      if (!task.trace_id) return;
      const eventSource = createTraceStream(task.trace_id);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'task_update') {
            message.info(`Task ${task.id} update: ${data.message}`);
            refetch();
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        eventSource.close();
      };

      eventSources.push(eventSource);
    });

    return () => {
      eventSources.forEach((es) => es.close());
    };
  }, [autoRefresh, tasksData, refetch]);

  // Statistics
  const stats = {
    total: tasksData?.pagination?.total || 0,
    pending:
      tasksData?.items?.filter(
        (t: TaskResp) => String(t.state) === String(TaskState.Pending)
      ).length || 0,
    running:
      tasksData?.items?.filter(
        (t: TaskResp) => String(t.state) === String(TaskState.Running)
      ).length || 0,
    completed:
      tasksData?.items?.filter(
        (t: TaskResp) => String(t.state) === String(TaskState.Completed)
      ).length || 0,
    error:
      tasksData?.items?.filter(
        (t: TaskResp) => String(t.state) === String(TaskState.Error)
      ).length || 0,
    cancelled:
      tasksData?.items?.filter(
        (t: TaskResp) => String(t.state) === String(TaskState.Cancelled)
      ).length || 0,
  };

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    setPagination({
      ...pagination,
      current: newPagination.current || 1,
      pageSize: newPagination.pageSize || 10,
    });
  };

  const handleSearch = (_value: string) => {
    setPagination({ ...pagination, current: 1 });
  };

  const handleTypeFilter = (type: ListTasksTaskType | undefined) => {
    setTypeFilter(type);
    setPagination({ ...pagination, current: 1 });
  };

  const handleStateFilter = (state: TaskState | undefined) => {
    setStateFilter(state);
    setPagination({ ...pagination, current: 1 });
  };

  const handleViewTask = (id?: string) => {
    if (id) {
      navigate(`/tasks/${id}`);
    }
  };

  const handleDeleteTask = (id?: string) => {
    if (!id) return;

    Modal.confirm({
      title: 'Delete Task',
      content:
        'Are you sure you want to delete this task? This action cannot be undone.',
      okText: 'Yes, delete it',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await taskApi.batchDelete([id]);
          message.success('Task deleted successfully');
          refetch();
        } catch {
          message.error('Failed to delete task');
        }
      },
    });
  };

  const handleManualRefresh = () => {
    refetch();
    message.success('Tasks refreshed');
  };

  const getStateColor = (state: TaskState) => {
    switch (state) {
      case TaskState.Pending:
        return 'var(--color-secondary-300)';
      case TaskState.Running:
        return 'var(--color-primary-500)';
      case TaskState.Completed:
        return 'var(--color-success)';
      case TaskState.Error:
        return 'var(--color-error)';
      case TaskState.Cancelled:
        return 'var(--color-secondary-500)';
      default:
        return 'var(--color-secondary-500)';
    }
  };

  const getStateIcon = (state: TaskState) => {
    switch (state) {
      case TaskState.Pending:
        return <ClockCircleOutlined />;
      case TaskState.Running:
        return <SyncOutlined spin />;
      case TaskState.Completed:
        return <CheckCircleOutlined />;
      case TaskState.Error:
        return <CloseCircleOutlined />;
      case TaskState.Cancelled:
        return <PauseCircleOutlined />;
      default:
        return <ClockCircleOutlined />;
    }
  };

  const getTaskTypeColor = (
    type: ListTasksTaskType | string | undefined
  ): string => {
    if (type === undefined || type === null)
      return 'var(--color-secondary-500)';

    const typeStr = String(type);
    switch (typeStr) {
      case '0':
        return 'var(--color-primary-500)';
      case '1':
        return 'var(--color-success)';
      case '2':
        return 'var(--color-warning)';
      case '3':
        return 'var(--color-info)';
      case '4':
        return 'var(--color-success)';
      case '5':
        return 'var(--color-primary-700)';
      case '6':
        return 'var(--color-secondary-500)';
      default:
        return 'var(--color-secondary-500)';
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: '10%',
      render: (id: string) => (
        <Text strong style={{ fontSize: '0.875rem' }}>
          {id?.substring(0, 8)}
        </Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: '14%',
      render: (type: ListTasksTaskType | string | undefined) => (
        <Tag color={getTaskTypeColor(type)} style={{ fontWeight: 500 }}>
          {getTaskTypeName(type)}
        </Tag>
      ),
      filters: [
        { text: 'Build Container', value: ListTasksTaskType.NUMBER_0 },
        { text: 'Restart Pedestal', value: ListTasksTaskType.NUMBER_1 },
        { text: 'Fault Injection', value: ListTasksTaskType.NUMBER_2 },
        { text: 'Run Algorithm', value: ListTasksTaskType.NUMBER_3 },
        { text: 'Build Datapack', value: ListTasksTaskType.NUMBER_4 },
        { text: 'Collect Result', value: ListTasksTaskType.NUMBER_5 },
        { text: 'Cron Job', value: ListTasksTaskType.NUMBER_6 },
      ],
      onFilter: (value: boolean | React.Key, record: TaskResp) =>
        record.type === value || String(record.type) === String(value),
    },
    {
      title: 'Project',
      key: 'project',
      width: '14%',
      render: (_: unknown, record: TaskResp) => {
        const projectId = (record as Record<string, unknown>).project_id as
          | string
          | undefined;
        const projectName = (record as Record<string, unknown>).project_name as
          | string
          | undefined;
        if (projectId) {
          return (
            <Link
              to={`/projects/${projectId}`}
              onClick={(e) => e.stopPropagation()}
            >
              {projectName || projectId.substring(0, 8)}
            </Link>
          );
        }
        return (
          <Text type='secondary' style={{ fontSize: '0.75rem' }}>
            -
          </Text>
        );
      },
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      width: '12%',
      render: (state: string | TaskState) => {
        const stateStr = String(state);
        let taskState: TaskState;
        if (!isNaN(Number(stateStr))) {
          taskState = Number(stateStr) as TaskState;
        } else {
          taskState = TaskState.Pending;
        }

        return (
          <Badge
            status={
              taskState === TaskState.Completed
                ? 'success'
                : taskState === TaskState.Error
                  ? 'error'
                  : taskState === TaskState.Running
                    ? 'processing'
                    : taskState === TaskState.Cancelled
                      ? 'warning'
                      : 'default'
            }
            text={
              <Space size='small'>
                {getStateIcon(taskState)}
                <Text
                  strong
                  style={{
                    color: getStateColor(taskState),
                    fontSize: '0.875rem',
                  }}
                >
                  {taskState === TaskState.Pending
                    ? 'Pending'
                    : taskState === TaskState.Running
                      ? 'Running'
                      : taskState === TaskState.Completed
                        ? 'Completed'
                        : taskState === TaskState.Error
                          ? 'Error'
                          : taskState === TaskState.Cancelled
                            ? 'Cancelled'
                            : 'Unknown'}
                </Text>
              </Space>
            }
          />
        );
      },
      filters: [
        { text: 'Pending', value: TaskState.Pending },
        { text: 'Rescheduled', value: TaskState.Rescheduled },
        { text: 'Running', value: TaskState.Running },
        { text: 'Completed', value: TaskState.Completed },
        { text: 'Error', value: TaskState.Error },
        { text: 'Cancelled', value: TaskState.Cancelled },
      ],
      onFilter: (value: boolean | React.Key, record: TaskResp) =>
        String(record.state) === String(value),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '12%',
      render: (date: string) => (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          <Text style={{ fontSize: '0.75rem' }}>{dayjs(date).fromNow()}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Duration',
      key: 'duration',
      width: '10%',
      render: (_: unknown, record: TaskResp) => {
        const start = (record as Record<string, unknown>).created_at as
          | string
          | undefined;
        const end = (record as Record<string, unknown>).updated_at as
          | string
          | undefined;
        if (!start) return <Text type='secondary'>-</Text>;

        const isRunning = String(record.state) === String(TaskState.Running);
        const endTime = isRunning ? dayjs() : dayjs(end || start);
        const diffMs = endTime.diff(dayjs(start));

        if (diffMs < 1000)
          return <Text style={{ fontSize: '0.75rem' }}>&lt;1s</Text>;
        if (diffMs < 60000) {
          return (
            <Text style={{ fontSize: '0.75rem' }}>
              {Math.round(diffMs / 1000)}s
            </Text>
          );
        }
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.round((diffMs % 60000) / 1000);
        return (
          <Text style={{ fontSize: '0.75rem' }}>
            {mins}m {secs}s
          </Text>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '8%',
      render: (_: unknown, record: TaskResp) => (
        <Space size='small'>
          <Tooltip title='View Details'>
            <Button
              type='text'
              size='small'
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleViewTask(record.id);
              }}
            />
          </Tooltip>
          <Tooltip title='Delete Task'>
            <Button
              type='text'
              size='small'
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTask(record.id);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className='task-list page-container'>
      {/* Page Header */}
      <div className='page-header'>
        <div className='page-header-left'>
          <Title level={4} className='page-title'>
            Task Monitor
          </Title>
          <Text type='secondary'>
            Monitor and manage background tasks with real-time updates
          </Text>
        </div>
        <div className='page-header-right'>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleManualRefresh}>
              Refresh
            </Button>
            <Button
              type={autoRefresh ? 'primary' : 'default'}
              icon={<SyncOutlined spin={autoRefresh} />}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
          </Space>
        </div>
      </div>

      {/* Statistics Cards */}
      <Row
        gutter={[
          { xs: 8, sm: 16, lg: 24 },
          { xs: 8, sm: 16, lg: 24 },
        ]}
        className='stats-row'
      >
        <Col xs={12} sm={12} lg={4}>
          <Card>
            <Statistic
              title='Total Tasks'
              value={stats.total}
              prefix={<DashboardOutlined />}
              valueStyle={{ color: 'var(--color-primary-500)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={4}>
          <Card>
            <Statistic
              title='Pending'
              value={stats.pending}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: 'var(--color-secondary-500)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={4}>
          <Card>
            <Statistic
              title='Running'
              value={stats.running}
              prefix={<SyncOutlined />}
              valueStyle={{ color: 'var(--color-primary-500)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={4}>
          <Card>
            <Statistic
              title='Completed'
              value={stats.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: 'var(--color-success)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={4}>
          <Card>
            <Statistic
              title='Error'
              value={stats.error}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: 'var(--color-error)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={4}>
          <Card>
            <Statistic
              title='Cancelled'
              value={stats.cancelled}
              prefix={<PauseCircleOutlined />}
              valueStyle={{ color: 'var(--color-secondary-500)' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align='middle'>
          <Col xs={24} sm={12} md={6}>
            <Search
              placeholder='Search tasks by ID or type...'
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder='Filter by type'
              allowClear
              style={{ width: '100%' }}
              onChange={handleTypeFilter}
              value={typeFilter}
            >
              <Option value={ListTasksTaskType.NUMBER_0}>
                Build Container
              </Option>
              <Option value={ListTasksTaskType.NUMBER_1}>
                Restart Pedestal
              </Option>
              <Option value={ListTasksTaskType.NUMBER_2}>
                Fault Injection
              </Option>
              <Option value={ListTasksTaskType.NUMBER_3}>Run Algorithm</Option>
              <Option value={ListTasksTaskType.NUMBER_4}>Build Datapack</Option>
              <Option value={ListTasksTaskType.NUMBER_5}>Collect Result</Option>
              <Option value={ListTasksTaskType.NUMBER_6}>Cron Job</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder='Filter by status'
              allowClear
              style={{ width: '100%' }}
              onChange={handleStateFilter}
              value={stateFilter}
            >
              <Option value={TaskState.Pending}>Pending</Option>
              <Option value={TaskState.Rescheduled}>Rescheduled</Option>
              <Option value={TaskState.Running}>Running</Option>
              <Option value={TaskState.Completed}>Completed</Option>
              <Option value={TaskState.Error}>Error</Option>
              <Option value={TaskState.Cancelled}>Cancelled</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Task Table */}
      <Card className='table-card'>
        <Table
          rowKey='id'
          columns={columns}
          dataSource={(tasksData?.items as TaskResp[] | undefined) || []}
          loading={isLoading}
          className='tasks-table'
          pagination={{
            ...pagination,
            total: tasksData?.pagination?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} tasks`,
          }}
          onChange={handleTableChange}
          onRow={(record) => ({
            onClick: () => handleViewTask(record.id),
            style: { cursor: 'pointer' },
          })}
          locale={{
            emptyText: <Empty description='No tasks found' />,
          }}
        />
      </Card>

      {/* Real-time Status Indicator */}
      {autoRefresh && (
        <div style={{ position: 'fixed', bottom: 24, right: 24 }}>
          <Card size='small' style={{ width: 200 }}>
            <Space>
              <Badge status='processing' />
              <Text type='secondary'>Real-time updates active</Text>
            </Space>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TaskList;

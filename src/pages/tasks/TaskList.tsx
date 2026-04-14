import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EyeOutlined,
  FunctionOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { ListTasksTaskType, type TaskResp, TaskState } from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  message,
  Modal,
  Progress,
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

const TaskList = () => {
  const navigate = useNavigate();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
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
          // Update task status based on SSE data
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
      ).length || 0, // PENDING
    running:
      tasksData?.items?.filter(
        (t: TaskResp) => String(t.state) === String(TaskState.Running)
      ).length || 0, // RUNNING
    completed:
      tasksData?.items?.filter(
        (t: TaskResp) => String(t.state) === String(TaskState.Completed)
      ).length || 0, // COMPLETED
    error:
      tasksData?.items?.filter(
        (t: TaskResp) => String(t.state) === String(TaskState.Error)
      ).length || 0, // ERROR
    cancelled:
      tasksData?.items?.filter(
        (t: TaskResp) => String(t.state) === String(TaskState.Cancelled)
      ).length || 0, // CANCELLED
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

  const handleCancelTask = (task: TaskResp) => {
    if (
      String(task.state) !== String(TaskState.Running) &&
      String(task.state) !== String(TaskState.Pending)
    ) {
      // Not RUNNING or PENDING
      message.warning('Only running or pending tasks can be cancelled');
      return;
    }

    Modal.confirm({
      title: 'Cancel Task',
      content: `Are you sure you want to cancel task "${task.id}"?`,
      okText: 'Yes, cancel it',
      okButtonProps: { danger: true },
      cancelText: 'No',
      onOk: () => {
        message.info('Task cancellation is not yet supported by the backend');
      },
    });
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
        } catch (error) {
          message.error('Failed to delete task');
        }
      },
    });
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select tasks to delete');
      return;
    }

    Modal.confirm({
      title: 'Batch Delete Tasks',
      content: `Are you sure you want to delete ${selectedRowKeys.length} tasks?`,
      okText: 'Yes, delete them',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await taskApi.batchDelete(selectedRowKeys as string[]);
          message.success(
            `${selectedRowKeys.length} tasks deleted successfully`
          );
          setSelectedRowKeys([]);
          refetch();
        } catch (error) {
          message.error('Failed to delete tasks');
        }
      },
    });
  };

  const handleManualRefresh = () => {
    refetch();
    message.success('Tasks refreshed');
  };

  const getTaskTypeIcon = (type: ListTasksTaskType | string | undefined) => {
    if (type === undefined || type === null) return <ClockCircleOutlined />;

    const taskType =
      typeof type === 'string'
        ? (Object.values(ListTasksTaskType).find(
            (v) => v === type || String(v) === type
          ) as ListTasksTaskType)
        : type;

    switch (taskType) {
      case ListTasksTaskType.NUMBER_0: // BuildContainer
        return (
          <FunctionOutlined style={{ color: 'var(--color-primary-500)' }} />
        );
      case ListTasksTaskType.NUMBER_1: // RestartPedestal
        return <SyncOutlined style={{ color: 'var(--color-success)' }} />;
      case ListTasksTaskType.NUMBER_2: // FaultInjection
        return <SyncOutlined style={{ color: 'var(--color-warning)' }} />;
      case ListTasksTaskType.NUMBER_3: // RunAlgorithm
        return <FunctionOutlined style={{ color: 'var(--color-info)' }} />;
      case ListTasksTaskType.NUMBER_4: // BuildDatapack
        return <DashboardOutlined style={{ color: 'var(--color-success)' }} />;
      case ListTasksTaskType.NUMBER_5: // CollectResult
        return (
          <DatabaseOutlined style={{ color: 'var(--color-primary-700)' }} />
        );
      case ListTasksTaskType.NUMBER_6: // CronJob
        return (
          <ClockCircleOutlined
            style={{ color: 'var(--color-secondary-500)' }}
          />
        );
      default:
        return <ClockCircleOutlined />;
    }
  };

  const getTaskTypeColor = (
    type: ListTasksTaskType | string | undefined
  ): string => {
    if (type === undefined || type === null)
      return 'var(--color-secondary-500)';

    const taskType =
      typeof type === 'string'
        ? (Object.values(ListTasksTaskType).find(
            (v) => v === type || String(v) === type
          ) as ListTasksTaskType)
        : type;

    switch (taskType) {
      case ListTasksTaskType.NUMBER_0: // BuildContainer
        return 'var(--color-primary-500)';
      case ListTasksTaskType.NUMBER_1: // RestartPedestal
        return 'var(--color-success)';
      case ListTasksTaskType.NUMBER_2: // FaultInjection
        return 'var(--color-warning)';
      case ListTasksTaskType.NUMBER_3: // RunAlgorithm
        return 'var(--color-info)';
      case ListTasksTaskType.NUMBER_4: // BuildDatapack
        return 'var(--color-success)';
      case ListTasksTaskType.NUMBER_5: // CollectResult
        return 'var(--color-primary-700)';
      case ListTasksTaskType.NUMBER_6: // CronJob
        return 'var(--color-secondary-500)';
      default:
        return 'var(--color-secondary-500)';
    }
  };

  const getStateColor = (state: TaskState) => {
    switch (state) {
      case TaskState.Pending: // PENDING
        return 'var(--color-secondary-300)';
      case TaskState.Running: // RUNNING
        return 'var(--color-primary-500)';
      case TaskState.Completed: // COMPLETED
        return 'var(--color-success)';
      case TaskState.Error: // ERROR
        return 'var(--color-error)';
      case TaskState.Cancelled: // CANCELLED
        return 'var(--color-secondary-500)';
      default:
        return 'var(--color-secondary-500)';
    }
  };

  const getStateIcon = (state: TaskState) => {
    switch (state) {
      case TaskState.Pending: // PENDING
        return <ClockCircleOutlined />;
      case TaskState.Running: // RUNNING
        return <SyncOutlined spin />;
      case TaskState.Completed: // COMPLETED
        return <CheckCircleOutlined />;
      case TaskState.Error: // ERROR
        return <CloseCircleOutlined />;
      case TaskState.Cancelled: // CANCELLED
        return <PauseCircleOutlined />;
      default:
        return <ClockCircleOutlined />;
    }
  };

  const getTaskProgress = (task: TaskResp): number | undefined => {
    if (String(task.state) === String(TaskState.Completed)) return 100; // COMPLETED
    if (
      String(task.state) === String(TaskState.Error) ||
      String(task.state) === String(TaskState.Cancelled)
    )
      return 0; // ERROR or CANCELLED
    if (String(task.state) === String(TaskState.Running)) return undefined; // indeterminate
    return 0;
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  const columns = [
    {
      title: 'Task',
      dataIndex: 'id',
      key: 'id',
      width: '15%',
      render: (id: string, record: TaskResp) => (
        <Space>
          <Avatar
            size='small'
            style={{ backgroundColor: getTaskTypeColor(record.type) }}
            icon={getTaskTypeIcon(record.type)}
          />
          <div>
            <Text strong style={{ fontSize: '0.875rem' }}>
              {id.substring(0, 8)}
            </Text>
            <br />
            <Text type='secondary' style={{ fontSize: '0.75rem' }}>
              {record.type}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: '15%',
      render: (type: ListTasksTaskType | string | undefined) => (
        <Tag color={getTaskTypeColor(type)} style={{ fontWeight: 500 }}>
          {type}
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
      title: 'Status',
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
                ? 'success' // COMPLETED
                : taskState === TaskState.Error
                  ? 'error' // ERROR
                  : taskState === TaskState.Running
                    ? 'processing' // RUNNING
                    : taskState === TaskState.Cancelled
                      ? 'warning' // CANCELLED
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
                    ? 'Pending' // PENDING
                    : taskState === TaskState.Running
                      ? 'Running' // RUNNING
                      : taskState === TaskState.Completed
                        ? 'Completed' // COMPLETED
                        : taskState === TaskState.Error
                          ? 'Error' // ERROR
                          : taskState === TaskState.Cancelled
                            ? 'Cancelled' // CANCELLED
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
      title: 'Progress',
      key: 'progress',
      width: '10%',
      render: (_: unknown, record: TaskResp) => {
        const isRunning = String(record.state) === String(TaskState.Running);
        if (isRunning) {
          return (
            <Space size='small'>
              <SyncOutlined
                spin
                style={{ color: 'var(--color-primary-500)' }}
              />
              <Text type='secondary' style={{ fontSize: '0.75rem' }}>
                Running
              </Text>
            </Space>
          );
        }
        const progress = getTaskProgress(record);
        return (
          <Progress
            percent={progress ?? 0}
            status={
              String(record.state) === String(TaskState.Error)
                ? 'exception' // ERROR
                : String(record.state) === String(TaskState.Completed)
                  ? 'success' // COMPLETED
                  : 'active'
            }
            size='small'
            format={(percent) => `${percent}%`}
          />
        );
      },
    },
    {
      title: 'Retries',
      key: 'retries',
      width: '8%',
      render: () => (
        <Text code style={{ fontSize: '0.75rem' }}>
          N/A
        </Text>
      ),
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
      title: 'Actions',
      key: 'actions',
      width: '12%',
      render: (_: unknown, record: TaskResp) => (
        <Space size='small'>
          <Tooltip title='View Details'>
            <Button
              type='text'
              size='small'
              icon={<EyeOutlined />}
              onClick={() => handleViewTask(record.id)}
            />
          </Tooltip>
          {String(record.state) === String(TaskState.Running) && ( // RUNNING
            <Tooltip title='Cancel Task'>
              <Button
                type='text'
                size='small'
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleCancelTask(record)}
              />
            </Tooltip>
          )}
          <Tooltip title='Delete Task'>
            <Button
              type='text'
              size='small'
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteTask(record.id)}
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

      {/* Filters and Actions */}
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
          <Col xs={24} sm={24} md={10} style={{ textAlign: 'right' }}>
            <Space>
              {selectedRowKeys.length > 0 && (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleBatchDelete}
                >
                  Delete Selected ({selectedRowKeys.length})
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Task Table */}
      <Card className='table-card'>
        <Table
          rowKey='id'
          rowSelection={rowSelection}
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

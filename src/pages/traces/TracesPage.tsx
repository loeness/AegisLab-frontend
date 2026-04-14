/**
 * TracesPage - Lists all traces for a project scope.
 *
 * Route: /:teamName/:projectName/traces
 *
 * Displays a paginated Ant Design Table of traces with columns:
 * ID, Status, Type, Created At, Duration.
 * Clicking a row navigates to the trace detail page.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  ClockCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Input,
  Space,
  Table,
  type TablePaginationConfig,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { traceApi } from '@/api/traces';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---------- Types ----------

interface TraceRecord {
  id: string;
  status: string;
  type: string;
  created_at: string;
  duration?: number;
  [key: string]: unknown;
}

// ---------- Helpers ----------

const statusColorMap: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  success: 'success',
  failed: 'error',
  cancelled: 'warning',
};

const statusTagColor = (status: string): string =>
  statusColorMap[status?.toLowerCase()] ?? 'default';

const formatDuration = (ms?: number): string => {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

// ---------- Component ----------

const TracesPage: React.FC = () => {
  const navigate = useNavigate();
  const { teamName, projectName } = useParams<{
    teamName: string;
    projectName: string;
  }>();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');

  // Fetch traces list
  // NOTE: The traces API currently does not support project-level filtering.
  // teamName and projectName are included in the query key for cache isolation,
  // but traces shown here are global across all projects.
  const {
    data: tracesData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['traces', teamName, projectName, page, pageSize],
    queryFn: () => traceApi.getTraces({ page, size: pageSize }),
    staleTime: 10_000,
  });

  // Normalise the response into a flat list
  const traces: TraceRecord[] = useMemo(() => {
    if (!tracesData) return [];
    // The API may return { items, total } or a plain array
    const items = Array.isArray(tracesData)
      ? tracesData
      : ((tracesData as { items?: TraceRecord[] }).items ?? []);
    return items as TraceRecord[];
  }, [tracesData]);

  const total = useMemo(() => {
    if (!tracesData) return 0;
    if (Array.isArray(tracesData)) return tracesData.length;
    return (tracesData as { total?: number }).total ?? traces.length;
  }, [tracesData, traces.length]);

  // Client-side search filter
  const filteredTraces = useMemo(() => {
    if (!searchText) return traces;
    const lower = searchText.toLowerCase();
    return traces.filter(
      (t) =>
        t.id?.toLowerCase().includes(lower) ||
        t.status?.toLowerCase().includes(lower) ||
        t.type?.toLowerCase().includes(lower)
    );
  }, [traces, searchText]);

  // ---------- Table columns ----------

  const columns: ColumnsType<TraceRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 220,
      ellipsis: true,
      render: (id: string) => (
        <Text
          strong
          style={{ color: 'var(--color-primary-600)', cursor: 'pointer' }}
        >
          {id}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: string) => (
        <Tag color={statusTagColor(status)}>
          {status?.toUpperCase() ?? 'UNKNOWN'}
        </Tag>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type: string) => <Text>{type ?? '-'}</Text>,
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      defaultSortOrder: 'descend',
      render: (date: string) => (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          <Space size={4}>
            <ClockCircleOutlined
              style={{ color: 'var(--color-secondary-400)' }}
            />
            <Text type='secondary'>{dayjs(date).fromNow()}</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      align: 'right',
      render: (duration?: number) => (
        <Text type='secondary'>{formatDuration(duration)}</Text>
      ),
    },
  ];

  // ---------- Handlers ----------

  const handleTableChange = (paginationConfig: TablePaginationConfig) => {
    setPage(paginationConfig.current ?? 1);
    if (paginationConfig.pageSize && paginationConfig.pageSize !== pageSize) {
      setPageSize(paginationConfig.pageSize);
      setPage(1);
    }
  };

  const handleRowClick = (record: TraceRecord) => {
    navigate(`/${teamName}/${projectName}/traces/${record.id}`);
  };

  // ---------- Render ----------

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Traces
        </Title>
        <Space>
          <Input
            placeholder='Search traces...'
            prefix={<SearchOutlined />}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 260 }}
          />
          <Tooltip title='Refresh'>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
            />
          </Tooltip>
        </Space>
      </div>

      <Card bodyStyle={{ padding: 0 }}>
        <Table<TraceRecord>
          rowKey='id'
          columns={columns}
          dataSource={filteredTraces}
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: searchText ? filteredTraces.length : total,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} traces`,
            pageSizeOptions: ['10', '20', '50'],
          }}
          onChange={handleTableChange}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
          size='middle'
          locale={{
            emptyText: (
              <div style={{ padding: 48 }}>
                <Text type='secondary'>No traces found for this project.</Text>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default TracesPage;

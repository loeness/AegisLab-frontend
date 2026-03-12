/**
 * ProjectExecutionList - W&B-style execution list page for workspace
 *
 * Displays executions in a W&B Table format with:
 * - Row visibility toggles
 * - Status color dots
 * - Column management
 * - Search and filtering
 * - Shared filter/group/sort/columns state with workspace sidebar
 * - Mock data fallback when API returns no data
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { DatabaseOutlined, TagOutlined } from '@ant-design/icons';
import type { ExecutionResp } from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';
import { message, Modal, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

import { executionApi } from '@/api/executions';
import WorkspacePageHeader from '@/components/workspace/WorkspacePageHeader';
import WorkspaceTable from '@/components/workspace/WorkspaceTable';
import type { ProjectOutletContext } from '@/hooks/useProjectContext';
import { useAuthStore } from '@/store/auth';
import { useWorkspaceStore } from '@/store/workspace';
import type { ColumnConfig, SortField } from '@/types/workspace';
import { getVisibleIdsFromMap } from '@/utils/idUtils';

import './ProjectExecutionList.css';

dayjs.extend(duration);

const { Text } = Typography;

// Table row data type
interface ExecutionTableData {
  id: number;
  name: string;
  notes: string;
  algorithm_name: string;
  algorithm_version: string;
  state: string;
  datapack_id: string;
  injection_name: string;
  runtime: string;
  execution_duration: number;
  created_at: string;
  updated_at: string | undefined;
  labels: Array<string | undefined>;
}

// Status mapping for display
const statusDisplayMap: Record<string, { text: string; color: string }> = {
  initial: { text: 'Initial', color: '#d9d9d9' },
  pending: { text: 'Pending', color: '#faad14' },
  running: { text: 'Running', color: '#1890ff' },
  success: { text: 'Success', color: '#52c41a' },
  failed: { text: 'Failed', color: '#f5222d' },
  finished: { text: 'Finished', color: '#52c41a' },
  crashed: { text: 'Crashed', color: '#faad14' },
};

// Format duration
const formatDuration = (seconds?: number): string => {
  if (!seconds) return '-';
  const d = dayjs.duration(seconds, 'seconds');
  if (d.asHours() >= 1) {
    return `${Math.floor(d.asHours())}h ${d.minutes()}m ${d.seconds()}s`;
  } else if (d.asMinutes() >= 1) {
    return `${d.minutes()}m ${d.seconds()}s`;
  } else {
    return `${d.seconds()}s`;
  }
};

// Algorithm names for mock data
const ALGORITHM_NAMES = [
  'RCABench',
  'MicroCause',
  'CloudRanger',
  'CIRCA',
  'DiagNet',
  'TraceAnomaly',
];
const EXECUTION_STATUSES = [
  'running',
  'finished',
  'failed',
  'crashed',
  'initial',
];
const INJECTION_NAMES = [
  'network_delay_001',
  'cpu_stress_002',
  'memory_leak_003',
  'disk_full_004',
  'process_kill_005',
];

// Generate mock executions data
const generateMockExecutions = (count: number): ExecutionTableData[] => {
  return Array.from({ length: count }, (_, i) => {
    const algorithm =
      ALGORITHM_NAMES[Math.floor(Math.random() * ALGORITHM_NAMES.length)];
    const status =
      EXECUTION_STATUSES[Math.floor(Math.random() * EXECUTION_STATUSES.length)];
    const injection =
      INJECTION_NAMES[Math.floor(Math.random() * INJECTION_NAMES.length)];
    const execDuration = Math.floor(Math.random() * 3600) + 60;
    return {
      id: i + 1,
      name: `exec_${String(i + 1).padStart(3, '0')}`,
      notes: `RCA execution test #${i + 1}`,
      algorithm_name: algorithm,
      algorithm_version: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}`,
      state: status,
      datapack_id: `dp_${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`,
      injection_name: injection,
      runtime: formatDuration(execDuration),
      execution_duration: execDuration,
      created_at: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      updated_at: new Date(
        Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000
      ).toISOString(),
      labels: [`algo:${algorithm.toLowerCase()}`],
    };
  });
};

// Pre-generated mock data
const MOCK_EXECUTIONS = generateMockExecutions(28);

const ProjectExecutionList: React.FC = () => {
  const navigate = useNavigate();
  const { teamName, projectName } = useOutletContext<ProjectOutletContext>();
  const { user } = useAuthStore();

  // Handle back to workspace
  const handleBackToWorkspace = () => {
    navigate(`/${teamName}/${projectName}/workspace`);
  };

  // Get shared table settings and visibility state from workspace store
  const {
    executionsTableSettings,
    setExecutionsTableSettings,
    runsPanelCollapsed,
    setRunsPanelCollapsed,
    // Visibility management
    visibleRuns,
    runColors,
    setItemsVisible,
    initializeVisibility,
  } = useWorkspaceStore();

  // Workspace info
  const workspaceName = `${user?.username || 'User'}'s workspace`;

  // Handle workspace panel toggle
  const handleToggleRunsPanel = useCallback(() => {
    setRunsPanelCollapsed(!runsPanelCollapsed);
  }, [runsPanelCollapsed, setRunsPanelCollapsed]);

  // Extract values from shared settings
  const {
    sortFields,
    groupBy,
    pageSize,
    currentPage,
    columns: sharedColumns,
  } = executionsTableSettings;

  // Callbacks to update shared settings
  const setSortFields = useCallback(
    (fields: SortField[]) => setExecutionsTableSettings({ sortFields: fields }),
    [setExecutionsTableSettings]
  );

  const setGroupBy = useCallback(
    (field: string | null) => setExecutionsTableSettings({ groupBy: field }),
    [setExecutionsTableSettings]
  );

  const setCurrentPage = useCallback(
    (page: number) => setExecutionsTableSettings({ currentPage: page }),
    [setExecutionsTableSettings]
  );

  const setPageSize = useCallback(
    (size: number) =>
      setExecutionsTableSettings({ pageSize: size, currentPage: 1 }),
    [setExecutionsTableSettings]
  );

  const setColumns = useCallback(
    (cols: ColumnConfig[]) => setExecutionsTableSettings({ columns: cols }),
    [setExecutionsTableSettings]
  );

  // Use shared columns from store, or use enhanced default if shared columns are basic
  const columns = useMemo(() => {
    // If shared columns have more than 5 columns, they've been customized - use them
    if (sharedColumns.length > 5) {
      return sharedColumns;
    }
    // Otherwise, use enhanced columns for the full page view
    const enhancedColumns: ColumnConfig[] = [
      {
        key: 'name',
        title: 'Name',
        dataIndex: 'name',
        type: 'text',
        width: 200,
        visible: true,
        pinned: true,
        locked: true,
        order: 0,
        sortable: true,
      },
      {
        key: 'notes',
        title: 'Notes',
        dataIndex: 'notes',
        type: 'text',
        width: 150,
        visible: true,
        pinned: false,
        order: 1,
      },
      {
        key: 'algorithm_name',
        title: 'Algorithm',
        dataIndex: 'algorithm_name',
        type: 'text',
        width: 150,
        visible: true,
        pinned: false,
        order: 2,
        filterable: true,
      },
      {
        key: 'state',
        title: 'Status',
        dataIndex: 'state',
        type: 'status',
        width: 100,
        visible: true,
        pinned: false,
        order: 3,
        filterable: true,
      },
      {
        key: 'injection_name',
        title: 'Injection',
        dataIndex: 'injection_name',
        type: 'text',
        width: 150,
        visible: true,
        pinned: false,
        order: 4,
      },
      {
        key: 'datapack_id',
        title: 'Datapack',
        dataIndex: 'datapack_id',
        type: 'text',
        width: 120,
        visible: true,
        pinned: false,
        order: 5,
      },
      {
        key: 'runtime',
        title: 'Runtime',
        dataIndex: 'runtime',
        type: 'duration',
        width: 100,
        visible: true,
        pinned: false,
        order: 6,
        sortable: true,
      },
      {
        key: 'created_at',
        title: 'Created',
        dataIndex: 'created_at',
        type: 'date',
        width: 120,
        visible: true,
        pinned: false,
        order: 7,
        sortable: true,
      },
      {
        key: 'labels',
        title: 'Labels',
        dataIndex: 'labels',
        type: 'tags',
        width: 150,
        visible: true,
        pinned: false,
        order: 8,
      },
      {
        key: 'id',
        title: 'ID',
        dataIndex: 'id',
        type: 'number',
        width: 80,
        visible: false,
        pinned: false,
        order: 100,
      },
      {
        key: 'algorithm_version',
        title: 'Algorithm Version',
        dataIndex: 'algorithm_version',
        type: 'text',
        width: 120,
        visible: false,
        pinned: false,
        order: 101,
      },
      {
        key: 'updated_at',
        title: 'Updated',
        dataIndex: 'updated_at',
        type: 'date',
        width: 120,
        visible: false,
        pinned: false,
        order: 102,
      },
      {
        key: 'execution_duration',
        title: 'Duration (s)',
        dataIndex: 'execution_duration',
        type: 'number',
        width: 100,
        visible: false,
        pinned: false,
        order: 103,
      },
    ];
    return enhancedColumns;
  }, [sharedColumns]);

  // Search and selection state (local state since they don't need to sync)
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Get visualized row keys from store (converted from string run IDs to numbers)
  const visualizedRowKeys = useMemo(() => {
    return getVisibleIdsFromMap(visibleRuns, 'executions');
  }, [visibleRuns]);

  // Build rowColors: map numeric ID -> color (from store, no recomputation)
  const rowColors = useMemo(() => {
    const result: Record<number, string> = {};
    Object.entries(runColors).forEach(([key, color]) => {
      if (key.startsWith('exec_')) {
        const numId = Number(key.slice(5));
        if (!isNaN(numId)) result[numId] = color;
      }
    });
    return result;
  }, [runColors]);

  // Handle visibility change from table - sync to store
  const handleVisualizeChange = useCallback(
    (keys: React.Key[]) => {
      const newIds = new Set(keys.map((k) => Number(k)));
      const oldIds = new Set(visualizedRowKeys);

      // Find items to show (added)
      const toShow = [...newIds].filter((id) => !oldIds.has(id));
      // Find items to hide (removed)
      const toHide = [...oldIds].filter((id) => !newIds.has(id));

      if (toShow.length > 0) {
        setItemsVisible('executions', toShow, true);
      }
      if (toHide.length > 0) {
        setItemsVisible('executions', toHide, false);
      }
    },
    [visualizedRowKeys, setItemsVisible]
  );

  // Fetch executions data
  const { data: executionsData, isLoading } = useQuery({
    queryKey: [
      'executions',
      projectName,
      currentPage,
      pageSize,
      searchText,
      sortFields,
    ],
    queryFn: () => {
      // Use search API when sort fields are present
      if (sortFields.length > 0) {
        return executionApi.searchExecutions({
          page: currentPage,
          size: pageSize,
          search: searchText || undefined,
          sort_by: sortFields.map((sf) => ({
            field: sf.field,
            order: sf.order,
          })),
        });
      }

      return executionApi.getExecutions({
        page: currentPage,
        size: pageSize,
      });
    },
  });

  // Transform API data to table format, with mock data fallback
  const tableData = useMemo(() => {
    // If API returns data, use it
    if (executionsData?.items && executionsData.items.length > 0) {
      return executionsData.items.map((item: ExecutionResp) => {
        // Use type assertion for optional field
        const execDuration = (
          item as ExecutionResp & { execution_duration?: number }
        ).execution_duration;
        return {
          id: item.id ?? 0,
          name: `exec_${String(item.id).padStart(3, '0')}`,
          notes: '',
          algorithm_name: item.algorithm_name ?? '-',
          algorithm_version: item.algorithm_version ?? '-',
          state: item.state ?? 'initial',
          datapack_id: item.datapack_id
            ? String(item.datapack_id).substring(0, 8)
            : '-',
          injection_name: '-',
          runtime: formatDuration(execDuration),
          execution_duration: execDuration ?? 0,
          created_at: item.created_at ?? new Date().toISOString(),
          updated_at: item.updated_at ?? item.created_at,
          labels: item.labels?.map((l) => l.key) ?? [],
        };
      });
    }

    // Use mock data as fallback
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    let filtered = MOCK_EXECUTIONS;

    // Apply search filter
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filtered = MOCK_EXECUTIONS.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerSearch) ||
          item.algorithm_name.toLowerCase().includes(lowerSearch) ||
          item.injection_name.toLowerCase().includes(lowerSearch)
      );
    }

    return filtered.slice(start, end);
  }, [executionsData, currentPage, pageSize, searchText]);

  // Total count (API or mock)
  const totalCount = useMemo(() => {
    if (executionsData?.pagination?.total) {
      return executionsData.pagination.total;
    }
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      return MOCK_EXECUTIONS.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerSearch) ||
          item.algorithm_name.toLowerCase().includes(lowerSearch) ||
          item.injection_name.toLowerCase().includes(lowerSearch)
      ).length;
    }
    return MOCK_EXECUTIONS.length;
  }, [executionsData, searchText]);

  // Initialize visibility for items when data loads
  useEffect(() => {
    if (tableData.length > 0) {
      // Initialize visibility in store (will only set if not already initialized)
      initializeVisibility(
        'executions',
        tableData.map((d) => d.id),
        5 // Default: first 5 visible
      );
    }
  }, [tableData, initializeVisibility]);

  // Handle pagination change
  const handlePaginationChange = (page: number, size: number) => {
    setCurrentPage(page);
    if (size !== pageSize) {
      setPageSize(size);
    }
  };

  // Handle row click - navigate to detail with state for instant display
  const handleRowClick = (record: ExecutionTableData) => {
    navigate(`/${teamName}/${projectName}/executions/${record.id}`, {
      state: {
        execution: { id: record.id, name: record.name, state: record.state },
      },
    });
  };

  // Handle new execution
  const handleNewClick = () => {
    navigate(`/${teamName}/${projectName}/executions/new`);
  };

  // Handle filter click (placeholder for now)
  const handleFilterClick = () => {
    // TODO: Implement filter modal/drawer
  };

  // Handle export to CSV
  const handleExportClick = () => {
    if (tableData.length === 0) return;

    // Generate CSV content
    const headers = columns
      .filter((col) => col.visible)
      .map((col) => col.title);
    const rows = tableData.map((row) =>
      columns
        .filter((col) => col.visible)
        .map((col) => {
          const value = row[col.dataIndex as keyof ExecutionTableData];
          if (Array.isArray(value)) return value.join('; ');
          return String(value ?? '');
        })
    );

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `executions-${projectName}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Bulk action handlers
  const handleBulkDelete = useCallback(() => {
    Modal.confirm({
      title: 'Delete Executions',
      content: `Are you sure you want to delete ${selectedRowKeys.length} execution(s)?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        // TODO: Implement bulk delete API call
        message.success(`Deleted ${selectedRowKeys.length} execution(s)`);
        setSelectedRowKeys([]);
      },
    });
  }, [selectedRowKeys]);

  const handleBulkAddTags = useCallback(() => {
    // TODO: Implement tag modal
    message.info('Add tags feature coming soon');
  }, []);

  const handleBulkMoveToProject = useCallback(() => {
    // TODO: Implement move to project modal
    message.info('Move to project feature coming soon');
  }, []);

  // Custom name renderer - simplified to show only name
  const renderName = (record: { name: string }) => (
    <Text strong>{record.name}</Text>
  );

  // Custom status renderer
  const renderStatus = (record: { state: string }) => {
    const status = statusDisplayMap[record.state] || {
      text: record.state,
      color: '#6b7280',
    };
    return (
      <Tag color={status.color} style={{ fontSize: '11px' }}>
        {status.text}
      </Tag>
    );
  };

  // Custom cell renderer
  const renderCell = (
    _key: string,
    _value: unknown,
    record: ExecutionTableData
  ): React.ReactNode => {
    if (_key === 'labels') {
      const labels = (record.labels || []).filter(Boolean) as string[];
      if (labels.length === 0) return <Text type='secondary'>-</Text>;
      return (
        <Space size='small' wrap>
          {labels.slice(0, 2).map((label, i) => (
            <Tag key={i} icon={<TagOutlined />} style={{ fontSize: '10px' }}>
              {label}
            </Tag>
          ))}
          {labels.length > 2 && (
            <Tag style={{ fontSize: '10px' }}>+{labels.length - 2}</Tag>
          )}
        </Space>
      );
    }
    if (_key === 'datapack_id') {
      return (
        <Space>
          <DatabaseOutlined style={{ color: '#3b82f6' }} />
          <Text code style={{ fontSize: '11px' }}>
            {record.datapack_id}
          </Text>
        </Space>
      );
    }
    return undefined;
  };

  return (
    <div className='project-execution-list'>
      {/* Workspace header */}
      <WorkspacePageHeader
        workspaceName={workspaceName}
        workspaceType='personal'
        lastSaved={new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}
        runsPanelCollapsed={runsPanelCollapsed}
        onToggleRunsPanel={handleToggleRunsPanel}
      />

      <WorkspaceTable
        dataSource={tableData}
        loading={isLoading}
        total={totalCount}
        title='Executions'
        storageKey={`executions-${projectName}`}
        columns={columns}
        onColumnsChange={setColumns}
        selectedRowKeys={selectedRowKeys}
        onSelectChange={setSelectedRowKeys}
        visualizedRowKeys={visualizedRowKeys}
        onVisualizeChange={handleVisualizeChange}
        searchText={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder='Search executions...'
        currentPage={currentPage}
        pageSize={pageSize}
        onPaginationChange={handlePaginationChange}
        sortFields={sortFields}
        onSortFieldsChange={setSortFields}
        defaultSortField='created_at'
        defaultSortOrder='desc'
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        onRowClick={handleRowClick}
        onNewClick={handleNewClick}
        onFilterClick={handleFilterClick}
        onExportClick={handleExportClick}
        newButtonText='New Execution'
        renderName={renderName}
        renderStatus={renderStatus}
        renderCell={renderCell}
        rowColors={rowColors}
        statusField='state'
        onBackClick={handleBackToWorkspace}
        backTooltip='Back to Workspace'
        onBulkDelete={handleBulkDelete}
        onBulkAddTags={handleBulkAddTags}
        onBulkMoveToProject={handleBulkMoveToProject}
      />
    </div>
  );
};

export default ProjectExecutionList;

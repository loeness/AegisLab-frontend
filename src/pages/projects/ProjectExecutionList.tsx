/**
 * ProjectExecutionList - W&B-style execution list page for workspace
 *
 * Displays executions in a W&B Table format with:
 * - Row visibility toggles
 * - Status color dots
 * - Column management
 * - Search and filtering (client-side)
 * - Shared filter/group/sort/columns state with workspace sidebar
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useNavigate,
  useOutletContext,
  useSearchParams,
} from 'react-router-dom';

import { DatabaseOutlined, TagOutlined } from '@ant-design/icons';
import type { ExecutionResp } from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';
import { Input, message, Modal, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

import { executionApi } from '@/api/executions';
import { projectApi } from '@/api/projects';
import BatchProgressBanner from '@/components/workspace/BatchProgressBanner';
import WorkspacePageHeader from '@/components/workspace/WorkspacePageHeader';
import WorkspaceTable from '@/components/workspace/WorkspaceTable';
import type { ProjectOutletContext } from '@/hooks/useProjectContext';
import { useAuthStore } from '@/store/auth';
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
  initial: { text: 'Initial', color: 'var(--color-secondary-300)' },
  pending: { text: 'Pending', color: 'var(--color-warning)' },
  running: { text: 'Running', color: 'var(--color-primary-500)' },
  success: { text: 'Success', color: 'var(--color-success)' },
  failed: { text: 'Failed', color: 'var(--color-error)' },
  finished: { text: 'Finished', color: 'var(--color-success)' },
  crashed: { text: 'Crashed', color: 'var(--color-warning)' },
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

const ProjectExecutionList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { teamName, projectName, projectId } =
    useOutletContext<ProjectOutletContext>();
  const { user } = useAuthStore();

  // Batch execution group tracking from URL query params
  const groupIdFromUrl = searchParams.get('group_id');
  const [dismissedGroupId, setDismissedGroupId] = useState<string | null>(null);
  const activeGroupId =
    groupIdFromUrl && groupIdFromUrl !== dismissedGroupId
      ? groupIdFromUrl
      : null;

  const handleDismissBanner = useCallback(() => {
    if (groupIdFromUrl) {
      setDismissedGroupId(groupIdFromUrl);
      // Clean up the URL param
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('group_id');
      setSearchParams(newParams, { replace: true });
    }
  }, [groupIdFromUrl, searchParams, setSearchParams]);

  // Handle back to workspace
  const handleBackToWorkspace = () => {
    navigate(`/${teamName}/${projectName}/workspace`);
  };

  // Table settings local state (workspace store removed)
  const [executionsTableSettings, setExecutionsTableSettingsRaw] = useState({
    sortFields: [] as SortField[],
    groupBy: null as string | null,
    pageSize: 20,
    currentPage: 1,
    columns: [] as ColumnConfig[],
    searchText: '',
    filters: {} as Record<string, unknown>,
  });
  const setExecutionsTableSettings = useCallback(
    (update: Partial<typeof executionsTableSettings>) =>
      setExecutionsTableSettingsRaw((prev) => ({ ...prev, ...update })),
    []
  );
  const [runsPanelCollapsed, setRunsPanelCollapsed] = useState(false);
  const [visibleRuns, setVisibleRunsState] = useState<Record<string, boolean>>(
    {}
  );
  const setItemsVisible = useCallback(
    (_type: string, ids: number[], visible: boolean) => {
      setVisibleRunsState((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          next[`exec_${id}`] = visible;
        });
        return next;
      });
    },
    []
  );
  const initializeVisibility = useCallback(
    (_type: string, ids: number[], defaultCount: number) => {
      setVisibleRunsState((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const next: Record<string, boolean> = {};
        ids.forEach((id, i) => {
          next[`exec_${id}`] = i < defaultCount;
        });
        return next;
      });
    },
    []
  );

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

  // rowColors: empty since per-run coloring is not yet implemented
  const rowColors = useMemo(() => {
    return {} as Record<number, string>;
  }, []);

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
  const {
    data: executionsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['executions', projectId, currentPage, pageSize],
    queryFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      return projectApi.getExecutions(projectId, {
        page: currentPage,
        size: pageSize,
      });
    },
    enabled: !!projectId,
  });

  // Transform API data to table format
  const allTableData = useMemo(() => {
    if (!executionsData?.items) return [];
    return executionsData.items.map((item: ExecutionResp) => {
      const execDuration = (
        item as ExecutionResp & { execution_duration?: number }
      ).execution_duration;
      return {
        id: item.id ?? 0,
        // ExecutionResp has no name field; derive from algorithm_name or fall back to ID
        name: item.algorithm_name ?? `exec_${String(item.id).padStart(3, '0')}`,
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
  }, [executionsData]);

  // Apply client-side search and sort
  const tableData = useMemo(() => {
    let filtered = allTableData;

    // Client-side search filter
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(lowerSearch) ||
          item.algorithm_name.toLowerCase().includes(lowerSearch) ||
          item.injection_name.toLowerCase().includes(lowerSearch)
      );
    }

    // Client-side sort
    if (sortFields.length > 0) {
      filtered = [...filtered].sort((a, b) => {
        for (const sf of sortFields) {
          const aVal = a[sf.field as keyof ExecutionTableData];
          const bVal = b[sf.field as keyof ExecutionTableData];
          if (aVal == null || bVal == null) continue;
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          if (cmp !== 0) return sf.order === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    return filtered;
  }, [allTableData, searchText, sortFields]);

  // Total count - use search-filtered length if searching client-side, otherwise API total
  const totalCount = useMemo(() => {
    if (searchText) {
      return tableData.length;
    }
    return executionsData?.pagination?.total ?? 0;
  }, [executionsData, searchText, tableData.length]);

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
        try {
          await executionApi.batchDelete(selectedRowKeys.map(Number));
          message.success(`Deleted ${selectedRowKeys.length} execution(s)`);
          setSelectedRowKeys([]);
          refetch();
        } catch {
          message.error('Failed to delete executions');
        }
      },
    });
  }, [selectedRowKeys, refetch]);

  const handleBulkAddTags = useCallback(() => {
    let tagKey = '';
    let tagValue = '';
    Modal.confirm({
      title: `Add Labels to ${selectedRowKeys.length} Execution(s)`,
      content: (
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Input
            placeholder='Label key'
            onChange={(e) => {
              tagKey = e.target.value;
            }}
          />
          <Input
            placeholder='Label value'
            onChange={(e) => {
              tagValue = e.target.value;
            }}
          />
        </div>
      ),
      okText: 'Add Label',
      cancelText: 'Cancel',
      onOk: async () => {
        if (!tagKey.trim()) {
          message.warning('Label key is required');
          return Promise.reject();
        }
        try {
          await Promise.all(
            selectedRowKeys.map((key) =>
              executionApi.updateLabels(Number(key), [
                { key: tagKey.trim(), value: tagValue.trim() },
              ])
            )
          );
          message.success(
            `Label added to ${selectedRowKeys.length} execution(s)`
          );
          setSelectedRowKeys([]);
          refetch();
        } catch {
          message.error('Failed to add labels');
        }
      },
    });
  }, [selectedRowKeys, refetch]);

  // Custom name renderer - simplified to show only name
  const renderName = (record: { name: string }) => (
    <Text strong>{record.name}</Text>
  );

  // Custom status renderer
  const renderStatus = (record: { state: string }) => {
    const status = statusDisplayMap[record.state] || {
      text: record.state,
      color: 'var(--color-secondary-500)',
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
          <DatabaseOutlined style={{ color: 'var(--color-primary-500)' }} />
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
        lastSaved={undefined}
        runsPanelCollapsed={runsPanelCollapsed}
        onToggleRunsPanel={handleToggleRunsPanel}
      />

      {/* Batch execution progress banner */}
      {activeGroupId && (
        <BatchProgressBanner
          groupId={activeGroupId}
          onDismiss={handleDismissBanner}
        />
      )}

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
        onExportClick={handleExportClick}
        newButtonText='New Execution'
        renderName={renderName}
        renderStatus={renderStatus}
        renderCell={renderCell}
        rowColors={rowColors}
        onBackClick={handleBackToWorkspace}
        backTooltip='Back to Workspace'
        onBulkDelete={handleBulkDelete}
        onBulkAddTags={handleBulkAddTags}
      />
    </div>
  );
};

export default ProjectExecutionList;

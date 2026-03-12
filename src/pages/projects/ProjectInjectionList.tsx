/**
 * ProjectInjectionList - W&B-style injection list page for workspace
 *
 * Displays injections in a W&B Table format with:
 * - Row visibility toggles
 * - Status color dots
 * - Column management
 * - Search and filtering
 * - Shared filter/group/sort/columns state with workspace sidebar
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { TagOutlined } from '@ant-design/icons';
import {
  DatapackStateString,
  type InjectionResp,
  PageSize,
} from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';
import { message, Modal, Space, Tag, Typography } from 'antd';

import { projectApi } from '@/api/projects';
import WorkspacePageHeader from '@/components/workspace/WorkspacePageHeader';
import WorkspaceTable from '@/components/workspace/WorkspaceTable';
import { COLORS } from '@/consts/consts';
import type { ProjectOutletContext } from '@/hooks/useProjectContext';
import { useAuthStore } from '@/store/auth';
import { useWorkspaceStore } from '@/store/workspace';
import type { ColumnConfig, SortField } from '@/types/workspace';
import { getVisibleIdsFromMap } from '@/utils/idUtils';

import './ProjectInjectionList.css';

const { Text } = Typography;

// Table data type
interface InjectionTableData {
  id: number;
  name: string;
  fault_type: string;
  state: string;
  benchmark_name: string;
  pedestal_name: string;
  created_at: string;
  updated_at?: string;
  labels: string[];
  pre_duration: number;
}

// State display mapping
const stateDisplayMap: Record<string, { text: string; color: string }> = {
  [DatapackStateString.InitialName]: { text: 'Initial', color: COLORS.GRAY },
  [DatapackStateString.InjectFailedName]: {
    text: 'Inject Failed',
    color: COLORS.RED,
  },
  [DatapackStateString.InjectSuccessName]: {
    text: 'Inject Success',
    color: COLORS.BLUE,
  },
  [DatapackStateString.BuildFailedName]: {
    text: 'Build Failed',
    color: COLORS.RED,
  },
  [DatapackStateString.BuildSuccessName]: {
    text: 'Build Success',
    color: COLORS.BLUE,
  },
  [DatapackStateString.DetectorFailedName]: {
    text: 'Detector Failed',
    color: COLORS.RED,
  },
  [DatapackStateString.DetectorSuccessName]: {
    text: 'Detector Success',
    color: COLORS.GREEN,
  },
};

// Convert numeric page size to PageSize enum
const toPageSizeEnum = (size: number): PageSize => {
  if (size <= 10) return PageSize.Small;
  if (size <= 20) return PageSize.Medium;
  return PageSize.Large;
};

// Filter injections by search text
const filterInjectionsBySearch = (
  items: InjectionResp[],
  searchText: string
): InjectionResp[] => {
  if (!searchText) return items;
  const lowerSearch = searchText.toLowerCase();
  return items.filter(
    (item) =>
      item.name?.toLowerCase().includes(lowerSearch) ||
      item.fault_type?.toLowerCase().includes(lowerSearch) ||
      item.benchmark_name?.toLowerCase().includes(lowerSearch) ||
      item.pedestal_name?.toLowerCase().includes(lowerSearch)
  );
};

const ProjectInjectionList: React.FC = () => {
  const navigate = useNavigate();
  const { teamName, projectName, projectId } =
    useOutletContext<ProjectOutletContext>();
  const { user } = useAuthStore();

  // Handle back to workspace
  const handleBackToWorkspace = () => {
    navigate(`/${teamName}/${projectName}/workspace`);
  };

  // Get shared table settings and visibility state from workspace store
  const {
    injectionsTableSettings,
    setInjectionsTableSettings,
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

  // Search and selection state (local state since they don't need to sync)
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Extract values from shared settings
  const {
    sortFields,
    groupBy,
    pageSize,
    currentPage,
    columns: sharedColumns,
  } = injectionsTableSettings;

  // Callbacks to update shared settings
  const setSortFields = useCallback(
    (fields: SortField[]) => setInjectionsTableSettings({ sortFields: fields }),
    [setInjectionsTableSettings]
  );

  const setGroupBy = useCallback(
    (field: string | null) => setInjectionsTableSettings({ groupBy: field }),
    [setInjectionsTableSettings]
  );

  const setCurrentPage = useCallback(
    (page: number) => setInjectionsTableSettings({ currentPage: page }),
    [setInjectionsTableSettings]
  );

  const setPageSize = useCallback(
    (size: number) =>
      setInjectionsTableSettings({ pageSize: size, currentPage: 1 }),
    [setInjectionsTableSettings]
  );

  const setColumns = useCallback(
    (cols: ColumnConfig[]) => setInjectionsTableSettings({ columns: cols }),
    [setInjectionsTableSettings]
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
        width: 150,
        visible: true,
        pinned: false,
        order: 0,
        sortable: true,
      },
      {
        key: 'fault_type',
        title: 'Fault Type',
        dataIndex: 'fault_type',
        type: 'text',
        width: 120,
        visible: true,
        pinned: false,
        order: 1,
        filterable: true,
      },
      {
        key: 'state',
        title: 'State',
        dataIndex: 'state',
        type: 'status',
        width: 120,
        visible: true,
        pinned: false,
        order: 2,
        filterable: true,
      },
      {
        key: 'pre_duration',
        title: 'Pre_Duration',
        dataIndex: 'pre_duration',
        type: 'duration',
        width: 100,
        visible: true,
        pinned: false,
        order: 3,
      },
      {
        key: 'benchmark_name',
        title: 'Benchmark',
        dataIndex: 'benchmark_name',
        type: 'text',
        width: 80,
        visible: true,
        pinned: false,
        order: 4,
      },
      {
        key: 'pedestal_name',
        title: 'Pedestal',
        dataIndex: 'pedestal_name',
        type: 'text',
        width: 120,
        visible: true,
        pinned: false,
        order: 5,
      },
      {
        key: 'created_at',
        title: 'Created',
        dataIndex: 'created_at',
        type: 'date',
        width: 120,
        visible: true,
        pinned: false,
        order: 6,
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
        order: 7,
      },
    ];
    return enhancedColumns;
  }, [sharedColumns]);

  // Get visualized row keys from store (converted from string run IDs to numbers)
  const visualizedRowKeys = useMemo(() => {
    return getVisibleIdsFromMap(visibleRuns, 'injections');
  }, [visibleRuns]);

  // Build rowColors: map numeric ID -> color (from store, no recomputation)
  const rowColors = useMemo(() => {
    const result: Record<number, string> = {};
    Object.entries(runColors).forEach(([key, color]) => {
      if (key.startsWith('inj_')) {
        const numId = Number(key.slice(4));
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
        setItemsVisible('injections', toShow, true);
      }
      if (toHide.length > 0) {
        setItemsVisible('injections', toHide, false);
      }
    },
    [visualizedRowKeys, setItemsVisible]
  );

  // Normalize sortFields for stable cache key (omit generated `key` field)
  const normalizedSortFields = sortFields.map((sf) => ({
    field: sf.field,
    order: sf.order,
  }));

  // Default sort = empty or exactly [created_at desc] — treated as "no sort condition"
  const isDefaultSort =
    normalizedSortFields.length === 0 ||
    (normalizedSortFields.length === 1 &&
      normalizedSortFields[0].field === 'created_at' &&
      normalizedSortFields[0].order === 'desc');

  // Determine whether any active conditions require the search API
  const hasSearchConditions =
    !!searchText ||
    !isDefaultSort ||
    !!groupBy ||
    Object.keys(injectionsTableSettings.filters || {}).length > 0;

  // Fetch injections data
  const { data: injectionsData, isLoading } = useQuery({
    queryKey: [
      'injections',
      projectId,
      currentPage,
      pageSize,
      searchText,
      normalizedSortFields,
      groupBy,
    ],
    queryFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      if (hasSearchConditions) {
        return projectApi.searchProjectInjections(projectId, {
          page: currentPage,
          size: pageSize,
          search: searchText || undefined,
          sort_by:
            normalizedSortFields.length > 0 ? normalizedSortFields : undefined,
        });
      }
      return projectApi.listProjectInjections(projectId, {
        page: currentPage,
        size: toPageSizeEnum(pageSize),
      });
    },
    enabled: !!projectId,
    staleTime: 0,
  });

  // Transform API data to table format, with mock data fallback
  const tableData = useMemo((): InjectionTableData[] => {
    // If API returns data, use it
    if (injectionsData?.items && injectionsData.items.length > 0) {
      return injectionsData.items.map((item: InjectionResp) => ({
        id: item.id ?? 0,
        name: item.name ?? `Injection #${item.id}`,
        fault_type: item.fault_type ?? 'unknown',
        state: item.state ?? 'unknown',
        benchmark_name: item.benchmark_name ?? '-',
        pedestal_name: item.pedestal_name ?? '-',
        created_at: item.created_at ?? new Date().toISOString(),
        updated_at: item.updated_at ?? item.created_at,
        labels: item.labels?.map((l) => l.key ?? '') ?? [],
        pre_duration: item.pre_duration ?? 0,
      }));
    }

    // Use mock data as fallback (when no data or empty array)
    return [];
  }, [injectionsData]);

  // Total count (API or mock)
  const totalCount = useMemo(() => {
    if (injectionsData?.total) {
      return injectionsData.total;
    }
    if (searchText && injectionsData?.items) {
      return filterInjectionsBySearch(injectionsData.items, searchText).length;
    }
    return injectionsData?.items?.length ?? 0;
  }, [injectionsData, searchText]);

  // Initialize visibility for items when data loads
  useEffect(() => {
    if (tableData.length > 0 && !isLoading) {
      // Initialize visibility in store (will only set if not already initialized)
      initializeVisibility(
        'injections',
        tableData.map((d) => d.id),
        Math.min(5, tableData.length) // Default: first 5 visible or all if less
      );
    }
  }, [tableData, initializeVisibility, isLoading]);

  // Handle pagination change
  const handlePaginationChange = (page: number, size: number) => {
    setCurrentPage(page);
    if (size !== pageSize) {
      setPageSize(size);
    }
  };

  // Handle row click - navigate to detail with state for instant display
  const handleRowClick = (record: InjectionTableData) => {
    navigate(`/${teamName}/${projectName}/injections/${record.id}`, {
      state: { injection: { name: record.name, state: record.state } },
    });
  };

  // Handle new injection
  const handleNewClick = () => {
    navigate(`/${teamName}/${projectName}/injections/create`);
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
          const value = row[col.dataIndex as keyof InjectionTableData];
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
    link.download = `injections-${projectName}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Bulk action handlers
  const handleBulkDelete = useCallback(() => {
    Modal.confirm({
      title: 'Delete Injections',
      content: `Are you sure you want to delete ${selectedRowKeys.length} injection(s)?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        // TODO: Implement bulk delete API call
        message.success(`Deleted ${selectedRowKeys.length} injection(s)`);
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
  const renderName = (record: InjectionTableData) => (
    <Text strong>{record.name}</Text>
  );

  // Custom status renderer
  const renderStatus = (record: InjectionTableData) => {
    const state = stateDisplayMap[record.state] || {
      text: record.state,
      color: '#6b7280',
    };
    return (
      <Tag color={state.color} style={{ fontSize: '11px' }}>
        {state.text}
      </Tag>
    );
  };

  // Custom cell renderer for labels
  const renderCell = (
    _key: string,
    _value: unknown,
    record: InjectionTableData
  ): React.ReactNode => {
    if (_key === 'labels') {
      const labels = (record.labels || []).filter(Boolean);
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
    return undefined;
  };

  return (
    <div className='project-injection-list'>
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
        title='Injections'
        storageKey={`injections-${projectName}`}
        columns={columns}
        onColumnsChange={setColumns}
        selectedRowKeys={selectedRowKeys}
        onSelectChange={setSelectedRowKeys}
        visualizedRowKeys={visualizedRowKeys}
        onVisualizeChange={handleVisualizeChange}
        searchText={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder='Search injections...'
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
        newButtonText='New Injection'
        renderName={renderName}
        renderStatus={renderStatus}
        renderCell={renderCell}
        rowColors={rowColors}
        onBackClick={handleBackToWorkspace}
        backTooltip='Back to Workspace'
        onBulkDelete={handleBulkDelete}
        onBulkAddTags={handleBulkAddTags}
        onBulkMoveToProject={handleBulkMoveToProject}
      />
    </div>
  );
};

export default ProjectInjectionList;

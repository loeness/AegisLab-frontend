import { useEffect, useMemo, useState } from 'react';

import {
  ExpandOutlined,
  FilterOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
  ShrinkOutlined,
} from '@ant-design/icons';
import { Badge, Button, Input, Space, Tooltip, Typography } from 'antd';

import { useRunListSettings } from '@/hooks/useRunListSettings';
import { useWorkspaceStore } from '@/store/workspace';
import type {
  ColumnConfig,
  Run,
  RunsDataSource,
  SortField,
} from '@/types/workspace';
import { getColor } from '@/utils/colors';
import { fromRunId } from '@/utils/idUtils';

import ColumnManager from './ColumnManager';
import GroupDropdown from './GroupDropdown';
import RunListDropdown from './RunListDropdown';
import RunListItem from './RunListItem';
import SortDropdown from './SortDropdown';

import './RunsPanel.css';

const { Text } = Typography;

interface RunsPanelProps {
  runs: Run[];
  totalRuns: number;
  visibleRuns: Record<string, boolean>;
  runColors?: Record<string, string>;
  selectedRuns: string[];
  page: number;
  pageSize: number;
  loading?: boolean;
  collapsed?: boolean;
  dataSource: RunsDataSource;
  onDataSourceChange: (source: RunsDataSource) => void;
  onToggleVisibility: (runId: string) => void;
  onSelectRun: (runId: string) => void;
  onPageChange: (page: number, pageSize?: number) => void;
  onSearch: (query: string) => void;
  onCollapse?: () => void;
  onExpand?: () => void;
  onFilterClick?: () => void;
}

/**
 * Panel displaying list of runs/executions
 * Supports visibility toggle, selection, search, and pagination
 * Includes filter/group/sort/columns controls that sync with standalone list pages
 */
const RunsPanel: React.FC<RunsPanelProps> = ({
  runs,
  totalRuns,
  visibleRuns,
  runColors = {},
  selectedRuns,
  page,
  pageSize,
  loading = false,
  collapsed = false,
  dataSource,
  onDataSourceChange,
  onToggleVisibility,
  onSelectRun,
  onPageChange,
  onSearch,
  onCollapse,
  onExpand,
  onFilterClick,
}) => {
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);

  // Get shared table settings from workspace store
  const {
    injectionsTableSettings,
    executionsTableSettings,
    setInjectionsTableSettings,
    setExecutionsTableSettings,
  } = useWorkspaceStore();

  // Get shared display settings from hook
  const { cropMode, sortOrder, setCropMode, setSortOrder, randomizeColors } =
    useRunListSettings({ dataSource });

  // Select the appropriate settings based on data source
  const tableSettings =
    dataSource === 'injections'
      ? injectionsTableSettings
      : executionsTableSettings;
  const setTableSettings =
    dataSource === 'injections'
      ? setInjectionsTableSettings
      : setExecutionsTableSettings;

  // Initialize search value from store (for sync with list pages)
  const [searchValue, setSearchValue] = useState(
    tableSettings.searchText || ''
  );

  // Sync searchValue with store when dataSource changes or store value changes externally
  useEffect(() => {
    setSearchValue(tableSettings.searchText || '');
  }, [dataSource, tableSettings.searchText]);

  // Get columns from shared settings
  const columns = tableSettings.columns || [];

  // Apply sorting and search from tableSettings to runs
  const processedRuns = useMemo(() => {
    let result = [...runs];

    // Apply search filter from store (in case it differs from local search)
    const searchText = tableSettings.searchText || '';
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      result = result.filter((run) =>
        run.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting from store
    const sortFields = tableSettings.sortFields || [];
    if (sortFields.length > 0) {
      result.sort((a, b) => {
        for (const sortField of sortFields) {
          const field = sortField.field as keyof Run;
          const aVal = a[field];
          const bVal = b[field];

          // Handle different types
          let comparison = 0;
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            comparison = aVal.localeCompare(bVal);
          } else if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal;
          } else if (aVal !== undefined && bVal !== undefined) {
            comparison = String(aVal).localeCompare(String(bVal));
          }

          if (comparison !== 0) {
            return sortField.order === 'desc' ? -comparison : comparison;
          }
        }
        return 0;
      });
    }

    return result;
  }, [runs, tableSettings.searchText, tableSettings.sortFields]);

  // Count visible runs
  const visibleCount = Object.values(visibleRuns).filter(Boolean).length;

  // Pagination computed values
  const startItem = totalRuns > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(page * pageSize, totalRuns);
  const isFirstPage = page <= 1;
  const isLastPage = page * pageSize >= totalRuns;

  // Handle search
  const handleSearch = (value: string) => {
    setSearchValue(value);
    onSearch(value);
    setTableSettings({ searchText: value });
  };

  // Handle group change
  const handleGroupChange = (field: string | null) => {
    setTableSettings({ groupBy: field });
  };

  // Handle sort change
  const handleSortChange = (sortFields: SortField[]) => {
    setTableSettings({ sortFields });
  };

  // Handle columns change
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setTableSettings({ columns: newColumns });
  };

  // Handle page navigation
  const handlePrevPage = () => {
    if (!isFirstPage) {
      onPageChange(page - 1, pageSize);
    }
  };

  const handleNextPage = () => {
    if (!isLastPage) {
      onPageChange(page + 1, pageSize);
    }
  };

  // Check if filters are active
  const hasActiveFilters = Object.keys(tableSettings.filters || {}).length > 0;

  if (collapsed) {
    return null;
  }

  return (
    <div className='runs-panel'>
      {/* Header */}
      <div className='runs-panel-header'>
        <div className='runs-panel-title'>
          <Button
            type='text'
            size='small'
            onClick={() =>
              onDataSourceChange(
                dataSource === 'injections' ? 'executions' : 'injections'
              )
            }
            className='runs-panel-source-toggle'
          >
            {dataSource === 'injections' ? 'Injections' : 'Executions'}
          </Button>
          <Badge count={totalRuns} showZero className='runs-panel-count' />
        </div>
        <Space size={4}>
          <Tooltip title='Expand to full page'>
            <Button
              type='text'
              size='small'
              icon={<ExpandOutlined />}
              onClick={onExpand}
            />
          </Tooltip>
          <Tooltip title='Minimize panel'>
            <Button
              type='text'
              size='small'
              icon={<ShrinkOutlined />}
              onClick={onCollapse}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Search */}
      <div className='runs-panel-search'>
        <Input
          prefix={<SearchOutlined />}
          placeholder={`Search ${dataSource}`}
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          allowClear
          size='small'
        />
      </div>

      {/* Filter/Group/Sort/Columns controls - icon only in sidebar */}
      <div className='runs-panel-controls'>
        <Space size={4} wrap>
          {/* Filter button */}
          <Tooltip title='Filter'>
            <Button
              type='text'
              size='small'
              icon={<FilterOutlined />}
              onClick={onFilterClick}
              className={`action-button ${hasActiveFilters ? 'active' : ''}`}
            />
          </Tooltip>
          <GroupDropdown
            columns={columns}
            groupBy={tableSettings.groupBy}
            onGroupChange={handleGroupChange}
            iconOnly
          />
          <SortDropdown
            columns={columns}
            sortFields={tableSettings.sortFields || []}
            onSortChange={handleSortChange}
            defaultSortField='created_at'
            defaultSortOrder='desc'
            iconOnly
          />
          {/* Columns button - opens ColumnManager modal */}
          <Tooltip title='Columns'>
            <Button
              type='text'
              size='small'
              icon={<SettingOutlined />}
              onClick={() => setColumnManagerOpen(true)}
              className='action-button'
            />
          </Tooltip>
        </Space>
      </div>

      {/* Visibility status with dropdown */}
      <div className='runs-panel-visibility-status'>
        <RunListDropdown
          visualizedCount={visibleCount}
          sortOrder={sortOrder}
          cropMode={cropMode}
          onSortOrderChange={setSortOrder}
          onCropModeChange={setCropMode}
          onRandomizeColors={randomizeColors}
        />
      </div>

      {/* Runs list */}
      <div className='runs-panel-list'>
        {loading ? (
          <div className='runs-panel-loading'>Loading...</div>
        ) : processedRuns.length === 0 ? (
          <div className='runs-panel-empty'>
            <Text type='secondary'>No {dataSource} found</Text>
          </div>
        ) : (
          processedRuns.map((run) => {
            // Read stored color first; fall back to palette if not yet initialized
            const storedColor = runColors[run.id];
            const resolvedColor =
              storedColor ??
              (() => {
                try {
                  return getColor(fromRunId(run.id).id);
                } catch {
                  return getColor(0);
                }
              })();

            return (
              <RunListItem
                key={run.id}
                id={run.id}
                name={run.name}
                status={run.status}
                color={resolvedColor}
                isVisible={visibleRuns[run.id]}
                isSelected={selectedRuns.includes(run.id)}
                showCheckbox={false}
                cropMode={cropMode}
                onVisibilityChange={() => onToggleVisibility(run.id)}
                onClick={() => onSelectRun(run.id)}
              />
            );
          })
        )}
      </div>

      {/* Pagination - W&B style fixed footer */}
      <div className='runs-panel-pagination'>
        <div className='pagination-info'>
          <span className='pagination-range'>
            {startItem}-{endItem}
          </span>
          <span>of {totalRuns}</span>
        </div>
        <div className='pagination-nav'>
          <button disabled={isFirstPage} onClick={handlePrevPage}>
            <LeftOutlined />
          </button>
          <button disabled={isLastPage} onClick={handleNextPage}>
            <RightOutlined />
          </button>
        </div>
      </div>

      {/* Column Manager Modal - same as standalone pages */}
      <ColumnManager
        open={columnManagerOpen}
        onClose={() => setColumnManagerOpen(false)}
        columns={columns}
        onColumnsChange={handleColumnsChange}
      />
    </div>
  );
};

export default RunsPanel;

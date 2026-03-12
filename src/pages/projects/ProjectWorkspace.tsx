import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { PageSize } from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';

import { projectApi } from '@/api/projects';
import ChartsPanel from '@/components/workspace/ChartsPanel';
import RunsPanel from '@/components/workspace/RunsPanel';
import WorkspacePageHeader from '@/components/workspace/WorkspacePageHeader';
import type { ProjectOutletContext } from '@/hooks/useProjectContext';
import { useAuthStore } from '@/store/auth';
import { useWorkspaceStore } from '@/store/workspace';
import type {
  Chart,
  ChartGroup,
  Run,
  RunsDataSource,
  RunStatus,
  SharedTableSettings,
} from '@/types/workspace';
import { fromRunId, toRunId } from '@/utils/idUtils';

import './ProjectWorkspace.css';

const INJECTION_STATUSES: RunStatus[] = [
  'running',
  'finished',
  'failed',
  'crashed',
];
const ALGORITHM_NAMES = [
  'RCABench',
  'MicroCause',
  'CloudRanger',
  'CIRCA',
  'DiagNet',
  'TraceAnomaly',
];

// Generate mock executions data
const generateMockExecutions = (count: number): Run[] => {
  return Array.from({ length: count }, (_, i) => {
    const algorithm =
      ALGORITHM_NAMES[Math.floor(Math.random() * ALGORITHM_NAMES.length)];
    const status =
      INJECTION_STATUSES[Math.floor(Math.random() * INJECTION_STATUSES.length)];
    return {
      id: `exec_${i + 1}`,
      name: `exec_${String(i + 1).padStart(3, '0')}`,
      status,
      created_at: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      metrics: {
        loss: Array.from(
          { length: 100 },
          (_, j) => 1 / (j + 1) + Math.random() * 0.1
        ),
        accuracy: Array.from({ length: 100 }, (_, j) =>
          Math.min(0.99, j / 100 + Math.random() * 0.1)
        ),
        f1_score: Array.from({ length: 100 }, (_, j) =>
          Math.min(0.95, j / 100 + Math.random() * 0.05)
        ),
      },
      config: {
        algorithm,
        version: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}`,
      },
    };
  });
};

// Generate mock charts
const generateMockCharts = (runs: Run[]): Chart[] => {
  const colors = [
    '#1890ff',
    '#52c41a',
    '#faad14',
    '#ff4d4f',
    '#722ed1',
    '#13c2c2',
  ];

  return [
    {
      id: 'chart_loss',
      metricKey: 'loss',
      title: 'Training Loss',
      type: 'line',
      series: runs.slice(0, 5).map((run, idx) => ({
        runId: run.id,
        runName: run.name,
        data: (run.metrics.loss || []).map((v, step) => ({ step, value: v })),
        color: colors[idx % colors.length],
        visible: true,
      })),
    },
    {
      id: 'chart_accuracy',
      metricKey: 'accuracy',
      title: 'Accuracy',
      type: 'line',
      series: runs.slice(0, 5).map((run, idx) => ({
        runId: run.id,
        runName: run.name,
        data: (run.metrics.accuracy || []).map((v, step) => ({
          step,
          value: v,
        })),
        color: colors[idx % colors.length],
        visible: true,
      })),
    },
    {
      id: 'chart_lr',
      metricKey: 'learning_rate',
      title: 'Learning Rate',
      type: 'line',
      series: [],
    },
  ];
};

// Mock chart groups
const mockChartGroups: ChartGroup[] = [
  {
    id: 'group_metrics',
    name: 'Metrics',
    collapsed: false,
    charts: ['chart_loss', 'chart_accuracy', 'chart_lr'],
  },
];

/**
 * Project Workspace Page
 * Central workspace for visualizing runs and metrics
 */
const ProjectWorkspace: React.FC = () => {
  const {
    project: _project,
    teamName,
    projectName,
    projectId,
  } = useOutletContext<ProjectOutletContext>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Get persisted state from workspace store
  const {
    runsDataSource,
    setRunsDataSource,
    runsPanelCollapsed,
    setRunsPanelCollapsed,
    // Visibility management from store
    visibleRuns,
    runColors,
    selectedRuns,
    toggleItemVisibility,
    initializeVisibility,
    // Table settings for pagination sync
    injectionsTableSettings,
    executionsTableSettings,
    setInjectionsTableSettings,
    setExecutionsTableSettings,
  } = useWorkspaceStore();

  // Get the appropriate table settings based on data source
  const tableSettings: SharedTableSettings =
    runsDataSource === 'injections'
      ? injectionsTableSettings
      : executionsTableSettings;
  const setTableSettings =
    runsDataSource === 'injections'
      ? setInjectionsTableSettings
      : setExecutionsTableSettings;

  // Extract pagination and search from shared settings (syncs with list pages)
  const {
    currentPage: page,
    pageSize,
    searchText: searchQuery,
  } = tableSettings;

  // Convert page size to enum
  const toPageSizeEnum = (size: number): PageSize => {
    if (size <= 10) return PageSize.Small;
    if (size <= 20) return PageSize.Medium;
    return PageSize.Large;
  };

  // Fetch injections data from API
  const { data: injectionsData } = useQuery({
    queryKey: ['injections', projectId, page, pageSize],
    queryFn: () => {
      if (!projectId) throw new Error('Project ID is required');
      return projectApi.listProjectInjections(projectId, {
        page,
        size: toPageSizeEnum(pageSize),
      });
    },
    enabled: !!projectId && runsDataSource === 'injections',
  });

  // Convert API injections to Run format
  const apiInjections = useMemo((): Run[] => {
    if (!injectionsData?.items) return [];
    return injectionsData.items.map((item) => ({
      id: toRunId('injections', item.id ?? 0),
      name: item.name ?? `Injection #${item.id}`,
      status: (item.state ? String(item.state) : 'unknown') as RunStatus,
      created_at: item.created_at ?? new Date().toISOString(),
      metrics: {},
      config: {
        fault_type: item.fault_type,
        benchmark: item.benchmark_name,
        pedestal: item.pedestal_name,
      },
    }));
  }, [injectionsData]);

  // Mock data for executions
  const mockExecutions = useMemo(() => generateMockExecutions(28), []);

  // Select data based on current data source
  const allRuns = useMemo(() => {
    return runsDataSource === 'injections' ? apiInjections : mockExecutions;
  }, [runsDataSource, apiInjections, mockExecutions]);

  const charts = useMemo(() => generateMockCharts(allRuns), [allRuns]);

  // Get visible runs for current data source from store
  // Convert store's prefixed IDs to the format RunsPanel expects
  const visibleRunsForPanel = useMemo(() => {
    const result: Record<string, boolean> = {};
    allRuns.forEach((run) => {
      // The run.id is already in format like 'inj_1' or 'exec_1'
      // We need to match it with our store's prefixed format
      const storeId = toRunId(runsDataSource, run.id.split('_')[1]);
      result[run.id] = visibleRuns[storeId] ?? false;
    });
    return result;
  }, [allRuns, visibleRuns, runsDataSource]);

  // Get selected runs for current data source
  const selectedRunsForPanel = useMemo(() => {
    return selectedRuns.filter((id) => {
      if (runsDataSource === 'injections') return id.startsWith('inj_');
      return id.startsWith('exec_');
    });
  }, [selectedRuns, runsDataSource]);

  // Initialize visibility when data loads
  useEffect(() => {
    if (allRuns.length > 0) {
      // Extract numeric IDs from run IDs (e.g., 'inj_1' -> 1)
      const numericIds = allRuns.map((run) => Number(run.id.split('_')[1]));
      initializeVisibility(runsDataSource, numericIds, 5);
    }
  }, [allRuns, runsDataSource, initializeVisibility]);

  // Filter and paginate runs
  const filteredRuns = useMemo(() => {
    let filtered = allRuns;
    if (searchQuery) {
      filtered = allRuns.filter((run) =>
        run.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [allRuns, searchQuery]);

  const paginatedRuns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRuns.slice(start, start + pageSize);
  }, [filteredRuns, page, pageSize]);

  // Handlers
  const handleToggleVisibility = useCallback(
    (runId: string) => {
      // Extract numeric ID from run ID (e.g., 'inj_1' -> 1)
      const numericId = Number(runId.split('_')[1]);
      toggleItemVisibility(runsDataSource, numericId);
    },
    [runsDataSource, toggleItemVisibility]
  );

  const handleSelectRun = useCallback(
    (runId: string) => {
      const { id: numericId, dataSource: runDataSource } = fromRunId(runId);
      if (runDataSource === 'injections') {
        navigate(`/${teamName}/${projectName}/injections/${numericId}`);
      } else {
        navigate(`/${teamName}/${projectName}/executions/${numericId}`);
      }
    },
    [navigate, teamName, projectName]
  );

  const handlePageChange = useCallback(
    (newPage: number, newPageSize?: number) => {
      setTableSettings({
        currentPage: newPage,
        ...(newPageSize && newPageSize !== pageSize
          ? { pageSize: newPageSize }
          : {}),
      });
    },
    [setTableSettings, pageSize]
  );

  const handleSearch = useCallback(
    (query: string) => {
      setTableSettings({
        searchText: query,
        currentPage: 1, // Reset to first page when searching
      });
    },
    [setTableSettings]
  );

  const handleToggleRunsPanel = useCallback(() => {
    setRunsPanelCollapsed(!runsPanelCollapsed);
  }, [runsPanelCollapsed, setRunsPanelCollapsed]);

  const handleDataSourceChange = useCallback(
    (source: RunsDataSource) => {
      setRunsDataSource(source);
      // Note: pagination and search are now per-data-source from store,
      // so no need to reset them here - they will automatically use the
      // correct settings when runsDataSource changes
    },
    [setRunsDataSource]
  );

  const handleExpandPanel = useCallback(() => {
    const targetPage =
      runsDataSource === 'injections' ? 'injections' : 'executions';
    navigate(`/${teamName}/${projectName}/${targetPage}`);
  }, [navigate, teamName, projectName, runsDataSource]);

  // Workspace info
  const workspaceName = `${user?.username || 'User'}'s workspace`;

  return (
    <div className='project-workspace'>
      {/* Workspace header */}
      <WorkspacePageHeader
        workspaceName={workspaceName}
        workspaceType='personal'
        lastSaved={new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}
        runsPanelCollapsed={runsPanelCollapsed}
        onToggleRunsPanel={handleToggleRunsPanel}
      />

      {/* Main content area */}
      <div className='project-workspace-content'>
        {/* Runs panel */}
        <RunsPanel
          runs={paginatedRuns}
          totalRuns={filteredRuns.length}
          visibleRuns={visibleRunsForPanel}
          runColors={runColors}
          selectedRuns={selectedRunsForPanel}
          page={page}
          pageSize={pageSize}
          collapsed={runsPanelCollapsed}
          dataSource={runsDataSource}
          onDataSourceChange={handleDataSourceChange}
          onToggleVisibility={handleToggleVisibility}
          onSelectRun={handleSelectRun}
          onPageChange={handlePageChange}
          onSearch={handleSearch}
          onCollapse={handleToggleRunsPanel}
          onExpand={handleExpandPanel}
        />

        {/* Charts panel */}
        <ChartsPanel
          charts={charts}
          groups={mockChartGroups}
          runsPanelCollapsed={runsPanelCollapsed}
          onExpandRunsPanel={handleToggleRunsPanel}
          visibleRuns={visibleRunsForPanel}
          runColors={runColors}
        />
      </div>
    </div>
  );
};

export default ProjectWorkspace;

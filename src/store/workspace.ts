import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  type Chart,
  type ChartGroup,
  createDefaultTableSettings,
  defaultRunListDisplaySettings,
  type Run,
  type RunColors,
  type RunListDisplaySettings,
  type RunNameCropMode,
  type RunsDataSource,
  type RunVisibility,
  type SharedTableSettings,
  type Workspace,
  type WorkspaceSettings,
} from '@/types/workspace';
import { getColor } from '@/utils/colors';
import {
  fromRunId,
  fromRunIds,
  getVisibleRunIdsFromMap,
  toRunId,
  toRunIds,
} from '@/utils/idUtils';

// Default colors for runs
const DEFAULT_COLORS = [
  '#1890ff', // Blue
  '#52c41a', // Green
  '#faad14', // Yellow
  '#ff4d4f', // Red
  '#722ed1', // Purple
  '#13c2c2', // Cyan
  '#eb2f96', // Magenta
  '#fa8c16', // Orange
  '#a0d911', // Lime
  '#2f54eb', // Geek Blue
];

interface WorkspaceState {
  // Current workspace
  currentWorkspace: Workspace | null;

  // Runs
  runs: Run[];
  totalRuns: number;
  selectedRuns: string[];
  visibleRuns: RunVisibility;
  runColors: RunColors;

  // Data source for RunsPanel (injections or executions)
  runsDataSource: RunsDataSource;

  // Shared table settings for injections and executions
  // These sync between RunsPanel sidebar and standalone list pages
  injectionsTableSettings: SharedTableSettings;
  executionsTableSettings: SharedTableSettings;

  // Charts
  charts: Chart[];
  chartGroups: ChartGroup[];

  // UI State
  runsPanelCollapsed: boolean;
  searchQuery: string;
  panelSearchQuery: string;
  currentPage: number;
  pageSize: number;

  // Actions
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setRuns: (runs: Run[], total: number) => void;
  toggleRunVisibility: (runId: string) => void;
  selectRun: (runId: string) => void;
  deselectRun: (runId: string) => void;
  clearSelection: () => void;
  setRunColor: (runId: string, color: string) => void;
  setCharts: (charts: Chart[]) => void;
  setChartGroups: (groups: ChartGroup[]) => void;
  toggleChartGroupCollapse: (groupId: string) => void;
  setRunsPanelCollapsed: (collapsed: boolean) => void;
  setSearchQuery: (query: string) => void;
  setPanelSearchQuery: (query: string) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setRunsDataSource: (source: RunsDataSource) => void;
  updateWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => void;
  resetWorkspace: () => void;

  // Shared table settings actions
  setInjectionsTableSettings: (settings: Partial<SharedTableSettings>) => void;
  setExecutionsTableSettings: (settings: Partial<SharedTableSettings>) => void;
  resetInjectionsTableSettings: () => void;
  resetExecutionsTableSettings: () => void;

  // === Run list display settings actions ===
  // Set display settings for a data source (synced between Table and Panel)
  setDisplaySettings: (
    dataSource: RunsDataSource,
    settings: Partial<RunListDisplaySettings>
  ) => void;
  // Set crop mode for a data source
  setCropMode: (dataSource: RunsDataSource, mode: RunNameCropMode) => void;
  // Set list sort order for a data source
  setListSortOrder: (dataSource: RunsDataSource, order: 'asc' | 'desc') => void;
  // Randomize colors for visible runs
  randomizeRunColors: (dataSource: RunsDataSource) => void;
  // Get display settings for a data source
  getDisplaySettings: (dataSource: RunsDataSource) => RunListDisplaySettings;

  // === New: Unified visibility management actions ===
  // Toggle visibility for a specific item (supports both list pages and Workspace)
  toggleItemVisibility: (
    dataSource: RunsDataSource,
    itemId: number | string
  ) => void;
  // Set visibility for multiple items
  setItemsVisible: (
    dataSource: RunsDataSource,
    itemIds: Array<number | string>,
    visible: boolean
  ) => void;
  // Initialize visibility for a list of items (only if not already initialized)
  initializeVisibility: (
    dataSource: RunsDataSource,
    itemIds: Array<number | string>,
    defaultVisibleCount?: number
  ) => void;
  // Set color for a specific item
  setItemColor: (
    dataSource: RunsDataSource,
    itemId: number | string,
    color: string
  ) => void;

  // === New: Selectors ===
  // Get visible item IDs for a specific data source (as numbers)
  getVisibleIds: (dataSource: RunsDataSource) => number[];
  // Get visible item IDs for a specific data source (as run IDs with prefix)
  getVisibleRunIds: (dataSource: RunsDataSource) => string[];
  // Check if an item is visible
  isItemVisible: (
    dataSource: RunsDataSource,
    itemId: number | string
  ) => boolean;
}

const initialState = {
  currentWorkspace: null,
  runs: [],
  totalRuns: 0,
  selectedRuns: [],
  visibleRuns: {},
  runColors: {},
  runsDataSource: 'executions' as RunsDataSource,
  injectionsTableSettings: createDefaultTableSettings('injections'),
  executionsTableSettings: createDefaultTableSettings('executions'),
  charts: [],
  chartGroups: [],
  runsPanelCollapsed: false,
  searchQuery: '',
  panelSearchQuery: '',
  currentPage: 1,
  pageSize: 20,
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentWorkspace: (workspace) => {
        set({ currentWorkspace: workspace });
      },

      setRuns: (runs, total) => {
        const { visibleRuns, runColors } = get();
        const newVisibleRuns = { ...visibleRuns };
        const newRunColors = { ...runColors };

        // Initialize visibility and colors for new runs
        runs.forEach((run, index) => {
          if (!(run.id in newVisibleRuns)) {
            // First 5 runs are visible by default
            newVisibleRuns[run.id] = index < 5;
          }
          if (!(run.id in newRunColors)) {
            // Parse numeric ID from prefixed run ID (e.g. 'inj_1' -> 1)
            try {
              const { id: numericId } = fromRunId(run.id);
              newRunColors[run.id] = getColor(numericId);
            } catch {
              newRunColors[run.id] = getColor(index);
            }
          }
        });

        set({
          runs,
          totalRuns: total,
          visibleRuns: newVisibleRuns,
          runColors: newRunColors,
        });
      },

      toggleRunVisibility: (runId) => {
        const { visibleRuns } = get();
        set({
          visibleRuns: {
            ...visibleRuns,
            [runId]: !visibleRuns[runId],
          },
        });
      },

      selectRun: (runId) => {
        const { selectedRuns } = get();
        if (!selectedRuns.includes(runId)) {
          set({ selectedRuns: [...selectedRuns, runId] });
        }
      },

      deselectRun: (runId) => {
        const { selectedRuns } = get();
        set({ selectedRuns: selectedRuns.filter((id) => id !== runId) });
      },

      clearSelection: () => {
        set({ selectedRuns: [] });
      },

      setRunColor: (runId, color) => {
        const { runColors } = get();
        set({
          runColors: {
            ...runColors,
            [runId]: color,
          },
        });
      },

      setCharts: (charts) => {
        set({ charts });
      },

      setChartGroups: (groups) => {
        set({ chartGroups: groups });
      },

      toggleChartGroupCollapse: (groupId) => {
        const { chartGroups } = get();
        set({
          chartGroups: chartGroups.map((group) =>
            group.id === groupId
              ? { ...group, collapsed: !group.collapsed }
              : group
          ),
        });
      },

      setRunsPanelCollapsed: (collapsed) => {
        set({ runsPanelCollapsed: collapsed });
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query, currentPage: 1 });
      },

      setPanelSearchQuery: (query) => {
        set({ panelSearchQuery: query });
      },

      setCurrentPage: (page) => {
        set({ currentPage: page });
      },

      setPageSize: (size) => {
        set({ pageSize: size, currentPage: 1 });
      },

      setRunsDataSource: (source) => {
        set({ runsDataSource: source, currentPage: 1, searchQuery: '' });
      },

      updateWorkspaceSettings: (settings) => {
        const { currentWorkspace } = get();
        if (currentWorkspace) {
          set({
            currentWorkspace: {
              ...currentWorkspace,
              settings: {
                ...currentWorkspace.settings,
                ...settings,
              },
              updated_at: new Date().toISOString(),
            },
          });
        }
      },

      // Shared table settings actions
      setInjectionsTableSettings: (settings) => {
        const { injectionsTableSettings } = get();
        set({
          injectionsTableSettings: {
            ...injectionsTableSettings,
            ...settings,
          },
        });
      },

      setExecutionsTableSettings: (settings) => {
        const { executionsTableSettings } = get();
        set({
          executionsTableSettings: {
            ...executionsTableSettings,
            ...settings,
          },
        });
      },

      resetInjectionsTableSettings: () => {
        set({
          injectionsTableSettings: createDefaultTableSettings('injections'),
        });
      },

      resetExecutionsTableSettings: () => {
        set({
          executionsTableSettings: createDefaultTableSettings('executions'),
        });
      },

      // === Run list display settings actions ===
      setDisplaySettings: (dataSource, settings) => {
        const { injectionsTableSettings, executionsTableSettings } = get();
        if (dataSource === 'injections') {
          set({
            injectionsTableSettings: {
              ...injectionsTableSettings,
              displaySettings: {
                ...injectionsTableSettings.displaySettings,
                ...settings,
              },
            },
          });
        } else {
          set({
            executionsTableSettings: {
              ...executionsTableSettings,
              displaySettings: {
                ...executionsTableSettings.displaySettings,
                ...settings,
              },
            },
          });
        }
      },

      setCropMode: (dataSource, mode) => {
        const { injectionsTableSettings, executionsTableSettings } = get();
        if (dataSource === 'injections') {
          set({
            injectionsTableSettings: {
              ...injectionsTableSettings,
              displaySettings: {
                ...injectionsTableSettings.displaySettings,
                cropMode: mode,
              },
            },
          });
        } else {
          set({
            executionsTableSettings: {
              ...executionsTableSettings,
              displaySettings: {
                ...executionsTableSettings.displaySettings,
                cropMode: mode,
              },
            },
          });
        }
      },

      setListSortOrder: (dataSource, order) => {
        const { injectionsTableSettings, executionsTableSettings } = get();
        if (dataSource === 'injections') {
          set({
            injectionsTableSettings: {
              ...injectionsTableSettings,
              displaySettings: {
                ...injectionsTableSettings.displaySettings,
                sortOrder: order,
              },
            },
          });
        } else {
          set({
            executionsTableSettings: {
              ...executionsTableSettings,
              displaySettings: {
                ...executionsTableSettings.displaySettings,
                sortOrder: order,
              },
            },
          });
        }
      },

      randomizeRunColors: (dataSource) => {
        const { runColors } = get();
        const prefix = dataSource === 'injections' ? 'inj_' : 'exec_';

        // Get all run IDs for this data source
        const relevantRunIds = Object.keys(runColors).filter((id) =>
          id.startsWith(prefix)
        );

        // Fisher-Yates shuffle for colors
        const shuffledColors = [...DEFAULT_COLORS];
        for (let i = shuffledColors.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledColors[i], shuffledColors[j]] = [
            shuffledColors[j],
            shuffledColors[i],
          ];
        }

        // Assign new random colors
        const newRunColors = { ...runColors };
        relevantRunIds.forEach((runId, index) => {
          newRunColors[runId] = shuffledColors[index % shuffledColors.length];
        });

        set({ runColors: newRunColors });
      },

      getDisplaySettings: (dataSource) => {
        const { injectionsTableSettings, executionsTableSettings } = get();
        if (dataSource === 'injections') {
          return (
            injectionsTableSettings.displaySettings ||
            defaultRunListDisplaySettings
          );
        }
        return (
          executionsTableSettings.displaySettings ||
          defaultRunListDisplaySettings
        );
      },

      // === New: Unified visibility management actions ===
      toggleItemVisibility: (dataSource, itemId) => {
        const runId = toRunId(dataSource, itemId);
        const { visibleRuns } = get();
        set({
          visibleRuns: {
            ...visibleRuns,
            [runId]: !visibleRuns[runId],
          },
        });
      },

      setItemsVisible: (dataSource, itemIds, visible) => {
        const runIds = toRunIds(dataSource, itemIds);
        const { visibleRuns } = get();
        const newVisibleRuns = { ...visibleRuns };

        runIds.forEach((runId) => {
          newVisibleRuns[runId] = visible;
        });

        set({ visibleRuns: newVisibleRuns });
      },

      initializeVisibility: (dataSource, itemIds, defaultVisibleCount = 5) => {
        const { visibleRuns, runColors } = get();
        const runIds = toRunIds(dataSource, itemIds);

        // Check if any items from this data source are already initialized
        const hasExistingVisibility = runIds.some(
          (runId) => runId in visibleRuns
        );
        if (hasExistingVisibility) {
          return; // Already initialized, skip
        }

        const newVisibleRuns = { ...visibleRuns };
        const newRunColors = { ...runColors };

        runIds.forEach((runId, index) => {
          // First N items are visible by default
          newVisibleRuns[runId] = index < defaultVisibleCount;
          // Assign colors
          if (!(runId in newRunColors)) {
            // Use the actual numeric ID for consistent palette lookup
            try {
              const { id: numericId } = fromRunId(runId);
              newRunColors[runId] = getColor(numericId);
            } catch {
              newRunColors[runId] = getColor(index);
            }
          }
        });

        set({
          visibleRuns: newVisibleRuns,
          runColors: newRunColors,
        });
      },

      setItemColor: (dataSource, itemId, color) => {
        const runId = toRunId(dataSource, itemId);
        const { runColors } = get();
        set({
          runColors: {
            ...runColors,
            [runId]: color,
          },
        });
      },

      // === New: Selectors ===
      getVisibleIds: (dataSource) => {
        const { visibleRuns } = get();
        return fromRunIds(
          dataSource,
          Object.entries(visibleRuns)
            .filter(([_, visible]) => visible)
            .map(([id]) => id)
        );
      },

      getVisibleRunIds: (dataSource) => {
        const { visibleRuns } = get();
        return getVisibleRunIdsFromMap(visibleRuns, dataSource);
      },

      isItemVisible: (dataSource, itemId) => {
        const runId = toRunId(dataSource, itemId);
        const { visibleRuns } = get();
        return visibleRuns[runId] ?? false;
      },

      resetWorkspace: () => {
        set(initialState);
      },
    }),
    {
      name: 'workspace-storage',
      partialize: (state) => ({
        runsPanelCollapsed: state.runsPanelCollapsed,
        pageSize: state.pageSize,
        runsDataSource: state.runsDataSource,
        injectionsTableSettings: state.injectionsTableSettings,
        executionsTableSettings: state.executionsTableSettings,
        // Persist visibility and color configurations
        visibleRuns: state.visibleRuns,
        runColors: state.runColors,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<WorkspaceState>;

        // Ensure table settings have valid columns and displaySettings (migration for old data)
        const injectionsTableSettings = {
          ...currentState.injectionsTableSettings,
          ...persisted.injectionsTableSettings,
          columns: persisted.injectionsTableSettings?.columns?.length
            ? persisted.injectionsTableSettings.columns
            : currentState.injectionsTableSettings.columns,
          displaySettings: {
            ...currentState.injectionsTableSettings.displaySettings,
            ...persisted.injectionsTableSettings?.displaySettings,
          },
        };

        const executionsTableSettings = {
          ...currentState.executionsTableSettings,
          ...persisted.executionsTableSettings,
          columns: persisted.executionsTableSettings?.columns?.length
            ? persisted.executionsTableSettings.columns
            : currentState.executionsTableSettings.columns,
          displaySettings: {
            ...currentState.executionsTableSettings.displaySettings,
            ...persisted.executionsTableSettings?.displaySettings,
          },
        };

        return {
          ...currentState,
          ...persisted,
          injectionsTableSettings,
          executionsTableSettings,
        };
      },
    }
  )
);

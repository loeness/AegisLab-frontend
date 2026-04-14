import { useMemo } from 'react';
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';

import {
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileOutlined,
  FileTextOutlined,
  FunctionOutlined,
  ProfileOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { message, Modal, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { executionApi } from '@/api/executions';
import {
  ArtifactsTab,
  DetailView,
  type DetailViewAction,
  type DetailViewTab,
  FilesTab,
  LogsTab,
  type OverviewField,
  OverviewTab,
} from '@/components/workspace/DetailView';
import type { ProjectOutletContext } from '@/hooks/useProjectContext';
import { useAuthStore } from '@/store/auth';
import { STATE_COLORS } from '@/types/workspace';

const { Text } = Typography;

dayjs.extend(relativeTime);

/**
 * Project Execution Detail Page
 * Wrapper component that uses DetailView for execution data
 */
const ProjectExecutionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    project: _project,
    teamName,
    projectName,
  } = useOutletContext<ProjectOutletContext>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  // Workspace name for header
  const workspaceName = `${user?.username || 'User'}'s workspace`;

  // Get execution data from location state (passed from list page for instant display)
  const executionFromState = location.state?.execution as
    | { id?: number; name?: string; state?: string }
    | undefined;

  // Fetch execution data
  const { data: execution, isLoading } = useQuery({
    queryKey: ['execution', id],
    queryFn: () => executionApi.getExecution(Number(id)),
    enabled: !!id,
  });

  // Get status color
  const getStatusColor = (state?: string): string => {
    if (!state) return 'var(--color-secondary-400)';
    const normalizedState = state.toLowerCase();
    if (normalizedState in STATE_COLORS) {
      return STATE_COLORS[normalizedState as keyof typeof STATE_COLORS];
    }
    if (normalizedState === 'crashed') {
      return STATE_COLORS.failed;
    }
    return 'var(--color-secondary-400)';
  };

  // Calculate runtime
  const runtime = useMemo(() => {
    if (!execution?.duration) return undefined;
    const seconds = execution.duration;
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }, [execution]);

  // Navigation handlers
  const handleBack = () => {
    navigate(`/${teamName}/${projectName}/executions`);
  };

  // Action handlers
  const handleEdit = () => {
    const configJson = (() => {
      if (!execution) return '{}';
      const data: Record<string, unknown> = {
        id: execution.id,
        algorithm_name: execution.algorithm_name,
        algorithm_version: execution.algorithm_version,
        datapack_id: execution.datapack_id,
        state: execution.state,
        duration: execution.duration,
        labels: execution.labels,
      };
      return JSON.stringify(data, null, 2);
    })();

    Modal.info({
      title: 'Execution Configuration',
      width: 640,
      content: (
        <pre
          style={{
            background: 'var(--color-secondary-100)',
            padding: 16,
            borderRadius: 6,
            maxHeight: 480,
            overflow: 'auto',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {configJson}
        </pre>
      ),
      okText: 'Close',
    });
  };

  const handleDelete = () => {
    if (!id) return;
    Modal.confirm({
      title: 'Delete Execution',
      content:
        'Are you sure you want to delete this execution? This action cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await executionApi.batchDelete([Number(id)]);
          message.success('Execution deleted successfully');
          navigate(`/${teamName}/${projectName}/executions`);
        } catch {
          message.error('Failed to delete execution');
        }
      },
    });
  };

  const handleDownloadResults = () => {
    if (!execution) {
      message.error('No execution data available');
      return;
    }

    const exportData = {
      id: execution.id,
      algorithm: execution.algorithm_name,
      algorithm_version: execution.algorithm_version,
      datapack_id: execution.datapack_id,
      state: execution.state,
      duration: execution.duration,
      created_at: execution.created_at,
      updated_at: execution.updated_at,
      detector_results: execution.detector_results,
      granularity_results: execution.granularity_results,
      labels: execution.labels,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${execution.id}-${dayjs().format('YYYY-MM-DD')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Results downloaded successfully');
  };

  // Define actions
  const actions: DetailViewAction[] = [
    {
      key: 'viewConfig',
      label: 'View config',
      icon: <EditOutlined />,
      onClick: handleEdit,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      onClick: handleDelete,
      danger: true,
    },
  ];

  // Overview additional fields for execution
  const additionalFields: OverviewField[] = useMemo(() => {
    if (!execution) return [];
    return [
      {
        label: 'Algorithm',
        value: (
          <Space>
            <FunctionOutlined style={{ color: 'var(--color-warning)' }} />
            <Text strong>{execution.algorithm_name}</Text>
          </Space>
        ),
      },
      {
        label: 'Algorithm Version',
        value: <Tag color='blue'>v{execution.algorithm_version}</Tag>,
      },
      {
        label: 'Datapack ID',
        value: (
          <Space>
            <DatabaseOutlined style={{ color: 'var(--color-primary-500)' }} />
            <Text code>
              {execution.datapack_id
                ? String(execution.datapack_id).substring(0, 16)
                : 'N/A'}
            </Text>
          </Space>
        ),
      },
      {
        label: 'Duration',
        value: runtime || '-',
      },
    ];
  }, [execution, runtime]);

  // Define tabs (including Artifacts for executions)
  const tabs: DetailViewTab[] = [
    {
      key: 'overview',
      label: 'Overview',
      icon: <ProfileOutlined />,
      content: (
        <OverviewTab
          notes={(execution as { description?: string })?.description}
          labels={execution?.labels}
          author={user?.username || 'Unknown'}
          state={execution?.state || 'unknown'}
          startTime={execution?.created_at}
          runtime={runtime}
          createdAt={execution?.created_at || new Date().toISOString()}
          updatedAt={execution?.updated_at}
          additionalFields={additionalFields}
        />
      ),
    },
    {
      key: 'logs',
      label: 'Logs',
      icon: <FileTextOutlined />,
      content: (
        <LogsTab
          mode='execution'
          traceId={execution?.task_id ?? ''}
          taskId={execution?.task_id}
        />
      ),
    },
    {
      key: 'files',
      label: 'Files',
      icon: <FileOutlined />,
      content: execution?.datapack_id ? (
        <FilesTab injectionId={execution.datapack_id} />
      ) : (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--color-secondary-400)',
          }}
        >
          No files available for this execution.
        </div>
      ),
    },
    {
      key: 'artifacts',
      label: 'Artifacts',
      icon: <ExperimentOutlined />,
      content: (
        <ArtifactsTab
          detectorResults={execution?.detector_results}
          granularityResults={execution?.granularity_results}
          loading={isLoading}
          onDownload={handleDownloadResults}
        />
      ),
    },
  ];

  return (
    <DetailView
      entityType='execution'
      title={
        execution
          ? `exec_${String(execution.id).padStart(3, '0')}`
          : executionFromState?.name ||
            (executionFromState?.id
              ? `exec_${String(executionFromState.id).padStart(3, '0')}`
              : '—')
      }
      titleDotColor={getStatusColor(
        execution?.state || executionFromState?.state
      )}
      loading={isLoading}
      workspaceName={workspaceName}
      workspaceType='personal'
      onBack={handleBack}
      backLabel='Back'
      actions={actions}
      tabs={tabs}
      defaultActiveTab='overview'
    />
  );
};

export default ProjectExecutionDetail;

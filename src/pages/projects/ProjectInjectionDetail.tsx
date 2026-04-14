import { useMemo } from 'react';
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';

import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileOutlined,
  FileTextOutlined,
  ProfileOutlined,
} from '@ant-design/icons';
import type { LabelItem } from '@rcabench/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { message, Modal, Tag } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { injectionApi, type InjectionDetailResp } from '@/api/injections';
import {
  DetailView,
  type DetailViewAction,
  type DetailViewTab,
  FilesTab,
  type GroundTruthItem,
  LogsTab,
  type OverviewField,
  OverviewTab,
} from '@/components/workspace/DetailView';
import PipelineProgress from '@/components/workspace/PipelineProgress';
import type { ProjectOutletContext } from '@/hooks/useProjectContext';
import { useAuthStore } from '@/store/auth';
import { getColor } from '@/utils/colors';

dayjs.extend(relativeTime);

/**
 * Project Injection Detail Page
 * Wrapper component that uses DetailView for injection data
 */
const ProjectInjectionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    project: _project,
    teamName,
    projectName,
    projectId,
  } = useOutletContext<ProjectOutletContext>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Workspace name for header
  const workspaceName = `${user?.username || 'User'}'s workspace`;

  // Get injection data from location state (passed from list page for instant display)
  const injectionFromState = location.state?.injection as
    | { name?: string; state?: string }
    | undefined;

  // Fetch injection data
  const { data: injection, isLoading } = useQuery({
    queryKey: ['injection', id, projectId],
    queryFn: () => injectionApi.getInjection(Number(id)),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Calculate runtime
  const runtime = useMemo(() => {
    if (!injection?.start_time) return undefined;
    const start = dayjs(injection.start_time);
    const end = injection.end_time ? dayjs(injection.end_time) : dayjs();
    const diff = end.diff(start, 'second');
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  }, [injection]);

  // Navigation handlers
  const handleBack = () => {
    navigate(`/${teamName}/${projectName}/injections`);
  };

  // Action handlers
  const handleExportData = async () => {
    try {
      const blob = await injectionApi.downloadInjection(Number(id));
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `injection-${id}-datapack.tar.gz`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Download started');
    } catch {
      message.error('Download failed');
    }
  };

  const handleClone = () => {
    Modal.confirm({
      title: 'Clone Injection',
      content: `Are you sure you want to clone injection "${injection?.name || id}"?`,
      okText: 'Yes, clone it',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const cloned = await injectionApi.cloneInjection(Number(id));
          message.success('Injection cloned successfully');
          queryClient.invalidateQueries({ queryKey: ['injections'] });
          if (cloned?.id) {
            navigate(`/${teamName}/${projectName}/injections/${cloned.id}`);
          }
        } catch {
          message.error('Failed to clone injection');
        }
      },
    });
  };

  const handleViewCode = () => {
    const configJson = (() => {
      if (!injection) return '{}';
      const data: Record<string, unknown> = {};
      if (
        injection.display_config &&
        Object.keys(injection.display_config).length > 0
      ) {
        data.display_config = injection.display_config;
      }
      if (injection.engine_config && injection.engine_config.length > 0) {
        data.engine_config = injection.engine_config;
      }
      data.fault_type = injection.fault_type;
      data.category = injection.category;
      data.pre_duration = injection.pre_duration;
      data.benchmark_name = injection.benchmark_name;
      data.pedestal_name = injection.pedestal_name;
      if (injection.ground_truth && injection.ground_truth.length > 0) {
        data.ground_truth = injection.ground_truth;
      }
      return JSON.stringify(data, null, 2);
    })();

    Modal.info({
      title: 'Injection Configuration',
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

  const handleEditRunName = () => {
    let newName = injection?.name || '';
    Modal.confirm({
      title: 'Edit Run Name',
      content: (
        <div style={{ marginTop: 12 }}>
          <input
            defaultValue={newName}
            onChange={(e) => {
              newName = e.target.value;
            }}
            placeholder='Enter new run name'
            style={{
              width: '100%',
              padding: '6px 11px',
              border: '1px solid var(--color-secondary-300)',
              borderRadius: 6,
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>
      ),
      okText: 'Save',
      cancelText: 'Cancel',
      onOk: async () => {
        if (!newName.trim()) {
          message.warning('Name cannot be empty');
          return Promise.reject();
        }
        try {
          await injectionApi.manageLabels(
            Number(id),
            [{ key: 'name', value: newName.trim() }],
            [{ key: 'name', value: injection?.name || '' }]
          );
          queryClient.invalidateQueries({
            queryKey: ['injection', id, projectId],
          });
          message.success('Run name updated');
        } catch {
          message.error('Failed to update run name');
        }
      },
    });
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Injection',
      content: `Are you sure you want to delete injection "${injection?.name || id}"? This action cannot be undone.`,
      okText: 'Yes, delete it',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await injectionApi.batchDelete([Number(id)]);
          message.success('Injection deleted successfully');
          navigate(`/${teamName}/${projectName}/injections`);
        } catch {
          message.error('Failed to delete injection');
        }
      },
    });
  };

  // Label handlers
  const handleAddLabel = async (key: string, value: string) => {
    try {
      // Create label object
      const newLabel: LabelItem = { key, value };

      // Add to backend
      await injectionApi.manageLabels(Number(id), [newLabel], []);

      // Update cache
      queryClient.setQueryData<InjectionDetailResp>(
        ['injection', id, projectId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            labels: [...(old.labels || []), newLabel],
          };
        }
      );
    } catch (error) {
      message.error('Failed to add label');
      throw error;
    }
  };

  const handleRemoveLabel = async (label: LabelItem) => {
    try {
      // Remove from backend
      await injectionApi.manageLabels(Number(id), [], [label]);
      queryClient.setQueryData<InjectionDetailResp>(
        ['injection', id, projectId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            labels:
              old.labels?.filter(
                (l: LabelItem) => l.key !== label.key || l.value !== label.value
              ) || [],
          };
        }
      );
    } catch (error) {
      message.error('Failed to remove label');
    }
  };

  // Define actions for dropdown menu (wandb style)
  const actions: DetailViewAction[] = [
    {
      key: 'export',
      label: 'Download datapack',
      icon: <DownloadOutlined />,
      onClick: handleExportData,
    },
    {
      key: 'clone',
      label: 'Clone injection',
      icon: <CopyOutlined />,
      onClick: handleClone,
    },
    {
      key: 'viewCode',
      label: 'View code',
      icon: <FileTextOutlined />,
      onClick: handleViewCode,
    },
    {
      key: 'editName',
      label: 'Edit run name',
      icon: <EditOutlined />,
      onClick: handleEditRunName,
    },
    {
      key: 'delete',
      label: 'Delete run',
      icon: <DeleteOutlined />,
      onClick: handleDelete,
      danger: true,
    },
  ];

  // Overview additional fields for injection
  const additionalFields: OverviewField[] = useMemo(() => {
    if (!injection) return [];
    return [
      {
        label: 'Pre Duration',
        value: `${injection.pre_duration || 0}m 0s`,
      },
      {
        label: 'Fault Type',
        value: injection.fault_type,
      },
      {
        label: 'Category',
        value: <Tag>{injection.category}</Tag>,
      },
      {
        label: 'Benchmark',
        value: injection.benchmark_name || '-',
      },
      {
        label: 'Pedestal',
        value: injection.pedestal_name || '-',
      },
    ];
  }, [injection]);

  // Build config object for display (fallback to empty if no data)
  const configData = useMemo(() => {
    if (!injection) return undefined;
    // Use display_config if available, otherwise build from engine_config
    if (
      injection.display_config &&
      Object.keys(injection.display_config).length > 0
    ) {
      return injection.display_config as Record<string, unknown>;
    }
    if (injection.engine_config && injection.engine_config.length > 0) {
      return { engine_config: injection.engine_config };
    }
    return undefined;
  }, [injection]);

  // Transform ground_truth data for OverviewTab
  const groundTruthData: GroundTruthItem[] = useMemo(() => {
    if (!injection?.ground_truth || injection.ground_truth.length === 0) {
      return [];
    }
    // Return as-is since API format matches GroundTruthItem
    return injection.ground_truth.map((gt) => ({
      service: gt.service,
      container: gt.container,
      pod: gt.pod,
      metric: gt.metric,
      function: gt.function,
      span: gt.span,
    }));
  }, [injection]);

  // Define tabs
  const tabs: DetailViewTab[] = [
    {
      key: 'overview',
      label: 'Overview',
      icon: <ProfileOutlined />,
      content: (
        <>
          <PipelineProgress traceId={injection?.trace_id} />
          <OverviewTab
            notes={injection?.description}
            labels={injection?.labels || []}
            author={user?.username || 'Unknown'}
            state={injection?.state}
            startTime={injection?.start_time}
            runtime={runtime}
            taskID={injection?.task_id}
            traceID={injection?.trace_id}
            taskLink={
              injection?.task_id ? `/tasks/${injection.task_id}` : undefined
            }
            traceLink={
              injection?.trace_id
                ? `/${teamName}/${projectName}/traces/${injection.trace_id}`
                : undefined
            }
            createdAt={injection?.created_at || new Date().toISOString()}
            updatedAt={injection?.updated_at}
            additionalFields={additionalFields}
            config={configData}
            groundTruth={groundTruthData}
            onAddLabel={handleAddLabel}
            onRemoveLabel={handleRemoveLabel}
          />
        </>
      ),
    },
    {
      key: 'logs',
      label: 'Logs',
      icon: <FileTextOutlined />,
      content: <LogsTab mode='injection' traceId={injection?.trace_id} />,
    },
    {
      key: 'files',
      label: 'Files',
      icon: <FileOutlined />,
      content: id ? <FilesTab injectionId={Number(id)} /> : null,
    },
  ];

  return (
    <DetailView
      entityType='injection'
      title={injection?.name || injectionFromState?.name || ''}
      titleDotColor={getColor(injection?.id || 0)}
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

export default ProjectInjectionDetail;

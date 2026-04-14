import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { Breadcrumb, Skeleton, Tabs, Typography } from 'antd';

import { projectApi } from '@/api/projects';

import DatapacksTab from './tabs/DatapacksTab';
import EvaluationsTab from './tabs/EvaluationsTab';
import ExecutionsTab from './tabs/ExecutionsTab';
import OverviewTab from './tabs/OverviewTab';
import SettingsTab from './tabs/SettingsTab';

const { Title } = Typography;

/**
 * Tab-based project detail page.
 * Route: /projects/:id
 */
const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const {
    data: project,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.getProjectDetail(projectId),
    enabled: !!projectId && !Number.isNaN(projectId),
  });

  const tabItems = useMemo(() => {
    if (!project) return [];
    return [
      {
        key: 'overview',
        label: 'Overview',
        children: <OverviewTab project={project} projectId={projectId} />,
      },
      {
        key: 'datapacks',
        label: 'Datapacks',
        children: <DatapacksTab projectId={projectId} />,
      },
      {
        key: 'executions',
        label: 'Executions',
        children: <ExecutionsTab projectId={projectId} />,
      },
      {
        key: 'evaluations',
        label: 'Evaluations',
        children: <EvaluationsTab projectId={projectId} />,
      },
      {
        key: 'settings',
        label: 'Settings',
        children: <SettingsTab project={project} projectId={projectId} />,
      },
    ];
  }, [project, projectId]);

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ padding: 24 }}>
        <Title level={4}>Project not found</Title>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to='/projects'>Projects</Link> },
          { title: project.name },
        ]}
      />

      <Title level={3} style={{ marginBottom: 24 }}>
        {project.name}
      </Title>

      <Tabs defaultActiveKey='overview' items={tabItems} />
    </div>
  );
};

export default ProjectDetail;

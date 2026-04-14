import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Layout, Result, Skeleton } from 'antd';

import {
  type ProjectOutletContext,
  useProjectContext,
} from '@/hooks/useProjectContext';

import AppHeader from './AppHeader';
import WorkspaceSidebar from './WorkspaceSidebar';

import './WorkspaceLayout.css';

const { Sider, Content } = Layout;

// Map route paths to page names for breadcrumb
const pageNameMap: Record<string, string> = {
  '': 'Project',
  workspace: 'Workspace',
  injections: 'Injections',
  executions: 'Executions',
  evaluations: 'Evaluations',
  algorithms: 'Algorithms',
  settings: 'Settings',
};

/**
 * Layout wrapper for workspace pages
 * Hides the main sidebar and shows a workspace-specific sidebar
 * Provides project context to child routes via Outlet context
 */
const WorkspaceLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { project, teamName, projectName, isLoading, error } =
    useProjectContext();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Determine current page from URL
  const currentPage = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    // URL format: /:teamName/:projectName/:subPath
    const subPath = pathParts[2] || '';
    return pageNameMap[subPath] || subPath || 'Project';
  }, [location.pathname]);

  // Breadcrumbs for AppHeader - wandb style: teamName > Projects > projectName > currentPage
  const breadcrumbs = useMemo(() => {
    const displayTeamName = teamName || 'Personal';
    const items = [
      {
        label: displayTeamName,
        path:
          displayTeamName === 'Personal' ? '/profile' : `/${displayTeamName}`,
      },
      { label: 'Projects', path: `/${displayTeamName}/projects` },
      { label: projectName ?? '', path: `/${teamName}/${projectName}` },
    ];

    // Add current page if not the default project overview
    if (currentPage !== 'Project') {
      items.push({ label: currentPage, path: '' });
    }

    return items;
  }, [teamName, projectName, currentPage]);

  // Handle window resize for responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className='workspace-layout-loading'>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  // Error state - project not found
  if (error || !project) {
    return (
      <Result
        status='404'
        title='Project Not Found'
        subTitle={`The project "${projectName}" could not be found.`}
        extra={<a onClick={() => navigate('/projects')}>Back to Projects</a>}
      />
    );
  }

  // Prepare outlet context for child routes
  const outletContext: ProjectOutletContext = {
    project,
    projectId: project.id ?? 0,
    teamName: teamName ?? '',
    projectName: projectName ?? '',
  };

  return (
    <Layout className='workspace-layout'>
      {/* Header with hamburger menu, logo, and breadcrumb */}
      <AppHeader breadcrumbs={breadcrumbs} />

      <Layout className='workspace-layout-body'>
        {/* Workspace Sidebar */}
        <Sider
          width={200}
          collapsedWidth={64}
          collapsed={sidebarCollapsed}
          className='workspace-sidebar-wrapper'
          trigger={null}
        >
          <WorkspaceSidebar
            teamName={teamName ?? ''}
            projectName={projectName ?? ''}
            collapsed={sidebarCollapsed}
          />
        </Sider>

        {/* Main Content Area */}
        <Content
          className='workspace-content'
          style={{ marginLeft: sidebarCollapsed ? 64 : 200 }}
        >
          <Outlet context={outletContext} />
        </Content>
      </Layout>
    </Layout>
  );
};

export default WorkspaceLayout;

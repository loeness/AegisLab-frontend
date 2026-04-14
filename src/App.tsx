import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Spin } from 'antd';

import MainLayout from '@/components/layout/MainLayout';
import { useAuthStore } from '@/store/auth';

// Lazy load all page components
const Login = lazy(() => import('@/pages/auth/Login'));

// User pages
const HomePage = lazy(() => import('@/pages/home/HomePage'));
const ProjectList = lazy(() => import('@/pages/projects/ProjectList'));
const ProjectDetail = lazy(() => import('@/pages/projects/ProjectDetail'));

// Project action pages
const InjectionWizard = lazy(
  () => import('@/pages/injections/InjectionWizard')
);
const CreateExecutionForm = lazy(
  () => import('@/pages/executions/CreateExecutionForm')
);

// Detail pages
const DatapackDetail = lazy(() => import('@/pages/datapacks/DatapackDetail'));
const ExecutionDetail = lazy(
  () => import('@/pages/executions/ExecutionDetail')
);

// Tasks
const TaskList = lazy(() => import('@/pages/tasks/TaskList'));
const TaskDetail = lazy(() => import('@/pages/tasks/TaskDetail'));

// User settings
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
const Settings = lazy(() => import('@/pages/settings/Settings'));

// Admin pages
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'));
const ContainerList = lazy(() => import('@/pages/containers/ContainerList'));
const ContainerForm = lazy(() => import('@/pages/containers/ContainerForm'));
const ContainerDetail = lazy(
  () => import('@/pages/containers/ContainerDetail')
);
const ContainerVersions = lazy(
  () => import('@/pages/containers/ContainerVersions')
);
const DatasetList = lazy(() => import('@/pages/datasets/DatasetList'));
const DatasetForm = lazy(() => import('@/pages/datasets/DatasetForm'));
const DatasetDetail = lazy(() => import('@/pages/datasets/DatasetDetail'));
const SystemSettings = lazy(() => import('@/pages/system/SystemSettings'));

// Loading fallback component
const LoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      minHeight: 200,
    }}
  >
    <Spin size='large' />
  </div>
);

function App() {
  const { isAuthenticated, loadUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      loadUser();
    }
  }, [isAuthenticated, loadUser]);

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path='/login'
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Login />
          </Suspense>
        }
      />

      {/* Protected routes - ALL under MainLayout */}
      <Route
        element={
          isAuthenticated ? <MainLayout /> : <Navigate to='/login' replace />
        }
      >
        {/* Default redirect */}
        <Route index element={<Navigate to='/home' replace />} />

        {/* ==================== User Routes ==================== */}

        {/* Home */}
        <Route
          path='home'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <HomePage />
            </Suspense>
          }
        />

        {/* Projects */}
        <Route
          path='projects'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ProjectList />
            </Suspense>
          }
        />
        <Route
          path='projects/:id'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ProjectDetail />
            </Suspense>
          }
        />
        <Route
          path='projects/:id/inject'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <InjectionWizard />
            </Suspense>
          }
        />
        <Route
          path='projects/:id/execute'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <CreateExecutionForm />
            </Suspense>
          }
        />

        {/* Datapacks */}
        <Route
          path='datapacks/:id'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <DatapackDetail />
            </Suspense>
          }
        />

        {/* Executions */}
        <Route
          path='executions/:id'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ExecutionDetail />
            </Suspense>
          }
        />

        {/* Tasks */}
        <Route
          path='tasks'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <TaskList />
            </Suspense>
          }
        />
        <Route
          path='tasks/:id'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <TaskDetail />
            </Suspense>
          }
        />

        {/* Profile */}
        <Route
          path='profile'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ProfilePage />
            </Suspense>
          }
        />

        {/* Settings */}
        <Route
          path='settings'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Settings />
            </Suspense>
          }
        />

        {/* ==================== Admin Routes ==================== */}

        {/* Admin Users */}
        <Route
          path='admin/users'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <AdminUsersPage />
            </Suspense>
          }
        />

        {/* Admin Containers */}
        <Route
          path='admin/containers'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ContainerList />
            </Suspense>
          }
        />
        <Route
          path='admin/containers/new'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ContainerForm />
            </Suspense>
          }
        />
        <Route
          path='admin/containers/:id'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ContainerDetail />
            </Suspense>
          }
        />
        <Route
          path='admin/containers/:id/edit'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ContainerForm />
            </Suspense>
          }
        />
        <Route
          path='admin/containers/:id/versions'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <ContainerVersions />
            </Suspense>
          }
        />

        {/* Admin Datasets */}
        <Route
          path='admin/datasets'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <DatasetList />
            </Suspense>
          }
        />
        <Route
          path='admin/datasets/new'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <DatasetForm />
            </Suspense>
          }
        />
        <Route
          path='admin/datasets/:id'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <DatasetDetail />
            </Suspense>
          }
        />
        <Route
          path='admin/datasets/:id/edit'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <DatasetForm />
            </Suspense>
          }
        />

        {/* Admin System */}
        <Route
          path='admin/system'
          element={
            <Suspense fallback={<LoadingFallback />}>
              <SystemSettings />
            </Suspense>
          }
        />
      </Route>

      {/* Fallback - redirect unknown routes */}
      <Route
        path='*'
        element={
          isAuthenticated ? (
            <Navigate to='/home' replace />
          ) : (
            <Navigate to='/login' replace />
          )
        }
      />
    </Routes>
  );
}

export default App;

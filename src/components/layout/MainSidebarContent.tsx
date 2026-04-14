import { useNavigate } from 'react-router-dom';

import {
  ContainerOutlined,
  DatabaseOutlined,
  FolderOutlined,
  HomeOutlined,
  OrderedListOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Menu, type MenuProps } from 'antd';

import { useAuthStore } from '@/store/auth';

import './MainSidebarContent.css';

interface MainSidebarContentProps {
  onNavigate?: () => void;
}

/**
 * Main sidebar content component
 * Reusable sidebar content for MainLayout
 */
const MainSidebarContent: React.FC<MainSidebarContentProps> = ({
  onNavigate,
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Check if user has admin privileges
  // TODO: Update this check once the UserInfo type exposes a role/is_superuser field
  const isAdmin = !!(user as Record<string, unknown>)?.is_superuser;

  // Menu items
  const menuItems: MenuProps['items'] = [
    {
      key: '/home',
      icon: <HomeOutlined />,
      label: 'Home',
    },
    {
      key: '/projects',
      icon: <FolderOutlined />,
      label: 'Projects',
    },
    {
      key: '/tasks',
      icon: <OrderedListOutlined />,
      label: 'Tasks',
    },
    // Admin section (conditionally visible)
    ...(isAdmin
      ? [
          {
            type: 'divider' as const,
            style: { margin: '12px 0 8px' },
          },
          {
            key: 'admin-header',
            type: 'group' as const,
            label: (
              <span
                style={{
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  padding: '0 8px',
                }}
              >
                Admin
              </span>
            ),
          },
          {
            key: '/admin/users',
            icon: <UserOutlined />,
            label: 'Users',
          },
          {
            key: '/admin/containers',
            icon: <ContainerOutlined />,
            label: 'Containers',
          },
          {
            key: '/admin/datasets',
            icon: <DatabaseOutlined />,
            label: 'Datasets',
          },
          {
            key: '/admin/system',
            icon: <SettingOutlined />,
            label: 'System',
          },
        ]
      : []),
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key.startsWith('/')) {
      navigate(key);
      onNavigate?.();
    }
  };

  return (
    <div className='main-sidebar-content'>
      <Menu
        mode='inline'
        items={menuItems}
        onClick={handleMenuClick}
        className='main-sidebar-menu'
      />
      <div className='main-sidebar-footer'>
        <div className='system-status'>
          <div className='status-indicator' />
          <span className='status-text'>System Online</span>
        </div>
      </div>
    </div>
  );
};

export default MainSidebarContent;

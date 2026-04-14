import { useState } from 'react';

import {
  ClockCircleOutlined,
  FileTextOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Empty, Input, Typography } from 'antd';

import './WorkspaceSelector.css';

const { Text } = Typography;

interface WorkspaceItem {
  id: string;
  name: string;
  owner: string;
  savedAt: string;
  isPersonal: boolean;
}

interface WorkspaceSelectorProps {
  onSelect: (workspaceId: string) => void;
  onClose: () => void;
}

/**
 * Dropdown selector for workspace views
 * Shows personal workspaces and saved views
 */
const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({ onSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // TODO: Replace with useTeams() hook to fetch real workspace data
  const personalWorkspaces: WorkspaceItem[] = [
    {
      id: '1',
      name: "User's workspace",
      owner: 'current-user',
      savedAt: '2025-01-25T10:30:00Z',
      isPersonal: true,
    },
  ];

  const savedViews: WorkspaceItem[] = [];

  // Filter workspaces based on search
  const filteredPersonal = personalWorkspaces.filter((ws) =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredViews = savedViews.filter((ws) =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className='workspace-selector'>
      {/* Search */}
      <div className='workspace-selector-search'>
        <Input
          prefix={<SearchOutlined />}
          placeholder='Search workspaces'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
      </div>

      {/* Personal workspaces */}
      <div className='workspace-selector-section'>
        <div className='workspace-selector-section-header'>
          <UserOutlined />
          <span>Personal workspaces</span>
          <span className='workspace-selector-count'>
            {filteredPersonal.length}
          </span>
        </div>
        <div className='workspace-selector-list'>
          {filteredPersonal.length > 0 ? (
            filteredPersonal.map((ws) => (
              <div
                key={ws.id}
                className='workspace-selector-item'
                onClick={() => onSelect(ws.id)}
              >
                <div className='workspace-selector-item-main'>
                  <UserOutlined className='workspace-selector-item-icon' />
                  <span className='workspace-selector-item-name'>
                    {ws.name}
                  </span>
                </div>
                <div className='workspace-selector-item-meta'>
                  <ClockCircleOutlined />
                  <Text type='secondary'>
                    Saved on {formatDate(ws.savedAt)}
                  </Text>
                </div>
              </div>
            ))
          ) : (
            <div className='workspace-selector-empty'>
              <Text type='secondary'>No personal workspaces found</Text>
            </div>
          )}
          {filteredPersonal.length > 0 && (
            <Button
              type='link'
              size='small'
              className='workspace-selector-show-all'
            >
              Show all
            </Button>
          )}
        </div>
      </div>

      {/* Saved views */}
      <div className='workspace-selector-section'>
        <div className='workspace-selector-section-header'>
          <FileTextOutlined />
          <span>Views</span>
        </div>
        <div className='workspace-selector-list'>
          {filteredViews.length > 0 ? (
            filteredViews.map((ws) => (
              <div
                key={ws.id}
                className='workspace-selector-item'
                onClick={() => onSelect(ws.id)}
              >
                <div className='workspace-selector-item-main'>
                  <FileTextOutlined className='workspace-selector-item-icon' />
                  <span className='workspace-selector-item-name'>
                    {ws.name}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div className='workspace-selector-empty-views'>
                  <Text type='secondary'>No views yet</Text>
                  <Text type='secondary' style={{ fontSize: 12 }}>
                    Save your workspace as a view to share it with your team
                  </Text>
                  <Button type='link' size='small'>
                    Learn more about views
                  </Button>
                </div>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSelector;

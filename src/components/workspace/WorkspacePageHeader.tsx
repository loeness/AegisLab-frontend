import { useState } from 'react';

import {
  CopyOutlined,
  MenuOutlined,
  RedoOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Space, Typography } from 'antd';

import WorkspaceSelector from './WorkspaceSelector';

import './WorkspacePageHeader.css';

const { Text } = Typography;

interface WorkspacePageHeaderProps {
  workspaceName: string;
  workspaceType: 'personal' | 'team';
  lastSaved?: string;
  runsPanelCollapsed: boolean;
  onToggleRunsPanel: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopyToMyWorkspace?: () => void;
  onWorkspaceChange?: (workspaceId: string) => void;
}

/**
 * Header component for the workspace page
 * Contains workspace name, selector, save status, and action buttons
 */
const WorkspacePageHeader: React.FC<WorkspacePageHeaderProps> = ({
  workspaceName,
  workspaceType,
  lastSaved,
  onUndo,
  onRedo,
  onCopyToMyWorkspace,
  onWorkspaceChange,
}) => {
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Format relative time
  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Never saved';

    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 1) return 'Saved just now';
    if (diffMins < 60)
      return `Saved ${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24)
      return `Saved ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30)
      return `Saved ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return `Saved ${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
  };

  return (
    <div className='workspace-page-header'>
      <div className='workspace-page-header-left'>
        {/* Workspace selector button (hamburger menu that opens workspace selector) */}
        <Dropdown
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          popupRender={() => (
            <WorkspaceSelector
              onSelect={(id) => {
                onWorkspaceChange?.(id);
                setSelectorOpen(false);
              }}
              onClose={() => setSelectorOpen(false)}
            />
          )}
          trigger={['click']}
          placement='bottomLeft'
        >
          <Button
            type='text'
            icon={<MenuOutlined />}
            className='workspace-toggle-btn'
            title='Switch workspace'
          />
        </Dropdown>

        {/* Workspace name with dropdown */}
        <div className='workspace-name-container'>
          <span className='workspace-name'>{workspaceName}</span>
          <span className='workspace-type-badge'>
            {workspaceType === 'personal' ? 'Personal' : 'Team'}
          </span>
        </div>
      </div>

      <div className='workspace-page-header-right'>
        {/* Save status */}
        <Text type='secondary' className='workspace-save-status'>
          {formatRelativeTime(lastSaved)}
        </Text>

        {/* Action buttons */}
        <Space size={4}>
          <Button
            type='text'
            icon={<UndoOutlined />}
            onClick={onUndo}
            disabled={!onUndo}
            title='Undo'
          />
          <Button
            type='text'
            icon={<RedoOutlined />}
            onClick={onRedo}
            disabled={!onRedo}
            title='Redo'
          />
          <Button
            type='text'
            icon={<CopyOutlined />}
            onClick={onCopyToMyWorkspace}
            title='Copy to my workspace'
          />
        </Space>
      </div>
    </div>
  );
};

export default WorkspacePageHeader;

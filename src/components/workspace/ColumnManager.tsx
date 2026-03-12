/**
 * ColumnManager - W&B-style column management modal
 *
 * Allows users to show/hide columns, pin columns, and reorder them
 * with drag-and-drop support.
 */
import { type FC, type ReactNode, useCallback, useMemo, useState } from 'react';

import {
  CalendarOutlined,
  ClockCircleOutlined,
  DragOutlined,
  FontSizeOutlined,
  LockOutlined,
  MenuOutlined,
  NumberOutlined,
  PushpinFilled,
  PushpinOutlined,
  TagsOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Badge, Button, Input, Modal, Select, Typography } from 'antd';

import type { ColumnConfig, ColumnType } from '@/types/workspace';

import './ColumnManager.css';

const { Text } = Typography;

interface ColumnManagerProps {
  open: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  onShowAll?: () => void;
  onHideUnpinned?: () => void;
}

// Column type icons
const columnTypeIcons: Record<ColumnType, ReactNode> = {
  text: <FontSizeOutlined />,
  number: <NumberOutlined />,
  date: <CalendarOutlined />,
  user: <UserOutlined />,
  tags: <TagsOutlined />,
  status: <MenuOutlined />,
  duration: <ClockCircleOutlined />,
  progress: <MenuOutlined />,
};

const ColumnManager: FC<ColumnManagerProps> = ({
  open,
  onClose,
  columns,
  onColumnsChange,
  onShowAll,
  onHideUnpinned,
}) => {
  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState<'fuzzy' | 'exact' | 'regexp'>(
    'fuzzy'
  );

  // Filter columns by search text
  const filterColumns = useCallback(
    (cols: ColumnConfig[]) => {
      if (!searchText) return cols;
      if (searchMode === 'regexp') {
        try {
          const regex = new RegExp(searchText, 'i');
          return cols.filter((col) => regex.test(col.title));
        } catch {
          // Invalid regex, fall back to no filter
          return cols;
        }
      }
      const lowerSearch = searchText.toLowerCase();
      return cols.filter((col) => {
        if (searchMode === 'exact') {
          return col.title.toLowerCase() === lowerSearch;
        }
        return col.title.toLowerCase().includes(lowerSearch);
      });
    },
    [searchText, searchMode]
  );

  // Separate visible and hidden columns
  const visibleColumns = useMemo(
    () =>
      filterColumns(columns.filter((col) => col.visible)).sort(
        (a, b) => a.order - b.order
      ),
    [columns, filterColumns]
  );

  const hiddenColumns = useMemo(
    () =>
      filterColumns(columns.filter((col) => !col.visible)).sort(
        (a, b) => a.order - b.order
      ),
    [columns, filterColumns]
  );

  // Toggle column visibility
  const handleToggleVisibility = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (col?.locked) return;

    onColumnsChange(
      columns.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
    );
  };

  // Toggle column pin
  const handleTogglePin = (key: string) => {
    onColumnsChange(
      columns.map((c) => (c.key === key ? { ...c, pinned: !c.pinned } : c))
    );
  };

  // Show all columns
  const handleShowAll = () => {
    if (onShowAll) {
      onShowAll();
    } else {
      onColumnsChange(columns.map((c) => ({ ...c, visible: true })));
    }
  };

  // Hide unpinned columns
  const handleHideUnpinned = () => {
    if (onHideUnpinned) {
      onHideUnpinned();
    } else {
      onColumnsChange(
        columns.map((c) =>
          c.pinned || c.locked ? c : { ...c, visible: false }
        )
      );
    }
  };

  // Render column item
  const renderColumnItem = (
    col: ColumnConfig,
    showPinButton: boolean = false
  ) => (
    <div
      key={col.key}
      className={`column-item ${col.locked ? 'locked' : ''}`}
      onClick={() => handleToggleVisibility(col.key)}
    >
      <div className='column-item-left'>
        <DragOutlined className='drag-handle' />
        <span className='column-icon'>
          {columnTypeIcons[col.type] || <MenuOutlined />}
        </span>
        <span className='column-title'>{col.title}</span>
      </div>
      <div className='column-item-right'>
        {col.locked && <LockOutlined className='lock-icon' />}
        {showPinButton && (
          <Button
            type='text'
            size='small'
            icon={col.pinned ? <PushpinFilled /> : <PushpinOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePin(col.key);
            }}
            className={`pin-button ${col.pinned ? 'pinned' : ''}`}
          />
        )}
      </div>
    </div>
  );

  return (
    <Modal
      title='Manage columns'
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width={700}
      className='column-manager-modal'
    >
      <div className='column-manager'>
        {/* Description */}
        <Text type='secondary' className='description'>
          Configure columns to display in the table. Pinned columns persist when
          the table is collapsed.
        </Text>

        {/* Search input */}
        <div className='search-container'>
          <Input
            placeholder='Search columns'
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            className='search-input'
          />
          <Select
            value={searchMode}
            onChange={setSearchMode}
            className='search-mode'
            options={[
              { value: 'fuzzy', label: 'Fuzzy' },
              { value: 'exact', label: 'Exact' },
              { value: 'regexp', label: 'RegExp' },
            ]}
          />
        </div>

        {/* Two-column layout */}
        <div className='columns-container'>
          {/* Hidden columns */}
          <div className='column-section hidden-section'>
            <div className='section-header'>
              <div className='section-title'>
                <Text strong>HIDDEN</Text>
                <Badge
                  count={hiddenColumns.length}
                  showZero
                  className='section-badge'
                />
              </div>
              <Button type='link' size='small' onClick={handleShowAll}>
                Show all
              </Button>
            </div>
            <div className='column-list'>
              {hiddenColumns.length === 0 ? (
                <div className='empty-state'>
                  <Text type='secondary'>No hidden columns</Text>
                </div>
              ) : (
                hiddenColumns.map((col) => renderColumnItem(col, false))
              )}
            </div>
          </div>

          {/* Visible & Pinned columns */}
          <div className='column-section visible-section'>
            <div className='section-header'>
              <div className='section-title'>
                <Text strong>VISIBLE & PINNED</Text>
                <Badge
                  count={visibleColumns.length}
                  showZero
                  className='section-badge'
                />
              </div>
              <Button type='link' size='small' onClick={handleHideUnpinned}>
                Hide unpinned
              </Button>
            </div>
            <div className='column-list'>
              {visibleColumns.length === 0 ? (
                <div className='empty-state'>
                  <Text type='secondary'>No visible columns</Text>
                </div>
              ) : (
                visibleColumns.map((col) => renderColumnItem(col, true))
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ColumnManager;

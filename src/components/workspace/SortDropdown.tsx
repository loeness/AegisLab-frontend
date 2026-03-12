/**
 * SortDropdown - W&B-style multi-field sort selector
 *
 * A popover dropdown that allows configuring multiple sort fields
 * with ascending/descending order for each.
 */
import { type FC, useCallback, useMemo, useState } from 'react';

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CloseOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import { Button, Popover, Select, Space, Tooltip, Typography } from 'antd';

import type { ColumnConfig, SortField } from '@/types/workspace';

import './SortDropdown.css';

const { Text } = Typography;

interface SortDropdownProps {
  columns: ColumnConfig[];
  sortFields: SortField[];
  onSortChange: (fields: SortField[]) => void;
  defaultSortField?: string;
  defaultSortOrder?: 'asc' | 'desc';
  maxSortFields?: number;
  /** Show only icon without text label */
  iconOnly?: boolean;
}

// Generate unique key for sort field
const generateSortKey = () =>
  `sort-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const SortDropdown: FC<SortDropdownProps> = ({
  columns = [],
  sortFields = [],
  onSortChange,
  defaultSortField,
  defaultSortOrder = 'desc',
  maxSortFields = 3,
  iconOnly = false,
}) => {
  const [open, setOpen] = useState(false);

  // Auto-populate default sort field when opening with no active fields
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && sortFields.length === 0 && defaultSortField) {
      onSortChange([
        {
          key: generateSortKey(),
          field: defaultSortField,
          order: defaultSortOrder,
        },
      ]);
    }
    setOpen(newOpen);
  };

  // Filter columns that are sortable
  const sortableColumns = useMemo(
    () => (columns || []).filter((col) => col.sortable !== false),
    [columns]
  );

  // Get fields already used in sorting
  const usedFields = useMemo(
    () => new Set((sortFields || []).map((f) => f.field)),
    [sortFields]
  );

  // Build options for select (exclude already used fields)
  const getAvailableOptions = useCallback(
    (currentField?: string) =>
      sortableColumns
        .filter(
          (col) =>
            col.dataIndex === currentField || !usedFields.has(col.dataIndex)
        )
        .map((col) => ({
          value: col.dataIndex,
          label: col.title,
        })),
    [sortableColumns, usedFields]
  );

  // Handle field change
  const handleFieldChange = useCallback(
    (key: string, newField: string) => {
      const updatedFields = sortFields.map((f) =>
        f.key === key ? { ...f, field: newField } : f
      );
      onSortChange(updatedFields);
    },
    [sortFields, onSortChange]
  );

  // Handle order change
  const handleOrderChange = useCallback(
    (key: string, newOrder: 'asc' | 'desc') => {
      const updatedFields = sortFields.map((f) =>
        f.key === key ? { ...f, order: newOrder } : f
      );
      onSortChange(updatedFields);
    },
    [sortFields, onSortChange]
  );

  // Handle remove field
  const handleRemoveField = useCallback(
    (key: string) => {
      const updatedFields = sortFields.filter((f) => f.key !== key);
      onSortChange(updatedFields);
    },
    [sortFields, onSortChange]
  );

  // Handle add field
  const handleAddField = useCallback(() => {
    // Find first unused sortable column
    const firstUnused = sortableColumns.find(
      (col) => !usedFields.has(col.dataIndex)
    );
    if (firstUnused) {
      const newField: SortField = {
        key: generateSortKey(),
        field: firstUnused.dataIndex,
        order: 'desc',
      };
      onSortChange([...sortFields, newField]);
    }
  }, [sortableColumns, usedFields, sortFields, onSortChange]);

  // Handle reset to default
  const handleResetToDefault = useCallback(() => {
    if (defaultSortField) {
      onSortChange([
        {
          key: generateSortKey(),
          field: defaultSortField,
          order: defaultSortOrder,
        },
      ]);
    } else {
      onSortChange([]);
    }
  }, [defaultSortField, defaultSortOrder, onSortChange]);

  const canAddMore =
    sortFields.length < maxSortFields &&
    sortableColumns.length > sortFields.length;

  // Button is "active" (blue) only when sort differs from the default
  const isNonDefault =
    sortFields.length > 0 &&
    !(
      sortFields.length === 1 &&
      sortFields[0].field === defaultSortField &&
      sortFields[0].order === defaultSortOrder
    );
  const content = (
    <div className='sort-dropdown-content'>
      <Text className='sort-dropdown-header'>Sort runs by...</Text>

      <div className='sort-dropdown-field-list'>
        {sortFields.map((sortField) => (
          <div key={sortField.key} className='sort-dropdown-field-item'>
            {sortFields.length > 1 && (
              <Button
                type='text'
                size='small'
                icon={<CloseOutlined />}
                onClick={() => handleRemoveField(sortField.key)}
                className='sort-dropdown-field-remove'
              />
            )}
            <Select
              className='sort-dropdown-field-select'
              value={sortField.field}
              onChange={(value) => handleFieldChange(sortField.key, value)}
              options={getAvailableOptions(sortField.field)}
              showSearch
              optionFilterProp='label'
            />
            <Button
              type='text'
              size='small'
              icon={
                sortField.order === 'asc' ? (
                  <ArrowUpOutlined />
                ) : (
                  <ArrowDownOutlined />
                )
              }
              onClick={() =>
                handleOrderChange(
                  sortField.key,
                  sortField.order === 'asc' ? 'desc' : 'asc'
                )
              }
              className={`sort-dropdown-order-toggle ${sortField.order}`}
            />
          </div>
        ))}
      </div>

      <Space direction='vertical' className='sort-dropdown-footer'>
        {canAddMore && (
          <Button
            type='link'
            onClick={handleAddField}
            className='sort-dropdown-add-field'
          >
            Add another field
          </Button>
        )}

        <Button
          type='link'
          onClick={handleResetToDefault}
          className='sort-dropdown-reset'
        >
          Reset to default
        </Button>
      </Space>
    </div>
  );

  const button = (
    <Button
      icon={<SortAscendingOutlined />}
      className={`action-button ${isNonDefault ? 'active' : ''}`}
      type={iconOnly ? 'text' : 'default'}
      size={iconOnly ? 'small' : 'middle'}
    >
      {!iconOnly && 'Sort'}
    </Button>
  );

  return (
    <Popover
      content={content}
      trigger='click'
      placement='bottomLeft'
      open={open}
      onOpenChange={handleOpenChange}
      classNames={{ root: 'sort-dropdown-popover' }}
    >
      {iconOnly ? <Tooltip title='Sort'>{button}</Tooltip> : button}
    </Popover>
  );
};

export default SortDropdown;

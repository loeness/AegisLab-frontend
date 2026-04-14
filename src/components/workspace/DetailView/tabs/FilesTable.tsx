import { useMemo, useState } from 'react';

import {
  DownloadOutlined,
  FileOutlined,
  FolderOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { DatapackFileItem } from '@rcabench/client';
import { Button, Input, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Text } = Typography;

/**
 * Recursively sort files and folders
 * - Folders first, then files
 * - Dot items (starting with .) come first within their category
 * - Files sorted by extension, then name
 */
const sortFiles = (items: DatapackFileItem[]): DatapackFileItem[] => {
  return items
    .map((item) => {
      // Recursively sort children if this is a folder
      if (item.children && item.children.length > 0) {
        return {
          ...item,
          children: sortFiles(item.children),
        };
      }
      return item;
    })
    .sort((a, b) => {
      const isAFolder = (a.children?.length ?? 0) > 0;
      const isBFolder = (b.children?.length ?? 0) > 0;
      const nameA = a.name ?? '';
      const nameB = b.name ?? '';
      const isADot = nameA.startsWith('.');
      const isBDot = nameB.startsWith('.');

      // Folders before files
      if (isAFolder && !isBFolder) return -1;
      if (!isAFolder && isBFolder) return 1;

      // Within the same category (both folders or both files)
      // Dot items come first
      if (isADot && !isBDot) return -1;
      if (!isADot && isBDot) return 1;

      if (!isAFolder) {
        // For files: sort by extension first, then by name
        const extA = nameA.includes('.') ? (nameA.split('.').pop() ?? '') : '';
        const extB = nameB.includes('.') ? (nameB.split('.').pop() ?? '') : '';

        if (extA !== extB) {
          return extA.localeCompare(extB);
        }
      }

      // Same extension or both folders: sort by name
      return nameA.localeCompare(nameB);
    });
};

interface FilesTableProps {
  files: DatapackFileItem[];
  loading?: boolean;
  onFolderClick: (folderName: string) => void;
  onFileClick: (file: DatapackFileItem) => void;
  onDownload?: (file: DatapackFileItem) => void;
}

/**
 * Files Table Component - Search and table view for files
 */
const FilesTable: React.FC<FilesTableProps> = ({
  files,
  loading = false,
  onFolderClick,
  onFileClick,
  onDownload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and sort files based on search query
  const filteredFiles = useMemo(() => {
    let result = files;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = files.filter((file) => file.name?.toLowerCase().includes(query));
    }

    // Sort files and folders recursively
    return sortFiles(result);
  }, [files, searchQuery]);

  // Table columns
  const columns: ColumnsType<DatapackFileItem> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: DatapackFileItem) => {
        const isFolder = (record.children?.length ?? 0) > 0;
        const displayName = isFolder ? `${name}/` : name;

        return (
          <Space>
            {isFolder ? (
              <FolderOutlined style={{ color: 'var(--color-warning)' }} />
            ) : (
              <FileOutlined style={{ color: 'var(--color-secondary-400)' }} />
            )}
            {isFolder ? (
              <Text
                onClick={(e) => {
                  e.stopPropagation();
                  onFolderClick(name);
                }}
                style={{ cursor: 'pointer' }}
              >
                {displayName}
              </Text>
            ) : (
              <Text
                onClick={(e) => {
                  e.stopPropagation();
                  onFileClick(record);
                }}
                style={{ cursor: 'pointer' }}
              >
                {displayName}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Modified',
      dataIndex: 'modified_at',
      key: 'modifiedAt',
      width: 120,
      render: (date?: string) => (
        <Text type='secondary'>{date ? dayjs(date).fromNow() : ''}</Text>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 200,
      align: 'right',
      render: (size?: string) => <Text type='secondary'>{size}</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, record: DatapackFileItem) => {
        const isFolder = (record.children?.length ?? 0) > 0;
        // Show download button for files, not folders
        return !isFolder && onDownload ? (
          <Button
            type='text'
            icon={<DownloadOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onDownload(record);
            }}
            title='Download'
          />
        ) : null;
      },
    },
  ];

  return (
    <>
      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder='Search files...'
          prefix={
            <SearchOutlined style={{ color: 'var(--color-secondary-400)' }} />
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
      </div>

      {/* File table */}
      <Table
        columns={columns}
        dataSource={filteredFiles}
        rowKey='path'
        loading={loading}
        pagination={false}
        size='middle'
        expandable={{ childrenColumnName: 'no-children' }}
      />
    </>
  );
};

export default FilesTable;

import { useMemo, useState } from 'react';

import { CopyOutlined, SearchOutlined } from '@ant-design/icons';
import { App, Button, Input, Modal, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import './GroundTruthTable.css';

const { Text } = Typography;

// Ground truth item structure
export interface GroundTruthItem {
  service?: string | string[];
  container?: string | string[];
  pod?: string | string[] | null;
  metric?: string | string[] | null;
  function?: string | string[] | null;
  span?: string | string[] | null;
  root_cause?: string;
  [key: string]: unknown;
}

interface GroundTruthTableProps {
  groundTruth: GroundTruthItem[];
  title?: string;
  description?: string;
  onViewRaw?: () => void;
}

// Property labels for display
const PROPERTY_LABELS: Array<{ key: keyof GroundTruthItem; label: string }> = [
  { key: 'service', label: 'Service' },
  { key: 'container', label: 'Container' },
  { key: 'pod', label: 'Pod' },
  { key: 'metric', label: 'Metric' },
  { key: 'function', label: 'Function' },
  { key: 'span', label: 'Span' },
];

// Row data structure for vertical layout
interface VerticalRowData {
  key: string;
  property: string;
  [rootCauseKey: string]: unknown;
}

/**
 * Render cell value - handles arrays, strings, and nulls
 */
const renderCellValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined) {
    return <Text type='secondary'>-</Text>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <Text type='secondary'>-</Text>;
    }
    return (
      <div className='ground-truth-tags'>
        {value.map((item, index) => (
          <Tag key={index} color='blue'>
            {String(item)}
          </Tag>
        ))}
      </div>
    );
  }

  if (typeof value === 'string' && value.trim() === '') {
    return <Text type='secondary'>-</Text>;
  }

  return <Text>{String(value)}</Text>;
};

/**
 * GroundTruthTable component - Display ground truth data in vertical table format
 * Rows are property names, columns are different root causes
 */
const GroundTruthTable: React.FC<GroundTruthTableProps> = ({
  groundTruth,
  title = 'Ground Truth',
  description = 'Expected root cause labels for this injection.',
  onViewRaw,
}) => {
  const { message } = App.useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Build vertical table data: rows are properties, columns are root causes
  const { columns, dataSource } = useMemo(() => {
    // First column is the property name
    const cols: ColumnsType<VerticalRowData> = [
      {
        title: '',
        dataIndex: 'property',
        key: 'property',
        width: 100,
        fixed: 'left',
        render: (text: string) => (
          <Text strong style={{ color: 'var(--color-secondary-400)' }}>
            {text}
          </Text>
        ),
      },
    ];

    // Add a column for each root cause
    groundTruth.forEach((_, index) => {
      cols.push({
        title: `root-cause-${index + 1}`,
        dataIndex: `rc_${index}`,
        key: `rc_${index}`,
        width: 150,
        render: renderCellValue,
      });
    });

    // Build row data - each row is a property
    const rows: VerticalRowData[] = PROPERTY_LABELS.map(({ key, label }) => {
      const row: VerticalRowData = {
        key: key as string,
        property: label,
      };

      // Add value for each root cause column
      groundTruth.forEach((gt, index) => {
        row[`rc_${index}`] = gt[key];
      });

      return row;
    });

    return { columns: cols, dataSource: rows };
  }, [groundTruth]);

  // Filter data based on search
  const filteredDataSource = useMemo(() => {
    if (!searchQuery.trim()) return dataSource;
    const lowerQuery = searchQuery.toLowerCase();

    return dataSource.filter((row) => {
      // Check property name
      if (row.property.toLowerCase().includes(lowerQuery)) return true;

      // Check all root cause values
      return Object.entries(row).some(([key, val]) => {
        if (key === 'key' || key === 'property') return false;
        if (val === null || val === undefined) return false;
        if (Array.isArray(val)) {
          return val.some((v) => String(v).toLowerCase().includes(lowerQuery));
        }
        return String(val).toLowerCase().includes(lowerQuery);
      });
    });
  }, [dataSource, searchQuery]);

  const isEmpty = !groundTruth || groundTruth.length === 0;

  // Handle view raw data
  const handleViewRaw = () => {
    if (onViewRaw) {
      onViewRaw();
    } else {
      setModalOpen(true);
    }
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    const jsonStr = JSON.stringify(groundTruth, null, 2);
    try {
      await navigator.clipboard.writeText(jsonStr);
      message.success('Copied to clipboard');
    } catch {
      message.error('Failed to copy');
    }
  };

  // JSON string for modal display
  const jsonString = useMemo(
    () => JSON.stringify(groundTruth, null, 2),
    [groundTruth]
  );

  return (
    <div className='ground-truth-container'>
      {/* Raw data modal */}
      <Modal
        title={title}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={800}
        footer={
          <div className='raw-data-modal-footer'>
            <Button onClick={() => setModalOpen(false)}>Close</Button>
            <Button icon={<CopyOutlined />} onClick={handleCopy}>
              Copy
            </Button>
          </div>
        }
      >
        <pre className='raw-data-modal-content'>{jsonString}</pre>
      </Modal>

      {/* Header */}
      <div className='ground-truth-header'>
        <Text strong className='ground-truth-title'>
          {title}
        </Text>
        <Button type='link' size='small' onClick={handleViewRaw}>
          View raw data
        </Button>
      </div>

      {/* Description */}
      <div className='ground-truth-description'>
        <Text type='secondary'>{description}</Text>
      </div>

      {/* Search */}
      <div className='ground-truth-search'>
        <Input
          prefix={
            <SearchOutlined style={{ color: 'var(--color-secondary-300)' }} />
          }
          placeholder='Search ground truth data'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
      </div>

      {/* Table content */}
      <div className='ground-truth-content'>
        {isEmpty ? (
          <div className='ground-truth-empty'>
            <Text type='secondary'>No ground truth data available</Text>
          </div>
        ) : (
          <Table
            className='ground-truth-table'
            columns={columns}
            dataSource={filteredDataSource}
            size='small'
            pagination={false}
            scroll={{ x: 'max-content' }}
            bordered={false}
          />
        )}
      </div>
    </div>
  );
};

export default GroundTruthTable;

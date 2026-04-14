import { useMemo, useState } from 'react';

import { DownOutlined, UpOutlined, UserOutlined } from '@ant-design/icons';
import type { LabelItem } from '@rcabench/client';
import { Button, Col, List, Row, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';

import AddLabelDropdown from '@/components/workspace/AddLabelDropdown';
import { getDatapackStateDisplay } from '@/types/workspace';

import ConfigTree from './ConfigTree';
import GroundTruthTable, { type GroundTruthItem } from './GroundTruthTable';

import './OverviewTab.css';

const { Text, Paragraph } = Typography;

export interface OverviewField {
  label: string;
  value: React.ReactNode;
  span?: number;
  isCommand?: boolean;
}

interface ListItem {
  key: string;
  label: string;
  value: React.ReactNode;
  isCommand?: boolean;
}

interface OverviewTabProps {
  // Basic info
  notes?: string;
  labels?: LabelItem[];
  author?: string;
  state?: string;
  startTime?: string;
  runtime?: string;
  taskID?: string;
  traceID?: string;
  taskLink?: string;
  traceLink?: string;
  createdAt: string;
  updatedAt?: string;

  // Entity-specific fields passed as array
  additionalFields?: OverviewField[];

  // Config and Ground Truth for two-column layout
  config?: Record<string, unknown>;
  groundTruth?: GroundTruthItem[];

  // Actions
  onEditNotes?: () => void;
  onAddLabel?: (key: string, value: string) => Promise<void>;
  onRemoveLabel?: (label: LabelItem) => void;
}

/**
 * Overview tab component - W&B style List layout with high-density key-value pairs
 * Plus two-column layout for Config JSON tree and Ground Truth table
 */
const OverviewTab: React.FC<OverviewTabProps> = ({
  notes,
  labels = [],
  author,
  state,
  startTime,
  runtime,
  taskID,
  traceID,
  taskLink,
  traceLink,
  createdAt,
  updatedAt,
  additionalFields = [],
  config,
  groundTruth,
  onAddLabel,
  onEditNotes,
  onRemoveLabel,
}) => {
  // State for controlling metrics table expansion
  const [metricsExpanded, setMetricsExpanded] = useState(true);

  // Categorize labels
  const categorizedLabels = useMemo(() => {
    const tags: LabelItem[] = [];
    const metrics: LabelItem[] = [];
    const customLabels: LabelItem[] = [];

    labels.forEach((label) => {
      if (label.key?.toLowerCase() === 'tag') {
        // Type 1: Tags - only show value
        tags.push(label);
      } else if (label.is_system) {
        metrics.push(label);
      } else {
        // Type 3: Custom user labels
        customLabels.push(label);
      }
    });

    return { tags, metrics, customLabels };
  }, [labels]);

  // Build data items for list
  const listData: ListItem[] = useMemo(() => {
    const items: ListItem[] = [
      {
        key: 'notes',
        label: 'Notes',
        value: notes ? (
          <Paragraph
            className='overview-notes'
            ellipsis={{ rows: 2, expandable: true }}
          >
            {notes}
          </Paragraph>
        ) : (
          <Button
            type='text'
            size='small'
            className='overview-add-notes'
            onClick={onEditNotes}
          >
            What makes this run special?
          </Button>
        ),
      },
      {
        key: 'tags',
        label: 'Tags',
        value: (
          <Space wrap size={4}>
            {categorizedLabels.tags.map((l, index) => (
              <Tag key={index} color='blue'>
                {l.value}
              </Tag>
            ))}
            {categorizedLabels.tags.length === 0 && (
              <Text type='secondary'>No tags</Text>
            )}
          </Space>
        ),
      },
      {
        key: 'customLabels',
        label: 'Labels',
        value: (
          <Space wrap size={4}>
            {categorizedLabels.customLabels.map((l, index) => (
              <Tag
                key={index}
                color='purple'
                closable
                onClose={(e) => {
                  e.preventDefault();
                  onRemoveLabel?.(l);
                }}
              >
                {`${l.key}: ${l.value}`}
              </Tag>
            ))}
            {onAddLabel && (
              <AddLabelDropdown
                existingLabels={labels}
                onAddLabel={onAddLabel}
              />
            )}
          </Space>
        ),
      },
      {
        key: 'author',
        label: 'Author',
        value: (
          <Space size={8}>
            <UserOutlined style={{ color: 'var(--color-secondary-400)' }} />
            <Text>{author || '-'}</Text>
          </Space>
        ),
      },
      {
        key: 'state',
        label: 'State',
        value: (
          <div className='overview-status'>
            <span
              className='overview-status-dot'
              style={{ backgroundColor: getDatapackStateDisplay(state).color }}
            />
            <span style={{ color: getDatapackStateDisplay(state).color }}>
              {getDatapackStateDisplay(state).text}
            </span>
          </div>
        ),
      },
      {
        key: 'startTime',
        label: 'Start time',
        value: (
          <Text>
            {startTime ? dayjs(startTime).format('YYYY-MM-DD H:mm:ss') : '-'}
          </Text>
        ),
      },
      {
        key: 'runtime',
        label: 'Runtime',
        value: <Text>{runtime || '-'}</Text>,
      },
    ];

    // Add additional entity-specific fields
    additionalFields.forEach((field, index) => {
      items.push({
        key: `additional-${index}`,
        label: field.label,
        value: field.isCommand ? (
          <pre className='overview-command-value'>{field.value}</pre>
        ) : (
          field.value
        ),
        isCommand: field.isCommand,
      });
    });

    items.push({
      key: 'taskID',
      label: 'Task ID',
      value: taskID ? (
        taskLink ? (
          <a href={taskLink}>{taskID}</a>
        ) : (
          <Text>{taskID}</Text>
        )
      ) : (
        <Text>-</Text>
      ),
    });

    items.push({
      key: 'traceID',
      label: 'Trace ID',
      value: traceID ? (
        traceLink ? (
          <a href={traceLink}>{traceID}</a>
        ) : (
          <Text>{traceID}</Text>
        )
      ) : (
        <Text>-</Text>
      ),
    });

    // Add timestamps
    items.push({
      key: 'created',
      label: 'Created',
      value: (
        <Text type='secondary'>
          {dayjs(createdAt).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
    });

    if (updatedAt) {
      items.push({
        key: 'updated',
        label: 'Updated',
        value: (
          <Text type='secondary'>
            {dayjs(updatedAt).format('YYYY-MM-DD HH:mm:ss')}
          </Text>
        ),
      });
    }

    items.push({
      key: 'metrics',
      label: 'Metrics',
      value: (
        <div className='overview-metrics-section'>
          {categorizedLabels.metrics.length > 0 ? (
            <>
              <Button
                type='text'
                size='small'
                onClick={() => setMetricsExpanded(!metricsExpanded)}
                icon={metricsExpanded ? <UpOutlined /> : <DownOutlined />}
                style={{ marginBottom: 8 }}
              >
                {metricsExpanded ? 'Hide' : 'Show'}{' '}
                {categorizedLabels.metrics.length} system metrics
              </Button>
              {metricsExpanded && (
                <Table
                  size='small'
                  dataSource={categorizedLabels.metrics.map((m, idx) => ({
                    key: idx,
                    metric: m.key,
                    value: m.value,
                  }))}
                  columns={[
                    {
                      title: 'Metric',
                      dataIndex: 'metric',
                      key: 'metric',
                      width: '50%',
                      render: (text) => <Text code>{text}</Text>,
                    },
                    {
                      title: 'Value',
                      dataIndex: 'value',
                      key: 'value',
                      width: '50%',
                    },
                  ]}
                  pagination={false}
                  style={{ maxHeight: 300, overflowY: 'auto' }}
                />
              )}
            </>
          ) : (
            <Text type='secondary'>No system metrics</Text>
          )}
        </div>
      ),
    });

    return items;
  }, [
    notes,
    onEditNotes,
    categorizedLabels.tags,
    categorizedLabels.customLabels,
    categorizedLabels.metrics,
    onAddLabel,
    onRemoveLabel,
    metricsExpanded,
    author,
    state,
    startTime,
    runtime,
    additionalFields,
    taskID,
    traceID,
    taskLink,
    traceLink,
    createdAt,
    updatedAt,
    labels,
  ]);

  // Render list item
  const renderItem = (item: ListItem) => (
    <List.Item
      className={`overview-list-item ${item.isCommand ? 'command-item' : ''}`}
    >
      <div className='overview-list-key'>{item.label}</div>
      <div className='overview-list-value'>{item.value}</div>
    </List.Item>
  );

  // Check if we should show the two-column section
  const hasConfig = config && Object.keys(config).length > 0;
  const hasGroundTruth = groundTruth && groundTruth.length > 0;
  const showTwoColumnSection = hasConfig || hasGroundTruth;

  return (
    <div className='overview-tab'>
      {/* Key-value list section */}
      <List
        className='overview-list'
        itemLayout='horizontal'
        dataSource={listData}
        split={false}
        renderItem={renderItem}
      />

      {/* Two-column section: Config + Ground Truth (only for injections) */}
      {showTwoColumnSection && (
        <div className='overview-two-column-section'>
          <Row gutter={24}>
            {/* Left column: Config JSON tree */}
            {hasConfig && (
              <Col flex={hasGroundTruth ? '1 1 50%' : '1 1 100%'}>
                <ConfigTree config={config} />
              </Col>
            )}

            {/* Right column: Ground Truth table */}
            {hasGroundTruth && (
              <Col flex={hasConfig ? '1 1 50%' : '1 1 100%'}>
                <GroundTruthTable groundTruth={groundTruth} />
              </Col>
            )}
          </Row>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;

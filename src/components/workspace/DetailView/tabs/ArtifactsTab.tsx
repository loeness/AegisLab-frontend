import { useState } from 'react';

import {
  BarChartOutlined,
  DownloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type {
  DetectorResultItem,
  GranularityResultItem,
} from '@rcabench/client';
import {
  Badge,
  Button,
  Card,
  Empty,
  Progress,
  Space,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface ArtifactsTabProps {
  detectorResults?: DetectorResultItem[];
  granularityResults?: GranularityResultItem[];
  loading?: boolean;
  onViewGranularity?: (result: GranularityResultItem) => void;
  onDownload?: () => void;
}

/**
 * Artifacts tab component - Execution-specific outputs
 */
const ArtifactsTab: React.FC<ArtifactsTabProps> = ({
  detectorResults = [],
  granularityResults = [],
  loading = false,
  onViewGranularity,
  onDownload,
}) => {
  const [showPercentiles, setShowPercentiles] = useState(false);

  // Detector Results Table columns
  const detectorColumns: ColumnsType<DetectorResultItem> = [
    {
      title: 'Span Name',
      dataIndex: 'span_name',
      key: 'span_name',
      width: 180,
      ellipsis: true,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Issues',
      dataIndex: 'issues',
      key: 'issues',
      width: 120,
      render: (type?: string) =>
        type ? (
          <Badge
            color={
              type === 'latency' ? 'var(--color-warning)' : 'var(--color-error)'
            }
            text={type}
          />
        ) : (
          '-'
        ),
    },
    {
      title: 'Normal Avg Duration',
      dataIndex: 'normal_avg_duration',
      key: 'normal_avg_duration',
      width: 150,
      render: (value?: number) =>
        value !== undefined ? `${value.toFixed(2)}ms` : '-',
    },
    {
      title: 'Abnormal Avg Duration',
      dataIndex: 'abnormal_avg_duration',
      key: 'abnormal_avg_duration',
      width: 160,
      render: (value?: number) =>
        value !== undefined ? `${value.toFixed(2)}ms` : '-',
    },
    {
      title: 'Normal Succ Rate',
      dataIndex: 'normal_succ_rate',
      key: 'normal_succ_rate',
      width: 140,
      render: (value?: number) =>
        value !== undefined ? `${(value * 100).toFixed(1)}%` : '-',
    },
    {
      title: 'Abnormal Succ Rate',
      dataIndex: 'abnormal_succ_rate',
      key: 'abnormal_succ_rate',
      width: 150,
      render: (value?: number) =>
        value !== undefined ? `${(value * 100).toFixed(1)}%` : '-',
    },
    // Percentile columns (shown when expanded)
    ...(showPercentiles
      ? ([
          {
            title: 'Normal P90',
            dataIndex: 'normal_p90',
            key: 'normal_p90',
            width: 110,
            render: (value?: number) =>
              value !== undefined ? `${value.toFixed(2)}ms` : '-',
          },
          {
            title: 'Normal P95',
            dataIndex: 'normal_p95',
            key: 'normal_p95',
            width: 110,
            render: (value?: number) =>
              value !== undefined ? `${value.toFixed(2)}ms` : '-',
          },
          {
            title: 'Normal P99',
            dataIndex: 'normal_p99',
            key: 'normal_p99',
            width: 110,
            render: (value?: number) =>
              value !== undefined ? `${value.toFixed(2)}ms` : '-',
          },
          {
            title: 'Abnormal P90',
            dataIndex: 'abnormal_p90',
            key: 'abnormal_p90',
            width: 120,
            render: (value?: number) =>
              value !== undefined ? `${value.toFixed(2)}ms` : '-',
          },
          {
            title: 'Abnormal P95',
            dataIndex: 'abnormal_p95',
            key: 'abnormal_p95',
            width: 120,
            render: (value?: number) =>
              value !== undefined ? `${value.toFixed(2)}ms` : '-',
          },
          {
            title: 'Abnormal P99',
            dataIndex: 'abnormal_p99',
            key: 'abnormal_p99',
            width: 120,
            render: (value?: number) =>
              value !== undefined ? `${value.toFixed(2)}ms` : '-',
          },
        ] as ColumnsType<DetectorResultItem>)
      : []),
  ];

  // Granularity Results Table columns
  const granularityColumns: ColumnsType<GranularityResultItem> = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: '10%',
      render: (rank?: number) =>
        rank !== undefined ? (
          <Badge
            count={rank}
            style={{
              backgroundColor:
                rank === 1
                  ? 'var(--color-success)'
                  : rank === 2
                    ? 'var(--color-warning)'
                    : 'var(--color-secondary-500)',
            }}
          />
        ) : (
          '-'
        ),
    },
    {
      title: 'Result',
      dataIndex: 'result',
      key: 'result',
      width: '40%',
      ellipsis: true,
      render: (value?: string) => value || '-',
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: '15%',
      render: (level?: string) => level || '-',
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      width: '20%',
      render: (confidence?: number) =>
        confidence !== undefined ? (
          <Progress
            percent={Math.round(confidence * 100)}
            size='small'
            strokeColor={
              confidence >= 0.8
                ? 'var(--color-success)'
                : confidence >= 0.5
                  ? 'var(--color-warning)'
                  : 'var(--color-error)'
            }
            format={(percent) => `${percent}%`}
          />
        ) : (
          '-'
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '15%',
      render: (_: unknown, record: GranularityResultItem) =>
        onViewGranularity ? (
          <Button
            type='link'
            icon={<EyeOutlined />}
            onClick={() => onViewGranularity(record)}
          >
            View
          </Button>
        ) : null,
    },
  ];

  const hasDetectorResults = detectorResults.length > 0;
  const hasGranularityResults = granularityResults.length > 0;

  if (!hasDetectorResults && !hasGranularityResults) {
    return (
      <div className='artifacts-tab-empty'>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description='No artifacts available for this execution'
        />
      </div>
    );
  }

  return (
    <div className='artifacts-tab'>
      <Space direction='vertical' style={{ width: '100%' }} size='large'>
        {/* Detector Results */}
        {hasDetectorResults && (
          <Card
            title='Anomaly Detection Results'
            extra={
              <Space>
                <Button
                  size='small'
                  onClick={() => setShowPercentiles((v) => !v)}
                >
                  {showPercentiles ? 'Hide Percentiles' : 'Show Percentiles'}
                </Button>
                {onDownload && (
                  <Button icon={<DownloadOutlined />} onClick={onDownload}>
                    Export
                  </Button>
                )}
              </Space>
            }
          >
            <Table
              rowKey={(record, index) => record.span_name || String(index)}
              columns={detectorColumns}
              dataSource={detectorResults}
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
              size='middle'
              scroll={showPercentiles ? { x: 1400 } : undefined}
            />
          </Card>
        )}

        {/* Granularity Results */}
        {hasGranularityResults && (
          <Card
            title='Granularity Results'
            extra={<Button icon={<BarChartOutlined />}>View Chart</Button>}
          >
            <Table
              rowKey={(record, index) =>
                record.rank !== undefined ? String(record.rank) : String(index)
              }
              columns={granularityColumns}
              dataSource={granularityResults}
              loading={loading}
              pagination={false}
              size='middle'
            />
          </Card>
        )}

        {/* Empty state */}
        {!hasDetectorResults && !hasGranularityResults && (
          <Empty description='No artifact data available'>
            <Text type='secondary'>
              Artifacts will be available once the execution completes.
            </Text>
          </Empty>
        )}
      </Space>
    </div>
  );
};

export default ArtifactsTab;

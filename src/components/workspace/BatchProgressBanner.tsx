/**
 * BatchProgressBanner - Shows real-time progress of a batch execution group.
 *
 * Connects to SSE stream for live updates and displays a collapsible/dismissible
 * banner with completion counts, failure counts, and a progress bar.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CloseOutlined,
  DownOutlined,
  SyncOutlined,
  UpOutlined,
} from '@ant-design/icons';
import type { GroupStats } from '@rcabench/client';
import { Alert, Button, Progress, Space, Typography } from 'antd';

import { createGroupStream, groupApi } from '@/api/groups';

const { Text } = Typography;

interface BatchProgressBannerProps {
  groupId: string;
  onDismiss: () => void;
}

interface ProgressState {
  total: number;
  completed: number;
  failed: number;
  running: number;
}

const BatchProgressBanner: React.FC<BatchProgressBannerProps> = ({
  groupId,
  onDismiss,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    total: 0,
    completed: 0,
    failed: 0,
    running: 0,
  });
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial stats to get total_traces
  useEffect(() => {
    groupApi
      .getGroupStats(groupId)
      .then((stats: GroupStats) => {
        if (stats?.total_traces) {
          setProgress((prev) => ({ ...prev, total: stats.total_traces ?? 0 }));
        }
        // Parse trace_state_map for initial counts
        if (stats?.trace_state_map) {
          let completed = 0;
          let failed = 0;
          let running = 0;
          const stateMap = stats.trace_state_map;
          // Keys are stringified TraceState values: "0"=Pending, "1"=Running, "2"=Completed, "3"=Failed
          if (stateMap['2']) completed = stateMap['2'].length;
          if (stateMap['3']) failed = stateMap['3'].length;
          if (stateMap['1']) running = stateMap['1'].length;
          setProgress((prev) => ({
            ...prev,
            completed,
            failed,
            running,
          }));
        }
      })
      .catch(() => {
        // Silently ignore fetch failures for group stats
      });
  }, [groupId]);

  // Connect to SSE stream
  useEffect(() => {
    const es = createGroupStream(groupId);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventName: string = data.last_event ?? '';
        const state: number | undefined = data.state;

        // Update progress based on trace state changes
        if (state === 2) {
          // Completed
          setProgress((prev) => {
            const newCompleted = prev.completed + 1;
            const newRunning = Math.max(0, prev.running - 1);
            return { ...prev, completed: newCompleted, running: newRunning };
          });
        } else if (state === 3) {
          // Failed
          setProgress((prev) => {
            const newFailed = prev.failed + 1;
            const newRunning = Math.max(0, prev.running - 1);
            return { ...prev, failed: newFailed, running: newRunning };
          });
        } else if (state === 1) {
          // Running
          setProgress((prev) => ({
            ...prev,
            running: prev.running + 1,
          }));
        }

        // Also handle event-name-based detection as fallback
        if (
          !state &&
          (eventName.includes('succeed') || eventName.includes('completed'))
        ) {
          setProgress((prev) => ({
            ...prev,
            completed: prev.completed + 1,
          }));
        } else if (!state && eventName.includes('failed')) {
          setProgress((prev) => ({
            ...prev,
            failed: prev.failed + 1,
          }));
        }
      } catch {
        // Ignore parse errors for heartbeat or non-JSON messages
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [groupId]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const finished = progress.completed + progress.failed;
  const percent =
    progress.total > 0 ? Math.round((finished / progress.total) * 100) : 0;
  const isComplete = progress.total > 0 && finished >= progress.total;

  // Determine alert type
  let alertType: 'info' | 'success' | 'warning' | 'error' = 'info';
  if (isComplete && progress.failed === 0) alertType = 'success';
  else if (isComplete && progress.failed > 0) alertType = 'warning';
  else if (progress.failed > 0) alertType = 'warning';

  const statusText = connected ? 'Live' : 'Reconnecting...';

  const description = collapsed ? null : (
    <div style={{ marginTop: 8 }}>
      <Space direction='vertical' style={{ width: '100%' }} size='small'>
        <Progress
          percent={percent}
          status={
            isComplete
              ? progress.failed > 0
                ? 'exception'
                : 'success'
              : 'active'
          }
          size='small'
        />
        <Space split={<Text type='secondary'>|</Text>}>
          <Text>
            {progress.completed}/{progress.total} completed
          </Text>
          {progress.failed > 0 && (
            <Text type='danger'>{progress.failed} failed</Text>
          )}
          {progress.running > 0 && (
            <Text type='secondary'>
              <SyncOutlined spin /> {progress.running} running
            </Text>
          )}
        </Space>
      </Space>
    </div>
  );

  const messageContent = (
    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
      <Space>
        <Text strong>
          Batch Execution {isComplete ? 'Complete' : 'In Progress'}
        </Text>
        {collapsed && (
          <Text type='secondary' style={{ fontSize: 12 }}>
            ({progress.completed}/{progress.total} completed
            {progress.failed > 0 ? `, ${progress.failed} failed` : ''})
          </Text>
        )}
      </Space>
      <Space size='small'>
        <Text type='secondary' style={{ fontSize: 11 }}>
          {statusText}
        </Text>
        <Button
          type='text'
          size='small'
          icon={collapsed ? <DownOutlined /> : <UpOutlined />}
          onClick={toggleCollapse}
        />
        <Button
          type='text'
          size='small'
          icon={<CloseOutlined />}
          onClick={onDismiss}
        />
      </Space>
    </Space>
  );

  return (
    <div style={{ marginBottom: 12 }}>
      <Alert
        type={alertType}
        message={messageContent}
        description={description}
        showIcon={false}
        closable={false}
        style={{ padding: '12px 16px' }}
      />
    </div>
  );
};

export default BatchProgressBanner;

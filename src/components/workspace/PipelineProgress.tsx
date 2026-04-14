import { useMemo } from 'react';

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { Space, Steps, Typography } from 'antd';

import {
  type PhaseInfo,
  type PipelinePhaseMap,
  useTraceSSE,
} from '@/hooks/useTraceSSE';

const { Text } = Typography;

interface PipelineProgressProps {
  traceId?: string;
  /** Optional: provide pre-fetched phases instead of connecting to SSE */
  phases?: PipelinePhaseMap;
}

const PHASE_LABELS: Record<string, string> = {
  fault_injection: 'Inject Fault',
  datapack_building: 'Build Datapack',
  detector: 'Run Algorithm',
};

const formatDuration = (startTime?: number, endTime?: number): string => {
  if (!startTime) return '';
  const end = endTime ?? Date.now();
  const diff = Math.floor((end - startTime) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
};

const getStepStatus = (
  info: PhaseInfo
): 'wait' | 'process' | 'finish' | 'error' => {
  return info.status;
};

const getStepIcon = (info: PhaseInfo) => {
  switch (info.status) {
    case 'process':
      return <LoadingOutlined />;
    case 'finish':
      return <CheckCircleOutlined />;
    case 'error':
      return <CloseCircleOutlined />;
    default:
      return <ClockCircleOutlined />;
  }
};

const getStepDescription = (info: PhaseInfo): string => {
  if (info.status === 'process' && info.startTime) {
    return `Running ${formatDuration(info.startTime)}`;
  }
  if (info.status === 'finish' && info.startTime && info.endTime) {
    return `Completed in ${formatDuration(info.startTime, info.endTime)}`;
  }
  if (info.status === 'error') {
    return 'Failed';
  }
  return 'Waiting';
};

/**
 * PipelineProgress — displays the injection pipeline stages with real-time SSE updates.
 *
 * Stages: Inject Fault → Build Datapack → Run Algorithm
 *
 * Uses useTraceSSE to connect to the trace stream and map events to pipeline phases.
 */
const PipelineProgress: React.FC<PipelineProgressProps> = ({
  traceId,
  phases: externalPhases,
}) => {
  const { phases: ssePhases, isConnected } = useTraceSSE(
    externalPhases ? undefined : traceId
  );

  const phases = externalPhases ?? ssePhases;

  const phaseKeys = useMemo(
    () => ['fault_injection', 'datapack_building', 'detector'] as const,
    []
  );

  const items = useMemo(
    () =>
      phaseKeys.map((key) => {
        const info = phases[key];
        return {
          title: PHASE_LABELS[key],
          status: getStepStatus(info),
          icon: getStepIcon(info),
          description: getStepDescription(info),
        };
      }),
    [phases, phaseKeys]
  );

  // Determine current step index for Steps component
  const currentStep = useMemo(() => {
    for (let i = phaseKeys.length - 1; i >= 0; i--) {
      const info = phases[phaseKeys[i]];
      if (info.status !== 'wait') return i;
    }
    return 0;
  }, [phases, phaseKeys]);

  return (
    <div style={{ marginBottom: 24 }}>
      <Space
        style={{
          width: '100%',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text strong>Pipeline Progress</Text>
        {traceId && !externalPhases && (
          <Text type='secondary' style={{ fontSize: 12 }}>
            {isConnected ? 'Live' : 'Connecting...'}
          </Text>
        )}
      </Space>
      <Steps
        current={currentStep}
        size='small'
        items={items}
        style={{ padding: '8px 0' }}
      />
    </div>
  );
};

export default PipelineProgress;

/**
 * TraceDetailPage - Real-time trace detail with SSE streaming.
 *
 * Route: /:teamName/:projectName/traces/:id
 *
 * Uses the useTraceSSE hook to stream trace events and shows a
 * Steps-based progress view of the pipeline phases:
 * Fault Injection -> Datapack Building -> Detector (Evaluation).
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Result,
  Row,
  Space,
  Spin,
  Steps,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

import { traceApi } from '@/api/traces';
import {
  type PhaseInfo,
  type StepPhase,
  useTraceSSE,
} from '@/hooks/useTraceSSE';

dayjs.extend(duration);

const { Title, Text, Paragraph } = Typography;

// ---------- Constants ----------

const PHASE_ORDER: StepPhase[] = [
  'fault_injection',
  'datapack_building',
  'detector',
];

const PHASE_LABELS: Record<StepPhase, string> = {
  fault_injection: 'Fault Injection',
  datapack_building: 'Datapack Building',
  detector: 'Detector (Evaluation)',
};

const PHASE_DESCRIPTIONS: Record<StepPhase, string> = {
  fault_injection: 'Inject faults into the target system',
  datapack_building: 'Build datapack from injected data',
  detector: 'Run detection algorithm and evaluate results',
};

// ---------- Helpers ----------

const phaseStatusToStepStatus = (
  status: PhaseInfo['status']
): 'wait' | 'process' | 'finish' | 'error' => status;

const phaseStatusIcon = (status: PhaseInfo['status']) => {
  switch (status) {
    case 'process':
      return <LoadingOutlined />;
    case 'finish':
      return <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />;
    case 'error':
      return <CloseCircleOutlined style={{ color: 'var(--color-error)' }} />;
    default:
      return (
        <ClockCircleOutlined style={{ color: 'var(--color-secondary-300)' }} />
      );
  }
};

const formatPhaseDuration = (phase: PhaseInfo): string => {
  if (!phase.startTime) return '-';
  const end = phase.endTime ?? Date.now();
  const diff = end - phase.startTime;
  if (diff < 1000) return `${diff}ms`;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const overallStatusTag = (phases: Record<StepPhase, PhaseInfo>) => {
  const values = Object.values(phases);
  if (values.some((p) => p.status === 'error')) {
    return <Tag color='error'>FAILED</Tag>;
  }
  if (values.every((p) => p.status === 'finish')) {
    return <Tag color='success'>COMPLETED</Tag>;
  }
  if (values.some((p) => p.status === 'process')) {
    return <Tag color='processing'>RUNNING</Tag>;
  }
  return <Tag color='default'>PENDING</Tag>;
};

// ---------- Component ----------

const TraceDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    teamName,
    projectName,
    id: traceId,
  } = useParams<{
    teamName: string;
    projectName: string;
    id: string;
  }>();

  // Fetch static trace metadata
  const { data: traceDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['trace', traceId],
    queryFn: () => traceApi.getTrace(traceId ?? ''),
    enabled: !!traceId,
    staleTime: 30_000,
  });

  // Real-time SSE streaming for phase progress
  const { phases, isConnected, lastEvent } = useTraceSSE(traceId);

  // Compute current step index for the Steps component
  const currentStepIndex = useMemo(() => {
    for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
      const status = phases[PHASE_ORDER[i]].status;
      if (status === 'process' || status === 'finish' || status === 'error') {
        return i;
      }
    }
    return 0;
  }, [phases]);

  // Timeline events derived from phases
  const timelineItems = useMemo(() => {
    const items: Array<{
      key: string;
      color: string;
      dot?: React.ReactNode;
      children: React.ReactNode;
    }> = [];

    for (const phase of PHASE_ORDER) {
      const info = phases[phase];
      if (info.status === 'wait') continue;

      const label = PHASE_LABELS[phase];

      if (info.startTime) {
        items.push({
          key: `${phase}-start`,
          color: 'blue',
          dot: <SyncOutlined />,
          children: (
            <div>
              <Text strong>{label} started</Text>
              <br />
              <Text type='secondary'>
                {dayjs(info.startTime).format('HH:mm:ss.SSS')}
              </Text>
              {info.taskId && (
                <>
                  <br />
                  <Text type='secondary' copyable style={{ fontSize: 12 }}>
                    Task: {info.taskId}
                  </Text>
                </>
              )}
            </div>
          ),
        });
      }

      if (info.endTime) {
        const isError = info.status === 'error';
        items.push({
          key: `${phase}-end`,
          color: isError ? 'red' : 'green',
          dot: isError ? <CloseCircleOutlined /> : <CheckCircleOutlined />,
          children: (
            <div>
              <Text strong type={isError ? 'danger' : 'success'}>
                {label} {isError ? 'failed' : 'completed'}
              </Text>
              <br />
              <Text type='secondary'>
                {dayjs(info.endTime).format('HH:mm:ss.SSS')}
              </Text>
              <br />
              <Text type='secondary'>
                Duration: {formatPhaseDuration(info)}
              </Text>
            </div>
          ),
        });
      }
    }

    return items;
  }, [phases]);

  // ---------- Render ----------

  if (!traceId) {
    return (
      <Result
        status='404'
        title='Trace Not Found'
        subTitle='No trace ID was provided.'
        extra={
          <Button
            type='primary'
            onClick={() => navigate(`/${teamName}/${projectName}/traces`)}
          >
            Back to Traces
          </Button>
        }
      />
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Space align='center'>
          <Button
            type='text'
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/${teamName}/${projectName}/traces`)}
          />
          <Title level={4} style={{ margin: 0 }}>
            Trace Detail
          </Title>
          {overallStatusTag(phases)}
          <Badge
            status={isConnected ? 'processing' : 'default'}
            text={
              <Text type='secondary' style={{ fontSize: 12 }}>
                {isConnected ? 'Live' : 'Disconnected'}
              </Text>
            }
          />
        </Space>
      </div>

      {/* Metadata card */}
      <Card
        title='Trace Information'
        style={{ marginBottom: 24 }}
        loading={isDetailLoading}
      >
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size='small'>
          <Descriptions.Item label='Trace ID'>
            <Text copyable>{traceId}</Text>
          </Descriptions.Item>
          <Descriptions.Item label='Status'>
            {overallStatusTag(phases)}
          </Descriptions.Item>
          <Descriptions.Item label='Project'>
            <Text>{projectName ?? '-'}</Text>
          </Descriptions.Item>
          {traceDetail && (
            <>
              {(traceDetail as Record<string, unknown>).created_at && (
                <Descriptions.Item label='Created'>
                  {dayjs(
                    (traceDetail as Record<string, unknown>)
                      .created_at as string
                  ).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              {(traceDetail as Record<string, unknown>).type && (
                <Descriptions.Item label='Type'>
                  <Tag>
                    {(traceDetail as Record<string, unknown>).type as string}
                  </Tag>
                </Descriptions.Item>
              )}
            </>
          )}
          {lastEvent && (
            <Descriptions.Item label='Last Event'>
              <Text type='secondary' style={{ fontSize: 12 }}>
                {lastEvent.event_name ?? 'unknown'}
              </Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Pipeline progress */}
      <Row gutter={24}>
        <Col xs={24} lg={14}>
          <Card title='Pipeline Progress' style={{ marginBottom: 24 }}>
            <Steps
              current={currentStepIndex}
              direction='vertical'
              items={PHASE_ORDER.map((phase) => {
                const info = phases[phase];
                return {
                  title: PHASE_LABELS[phase],
                  description: (
                    <div>
                      <Paragraph
                        type='secondary'
                        style={{ margin: 0, fontSize: 13 }}
                      >
                        {PHASE_DESCRIPTIONS[phase]}
                      </Paragraph>
                      {info.status !== 'wait' && (
                        <Space
                          size='middle'
                          style={{ marginTop: 8, fontSize: 12 }}
                        >
                          <Text type='secondary'>
                            Duration: {formatPhaseDuration(info)}
                          </Text>
                          {info.taskId && (
                            <Text type='secondary' copyable>
                              Task: {info.taskId}
                            </Text>
                          )}
                        </Space>
                      )}
                    </div>
                  ),
                  status: phaseStatusToStepStatus(info.status),
                  icon: phaseStatusIcon(info.status),
                };
              })}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          {/* Phase summary cards */}
          <Card title='Phase Summary' style={{ marginBottom: 24 }}>
            <Space direction='vertical' style={{ width: '100%' }} size={16}>
              {PHASE_ORDER.map((phase) => {
                const info = phases[phase];
                const statusColors: Record<string, string> = {
                  wait: 'var(--color-secondary-300)',
                  process: 'var(--color-primary-500)',
                  finish: 'var(--color-success)',
                  error: 'var(--color-error)',
                };
                return (
                  <div
                    key={phase}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: `1px solid ${statusColors[info.status]}22`,
                      background: `${statusColors[info.status]}08`,
                    }}
                  >
                    <div>
                      <Text strong>{PHASE_LABELS[phase]}</Text>
                      <br />
                      <Text type='secondary' style={{ fontSize: 12 }}>
                        {info.status === 'wait'
                          ? 'Waiting'
                          : info.status === 'process'
                            ? 'In progress...'
                            : info.status === 'finish'
                              ? 'Completed'
                              : 'Failed'}
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {info.status === 'process' && <Spin size='small' />}
                      {info.status !== 'wait' && (
                        <Text
                          type='secondary'
                          style={{ fontSize: 12, display: 'block' }}
                        >
                          {formatPhaseDuration(info)}
                        </Text>
                      )}
                    </div>
                  </div>
                );
              })}
            </Space>
          </Card>

          {/* Event timeline */}
          {timelineItems.length > 0 && (
            <Card title='Event Timeline'>
              <Timeline items={timelineItems} />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default TraceDetailPage;

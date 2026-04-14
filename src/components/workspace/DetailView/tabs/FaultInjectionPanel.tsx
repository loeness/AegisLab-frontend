import { ExperimentOutlined } from '@ant-design/icons';
import { Empty } from 'antd';

import './FaultInjectionPanel.css';

interface FaultInjectionPanelProps {
  taskId?: string;
}

/**
 * Fault Injection phase panel - placeholder for future implementation
 */
const FaultInjectionPanel: React.FC<FaultInjectionPanelProps> = ({
  taskId,
}) => {
  return (
    <div className='fault-injection-panel'>
      <Empty
        image={
          <ExperimentOutlined
            style={{ fontSize: 48, color: 'var(--color-secondary-400)' }}
          />
        }
        description={
          <span className='fault-injection-panel-desc'>
            Fault Injection details
            {taskId && (
              <span className='fault-injection-panel-task-id'>
                Task: {taskId}
              </span>
            )}
          </span>
        }
      />
    </div>
  );
};

export default FaultInjectionPanel;

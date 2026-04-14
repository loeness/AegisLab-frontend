import { useCallback, useMemo, useState } from 'react';

import {
  CaretDownOutlined,
  CaretRightOutlined,
  CopyOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { App, Button, Input, Modal, Typography } from 'antd';

import './ConfigTree.css';

const { Text } = Typography;

interface ConfigTreeProps {
  config: Record<string, unknown>;
  title?: string;
  description?: string;
  onViewRaw?: () => void;
}

interface TreeNodeData {
  key: string;
  label: string;
  value: unknown;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  childCount?: number;
  children?: TreeNodeData[];
  depth: number;
}

/**
 * Recursively build tree node data from JSON object
 */
const buildTreeData = (
  obj: unknown,
  parentKey: string = '',
  depth: number = 0
): TreeNodeData[] => {
  if (obj === null || obj === undefined) {
    return [];
  }

  if (typeof obj !== 'object') {
    return [];
  }

  const entries = Array.isArray(obj)
    ? obj.map((item, index) => [String(index), item] as [string, unknown])
    : Object.entries(obj);

  return entries.map(([key, value]) => {
    const nodeKey = parentKey ? `${parentKey}.${key}` : key;
    const node: TreeNodeData = {
      key: nodeKey,
      label: key,
      value,
      type: getValueType(value),
      depth,
    };

    if (typeof value === 'object' && value !== null) {
      const childEntries = Array.isArray(value) ? value : Object.keys(value);
      node.childCount = childEntries.length;
      node.children = buildTreeData(value, nodeKey, depth + 1);
    }

    return node;
  });
};

/**
 * Get the type of a value for styling purposes
 */
const getValueType = (
  value: unknown
): 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'null';
};

/**
 * Format value for display
 */
const formatValue = (value: unknown, type: string): string => {
  if (type === 'null') return 'null';
  if (type === 'string') return `"${value}"`;
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') {
    // Format numbers with commas for thousands
    const num = value as number;
    return num.toLocaleString();
  }
  return '';
};

/**
 * Filter tree nodes by search query
 */
const filterTreeData = (
  nodes: TreeNodeData[],
  query: string
): TreeNodeData[] => {
  if (!query.trim()) return nodes;

  const lowerQuery = query.toLowerCase();

  const filterNode = (node: TreeNodeData): TreeNodeData | null => {
    const labelMatches = node.label.toLowerCase().includes(lowerQuery);
    const valueMatches =
      node.type !== 'object' &&
      node.type !== 'array' &&
      String(node.value).toLowerCase().includes(lowerQuery);

    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is TreeNodeData => n !== null);

      if (filteredChildren.length > 0 || labelMatches) {
        return {
          ...node,
          children:
            filteredChildren.length > 0 ? filteredChildren : node.children,
          childCount:
            filteredChildren.length > 0
              ? filteredChildren.length
              : node.childCount,
        };
      }
    }

    if (labelMatches || valueMatches) {
      return node;
    }

    return null;
  };

  return nodes.map(filterNode).filter((n): n is TreeNodeData => n !== null);
};

/**
 * Single tree node component
 */
const TreeNode: React.FC<{
  node: TreeNodeData;
  expandedKeys: Set<string>;
  onToggle: (key: string) => void;
}> = ({ node, expandedKeys, onToggle }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedKeys.has(node.key);
  const isExpandable = node.type === 'object' || node.type === 'array';

  const handleToggle = () => {
    if (isExpandable) {
      onToggle(node.key);
    }
  };

  return (
    <div className='config-tree-node'>
      <div
        className={`config-tree-node-content ${isExpandable ? 'expandable' : ''}`}
        style={{ paddingLeft: node.depth * 20 }}
        onClick={handleToggle}
      >
        {/* Expand/Collapse icon */}
        {isExpandable ? (
          <span className='config-tree-icon'>
            {isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
          </span>
        ) : (
          <span className='config-tree-icon-placeholder' />
        )}

        {/* Key label */}
        <span className='config-tree-key'>{node.label}:</span>

        {/* Value or type indicator */}
        {isExpandable ? (
          <span className='config-tree-type'>
            <span className='config-tree-bracket'>{'{}'}</span>
            <span className='config-tree-count'>
              {node.childCount} {node.childCount === 1 ? 'key' : 'keys'}
            </span>
          </span>
        ) : (
          <span className={`config-tree-value config-tree-value-${node.type}`}>
            {formatValue(node.value, node.type)}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && node.children && (
        <div className='config-tree-children'>
          {node.children.map((child) => (
            <TreeNode
              key={child.key}
              node={child}
              expandedKeys={expandedKeys}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * ConfigTree component - W&B style JSON tree view
 */
const ConfigTree: React.FC<ConfigTreeProps> = ({
  config,
  title = 'Config',
  description = "Config parameters are your model's inputs.",
  onViewRaw,
}) => {
  const { message } = App.useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Build tree data (start at depth 1 since root is depth 0)
  const treeData = useMemo(() => buildTreeData(config, '', 1), [config]);

  // Filter tree data based on search
  const filteredTreeData = useMemo(
    () => filterTreeData(treeData, searchQuery),
    [treeData, searchQuery]
  );

  // Count total keys
  const totalKeys = useMemo(() => Object.keys(config).length, [config]);

  // Track expanded keys - default expand root
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const initialKeys = new Set<string>();
    initialKeys.add('__root__');
    return initialKeys;
  });

  const handleToggle = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Handle root toggle
  const isRootExpanded = expandedKeys.has('__root__');
  const handleRootToggle = () => {
    handleToggle('__root__');
  };

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
    const jsonStr = JSON.stringify(config, null, 2);
    try {
      await navigator.clipboard.writeText(jsonStr);
      message.success('Copied to clipboard');
    } catch {
      message.error('Failed to copy');
    }
  };

  // JSON string for modal display
  const jsonString = useMemo(() => JSON.stringify(config, null, 2), [config]);

  const isEmpty = !config || Object.keys(config).length === 0;

  return (
    <div className='config-tree-container'>
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
      <div className='config-tree-header'>
        <Text strong className='config-tree-title'>
          {title}
        </Text>
        <Button type='link' size='small' onClick={handleViewRaw}>
          View raw data
        </Button>
      </div>

      {/* Description */}
      <div className='config-tree-description'>
        <Text type='secondary'>{description}</Text>
      </div>

      {/* Search */}
      <div className='config-tree-search'>
        <Input
          prefix={
            <SearchOutlined style={{ color: 'var(--color-secondary-300)' }} />
          }
          placeholder='Search keys with regex'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
      </div>

      {/* Tree content */}
      <div className='config-tree-content'>
        {isEmpty ? (
          <div className='config-tree-empty'>
            <Text type='secondary'>No configuration data available</Text>
          </div>
        ) : (
          <>
            {/* Root node */}
            <div className='config-tree-node'>
              <div
                className='config-tree-node-content expandable root-node'
                onClick={handleRootToggle}
              >
                <span className='config-tree-icon'>
                  {isRootExpanded ? (
                    <CaretDownOutlined />
                  ) : (
                    <CaretRightOutlined />
                  )}
                </span>
                <span className='config-tree-key'>Config parameters:</span>
                <span className='config-tree-type'>
                  <span className='config-tree-bracket'>{'{}'}</span>
                  <span className='config-tree-count'>
                    {totalKeys} {totalKeys === 1 ? 'key' : 'keys'}
                  </span>
                </span>
              </div>
            </div>

            {/* Child nodes */}
            {isRootExpanded && (
              <div className='config-tree-children'>
                {filteredTreeData.map((node) => (
                  <TreeNode
                    key={node.key}
                    node={node}
                    expandedKeys={expandedKeys}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ConfigTree;

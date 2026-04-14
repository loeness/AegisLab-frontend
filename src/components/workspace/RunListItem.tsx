/**
 * RunListItem - Reusable run item component for both RunsPanel and WorkspaceTable
 *
 * Renders a single run item with:
 * - Optional checkbox (for table view)
 * - Visibility toggle (eye icon)
 * - Color indicator dot
 * - Run name with crop mode support
 */
import {
  type Key,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Checkbox, Tooltip } from 'antd';

import type { RunNameCropMode, RunStatus } from '@/types/workspace';
import { cropText, needsJsCropping } from '@/utils/textCrop';

// Default colors matching the existing status colors
const DEFAULT_STATUS_COLORS: Record<RunStatus, string> = {
  running: 'var(--color-primary-500)',
  finished: 'var(--color-success)',
  failed: 'var(--color-error)',
  crashed: 'var(--color-warning)',
};

export interface RunListItemProps {
  /** Unique identifier for the run */
  id: Key;
  /** Display name of the run */
  name: string;
  /** Run status for default color */
  status?: RunStatus;
  /** Custom color override (from workspace store) */
  color?: string;
  /** Whether the run is visible (eye icon state) */
  isVisible?: boolean;
  /** Whether the run is selected */
  isSelected?: boolean;
  /** Whether to show checkbox (table view) */
  showCheckbox?: boolean;
  /** Whether the checkbox is checked */
  isChecked?: boolean;
  /** Crop mode for the run name */
  cropMode?: RunNameCropMode;
  /** Callback when visibility is toggled */
  onVisibilityChange?: (id: Key) => void;
  /** Callback when item is clicked */
  onClick?: (id: Key) => void;
  /** Callback when checkbox is toggled */
  onCheckboxChange?: (id: Key, checked: boolean) => void;
  /** Custom class name */
  className?: string;
}

/**
 * RunListItem component for rendering individual run items
 *
 * @example
 * ```tsx
 * // Panel view (no checkbox)
 * <RunListItem
 *   id="run-1"
 *   name="injection_test_001"
 *   status="running"
 *   isVisible={true}
 *   cropMode="end"
 *   onVisibilityChange={(id) => toggleVisibility(id)}
 * />
 *
 * // Table view (with checkbox)
 * <RunListItem
 *   id="run-1"
 *   name="injection_test_001"
 *   showCheckbox
 *   isChecked={selectedRows.includes('run-1')}
 *   onCheckboxChange={(id, checked) => handleSelect(id, checked)}
 * />
 * ```
 */
const RunListItem: React.FC<RunListItemProps> = ({
  id,
  name,
  status = 'running',
  color,
  isVisible = true,
  isSelected = false,
  showCheckbox = false,
  isChecked = false,
  cropMode = 'end',
  onVisibilityChange,
  onClick,
  onCheckboxChange,
  className = '',
}) => {
  const nameRef = useRef<HTMLSpanElement>(null);
  const [displayName, setDisplayName] = useState(name);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Determine the color to use (custom color or status-based)
  const dotColor = useMemo(
    () => color || DEFAULT_STATUS_COLORS[status] || 'var(--color-primary-500)',
    [color, status]
  );

  // Handle visibility toggle
  const handleVisibilityClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onVisibilityChange?.(id);
    },
    [id, onVisibilityChange]
  );

  // Handle item click
  const handleClick = useCallback(() => {
    onClick?.(id);
  }, [id, onClick]);

  // Handle checkbox change
  const handleCheckboxChange = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement> | { target: { checked: boolean } }
    ) => {
      onCheckboxChange?.(id, e.target.checked);
    },
    [id, onCheckboxChange]
  );

  // Handle checkbox click to prevent propagation
  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Check if text overflows and apply JS cropping for non-end modes
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) return;

    // For end mode, use CSS text-overflow
    if (!needsJsCropping(cropMode)) {
      setDisplayName(name);
      setIsOverflowing(el.scrollWidth > el.clientWidth);
      return;
    }

    // For middle/beginning modes, calculate crop based on available width
    // Use a rough estimate: ~7px per character for 13px font
    const charWidth = 7;
    const availableWidth = el.clientWidth || 150;
    const maxChars = Math.floor(availableWidth / charWidth);

    if (name.length > maxChars) {
      setDisplayName(cropText(name, maxChars, cropMode));
      setIsOverflowing(true);
    } else {
      setDisplayName(name);
      setIsOverflowing(false);
    }
  }, [name, cropMode]);

  // Build class names
  const itemClassName = useMemo(() => {
    const classes = ['runs-panel-item'];
    if (isSelected) classes.push('selected');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [isSelected, className]);

  // Determine if we should use CSS ellipsis (only for 'end' mode)
  const usesCssEllipsis = !needsJsCropping(cropMode);

  return (
    <div className={itemClassName} onClick={handleClick}>
      {/* Checkbox (table view only) */}
      {showCheckbox && (
        <Checkbox
          checked={isChecked}
          onChange={handleCheckboxChange}
          onClick={handleCheckboxClick}
          className='runs-panel-item-checkbox'
        />
      )}

      {/* Visibility toggle */}
      <Button
        type='text'
        size='small'
        icon={
          isVisible ? (
            <EyeOutlined style={{ color: 'var(--color-primary-500)' }} />
          ) : (
            <EyeInvisibleOutlined />
          )
        }
        onClick={handleVisibilityClick}
        className='runs-panel-item-visibility'
      />

      {/* Color dot */}
      <span
        className='runs-panel-item-status'
        style={{ backgroundColor: dotColor }}
      />

      {/* Run name with optional tooltip for overflow */}
      {isOverflowing ? (
        <Tooltip title={name} placement='topLeft'>
          <span
            ref={nameRef}
            className='runs-panel-item-name'
            style={usesCssEllipsis ? undefined : { textOverflow: 'clip' }}
          >
            {displayName}
          </span>
        </Tooltip>
      ) : (
        <span
          ref={nameRef}
          className='runs-panel-item-name'
          style={usesCssEllipsis ? undefined : { textOverflow: 'clip' }}
        >
          {displayName}
        </span>
      )}
    </div>
  );
};

export default RunListItem;

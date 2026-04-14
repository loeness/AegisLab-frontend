import { useEffect, useMemo, useState } from 'react';

import { PlusOutlined } from '@ant-design/icons';
import type { LabelItem } from '@rcabench/client';
import { useQuery } from '@tanstack/react-query';
import { Button, Dropdown, Input, message, Select } from 'antd';

import { labelApi } from '@/api/labels';

import './AddLabelDropdown.css';

interface AddLabelDropdownProps {
  existingLabels?: LabelItem[];
  onAddLabel: (key: string, value: string) => Promise<void>;
}

/**
 * Add Label Dropdown Component - W&B style
 * Allows users to select or create key-value labels
 */
const AddLabelDropdown: React.FC<AddLabelDropdownProps> = ({
  existingLabels = [],
  onAddLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [keyInputValue, setKeyInputValue] = useState<string>('');
  const [valueInputValue, setValueInputValue] = useState<string>('');
  const [keySelectOpen, setKeySelectOpen] = useState(false);
  const [valueSelectOpen, setValueSelectOpen] = useState(false);

  // Fetch label suggestions from the API
  const { data: labelsData } = useQuery({
    queryKey: ['labels', 'suggestions'],
    queryFn: () => labelApi.getLabels({ page: 1, size: 50 }),
    staleTime: 60_000,
  });

  // Build key->values map from API labels + existing labels
  const labelSuggestions = useMemo(() => {
    const byKey: Record<string, string[]> = {};

    // Add labels from API response
    const apiItems = labelsData?.items ?? [];
    for (const label of apiItems) {
      const k = (label as { key?: string }).key;
      const v = (label as { value?: string }).value;
      if (k) {
        if (!byKey[k]) byKey[k] = [];
        if (v && !byKey[k].includes(v)) byKey[k].push(v);
      }
    }

    // Merge existing labels passed as props
    for (const label of existingLabels) {
      if (label.key) {
        if (!byKey[label.key]) byKey[label.key] = [];
        if (label.value && !byKey[label.key].includes(label.value)) {
          byKey[label.key].push(label.value);
        }
      }
    }

    return byKey;
  }, [labelsData, existingLabels]);

  const availableKeys = Object.keys(labelSuggestions);

  // Get available values for selected key
  const availableValues = selectedKey
    ? labelSuggestions[selectedKey] || []
    : [];

  // Reset form when dropdown closes
  useEffect(() => {
    if (!open) {
      // 立即关闭 Select 的下拉框
      setKeySelectOpen(false);
      setValueSelectOpen(false);
      // 稍后清理表单状态
      const timer = setTimeout(() => {
        setSelectedKey('');
        setSelectedValue('');
        setKeyInputValue('');
        setValueInputValue('');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleAddLabel = async () => {
    const key = selectedKey || keyInputValue;
    const value = selectedValue || valueInputValue;

    if (!key || !value) {
      message.warning('Please enter both key and value');
      return;
    }

    // Check if label already exists
    const labelExists = existingLabels.some(
      (label) => label.key === key && label.value === value
    );

    if (labelExists) {
      message.warning(`Label "${key}: ${value}" already exists`);
      return;
    }

    setLoading(true);
    try {
      await onAddLabel(key, value);
      setOpen(false);
    } catch (error) {
      message.error('Failed to add label');
    } finally {
      setLoading(false);
    }
  };

  const handleKeySelect = (value: string) => {
    setSelectedKey(value);
    setKeyInputValue('');
    setSelectedValue('');
    setValueInputValue('');
    setKeySelectOpen(false);
  };

  const handleValueSelect = (value: string) => {
    setSelectedValue(value);
    setValueInputValue('');
    setValueSelectOpen(false);
  };

  const dropdownContent = (
    <div className='add-label-dropdown-content'>
      <div className='add-label-field'>
        <div className='add-label-field-label'>Key</div>
        <Select
          showSearch
          open={keySelectOpen}
          onDropdownVisibleChange={setKeySelectOpen}
          getPopupContainer={(trigger) =>
            trigger.parentElement || document.body
          }
          placeholder='Select or type key'
          value={selectedKey || undefined}
          onChange={handleKeySelect}
          onSearch={setKeyInputValue}
          searchValue={keyInputValue}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={availableKeys.map((key) => ({
            label: key,
            value: key,
          }))}
          style={{ width: '100%' }}
          notFoundContent={
            keyInputValue ? (
              <div
                className='add-label-create-option'
                onClick={() => {
                  setSelectedKey(keyInputValue);
                  setKeyInputValue('');
                  setKeySelectOpen(false);
                }}
              >
                <PlusOutlined /> Create New Key: &ldquo;{keyInputValue}&rdquo;
              </div>
            ) : null
          }
        />
      </div>

      <div className='add-label-field'>
        <div className='add-label-field-label'>Value</div>
        {selectedKey && availableValues.length > 0 ? (
          <Select
            showSearch
            open={valueSelectOpen}
            onDropdownVisibleChange={setValueSelectOpen}
            getPopupContainer={(trigger) =>
              trigger.parentElement || document.body
            }
            placeholder='Select or type value'
            value={selectedValue || undefined}
            onChange={handleValueSelect}
            onSearch={setValueInputValue}
            searchValue={valueInputValue}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={availableValues.map((val) => ({
              label: val,
              value: val,
            }))}
            style={{ width: '100%' }}
            notFoundContent={
              valueInputValue ? (
                <div
                  className='add-label-create-option'
                  onClick={() => {
                    setSelectedValue(valueInputValue);
                    setValueInputValue('');
                    setValueSelectOpen(false);
                  }}
                >
                  <PlusOutlined /> Create New Value: &ldquo;{valueInputValue}
                  &rdquo;
                </div>
              ) : null
            }
          />
        ) : (
          <Input
            placeholder='Enter value'
            value={valueInputValue}
            onChange={(e) => setValueInputValue(e.target.value)}
            onPressEnter={handleAddLabel}
          />
        )}
      </div>

      <div className='add-label-actions'>
        <Button size='small' onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          type='primary'
          size='small'
          onClick={handleAddLabel}
          loading={loading}
          disabled={
            (!selectedKey && !keyInputValue) ||
            (!selectedValue && !valueInputValue)
          }
        >
          Add
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement='bottomLeft'
    >
      <Button
        type='text'
        size='small'
        icon={<PlusOutlined />}
        className='overview-add-tag-btn'
      />
    </Dropdown>
  );
};

export default AddLabelDropdown;

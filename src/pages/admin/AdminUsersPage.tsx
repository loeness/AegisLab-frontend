/**
 * AdminUsersPage - RBAC user and role management.
 *
 * Route: /admin/users
 *
 * Two tabs:
 * - Users: List all users with role badges, assign/remove roles via drawer
 * - Roles: List all roles with permissions management, create/delete roles
 */
import { useCallback, useMemo, useState } from 'react';

import {
  DeleteOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { PermissionResp } from '@rcabench/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Drawer,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { permissionApi } from '@/api/permissions';
import { roleApi } from '@/api/roles';
import { usersApi } from '@/api/users';

const { Title, Text } = Typography;

// ---------- Types ----------

interface UserRecord {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  status?: string;
  roles?: RoleRecord[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

interface RoleRecord {
  id: number;
  name: string;
  scope?: string;
  description?: string;
  permissions_count?: number;
  created_at?: string;
  [key: string]: unknown;
}

// ---------- Users Tab ----------

const UsersTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [assignForm] = Form.useForm();

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', page, pageSize, searchText],
    queryFn: () =>
      usersApi.getUsers({
        page,
        size: pageSize,
        username: searchText || undefined,
      }),
    staleTime: 10_000,
  });

  // Fetch available roles for the assign drawer
  const { data: rolesData } = useQuery({
    queryKey: ['roles-all'],
    queryFn: () => roleApi.getRoles({ page: 1, size: 100 }),
    staleTime: 60_000,
  });

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) =>
      usersApi.assignRole(userId, roleId),
    onSuccess: () => {
      message.success('Role assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDrawerOpen(false);
      assignForm.resetFields();
    },
    onError: () => {
      message.error('Failed to assign role');
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) =>
      usersApi.removeRole(userId, roleId),
    onSuccess: () => {
      message.success('Role removed successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => {
      message.error('Failed to remove role');
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => usersApi.deleteUser(id),
    onSuccess: () => {
      message.success('User deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => {
      message.error('Failed to delete user');
    },
  });

  // Normalise data
  const users: UserRecord[] = useMemo(() => {
    if (!usersData) return [];
    const items = (usersData as { items?: UserRecord[] }).items ?? [];
    return items;
  }, [usersData]);

  const total = useMemo(() => {
    if (!usersData) return 0;
    return (usersData as { total?: number }).total ?? users.length;
  }, [usersData, users.length]);

  const availableRoles: RoleRecord[] = useMemo(() => {
    if (!rolesData) return [];
    if (Array.isArray(rolesData)) return rolesData;
    return (rolesData as { items?: RoleRecord[] }).items ?? [];
  }, [rolesData]);

  // Open assign role drawer
  const openAssignDrawer = useCallback((user: UserRecord) => {
    setSelectedUser(user);
    setDrawerOpen(true);
  }, []);

  // Handle assign form submit
  const handleAssignRole = useCallback(
    (values: { roleId: number }) => {
      if (!selectedUser) return;
      assignRoleMutation.mutate({
        userId: selectedUser.id,
        roleId: values.roleId,
      });
    },
    [selectedUser, assignRoleMutation]
  );

  // Columns
  const columns: ColumnsType<UserRecord> = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      width: 180,
      render: (text: string) => (
        <Space>
          <UserOutlined />
          <Text strong style={{ color: 'var(--color-primary-600)' }}>
            {text}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 240,
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active: boolean) => (
        <Badge
          status={active ? 'success' : 'error'}
          text={active ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      title: 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      width: 280,
      render: (roles: RoleRecord[] | undefined, record: UserRecord) => {
        if (!roles || roles.length === 0) {
          return <Text type='secondary'>No roles</Text>;
        }
        return (
          <Space size={4} wrap>
            {roles.map((role) => (
              <Tag
                key={role.id}
                color='blue'
                closable
                onClose={(e) => {
                  e.preventDefault();
                  Modal.confirm({
                    title: 'Remove Role',
                    content: `Remove role "${role.name}" from user "${record.username}"?`,
                    okText: 'Remove',
                    okButtonProps: { danger: true },
                    onOk: () =>
                      removeRoleMutation.mutate({
                        userId: record.id,
                        roleId: role.id,
                      }),
                  });
                }}
              >
                {role.name}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date?: string) =>
        date ? (
          <Text type='secondary'>{dayjs(date).format('YYYY-MM-DD')}</Text>
        ) : (
          '-'
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: UserRecord) => (
        <Space>
          <Tooltip title='Assign Role'>
            <Button
              type='text'
              size='small'
              icon={<PlusOutlined />}
              onClick={() => openAssignDrawer(record)}
            />
          </Tooltip>
          <Popconfirm
            title='Delete this user?'
            description='This action cannot be undone.'
            okText='Delete'
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteUserMutation.mutate(record.id)}
          >
            <Button type='text' size='small' danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Expandable row showing user detail
  const expandedRowRender = (record: UserRecord) => (
    <Descriptions size='small' column={3} bordered>
      <Descriptions.Item label='User ID'>{record.id}</Descriptions.Item>
      <Descriptions.Item label='Email'>{record.email}</Descriptions.Item>
      <Descriptions.Item label='Status'>
        <Badge
          status={record.is_active ? 'success' : 'error'}
          text={record.is_active ? 'Active' : 'Inactive'}
        />
      </Descriptions.Item>
      <Descriptions.Item label='Roles' span={3}>
        {record.roles && record.roles.length > 0 ? (
          <Space wrap>
            {record.roles.map((role) => (
              <Tag key={role.id} color='blue'>
                {role.name}
                {role.scope && (
                  <Text
                    type='secondary'
                    style={{ fontSize: 11, marginLeft: 4 }}
                  >
                    ({role.scope})
                  </Text>
                )}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type='secondary'>No roles assigned</Text>
        )}
      </Descriptions.Item>
      {record.created_at && (
        <Descriptions.Item label='Created'>
          {dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
      )}
      {record.updated_at && (
        <Descriptions.Item label='Updated'>
          {dayjs(record.updated_at).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
      )}
    </Descriptions>
  );

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <Input
          placeholder='Search by username...'
          prefix={<SearchOutlined />}
          allowClear
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setPage(1);
          }}
          style={{ width: 300 }}
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ['admin-users'] })
          }
        >
          Refresh
        </Button>
      </div>

      {/* Table */}
      <Table<UserRecord>
        rowKey='id'
        columns={columns}
        dataSource={users}
        loading={isLoading}
        expandable={{
          expandedRowRender,
          rowExpandable: () => true,
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `Total ${t} users`,
          onChange: (p, s) => {
            setPage(p);
            setPageSize(s);
          },
        }}
        size='middle'
      />

      {/* Assign role drawer */}
      <Drawer
        title={`Assign Role to ${selectedUser?.username ?? ''}`}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          assignForm.resetFields();
        }}
        width={400}
        extra={
          <Button
            type='primary'
            onClick={() => assignForm.submit()}
            loading={assignRoleMutation.isPending}
          >
            Assign
          </Button>
        }
      >
        <Form form={assignForm} layout='vertical' onFinish={handleAssignRole}>
          <Form.Item
            name='roleId'
            label='Role'
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select
              placeholder='Select a role to assign'
              showSearch
              optionFilterProp='label'
            >
              {availableRoles.map((role) => (
                <Select.Option key={role.id} value={role.id} label={role.name}>
                  <Space>
                    <TeamOutlined />
                    <span>{role.name}</span>
                    {role.scope && (
                      <Tag style={{ fontSize: 10 }}>{role.scope}</Tag>
                    )}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {selectedUser && (
            <Card size='small' title='Current Roles' style={{ marginTop: 16 }}>
              {selectedUser.roles && selectedUser.roles.length > 0 ? (
                <Space wrap>
                  {selectedUser.roles.map((role) => (
                    <Tag key={role.id} color='blue'>
                      {role.name}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type='secondary'>No roles assigned yet</Text>
              )}
            </Card>
          )}
        </Form>
      </Drawer>
    </>
  );
};

// ---------- Role Permissions Expanded View ----------

const RolePermissionsView: React.FC<{ roleId: number }> = ({ roleId }) => {
  const queryClient = useQueryClient();
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>(
    []
  );

  // Fetch role detail (includes permissions)
  const { data: roleDetail, isLoading: roleDetailLoading } = useQuery({
    queryKey: ['role-detail', roleId],
    queryFn: () => roleApi.getRole(roleId),
    staleTime: 10_000,
  });

  // Fetch all permissions for the assign modal
  const { data: allPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: () => permissionApi.getPermissions({ page: 1, size: 500 }),
    staleTime: 30_000,
    enabled: assignModalOpen,
  });

  // Remove permissions mutation
  const removePermissionsMutation = useMutation({
    mutationFn: (permissionIds: number[]) =>
      roleApi.removePermissions(roleId, { permission_ids: permissionIds }),
    onSuccess: () => {
      message.success('Permission removed successfully');
      queryClient.invalidateQueries({ queryKey: ['role-detail', roleId] });
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: () => {
      message.error('Failed to remove permission');
    },
  });

  // Assign permissions mutation
  const assignPermissionsMutation = useMutation({
    mutationFn: (permissionIds: number[]) =>
      roleApi.assignPermissions(roleId, { permission_ids: permissionIds }),
    onSuccess: () => {
      message.success('Permissions assigned successfully');
      setAssignModalOpen(false);
      setSelectedPermissionIds([]);
      queryClient.invalidateQueries({ queryKey: ['role-detail', roleId] });
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: () => {
      message.error('Failed to assign permissions');
    },
  });

  const currentPermissions: PermissionResp[] = useMemo(
    () => roleDetail?.permissions ?? [],
    [roleDetail]
  );

  const currentPermissionIds = useMemo(
    () => new Set(currentPermissions.map((p) => p.id).filter(Boolean)),
    [currentPermissions]
  );

  // Filter out already-assigned permissions in the assign modal
  const availablePermissions = useMemo(() => {
    if (!allPermissions) return [];
    const perms = Array.isArray(allPermissions)
      ? allPermissions
      : ((allPermissions as unknown as { items?: PermissionResp[] }).items ??
        []);
    return perms.filter((p) => p.id != null && !currentPermissionIds.has(p.id));
  }, [allPermissions, currentPermissionIds]);

  if (roleDetailLoading) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <Spin size='small' />
      </div>
    );
  }

  const permissionColumns: ColumnsType<PermissionResp> = [
    {
      title: 'Permission',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 200,
      render: (text: string | undefined, record: PermissionResp) => (
        <Space>
          <LockOutlined />
          <Text strong>{text ?? record.name ?? '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action?: string) => {
        if (!action) return <Text type='secondary'>-</Text>;
        const colorMap: Record<string, string> = {
          create: 'green',
          read: 'blue',
          update: 'orange',
          delete: 'red',
          manage: 'purple',
        };
        return (
          <Tag color={colorMap[action.toLowerCase()] ?? 'default'}>
            {action}
          </Tag>
        );
      },
    },
    {
      title: 'Resource',
      dataIndex: 'resource_name',
      key: 'resource_name',
      width: 150,
      render: (name?: string) => <Text type='secondary'>{name ?? '-'}</Text>,
    },
    {
      title: 'Scope',
      dataIndex: 'scope',
      key: 'scope',
      width: 100,
      render: (scope?: string) =>
        scope ? <Tag>{scope}</Tag> : <Text type='secondary'>-</Text>,
    },
    {
      title: '',
      key: 'remove',
      width: 60,
      render: (_: unknown, record: PermissionResp) => (
        <Popconfirm
          title='Remove this permission?'
          okText='Remove'
          okButtonProps={{ danger: true }}
          onConfirm={() => {
            if (record.id != null) {
              removePermissionsMutation.mutate([record.id]);
            }
          }}
        >
          <Button type='text' size='small' danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '8px 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text strong>
          <LockOutlined style={{ marginRight: 4 }} />
          Permissions ({currentPermissions.length})
        </Text>
        <Button
          type='primary'
          size='small'
          icon={<PlusOutlined />}
          onClick={() => {
            setSelectedPermissionIds([]);
            setAssignModalOpen(true);
          }}
        >
          Assign Permissions
        </Button>
      </div>

      {currentPermissions.length > 0 ? (
        <Table<PermissionResp>
          rowKey='id'
          columns={permissionColumns}
          dataSource={currentPermissions}
          pagination={false}
          size='small'
        />
      ) : (
        <Text type='secondary'>No permissions assigned to this role.</Text>
      )}

      {/* Assign Permissions Modal */}
      <Modal
        title='Assign Permissions'
        open={assignModalOpen}
        onCancel={() => {
          setAssignModalOpen(false);
          setSelectedPermissionIds([]);
        }}
        onOk={() => {
          if (selectedPermissionIds.length === 0) {
            message.error('Please select at least one permission');
            return;
          }
          assignPermissionsMutation.mutate(selectedPermissionIds);
        }}
        okText='Assign Selected'
        confirmLoading={assignPermissionsMutation.isPending}
        width={600}
      >
        {permissionsLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : availablePermissions.length === 0 ? (
          <Text type='secondary'>
            No additional permissions available to assign.
          </Text>
        ) : (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <Checkbox.Group
              value={selectedPermissionIds}
              onChange={(values) =>
                setSelectedPermissionIds(values as number[])
              }
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {availablePermissions.map((perm) => (
                <Checkbox key={perm.id} value={perm.id}>
                  <Space>
                    <Text strong>{perm.display_name ?? perm.name ?? '-'}</Text>
                    {perm.action && (
                      <Tag
                        color={
                          {
                            create: 'green',
                            read: 'blue',
                            update: 'orange',
                            delete: 'red',
                            manage: 'purple',
                          }[perm.action.toLowerCase()] ?? 'default'
                        }
                      >
                        {perm.action}
                      </Tag>
                    )}
                    {perm.resource_name && (
                      <Text type='secondary'>{perm.resource_name}</Text>
                    )}
                  </Space>
                </Checkbox>
              ))}
            </Checkbox.Group>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ---------- Roles Tab ----------

const RolesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [scopeFilter, setScopeFilter] = useState<string | undefined>();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();

  // Fetch roles
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['admin-roles', page, pageSize, scopeFilter],
    queryFn: () =>
      roleApi.getRoles({ page, size: pageSize, scope: scopeFilter }),
    staleTime: 10_000,
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: (data: {
      name: string;
      display_name: string;
      description?: string;
    }) => roleApi.createRole(data),
    onSuccess: () => {
      message.success('Role created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: () => {
      message.error('Failed to create role');
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: (id: number) => roleApi.deleteRole(id),
    onSuccess: () => {
      message.success('Role deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: () => {
      message.error('Failed to delete role');
    },
  });

  const roles: RoleRecord[] = useMemo(() => {
    if (!rolesData) return [];
    if (Array.isArray(rolesData)) return rolesData;
    return (rolesData as { items?: RoleRecord[] }).items ?? [];
  }, [rolesData]);

  const total = useMemo(() => {
    if (!rolesData) return 0;
    if (Array.isArray(rolesData)) return rolesData.length;
    return (rolesData as { total?: number }).total ?? roles.length;
  }, [rolesData, roles.length]);

  const handleCreateRole = useCallback(
    (values: { name: string; display_name: string; description?: string }) => {
      createRoleMutation.mutate(values);
    },
    [createRoleMutation]
  );

  const columns: ColumnsType<RoleRecord> = [
    {
      title: 'Role Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string) => (
        <Space>
          <TeamOutlined />
          <Text strong style={{ color: 'var(--color-primary-600)' }}>
            {text}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Scope',
      dataIndex: 'scope',
      key: 'scope',
      width: 130,
      render: (scope?: string) => {
        if (!scope) return <Text type='secondary'>-</Text>;
        const colorMap: Record<string, string> = {
          global: 'purple',
          project: 'blue',
          container: 'cyan',
          dataset: 'green',
        };
        return (
          <Tag color={colorMap[scope.toLowerCase()] ?? 'default'}>{scope}</Tag>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc?: string) => <Text type='secondary'>{desc ?? '-'}</Text>,
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions_count',
      key: 'permissions_count',
      width: 120,
      align: 'center',
      render: (count?: number) => (
        <Badge
          count={count ?? 0}
          showZero
          style={{
            backgroundColor: count
              ? 'var(--color-primary-600)'
              : 'var(--color-secondary-300)',
          }}
        />
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date?: string) =>
        date ? (
          <Text type='secondary'>{dayjs(date).format('YYYY-MM-DD')}</Text>
        ) : (
          '-'
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: RoleRecord) => (
        <Popconfirm
          title='Delete this role?'
          description='This will remove the role from all assigned users.'
          okText='Delete'
          okButtonProps={{ danger: true }}
          onConfirm={() => deleteRoleMutation.mutate(record.id)}
        >
          <Button type='text' size='small' danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <Space>
          <Select
            placeholder='Filter by scope'
            allowClear
            value={scopeFilter}
            onChange={(val) => {
              setScopeFilter(val);
              setPage(1);
            }}
            style={{ width: 180 }}
          >
            <Select.Option value='global'>Global</Select.Option>
            <Select.Option value='project'>Project</Select.Option>
            <Select.Option value='container'>Container</Select.Option>
            <Select.Option value='dataset'>Dataset</Select.Option>
          </Select>
        </Space>
        <Space>
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Role
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
            }
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Table */}
      <Table<RoleRecord>
        rowKey='id'
        columns={columns}
        dataSource={roles}
        loading={isLoading}
        expandable={{
          expandedRowRender: (record) => (
            <RolePermissionsView roleId={record.id} />
          ),
          rowExpandable: () => true,
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `Total ${t} roles`,
          onChange: (p, s) => {
            setPage(p);
            setPageSize(s);
          },
        }}
        size='middle'
      />

      {/* Create Role Modal */}
      <Modal
        title='Create Role'
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        okText='Create'
        confirmLoading={createRoleMutation.isPending}
      >
        <Form form={createForm} layout='vertical' onFinish={handleCreateRole}>
          <Form.Item
            name='name'
            label='Name'
            rules={[
              { required: true, message: 'Please enter a role name' },
              {
                pattern: /^[a-z][a-z0-9_-]*$/,
                message:
                  'Name must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores',
              },
            ]}
          >
            <Input placeholder='e.g., project-manager' />
          </Form.Item>
          <Form.Item
            name='display_name'
            label='Display Name'
            rules={[{ required: true, message: 'Please enter a display name' }]}
          >
            <Input placeholder='e.g., Project Manager' />
          </Form.Item>
          <Form.Item name='description' label='Description'>
            <Input.TextArea
              rows={3}
              placeholder='Optional description of this role'
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ---------- Main Component ----------

const AdminUsersPage: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <TeamOutlined style={{ marginRight: 8 }} />
        User & Role Management
      </Title>

      <Card>
        <Tabs
          defaultActiveKey='users'
          items={[
            {
              key: 'users',
              label: (
                <span>
                  <UserOutlined /> Users
                </span>
              ),
              children: <UsersTab />,
            },
            {
              key: 'roles',
              label: (
                <span>
                  <TeamOutlined /> Roles
                </span>
              ),
              children: <RolesTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AdminUsersPage;

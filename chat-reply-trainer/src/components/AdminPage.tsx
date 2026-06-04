import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Button, Switch, Descriptions, Statistic, Row, Col, Modal, Popconfirm, message, InputNumber, Spin, Empty, Space } from 'antd';
import {
  ArrowLeftOutlined, UserOutlined, TeamOutlined, DashboardOutlined,
  SettingOutlined, DeleteOutlined, CrownOutlined, DatabaseOutlined,
  MessageOutlined, AimOutlined, BarChartOutlined, SafetyCertificateOutlined,
  ThunderboltOutlined, ReloadOutlined,
} from '@ant-design/icons';
import * as api from '../services/api';

interface AdminPageProps {
  onBack: () => void;
  isMobile?: boolean;
}

type AdminTab = 'overview' | 'users' | 'settings';

const AdminPage: React.FC<AdminPageProps> = ({ onBack, isMobile = false }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch { messageApi.error('加载统计数据失败'); }
  }, [messageApi]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch { messageApi.error('加载用户列表失败'); }
  }, [messageApi]);

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.getAdminSettings();
      setSettings(data);
    } catch { messageApi.error('加载设置失败'); }
  }, [messageApi]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadUsers(), loadSettings()]).finally(() => setLoading(false));
  }, []);

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.deleteAdminUser(userId);
      messageApi.success('用户已删除');
      loadUsers();
      loadStats();
    } catch (err: any) {
      messageApi.error(err.message || '删除失败');
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await api.updateUserRole(userId, newRole);
      messageApi.success(`已设为${newRole === 'admin' ? '管理员' : '普通用户'}`);
      loadUsers();
    } catch (err: any) {
      messageApi.error(err.message || '操作失败');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.updateAdminSettings(settings);
      messageApi.success('设置已保存');
    } catch (err: any) {
      messageApi.error(err.message || '保存失败');
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Section menu items (Memos style vertical nav)
  const sections = [
    { key: 'overview', icon: <DashboardOutlined />, label: '系统概览' },
    { key: 'users', icon: <TeamOutlined />, label: '用户管理' },
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
  ];

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <Spin size="large" />
        <span style={{ color: '#999' }}>加载管理后台...</span>
      </div>
    );
  }

  return (
    <>
      {contextHolder}
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        {/* Header */}
        <div style={{
          height: 56, background: '#fff', borderBottom: '1px solid #e8e8e8',
          display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 24px', gap: 12, flexShrink: 0,
        }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack} type="text" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CrownOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>管理后台</span>
          </div>
          <div style={{ flex: 1 }} />
          <Button icon={<ReloadOutlined />} type="text" onClick={() => { loadStats(); loadUsers(); loadSettings(); }}>
            {isMobile ? '' : '刷新'}
          </Button>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? 12 : 24 }}>
          {isMobile ? (
            // Mobile: tab buttons at top
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              {sections.map(s => (
                <Button
                  key={s.key}
                  icon={s.icon}
                  type={activeTab === s.key ? 'primary' : 'default'}
                  onClick={() => setActiveTab(s.key as AdminTab)}
                  size="small"
                >
                  {s.label}
                </Button>
              ))}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: isMobile ? 0 : 24, maxWidth: 1200, margin: '0 auto' }}>
            {/* Desktop: Left sidebar nav (Memos style) */}
            {!isMobile && (
              <div style={{ width: 180, flexShrink: 0 }}>
                <div style={{
                  background: '#fff', borderRadius: 12, border: '1px solid #e8e8e8',
                  padding: '8px 0', position: 'sticky', top: 0,
                }}>
                  {sections.map(s => (
                    <div
                      key={s.key}
                      onClick={() => setActiveTab(s.key as AdminTab)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 16px', margin: '2px 8px', borderRadius: 8,
                        cursor: 'pointer', fontSize: 14,
                        background: activeTab === s.key ? '#e8f0fe' : 'transparent',
                        color: activeTab === s.key ? '#3b5998' : '#666',
                        fontWeight: activeTab === s.key ? 600 : 400,
                        transition: 'all 0.2s',
                      }}
                    >
                      {s.icon}
                      {s.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Right: Active section content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* ===== Overview Section ===== */}
              {activeTab === 'overview' && stats && (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>系统概览</h3>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>实时系统运行状态和数据统计</div>
                  </div>

                  <Row gutter={[12, 12]}>
                    {[
                      { title: '用户数', value: stats.users, icon: <TeamOutlined style={{ color: '#1677ff' }} />, color: '#e8f0fe' },
                      { title: '聊天对象', value: stats.targets, icon: <UserOutlined style={{ color: '#f48fb1' }} />, color: '#fce4ec' },
                      { title: '消息总数', value: stats.messages, icon: <MessageOutlined style={{ color: '#52c41a' }} />, color: '#f6ffed' },
                      { title: '辅导窗口', value: stats.sessions, icon: <ThunderboltOutlined style={{ color: '#722ed1' }} />, color: '#f9f0ff' },
                      { title: '诊断记录', value: stats.diagnoses, icon: <AimOutlined style={{ color: '#fa8c16' }} />, color: '#fff7e6' },
                      { title: '复盘评分', value: stats.evaluations, icon: <BarChartOutlined style={{ color: '#eb2f96' }} />, color: '#fff0f6' },
                    ].map(item => (
                      <Col xs={8} sm={8} md={8} key={item.title}>
                        <div style={{
                          background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0',
                          padding: isMobile ? '12px' : '16px 20px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                              {item.icon}
                            </div>
                            <span style={{ fontSize: 12, color: '#999' }}>{item.title}</span>
                          </div>
                          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 700, color: '#333' }}>{item.value}</div>
                        </div>
                      </Col>
                    ))}
                  </Row>

                  {/* Activity & Storage */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                    <Card size="small" style={{ flex: 1, minWidth: 200 }}>
                      <Statistic
                        title="24h 新增消息"
                        value={stats.recentMessages}
                        prefix={<MessageOutlined style={{ color: '#52c41a' }} />}
                      />
                    </Card>
                    <Card size="small" style={{ flex: 1, minWidth: 200 }}>
                      <Statistic
                        title="24h 新增窗口"
                        value={stats.recentSessions}
                        prefix={<ThunderboltOutlined style={{ color: '#722ed1' }} />}
                      />
                    </Card>
                    <Card size="small" style={{ flex: 1, minWidth: 200 }}>
                      <Statistic
                        title="数据库大小"
                        value={stats.dbSizeKB}
                        suffix="KB"
                        prefix={<DatabaseOutlined style={{ color: '#fa8c16' }} />}
                      />
                    </Card>
                  </div>

                  {/* Quick model info */}
                  <Card size="small" title={<span><SafetyCertificateOutlined style={{ marginRight: 4 }} />运行信息</span>} style={{ marginTop: 16 }}>
                    <Descriptions column={isMobile ? 1 : 2} size="small">
                      <Descriptions.Item label="版本">v1.0.0</Descriptions.Item>
                      <Descriptions.Item label="数据库">SQLite (sql.js)</Descriptions.Item>
                      <Descriptions.Item label="认证">JWT 24h 过期</Descriptions.Item>
                      <Descriptions.Item label="注册">{settings.allow_registration === 'true' ? '开放' : '关闭'}</Descriptions.Item>
                    </Descriptions>
                  </Card>
                </div>
              )}

              {/* ===== Users Section ===== */}
              {activeTab === 'users' && (
                <div>
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>用户管理</h3>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>共 {users.length} 个注册用户</div>
                    </div>
                    <Button icon={<ReloadOutlined />} size="small" onClick={loadUsers}>刷新</Button>
                  </div>

                  <Card size="small" style={{ borderRadius: 10 }}>
                    <Table
                      dataSource={users}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      scroll={isMobile ? { x: 600 } : undefined}
                    >
                      <Table.Column title="用户名" dataIndex="username" key="username" render={(name: string, record: any) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 6, background: record.role === 'admin' ? '#fff7e6' : '#e8f0fe',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600,
                            color: record.role === 'admin' ? '#fa8c16' : '#3b5998',
                          }}>
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500 }}>{name}</span>
                        </div>
                      )} />
                      <Table.Column title="角色" dataIndex="role" key="role" width={100} render={(role: string) => (
                        <Tag color={role === 'admin' ? 'gold' : 'blue'} icon={role === 'admin' ? <CrownOutlined /> : <UserOutlined />}>
                          {role === 'admin' ? '管理员' : '用户'}
                        </Tag>
                      )} />
                      <Table.Column title="对象" dataIndex="targetCount" key="targets" width={70} align="center" />
                      <Table.Column title="消息" dataIndex="messageCount" key="messages" width={70} align="center" />
                      <Table.Column title="窗口" dataIndex="sessionCount" key="sessions" width={70} align="center" />
                      <Table.Column title="注册时间" dataIndex="created_at" key="created_at" width={150} render={(ts: number) => (
                        <span style={{ fontSize: 12, color: '#999' }}>{formatTime(ts)}</span>
                      )} />
                      <Table.Column title="操作" key="actions" width={160} render={(_: any, record: any) => (
                        <Space size={4}>
                          <Button
                            size="small"
                            type={record.role === 'admin' ? 'default' : 'text'}
                            icon={<CrownOutlined />}
                            onClick={() => handleToggleRole(record.id, record.role)}
                            disabled={record.role === 'admin' && users.filter((u: any) => u.role === 'admin').length <= 1}
                          >
                            {record.role === 'admin' ? '降级' : '升级'}
                          </Button>
                          <Popconfirm
                            title={`确定删除用户 ${record.username}？`}
                            description="该用户的所有数据将被永久删除"
                            onConfirm={() => handleDeleteUser(record.id)}
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <Button size="small" danger icon={<DeleteOutlined />} disabled={record.role === 'admin'}>
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      )} />
                    </Table>
                  </Card>
                </div>
              )}

              {/* ===== Settings Section ===== */}
              {activeTab === 'settings' && (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>系统设置</h3>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>管理系统全局配置</div>
                  </div>

                  {/* Registration */}
                  <Card size="small" title="注册控制" style={{ marginBottom: 12, borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>开放注册</div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>允许新用户自行注册账户</div>
                      </div>
                      <Switch
                        checked={settings.allow_registration === 'true'}
                        onChange={(checked) => setSettings(s => ({ ...s, allow_registration: checked ? 'true' : 'false' }))}
                      />
                    </div>
                  </Card>

                  {/* Limits */}
                  <Card size="small" title="使用限制" style={{ marginBottom: 12, borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>每用户最大聊天对象数</div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>限制每个用户可创建的聊天对象数量</div>
                      </div>
                      <InputNumber
                        size="small"
                        min={1}
                        max={200}
                        value={parseInt(settings.max_targets_per_user || '50')}
                        onChange={(v) => setSettings(s => ({ ...s, max_targets_per_user: String(v || 50) }))}
                        style={{ width: 80 }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>每对象最大辅导窗口数</div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>限制每个聊天对象可创建的 AI 辅导窗口数量</div>
                      </div>
                      <InputNumber
                        size="small"
                        min={1}
                        max={100}
                        value={parseInt(settings.max_sessions_per_target || '20')}
                        onChange={(v) => setSettings(s => ({ ...s, max_sessions_per_target: String(v || 20) }))}
                        style={{ width: 80 }}
                      />
                    </div>
                  </Card>

                  {/* Model Config (read-only display) */}
                  <Card size="small" title="AI 模型配置" style={{ marginBottom: 12, borderRadius: 10 }}>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                      模型配置通过服务器环境变量设置，此处仅展示当前可用模型
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {settings._models?.split(',').filter(Boolean).map((m: string) => (
                        <Tag key={m} color="blue">{m}</Tag>
                      )) || <Tag>智谱 GLM (默认)</Tag>}
                    </div>
                  </Card>

                  {/* Save button */}
                  <div style={{ textAlign: 'right', marginTop: 16 }}>
                    <Button type="primary" onClick={handleSaveSettings} icon={<SettingOutlined />}>
                      保存设置
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminPage;

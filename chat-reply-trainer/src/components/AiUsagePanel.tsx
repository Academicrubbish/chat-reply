import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Row, Col, Select, Space, Spin, Button, message } from 'antd';
import {
  ThunderboltOutlined, ReloadOutlined, TeamOutlined, BarChartOutlined,
} from '@ant-design/icons';
import * as api from '../services/api';

const FEATURE_LABELS: Record<string, string> = {
  generate: '生成回复',
  regenerate: '重新生成',
  diagnose: '军师诊断',
  analyze: '分析复盘',
  auto_diagnose: '自动诊断',
};
const MODE_LABELS: Record<string, string> = { quick: '快速', full: '完整', advisor: '军师', review: '复盘' };
const STATUS_COLOR: Record<string, string> = { success: 'green', fallback: 'orange', error: 'red' };
const STATUS_LABEL: Record<string, string> = { success: '成功', fallback: '降级', error: '失败' };

function formatTime(ts: number) {
  if (!ts) return '-';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatTokens(n: number) {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return String(n || 0);
}

const AiUsagePanel: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
  const [overview, setOverview] = useState<any>(null);
  const [byUser, setByUser] = useState<any[]>([]);
  const [byFeature, setByFeature] = useState<any[]>([]);
  const [logs, setLogs] = useState<{ total: number; rows: any[] }>({ total: 0, rows: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ feature?: string; status?: string }>({});
  const [messageApi, contextHolder] = message.useMessage();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, bu, bf] = await Promise.all([api.getAiUsageOverview(), api.getAiUsageByUser(), api.getAiUsageByFeature()]);
      setOverview(ov);
      setByUser(bu);
      setByFeature(bf);
    } catch {
      messageApi.error('加载 AI 用量失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  const loadLogs = useCallback(async () => {
    try {
      const data = await api.getAiUsageLogs({ ...filter, days: 30, limit: 50 });
      setLogs(data);
    } catch {
      messageApi.error('加载明细失败');
    }
  }, [filter, messageApi]);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spin />
      </div>
    );
  }

  const totals = overview?.totals || { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const today = overview?.today || { calls: 0, tokens: 0 };

  const cards = [
    { title: '总调用次数', value: totals.calls, sub: `今日 ${today.calls}`, color: '#e8f0fe', icon: <ThunderboltOutlined style={{ color: '#1677ff' }} /> },
    { title: '总 Token', value: formatTokens(totals.total_tokens), sub: `今日 ${formatTokens(today.tokens)}`, color: '#f9f0ff', icon: <ThunderboltOutlined style={{ color: '#722ed1' }} /> },
    { title: 'Prompt Token', value: formatTokens(totals.prompt_tokens), sub: '输入消耗', color: '#fff7e6', icon: <ThunderboltOutlined style={{ color: '#fa8c16' }} /> },
    { title: 'Completion Token', value: formatTokens(totals.completion_tokens), sub: '输出消耗', color: '#f6ffed', icon: <ThunderboltOutlined style={{ color: '#52c41a' }} /> },
  ];

  return (
    <>
      {contextHolder}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>AI 用量监控</h3>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>统计每次 AI 调用的用户、功能与 token 消耗</div>
        </div>
        <Space wrap>
          <Select
            size="small"
            allowClear
            placeholder="功能筛选"
            style={{ width: 120 }}
            options={Object.entries(FEATURE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            value={filter.feature}
            onChange={(v) => setFilter(f => ({ ...f, feature: v }))}
          />
          <Select
            size="small"
            allowClear
            placeholder="状态筛选"
            style={{ width: 110 }}
            options={Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v }))}
            value={filter.status}
            onChange={(v) => setFilter(f => ({ ...f, status: v }))}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={loadAll}>刷新</Button>
        </Space>
      </div>

      {/* 汇总卡 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {cards.map(c => (
          <Col xs={12} sm={12} md={6} key={c.title}>
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', padding: isMobile ? '12px' : '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{c.icon}</div>
                <span style={{ fontSize: 12, color: '#999' }}>{c.title}</span>
              </div>
              <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: '#333' }}>{c.value}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{c.sub}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* 状态分布 */}
      {overview?.byStatus?.length > 0 && (
        <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {overview.byStatus.map((s: any) => (
              <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag color={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status] || s.status}</Tag>
                <span style={{ fontWeight: 600 }}>{s.calls}</span>
                <span style={{ fontSize: 12, color: '#999' }}>次 · {formatTokens(s.tokens)} token</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 按用户 + 按功能 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card size="small" title={<span><TeamOutlined style={{ marginRight: 4 }} />按用户</span>} style={{ borderRadius: 10 }}>
            <Table
              dataSource={byUser}
              rowKey="user_id"
              size="small"
              pagination={false}
              scroll={{ y: 280 }}
              columns={[
                { title: '用户', dataIndex: 'username', key: 'u', render: (n: string) => <span style={{ fontWeight: 500 }}>{n}</span> },
                { title: '次数', dataIndex: 'calls', key: 'c', width: 70, align: 'center' as const },
                { title: 'Token', key: 't', width: 90, align: 'right' as const, render: (_: any, r: any) => formatTokens(r.total_tokens) },
                { title: '最近', dataIndex: 'last_call_at', key: 'l', width: 120, render: (t: number) => <span style={{ fontSize: 12, color: '#999' }}>{formatTime(t)}</span> },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title={<span><BarChartOutlined style={{ marginRight: 4 }} />按功能</span>} style={{ borderRadius: 10 }}>
            <Table
              dataSource={byFeature}
              rowKey="feature"
              size="small"
              pagination={false}
              scroll={{ y: 280 }}
              columns={[
                { title: '功能', dataIndex: 'feature', key: 'f', render: (f: string) => FEATURE_LABELS[f] || f },
                { title: '次数', dataIndex: 'calls', key: 'c', width: 70, align: 'center' as const },
                { title: 'Token', key: 't', width: 90, align: 'right' as const, render: (_: any, r: any) => formatTokens(r.total_tokens) },
                { title: '均/次', dataIndex: 'avg_tokens', key: 'a', width: 70, align: 'right' as const },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* 明细流水 */}
      <Card size="small" title="调用明细（近 30 天）" style={{ borderRadius: 10 }}>
        <Table
          dataSource={logs.rows}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10, total: logs.total, showTotal: (t) => `共 ${t} 条`, size: 'small' }}
          scroll={isMobile ? { x: 900 } : undefined}
          columns={[
            { title: '时间', dataIndex: 'created_at', key: 't', width: 140, render: (t: number) => <span style={{ fontSize: 12, color: '#999' }}>{formatTime(t)}</span> },
            { title: '用户', dataIndex: 'username', key: 'u', width: 90 },
            { title: '功能', dataIndex: 'feature', key: 'f', width: 90, render: (f: string) => FEATURE_LABELS[f] || f },
            { title: '模式', dataIndex: 'mode', key: 'm', width: 70, render: (m: string) => (m ? (MODE_LABELS[m] || m) : '-') },
            { title: '模型', dataIndex: 'model', key: 'mo', width: 90, render: (m: string) => <span style={{ fontSize: 12, color: '#999' }}>{m || '-'}</span> },
            { title: 'Prompt', dataIndex: 'prompt_tokens', key: 'p', width: 80, align: 'right' as const },
            { title: 'Compl.', dataIndex: 'completion_tokens', key: 'c2', width: 80, align: 'right' as const },
            { title: '合计', dataIndex: 'total_tokens', key: 'tt', width: 80, align: 'right' as const, render: (n: number) => <span style={{ fontWeight: 600 }}>{n}</span> },
            { title: '耗时', dataIndex: 'duration_ms', key: 'd', width: 70, align: 'right' as const, render: (ms: number) => `${ms}ms` },
            { title: '状态', dataIndex: 'status', key: 's', width: 70, render: (s: string) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] || s}</Tag> },
          ]}
        />
      </Card>
    </>
  );
};

export default AiUsagePanel;

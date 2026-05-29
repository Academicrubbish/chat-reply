import React from 'react';
import { Button, Progress, Select, Space, Popconfirm } from 'antd';
import { PlusOutlined, UnorderedListOutlined, DeleteOutlined } from '@ant-design/icons';
import type { AISession, ModelOption } from '../types';

interface SessionBarProps {
  session: AISession | null;
  sessions: AISession[];
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  models?: ModelOption[];
  selectedProvider?: string;
  onSelectProvider?: (provider: string) => void;
}

const SessionBar: React.FC<SessionBarProps> = ({
  session,
  sessions,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  models = [],
  selectedProvider = 'zhipu',
  onSelectProvider,
}) => {
  const currentIndex = session
    ? sessions.findIndex((s) => s.id === session.id)
    : -1;
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  const roundCount = session?.round_count ?? 0;
  const contextPercentage = session?.context_tokens
    ? Math.min(100, Math.round((session.context_tokens / 4000) * 100))
    : 0;

  return (
    <div data-tour-id="session-bar" style={{ padding: '8px 20px', background: '#fff', borderBottom: '1px solid #ebeef5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Space>
        <span style={{ fontSize: 13, fontWeight: 'bold', color: '#3b5998', background: '#e8f0fe', padding: '2px 10px', borderRadius: 10 }}>
          窗口 #{displayIndex || '-'}
        </span>
        <span style={{ fontSize: 11, color: '#999' }}>
          {roundCount} 轮对话
        </span>
      </Space>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>上下文</span>
        <Progress
          percent={contextPercentage}
          size="small"
          strokeColor={contextPercentage > 80 ? '#fa8c16' : '#52c41a'}
          showInfo
          format={() => `${contextPercentage}%`}
          style={{ width: 80, marginBottom: 0 }}
        />
      </div>

      <Space>
        {models.length > 1 && onSelectProvider && (
          <Select
            size="small"
            value={selectedProvider}
            style={{ width: 120 }}
            onChange={onSelectProvider}
            options={models.map(m => ({ value: m.provider, label: m.label }))}
          />
        )}
        <Select
          size="small"
          value={session?.id}
          placeholder="选择窗口"
          style={{ width: 140 }}
          onChange={onSelectSession}
          options={sessions.map((s, i) => ({
            value: s.id,
            label: s.title || `窗口 ${i + 1}`,
          }))}
          suffixIcon={<UnorderedListOutlined />}
        />
        <Button size="small" icon={<PlusOutlined />} onClick={onCreateSession}>
          新窗口
        </Button>
        {session && (
          <Popconfirm
            title="确定删除该窗口？"
            description="窗口内的对话记录将一并删除"
            onConfirm={() => onDeleteSession(session.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
      </Space>
    </div>
  );
};

export default SessionBar;

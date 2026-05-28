import React from 'react';
import { Button, Progress, Select, Space } from 'antd';
import { PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import type { AISession } from '../types';

interface SessionBarProps {
  session: AISession | null;
  sessions: AISession[];
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
}

const SessionBar: React.FC<SessionBarProps> = ({
  session,
  sessions,
  onSelectSession,
  onCreateSession,
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
    <div style={{ padding: '8px 20px', background: '#fff', borderBottom: '1px solid #ebeef5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Space>
        <span style={{ fontSize: 13, fontWeight: 'bold', color: '#3b5998', background: '#e8f0fe', padding: '2px 10px', borderRadius: 10 }}>
          窗口 #{displayIndex || '-'}
        </span>
        <span style={{ fontSize: 11, color: '#999' }}>
          {roundCount} 轮对话
        </span>
      </Space>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
      </Space>
    </div>
  );
};

export default SessionBar;

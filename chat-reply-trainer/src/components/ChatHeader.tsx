import React from 'react';
import { Avatar, Badge, Button, Space, Popconfirm, Switch, Tooltip } from 'antd';
import { RobotOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';

interface ChatHeaderProps {
  targetName: string;
  onAIAssist: () => void;
  onReset: () => void;
  isGenerating: boolean;
  quickMode: boolean;
  onQuickModeChange: (checked: boolean) => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ targetName, onAIAssist, onReset, isGenerating, quickMode, onQuickModeChange }) => {
  return (
    <div style={{ background: '#fff', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
      <Space>
        <Avatar size={34} style={{ backgroundColor: '#f48fb1', borderRadius: 6 }}>
          {targetName.charAt(0)}
        </Avatar>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{targetName}</span>
        <Badge status="success" />
      </Space>
      <Space>
        <Tooltip title={quickMode ? '快速模式：精简分析，仅出 2 条回复' : '完整模式：深度分析 + 3-4 条回复'}>
          <Space size={4} style={{ fontSize: 12, color: quickMode ? '#fa8c16' : '#999' }}>
            <ThunderboltOutlined style={{ color: quickMode ? '#fa8c16' : '#999' }} />
            <Switch size="small" checked={quickMode} onChange={onQuickModeChange} />
          </Space>
        </Tooltip>
        <Button
          data-tour-id="ai-assist-btn"
          type="primary"
          icon={<RobotOutlined />}
          onClick={onAIAssist}
          loading={isGenerating}
        >
          {isGenerating ? (quickMode ? '快速生成中...' : '分析中...') : 'AI 辅助'}
        </Button>
        <Popconfirm
          title="确定清空所有聊天记录？"
          description="此操作不可恢复"
          onConfirm={onReset}
          okText="确定"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" icon={<ReloadOutlined />}>
            重新开始
          </Button>
        </Popconfirm>
      </Space>
    </div>
  );
};

export default ChatHeader;

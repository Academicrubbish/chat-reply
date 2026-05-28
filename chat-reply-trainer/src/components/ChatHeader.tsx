import React from 'react';
import { Avatar, Badge, Button, Space, Popconfirm } from 'antd';
import { RobotOutlined, ReloadOutlined } from '@ant-design/icons';

interface ChatHeaderProps {
  targetName: string;
  onAIAssist: () => void;
  onReset: () => void;
  isGenerating: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ targetName, onAIAssist, onReset, isGenerating }) => {
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
        <Button
          type="primary"
          icon={<RobotOutlined />}
          onClick={onAIAssist}
          loading={isGenerating}
        >
          {isGenerating ? '分析中...' : 'AI 辅助'}
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

import React from 'react';
import { Avatar, Button, Popconfirm, Segmented } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { GenerateMode } from '../types';

interface ChatHeaderProps {
  targetName: string;
  onReset: () => void;
  aiMode: GenerateMode;
  onAiModeChange: (mode: GenerateMode) => void;
  isMobile?: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ targetName, onReset, aiMode, onAiModeChange, isMobile = false }) => {
  const isQuick = aiMode === 'quick';
  return (
    <div style={{
      height: 52, background: '#fff', borderBottom: '1px solid #ebeef5',
      display: 'flex', alignItems: 'center', padding: isMobile ? '0 12px' : '0 16px', gap: 8, flexShrink: 0,
    }}>
      <Avatar size={32} style={{ backgroundColor: '#f48fb1', borderRadius: 7, flexShrink: 0 }}>
        {targetName.charAt(0)}
      </Avatar>
      <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{targetName}</span>
      {!isMobile && <span style={{ width: 6, height: 6, background: '#52c41a', borderRadius: '50%', flexShrink: 0 }} />}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Segmented
          size="small"
          value={isQuick ? 'quick' : 'full'}
          onChange={(val) => onAiModeChange(val as GenerateMode)}
          options={[
            { label: '完整', value: 'full' },
            { label: '快速', value: 'quick' },
          ]}
        />
        <Popconfirm
          title="确定清空所有聊天记录？"
          description="此操作不可恢复"
          onConfirm={onReset}
          okText="确定"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" type="text" icon={<ReloadOutlined />} style={{ color: '#999' }} />
        </Popconfirm>
      </div>
    </div>
  );
};

export default ChatHeader;

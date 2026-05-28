import React from 'react';
import { Button, Dropdown, Space, Card } from 'antd';
import { SyncOutlined, AimOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ReplyOption } from '../types';

interface ReplyGridProps {
  replies: ReplyOption[];
  onRegenerate: () => void;
  onStrategySelect: (strategy: string) => void;
}

const strategies = ['扩大冲突', '魔趣法则', '平衡艺术', '释放性信息', '安全回复'];

const ReplyGrid: React.FC<ReplyGridProps> = ({ replies, onRegenerate, onStrategySelect }) => {
  const strategyMenuItems: MenuProps['items'] = strategies.map(s => ({
    key: s,
    label: s,
    onClick: () => onStrategySelect(s),
  }));

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {replies.map((reply) => (
          <Card key={reply.id} size="small" style={{ borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: '#999', fontWeight: 500, marginBottom: 4 }}>{reply.strategy}</div>
            <div style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>{reply.text}</div>
          </Card>
        ))}
      </div>
      <Space>
        <Button size="small" icon={<SyncOutlined />} onClick={onRegenerate}>
          重新生成
        </Button>
        <Dropdown menu={{ items: strategyMenuItems }} trigger={['click']}>
          <Button size="small" icon={<AimOutlined />}>
            指定策略
          </Button>
        </Dropdown>
      </Space>
    </div>
  );
};

export default ReplyGrid;

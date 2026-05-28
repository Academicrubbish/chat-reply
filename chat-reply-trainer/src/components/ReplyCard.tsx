import React from 'react';
import { Tag, Button, Space, Card } from 'antd';
import { LikeOutlined, DislikeOutlined } from '@ant-design/icons';
import type { ReplyOption } from '../types';

interface ReplyCardProps {
  reply: ReplyOption;
  selected: boolean;
  onSelect: () => void;
  onFeedback: (rating: 'thumbs_up' | 'thumbs_down') => void;
}

const strategyTagColor: Record<string, string> = {
  '魔趣法则': 'blue',
  '平衡艺术': 'green',
  '扩大冲突': 'red',
  '安全回复': 'purple',
  '释放性信息': 'orange',
};

const ReplyCard: React.FC<ReplyCardProps> = ({ reply, selected, onSelect, onFeedback }) => {
  return (
    <Card
      hoverable
      size="small"
      style={{ marginBottom: 10, borderColor: selected ? '#3b5998' : undefined }}
      onClick={onSelect}
    >
      <Tag color={strategyTagColor[reply.strategy] || 'default'} style={{ marginBottom: 6 }}>
        {reply.strategy}
      </Tag>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.6, marginBottom: 4 }}>{reply.text}</div>
      <div style={{ fontSize: 11, color: '#999', lineHeight: 1.5 }}>{reply.reason}</div>
      <div style={{ marginTop: 4 }}>
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<LikeOutlined />}
            onClick={(e) => { e.stopPropagation(); onFeedback('thumbs_up'); }}
          />
          <Button
            type="text"
            size="small"
            icon={<DislikeOutlined />}
            onClick={(e) => { e.stopPropagation(); onFeedback('thumbs_down'); }}
          />
        </Space>
      </div>
    </Card>
  );
};

export default ReplyCard;

import React from 'react';
import { Drawer } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import type { ReplyOption } from '../types';
import ReplyCard from './ReplyCard';
import ReplyGrid from './ReplyGrid';
import CustomReply from './CustomReply';

interface ReplyPopupProps {
  open: boolean;
  replies: ReplyOption[];
  onClose: () => void;
  onSelectReply: (reply: ReplyOption) => void;
  onCustomReply: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (replyId: number, rating: 'thumbs_up' | 'thumbs_down') => void;
}

const ReplyPopup: React.FC<ReplyPopupProps> = ({
  open,
  replies,
  onClose,
  onSelectReply,
  onCustomReply,
  onRegenerate,
  onFeedback,
}) => {
  return (
    <Drawer
      title="选择回复 或 自定义"
      placement="bottom"
      open={open}
      onClose={onClose}
      height="70vh"
      closeIcon={<CloseOutlined />}
      styles={{ body: { padding: '16px 20px' } }}
    >
      <ReplyGrid
        replies={replies}
        onRegenerate={onRegenerate}
        onStrategySelect={() => {}}
      />
      {replies.map((reply) => (
        <ReplyCard
          key={reply.id}
          reply={reply}
          selected={false}
          onSelect={() => onSelectReply(reply)}
          onFeedback={(rating) => onFeedback(reply.id, rating)}
        />
      ))}
      <CustomReply onSend={onCustomReply} />
    </Drawer>
  );
};

export default ReplyPopup;

import React from 'react';
import { Avatar } from 'antd';
import type { ChatMessage } from '../types';

interface ChatBubbleProps {
  message: ChatMessage;
  targetName: string;
}

const ChatBubble: React.FC<ChatBubbleProps> = React.memo(({ message, targetName }) => {
  const isHer = message.role === 'her';

  const renderSource = () => {
    const { source, strategy } = message;
    if (source === 'AI建议' && strategy) {
      return `AI建议·${strategy}`;
    }
    return source;
  };

  return (
    <div className={`flex gap-1.5 max-w-[85%] ${isHer ? 'self-start' : 'self-end flex-row-reverse'}`}>
      <Avatar
        size={30}
        style={{ backgroundColor: isHer ? '#f48fb1' : '#66bb6a', flexShrink: 0, fontSize: 12, borderRadius: 4 }}
      >
        {isHer ? targetName.charAt(0) : '我'}
      </Avatar>
      <div>
        <div
          className={`rounded-xl px-2.5 py-2 text-[13px] leading-relaxed wrap-break-word ${
            isHer
              ? 'bg-white text-[#1a1a1a] rounded-tl-sm'
              : 'bg-wechat-green text-[#1a1a1a] rounded-tr-sm'
          }`}
        >
          {message.text}
        </div>
        <div className={`text-[9px] text-[#bbb] mt-0.5 ${isHer ? 'text-left' : 'text-right'}`}>
          {renderSource()}
        </div>
      </div>
    </div>
  );
});

ChatBubble.displayName = 'ChatBubble';

export default ChatBubble;

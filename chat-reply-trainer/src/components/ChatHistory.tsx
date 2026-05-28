import React, { useRef, useEffect } from 'react';
import { Empty } from 'antd';
import type { ChatMessage } from '../types';
import ChatBubble from './ChatBubble';

interface ChatHistoryProps {
  messages: ChatMessage[];
  targetName: string;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ messages, targetName }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
      {messages.length === 0 && (
        <Empty description="开始新对话" style={{ marginTop: 40 }} />
      )}
      {messages.map((msg) => (
        <ChatBubble key={msg.id} message={msg} targetName={targetName} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatHistory;

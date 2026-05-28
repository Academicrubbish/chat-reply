import React, { useState } from 'react';
import { Input, Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';

const { TextArea } = Input;

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
  placeholder?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend, disabled, placeholder }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = !disabled && text.trim().length > 0;

  return (
    <div style={{ background: '#f7f7f7', borderTop: '1px solid #e0e0e0', padding: 8, display: 'flex', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
      <TextArea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || '输入她刚发的消息...'}
        disabled={disabled}
        autoSize={{ minRows: 1, maxRows: 3 }}
        style={{ flex: 1 }}
      />
      <Button
        type="primary"
        icon={<SendOutlined />}
        disabled={!canSend}
        onClick={handleSend}
      >
        发送
      </Button>
    </div>
  );
};

export default MessageInput;

import React, { useState } from 'react';
import { Input, Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';

const { TextArea } = Input;

interface CustomReplyProps {
  onSend: (text: string) => void;
}

const CustomReply: React.FC<CustomReplyProps> = ({ onSend }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #ddd' }}>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>不满意？自己写：</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <TextArea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的自定义回复..."
          autoSize={{ minRows: 2, maxRows: 4 }}
          style={{ flex: 1 }}
        />
        <Button type="primary" ghost icon={<SendOutlined />} onClick={handleSend}>
          发送自定义
        </Button>
      </div>
    </div>
  );
};

export default CustomReply;

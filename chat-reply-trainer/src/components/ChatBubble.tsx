import React, { useState } from 'react';
import { Avatar, Input, Button, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { ChatMessage } from '../types';

interface ChatBubbleProps {
  message: ChatMessage;
  targetName: string;
  onEdit?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = React.memo(({ message, targetName, onEdit, onDelete }) => {
  const isHer = message.role === 'her';
  const isScene = message.role === 'scene';
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const startEdit = () => {
    setEditText(message.text);
    setEditing(true);
  };

  const saveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.text) {
      onEdit?.(message.id, trimmed);
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const renderSource = () => {
    const { source, strategy } = message;
    if (source === 'AI建议' && strategy) {
      return `AI建议·${strategy}`;
    }
    return source;
  };

  // Scene message: centered card
  if (isScene) {
    return (
      <div className="self-center max-w-[90%] w-full group" style={{ position: 'relative' }}>
        {editing ? (
          <div style={{
            background: '#fffbe6',
            border: '1px solid #ffe58f',
            borderRadius: 8,
            padding: 8,
          }}>
            <Input.TextArea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              autoSize={{ minRows: 1, maxRows: 4 }}
              autoFocus
              onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); saveEdit(); } }}
            />
            <Space size={4} style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" icon={<CheckOutlined />} type="primary" onClick={saveEdit}>保存</Button>
              <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit}>取消</Button>
            </Space>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              color: '#8c6d1f',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
            }}>
              <EnvironmentOutlined style={{ marginTop: 2, color: '#d48806', flexShrink: 0 }} />
              <span>{message.text}</span>
            </div>
            {(onEdit || onDelete) && (
              <div
                className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-70 transition-opacity"
                style={{ display: 'flex', gap: 2, zIndex: 10 }}
              >
                {onEdit && (
                  <Button type="text" size="small" icon={<EditOutlined />}
                    aria-label="编辑消息"
                    aria-label="编辑场景"
                    style={{ fontSize: 10, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', borderRadius: 4 }}
                    onClick={startEdit} />
                )}
                {onDelete && (
                  <Popconfirm title="确定删除这条场景？" onConfirm={() => onDelete(message.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                    <Button type="text" size="small" icon={<DeleteOutlined />}
                      aria-label="删除消息"
                      aria-label="删除场景"
                      style={{ fontSize: 10, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', borderRadius: 4, color: '#ff4d4f' }} />
                  </Popconfirm>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Her / Me messages
  return (
    <div className={`flex gap-1.5 max-w-[85%] group ${isHer ? 'self-start' : 'self-end flex-row-reverse'}`}>
      <Avatar
        size={30}
        style={{ backgroundColor: isHer ? '#f48fb1' : '#66bb6a', flexShrink: 0, fontSize: 12, borderRadius: 4 }}
      >
        {isHer ? targetName.charAt(0) : '我'}
      </Avatar>
      <div style={{ position: 'relative', maxWidth: '100%' }}>
        {editing ? (
          <div style={{ background: '#fff', border: '1px solid #3b5998', borderRadius: 10, padding: 8, minWidth: 200 }}>
            <Input.TextArea value={editText} onChange={e => setEditText(e.target.value)} autoSize={{ minRows: 1, maxRows: 4 }} autoFocus
              onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); saveEdit(); } }} />
            <Space size={4} style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="small" icon={<CheckOutlined />} type="primary" onClick={saveEdit}>保存</Button>
              <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit}>取消</Button>
            </Space>
          </div>
        ) : (
          <>
            <div className={`rounded-xl px-2.5 py-2 text-[13px] leading-relaxed wrap-break-word ${isHer ? 'bg-white text-[#1a1a1a] rounded-tl-sm' : 'bg-wechat-green text-[#1a1a1a] rounded-tr-sm'}`}>
              {message.text}
            </div>
            {(onEdit || onDelete) && (
              <div className="absolute -top-2 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-70 transition-opacity" style={{ [isHer ? 'right' : 'left']: 0, display: 'flex', gap: 2, zIndex: 10 }}>
                {onEdit && (
                  <Button type="text" size="small" icon={<EditOutlined />}
                    aria-label="编辑消息"
                    style={{ fontSize: 10, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', borderRadius: 4 }}
                    onClick={startEdit} />
                )}
                {onDelete && (
                  <Popconfirm title="确定删除这条消息？" onConfirm={() => onDelete(message.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
                    <Button type="text" size="small" icon={<DeleteOutlined />}
                      aria-label="删除消息"
                      style={{ fontSize: 10, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', borderRadius: 4, color: '#ff4d4f' }} />
                  </Popconfirm>
                )}
              </div>
            )}
          </>
        )}
        <div className={`text-[11px] text-[#bbb] mt-0.5 ${isHer ? 'text-left' : 'text-right'}`}>
          {renderSource()}
        </div>
      </div>
    </div>
  );
});

ChatBubble.displayName = 'ChatBubble';

export default ChatBubble;

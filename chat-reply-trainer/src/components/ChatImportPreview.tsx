import React from 'react';
import { Input, Button, Select, Alert, Card } from 'antd';
import { EnvironmentOutlined, CheckOutlined, CloseOutlined, WechatOutlined, PlusOutlined } from '@ant-design/icons';
import type { ParsedMessage } from '../utils/parseChat';

interface ChatImportPreviewProps {
  messages: ParsedMessage[];
  warnings?: string[];
  /** WeChat nickname state — pass arrays to show picker, empty to hide */
  wechatNicknames: string[];
  herNickname: string;
  meNickname: string;
  onHerNicknameChange: (v: string) => void;
  onMeNicknameChange: (v: string) => void;
  onNicknameConfirm: () => void;
  /** Scene insertion state */
  insertSceneIndex: number | null;
  insertSceneText: string;
  onSetInsertSceneIndex: (i: number | null) => void;
  onSetInsertSceneText: (t: string) => void;
  onInsertScene: (index: number) => void;
  /** Display variant */
  variant?: 'compact' | 'card';
}

const ChatImportPreview: React.FC<ChatImportPreviewProps> = ({
  messages,
  warnings = [],
  wechatNicknames,
  herNickname,
  meNickname,
  onHerNicknameChange,
  onMeNicknameChange,
  onNicknameConfirm,
  insertSceneIndex,
  insertSceneText,
  onSetInsertSceneIndex,
  onSetInsertSceneText,
  onInsertScene,
  variant = 'card',
}) => {
  const showNicknamePicker = wechatNicknames.length >= 2 && messages.length === 0;
  const msgCount = messages.length;
  const herCount = messages.filter(m => m.role === 'her').length;
  const meCount = msgCount - herCount;

  const renderSceneInsert = (index: number) => (
    insertSceneIndex === index ? (
      <div style={{
        background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4,
        padding: '4px 6px', marginBottom: 2, display: 'flex', gap: 4, alignItems: 'center',
      }}>
        <EnvironmentOutlined style={{ color: '#8c6d1f', fontSize: 10 }} />
        <Input
          size="small"
          value={insertSceneText}
          onChange={e => onSetInsertSceneText(e.target.value)}
          placeholder="输入场景描述..."
          style={{ flex: 1, fontSize: 11 }}
          autoFocus
          onPressEnter={() => onInsertScene(index)}
        />
        <Button size="small" type="link" icon={<CheckOutlined />} style={{ fontSize: 10 }}
          onClick={() => onInsertScene(index)} />
        <Button size="small" type="link" icon={<CloseOutlined />} style={{ fontSize: 10 }}
          onClick={() => { onSetInsertSceneIndex(null); onSetInsertSceneText(''); }} />
      </div>
    ) : (
      <div
        style={{ textAlign: 'center', margin: '2px 0', opacity: 0.5 }}
        className="hover:opacity-100 cursor-pointer"
        onClick={() => onSetInsertSceneIndex(index)}
      >
        <PlusOutlined style={{ fontSize: 10, color: '#8c6d1f' }} />
        <span style={{ fontSize: 10, color: '#8c6d1f', marginLeft: 2 }}>场景</span>
      </div>
    )
  );

  const renderMessage = (msg: ParsedMessage, i: number) => (
    <React.Fragment key={i}>
      {variant === 'compact' ? (
        <div style={{ color: msg.role === 'scene' ? '#8c6d1f' : msg.role === 'her' ? '#f48fb1' : '#66bb6a' }}>
          {msg.role === 'scene' ? '场景' : msg.role === 'her' ? '她' : '我'}：{msg.text.slice(0, 50)}{msg.text.length > 50 ? '...' : ''}
        </div>
      ) : msg.role === 'scene' ? (
        <div style={{
          background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6,
          padding: '3px 10px', fontSize: 12, lineHeight: 1.5, color: '#8c6d1f',
          wordBreak: 'break-all', whiteSpace: 'pre-wrap', textAlign: 'center',
        }}>
          {msg.text}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: msg.role === 'her' ? 'flex-start' : 'flex-end' }}>
          <div style={{
            maxWidth: '80%', padding: '4px 10px', borderRadius: 8,
            fontSize: 12, lineHeight: 1.5,
            background: msg.role === 'her' ? '#fff' : '#95ec69',
            border: msg.role === 'her' ? '1px solid #e8e8e8' : 'none',
            wordBreak: 'break-all', whiteSpace: 'pre-wrap',
          }}>
            <span style={{ color: '#999', fontSize: 10, marginRight: 4 }}>
              {msg.role === 'her' ? '她' : '我'}
            </span>
            {msg.text}
          </div>
        </div>
      )}
      {renderSceneInsert(i + 1)}
    </React.Fragment>
  );

  const nicknamePicker = showNicknamePicker && (
    <div style={{
      marginBottom: variant === 'card' ? 12 : 0, marginTop: variant === 'compact' ? 8 : 0,
      padding: '8px 10px',
      background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 6,
    }}>
      <div style={{ fontSize: 11, color: '#096dd9', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <WechatOutlined /> 检测到微信导出格式，共 {wechatNicknames.length} 位参与者，请选择角色映射：
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#f48fb1', fontWeight: 500 }}>她：</span>
          <Select
            size="small"
            value={herNickname}
            onChange={onHerNicknameChange}
            style={{ minWidth: 120 }}
            options={wechatNicknames.map(n => ({ label: n, value: n }))}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#66bb6a', fontWeight: 500 }}>我：</span>
          <Select
            size="small"
            value={meNickname}
            onChange={onMeNicknameChange}
            style={{ minWidth: 120 }}
            options={wechatNicknames.map(n => ({ label: n, value: n }))}
          />
        </div>
        <Button size="small" type="primary" onClick={onNicknameConfirm}
          disabled={!herNickname || !meNickname || herNickname === meNickname}>
          确认
        </Button>
      </div>
      {herNickname === meNickname && herNickname && (
        <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 4 }}>「她」和「我」不能选同一个人</div>
      )}
    </div>
  );

  if (variant === 'compact') {
    return (
      <>
        {nicknamePicker}
        {messages.length > 0 && (
          <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto', fontSize: 11, lineHeight: 1.6 }}>
            {renderSceneInsert(0)}
            {messages.map(renderMessage)}
            <div style={{ color: '#999', marginTop: 2 }}>共 {messages.length} 条</div>
          </div>
        )}
        {warnings.length > 0 && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#fa8c16' }}>
            {warnings.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {nicknamePicker}
      {msgCount > 0 && (
        <Card
          size="small"
          title={<span style={{ fontSize: 12 }}>解析预览 · {msgCount} 条消息（她: {herCount}，我: {meCount}）</span>}
        >
          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderSceneInsert(0)}
            {messages.map(renderMessage)}
          </div>
          {warnings.map((w, i) => (
            <Alert key={i} title={w} type="warning" showIcon style={{ marginTop: 8, fontSize: 11 }} />
          ))}
        </Card>
      )}
    </>
  );
};

export default ChatImportPreview;

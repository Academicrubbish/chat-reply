import React, { useRef, useEffect, useState } from 'react';
import { Empty, Button, Input, Space } from 'antd';
import { EnvironmentOutlined, FileAddOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ChatMessage } from '../types';
import type { ParsedMessage } from '../utils/parseChat';
import { parseChatWithMeta } from '../utils/parseChat';
import ChatBubble from './ChatBubble';

interface ChatHistoryProps {
  messages: ChatMessage[];
  targetName: string;
  onEditMessage?: (id: string, text: string) => void;
  onDeleteMessage?: (id: string) => void;
  onAddScene?: (text: string) => Promise<void>;
  onImportMessages?: (messages: ParsedMessage[]) => Promise<void>;
}

type InsertMode = 'none' | 'scene' | 'import';

const ChatHistory: React.FC<ChatHistoryProps> = ({
  messages, targetName, onEditMessage, onDeleteMessage,
  onAddScene, onImportMessages,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [insertMode, setInsertMode] = useState<InsertMode>('none');
  const [sceneText, setSceneText] = useState('');
  const [importText, setImportText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParsedMessage[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSceneSubmit = async () => {
    const trimmed = sceneText.trim();
    if (!trimmed || !onAddScene) return;
    setSubmitting(true);
    try {
      await onAddScene(trimmed);
      setSceneText('');
      setInsertMode('none');
    } finally {
      setSubmitting(false);
    }
  };

  const handleParseImport = () => {
    const { messages: parsed, warnings } = parseChatWithMeta(importText, targetName);
    setParsedPreview(parsed);
    setParseWarnings(warnings);
  };

  const handleConfirmImport = async () => {
    if (parsedPreview.length === 0 || !onImportMessages) return;
    setSubmitting(true);
    try {
      await onImportMessages(parsedPreview);
      setImportText('');
      setParsedPreview([]);
      setParseWarnings([]);
      setInsertMode('none');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelInsert = () => {
    setInsertMode('none');
    setSceneText('');
    setImportText('');
    setParsedPreview([]);
    setParseWarnings([]);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
      {messages.length === 0 && (
        <Empty description="开始新对话" style={{ marginTop: 40 }} />
      )}
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          message={msg}
          targetName={targetName}
          onEdit={onEditMessage}
          onDelete={onDeleteMessage}
        />
      ))}

      {/* Scene input area */}
      {insertMode === 'scene' && (
        <div className="self-center max-w-[90%] w-full" style={{
          background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: 8,
        }}>
          <div style={{ fontSize: 11, color: '#8c6d1f', marginBottom: 4 }}>
            <EnvironmentOutlined /> 补充场景描述
          </div>
          <Input.TextArea
            value={sceneText}
            onChange={e => setSceneText(e.target.value)}
            autoSize={{ minRows: 2, maxRows: 4 }}
            placeholder="例如：上次聊天已过7天，想找个开场白..."
            autoFocus
            onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSceneSubmit(); } }}
          />
          <Space size={4} style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" icon={<CloseOutlined />} onClick={cancelInsert}>取消</Button>
            <Button size="small" type="primary" icon={<CheckOutlined />}
              loading={submitting} disabled={!sceneText.trim()} onClick={handleSceneSubmit}>
              添加
            </Button>
          </Space>
        </div>
      )}

      {/* Import preview area */}
      {insertMode === 'import' && (
        <div className="self-center max-w-[90%] w-full" style={{
          background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: 8,
        }}>
          <div style={{ fontSize: 11, color: '#389e0d', marginBottom: 4 }}>
            <FileAddOutlined /> 粘贴聊天记录，支持：她：xxx / 我：xxx / 场景：xxx
          </div>
          <Input.TextArea
            value={importText}
            onChange={e => { setImportText(e.target.value); setParsedPreview([]); setParseWarnings([]); }}
            autoSize={{ minRows: 3, maxRows: 8 }}
            placeholder="粘贴聊天记录..."
            autoFocus
          />
          {parsedPreview.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 120, overflowY: 'auto', fontSize: 11, lineHeight: 1.6 }}>
              {parsedPreview.map((m, i) => (
                <div key={i} style={{ color: m.role === 'scene' ? '#8c6d1f' : m.role === 'her' ? '#f48fb1' : '#66bb6a' }}>
                  {m.role === 'scene' ? '📋' : m.role === 'her' ? '她' : '我'}：{m.text.slice(0, 50)}{m.text.length > 50 ? '...' : ''}
                </div>
              ))}
              <div style={{ color: '#999', marginTop: 2 }}>共 {parsedPreview.length} 条</div>
            </div>
          )}
          {parseWarnings.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#fa8c16' }}>
              {parseWarnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          )}
          <Space size={4} style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" icon={<CloseOutlined />} onClick={cancelInsert}>取消</Button>
            {parsedPreview.length === 0 ? (
              <Button size="small" type="primary" onClick={handleParseImport} disabled={!importText.trim()}>
                预览
              </Button>
            ) : (
              <Button size="small" type="primary" icon={<CheckOutlined />}
                loading={submitting} onClick={handleConfirmImport}>
                确认导入 ({parsedPreview.length}条)
              </Button>
            )}
          </Space>
        </div>
      )}

      <div ref={bottomRef} />

      {/* Action buttons */}
      {insertMode === 'none' && (onAddScene || onImportMessages) && (
        <div className="self-center flex gap-2" style={{ padding: '4px 0' }}>
          {onAddScene && (
            <Button size="small" type="dashed" icon={<EnvironmentOutlined />}
              onClick={() => setInsertMode('scene')}>
              场景补充
            </Button>
          )}
          {onImportMessages && (
            <Button size="small" type="dashed" icon={<FileAddOutlined />}
              onClick={() => setInsertMode('import')}>
              补充记录
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatHistory;

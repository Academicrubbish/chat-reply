import React, { useRef, useEffect, useState } from 'react';
import { Empty, Button, Input, Space, Select, Alert } from 'antd';
import { EnvironmentOutlined, FileAddOutlined, CheckOutlined, CloseOutlined, WechatOutlined, PlusOutlined } from '@ant-design/icons';
import type { ChatMessage } from '../types';
import type { ParsedMessage, NicknameMap } from '../utils/parseChat';
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

  // Inline scene insert in preview
  const [insertSceneIndex, setInsertSceneIndex] = useState<number | null>(null);
  const [insertSceneText, setInsertSceneText] = useState('');

  // WeChat nickname mapping state
  const [wechatNicknames, setWechatNicknames] = useState<string[]>([]);
  const [herNickname, setHerNickname] = useState<string>('');
  const [meNickname, setMeNickname] = useState<string>('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const resetImportState = () => {
    setImportText('');
    setParsedPreview([]);
    setParseWarnings([]);
    setWechatNicknames([]);
    setHerNickname('');
    setMeNickname('');
    setInsertSceneIndex(null);
    setInsertSceneText('');
  };

  const handleInsertScene = (index: number) => {
    const text = insertSceneText.trim();
    if (!text) return;
    const next = [...parsedPreview];
    next.splice(index, 0, { role: 'scene', text });
    setParsedPreview(next);
    setInsertSceneIndex(null);
    setInsertSceneText('');
  };

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
    const result = parseChatWithMeta(importText);
    setParsedPreview(result.messages);
    setParseWarnings(result.warnings);

    // If WeChat format detected with nicknames, show mapping UI
    if (result.nicknames && result.nicknames.length >= 2) {
      setWechatNicknames(result.nicknames);
      setHerNickname(result.nicknames[0]);
      setMeNickname(result.nicknames[1]);
      setParsedPreview([]); // Don't show preview until mapping is confirmed
    } else {
      setWechatNicknames([]);
    }
  };

  const handleNicknameConfirm = () => {
    if (!herNickname || !meNickname) return;
    const map: NicknameMap = { herNick: herNickname, meNick: meNickname };
    const result = parseChatWithMeta(importText, targetName, map);
    setParsedPreview(result.messages);
    setParseWarnings(result.warnings);
  };

  const handleConfirmImport = async () => {
    if (parsedPreview.length === 0 || !onImportMessages) return;
    setSubmitting(true);
    try {
      await onImportMessages(parsedPreview);
      resetImportState();
      setInsertMode('none');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelInsert = () => {
    setInsertMode('none');
    setSceneText('');
    resetImportState();
  };

  // WeChat nickname is being selected
  const showNicknamePicker = wechatNicknames.length >= 2 && parsedPreview.length === 0;

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
            <FileAddOutlined /> 粘贴聊天记录，支持以下格式：
          </div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4, paddingLeft: 14, lineHeight: 1.8 }}>
            <div>• <span style={{ color: '#f48fb1' }}>她：xxx</span> / <span style={{ color: '#66bb6a' }}>我：xxx</span></div>
            <div>• <span style={{ color: '#8c6d1f' }}>场景：xxx</span> ← 在对话中间插入背景说明</div>
            <div>• 微信聊天记录导出（自动识别）</div>
          </div>
          <Input.TextArea
            value={importText}
            onChange={e => { setImportText(e.target.value); setParsedPreview([]); setParseWarnings([]); setWechatNicknames([]); }}
            autoSize={{ minRows: 3, maxRows: 8 }}
            placeholder={"她：你在干嘛\n我：在加班呢\n场景：过了两天没联系\n她：最近忙吗"}
            autoFocus
          />
          <Alert
            type="info"
            showIcon
            style={{ fontSize: 11, marginTop: 6, padding: '6px 10px' }}
            message={
              <span>
                <b>微信记录导入：</b>在微信中长按消息 → 多选 → 选择最右侧邮件转发 → 进入发送页 → 长按该条邮件 → 全选复制 → 粘贴到此处。（无需发送真实邮件）
                系统会自动识别参与者，你只需选择谁是「她」谁是「我」即可。
              </span>
            }
          />

          {/* WeChat nickname picker */}
          {showNicknamePicker && (
            <div style={{
              marginTop: 8, padding: '8px 10px',
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
                    onChange={setHerNickname}
                    style={{ minWidth: 120 }}
                    options={wechatNicknames.map(n => ({ label: n, value: n }))}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, color: '#66bb6a', fontWeight: 500 }}>我：</span>
                  <Select
                    size="small"
                    value={meNickname}
                    onChange={setMeNickname}
                    style={{ minWidth: 120 }}
                    options={wechatNicknames.map(n => ({ label: n, value: n }))}
                  />
                </div>
                <Button size="small" type="primary" onClick={handleNicknameConfirm}
                  disabled={!herNickname || !meNickname || herNickname === meNickname}>
                  确认
                </Button>
              </div>
              {herNickname === meNickname && herNickname && (
                <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 4 }}>「她」和「我」不能选同一个人</div>
              )}
            </div>
          )}

          {parsedPreview.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto', fontSize: 11, lineHeight: 1.6 }}>
              {/* Insert scene at the top */}
              {insertSceneIndex === 0 ? (
                <div style={{
                  background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4,
                  padding: '4px 6px', marginBottom: 2, display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  <EnvironmentOutlined style={{ color: '#8c6d1f', fontSize: 10 }} />
                  <Input
                    size="small"
                    value={insertSceneText}
                    onChange={e => setInsertSceneText(e.target.value)}
                    placeholder="输入场景描述..."
                    style={{ flex: 1, fontSize: 11 }}
                    autoFocus
                    onPressEnter={() => handleInsertScene(0)}
                  />
                  <Button size="small" type="link" icon={<CheckOutlined />} style={{ fontSize: 10 }}
                    onClick={() => handleInsertScene(0)} />
                  <Button size="small" type="link" icon={<CloseOutlined />} style={{ fontSize: 10 }}
                    onClick={() => { setInsertSceneIndex(null); setInsertSceneText(''); }} />
                </div>
              ) : (
                <div
                  style={{ textAlign: 'center', margin: '2px 0', opacity: 0.5 }}
                  className="hover:opacity-100 cursor-pointer"
                  onClick={() => setInsertSceneIndex(0)}
                >
                  <PlusOutlined style={{ fontSize: 10, color: '#8c6d1f' }} />
                  <span style={{ fontSize: 10, color: '#8c6d1f', marginLeft: 2 }}>场景</span>
                </div>
              )}
              {parsedPreview.map((m, i) => (
                <React.Fragment key={i}>
                  <div style={{ color: m.role === 'scene' ? '#8c6d1f' : m.role === 'her' ? '#f48fb1' : '#66bb6a' }}>
                    {m.role === 'scene' ? '📋' : m.role === 'her' ? '她' : '我'}：{m.text.slice(0, 50)}{m.text.length > 50 ? '...' : ''}
                  </div>
                  {/* Insert scene between messages */}
                  {insertSceneIndex === i + 1 ? (
                    <div style={{
                      background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4,
                      padding: '4px 6px', margin: '2px 0', display: 'flex', gap: 4, alignItems: 'center',
                    }}>
                      <EnvironmentOutlined style={{ color: '#8c6d1f', fontSize: 10 }} />
                      <Input
                        size="small"
                        value={insertSceneText}
                        onChange={e => setInsertSceneText(e.target.value)}
                        placeholder="输入场景描述..."
                        style={{ flex: 1, fontSize: 11 }}
                        autoFocus
                        onPressEnter={() => handleInsertScene(i + 1)}
                      />
                      <Button size="small" type="link" icon={<CheckOutlined />} style={{ fontSize: 10 }}
                        onClick={() => handleInsertScene(i + 1)} />
                      <Button size="small" type="link" icon={<CloseOutlined />} style={{ fontSize: 10 }}
                        onClick={() => { setInsertSceneIndex(null); setInsertSceneText(''); }} />
                    </div>
                  ) : (
                    <div
                      style={{ textAlign: 'center', margin: '2px 0', opacity: 0.5 }}
                      className="hover:opacity-100 cursor-pointer"
                      onClick={() => setInsertSceneIndex(i + 1)}
                    >
                      <PlusOutlined style={{ fontSize: 10, color: '#8c6d1f' }} />
                      <span style={{ fontSize: 10, color: '#8c6d1f', marginLeft: 2 }}>场景</span>
                    </div>
                  )}
                </React.Fragment>
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
            {parsedPreview.length === 0 && !showNicknamePicker ? (
              <Button size="small" type="primary" onClick={handleParseImport} disabled={!importText.trim()}>
                预览
              </Button>
            ) : parsedPreview.length > 0 ? (
              <Button size="small" type="primary" icon={<CheckOutlined />}
                loading={submitting} onClick={handleConfirmImport}>
                确认导入 ({parsedPreview.length}条)
              </Button>
            ) : null}
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

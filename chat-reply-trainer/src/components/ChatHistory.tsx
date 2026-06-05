import React, { useRef, useEffect, useState } from 'react';
import { Empty, Button, Input, Space, Alert } from 'antd';
import { EnvironmentOutlined, FileAddOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ChatMessage } from '../types';
import type { ParsedMessage, NicknameMap } from '../utils/parseChat';
import { parseChatWithMeta } from '../utils/parseChat';
import ChatBubble from './ChatBubble';
import ChatImportPreview from './ChatImportPreview';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [insertMode, setInsertMode] = useState<InsertMode>('none');
  const [sceneText, setSceneText] = useState('');
  const [importText, setImportText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParsedMessage[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [insertSceneIndex, setInsertSceneIndex] = useState<number | null>(null);
  const [insertSceneText, setInsertSceneText] = useState('');
  const [wechatNicknames, setWechatNicknames] = useState<string[]>([]);
  const [herNickname, setHerNickname] = useState<string>('');
  const [meNickname, setMeNickname] = useState<string>('');

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const threshold = 150;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      if (isNearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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

    if (result.nicknames && result.nicknames.length >= 2) {
      setWechatNicknames(result.nicknames);
      setHerNickname(result.nicknames[0]);
      setMeNickname(result.nicknames[1]);
      setParsedPreview([]);
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

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
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
            title={
              <span>
                <b>微信记录导入：</b>在微信中长按消息 → 多选 → 选择最右侧邮件转发 → 进入发送页 → 长按该条邮件 → 全选复制 → 粘贴到此处。（无需发送真实邮件）
                系统会自动识别参与者，你只需选择谁是「她」谁是「我」即可。
              </span>
            }
          />
          <ChatImportPreview
            messages={parsedPreview}
            warnings={parseWarnings}
            wechatNicknames={wechatNicknames}
            herNickname={herNickname}
            meNickname={meNickname}
            onHerNicknameChange={setHerNickname}
            onMeNicknameChange={setMeNickname}
            onNicknameConfirm={handleNicknameConfirm}
            insertSceneIndex={insertSceneIndex}
            insertSceneText={insertSceneText}
            onSetInsertSceneIndex={setInsertSceneIndex}
            onSetInsertSceneText={setInsertSceneText}
            onInsertScene={handleInsertScene}
            variant="compact"
          />
          <Space size={4} style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" icon={<CloseOutlined />} onClick={cancelInsert}>取消</Button>
            {parsedPreview.length === 0 && wechatNicknames.length < 2 ? (
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

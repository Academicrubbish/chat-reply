import React, { useState, useMemo } from 'react';
import { Collapse, Tag, Card, Button, Space, Input, Spin, Tooltip, message } from 'antd';
import {
  LikeOutlined, LikeFilled, DislikeOutlined, DislikeFilled,
  ReloadOutlined, SendOutlined,
  CheckCircleFilled, CheckOutlined, LoadingOutlined,
} from '@ant-design/icons';
import type { AIMessage, AnalysisData, ReplyOption, AppPhase, GenerationStep, FavorabilityRecord, ReplyVersion, ChatMessage, ReplySelection } from '../types';

interface RoundTimelineProps {
  aiMessages: AIMessage[];
  replySelections: ReplySelection[];
  phase: AppPhase;
  currentAnalysis: AnalysisData | null;
  currentReplies: ReplyOption[] | null;
  isGenerating: boolean;
  generationStep: GenerationStep;
  streamingText: string;
  favorabilityHistory: FavorabilityRecord[];
  replyVersions: ReplyVersion[];
  activeVersionIndex: number;
  onSwitchVersion: (index: number) => void;
  onSelectReply: (reply: ReplyOption, aiMessageId?: string) => void;
  onCustomReply: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (replyId: number, rating: 'thumbs_up' | 'thumbs_down') => void;
}

interface RoundVersion {
  analysis: AnalysisData;
  replies: ReplyOption[];
  aiMessageId?: string;
}

interface HistoricalRound {
  versions: RoundVersion[];
  selectedReplyText: string | null;
  selectedAiMessageId: string | null;
}

/** Parse ai_messages into rounds, grouping by round_id (with legacy fallback). */
function parseAiMessages(aiMessages: AIMessage[]): HistoricalRound[] {
  const hasRoundIds = aiMessages.some(m => m.role === 'assistant' && m.round_id);

  if (hasRoundIds) {
    // New path: group by round_id
    const roundMap = new Map<string, RoundVersion[]>();
    for (const msg of aiMessages) {
      if (msg.role !== 'assistant') continue;
      let data: any;
      try { data = JSON.parse(msg.content); } catch { continue; }
      if (!data.replies || data.replies.length === 0) continue;

      const analysis: AnalysisData = data.analysis || {
        stage: '快速模式', signal: '—', strategy: '—',
        signalText: '快速模式无分析', emotions: [],
        tip: '', favorability: 50, favorabilityReason: '',
      };
      const roundId = msg.round_id || `legacy-${msg.id}`;
      const version: RoundVersion = { analysis, replies: data.replies, aiMessageId: msg.id };
      if (!roundMap.has(roundId)) roundMap.set(roundId, []);
      roundMap.get(roundId)!.push(version);
    }
    const rounds: HistoricalRound[] = [];
    for (const [, versions] of roundMap) {
      versions.sort((a, b) => (a.aiMessageId ? 0 : 0)); // insertion order is fine
      rounds.push({ versions, selectedReplyText: null, selectedAiMessageId: null });
    }
    return rounds;
  }

  // Legacy fallback: sequence-based parsing for old data without round_id
  const rounds: HistoricalRound[] = [];
  let currentAssistantData: { analysis: AnalysisData; replies: ReplyOption[] } | null = null;

  for (const msg of aiMessages) {
    if (msg.role === 'user') {
      let parsed: any;
      try { parsed = JSON.parse(msg.content); } catch { continue; }
      if (parsed.type === 'regenerate') continue;
      currentAssistantData = null;
      continue;
    }
    if (msg.role === 'assistant') {
      let data: any;
      try { data = JSON.parse(msg.content); } catch { continue; }
      if (!data.replies || data.replies.length === 0) continue;

      const analysis: AnalysisData = data.analysis || {
        stage: '快速模式', signal: '—', strategy: '—',
        signalText: '快速模式无分析', emotions: [],
        tip: '', favorability: 50, favorabilityReason: '',
      };
      const version: RoundVersion = { analysis, replies: data.replies, aiMessageId: msg.id };

      if (currentAssistantData) {
        rounds[rounds.length - 1].versions.push(version);
      } else {
        currentAssistantData = { analysis: data.analysis, replies: data.replies };
        rounds.push({ versions: [version], selectedReplyText: null, selectedAiMessageId: null });
      }
    }
  }
  return rounds;
}

/** Match selected replies using explicit reply_selections data. */
function matchSelectedReplies(rounds: HistoricalRound[], selections: ReplySelection[]): HistoricalRound[] {
  return rounds.map(round => {
    for (const sel of selections) {
      const matchingVersion = round.versions.find(v => v.aiMessageId === sel.ai_message_id);
      if (matchingVersion) {
        return {
          ...round,
          selectedReplyText: sel.reply_text,
          selectedAiMessageId: sel.ai_message_id,
        };
      }
    }
    return round;
  });
}

const strategyTagColor: Record<string, string> = {
  '魔趣法则': 'blue',
  '平衡艺术': 'green',
  '扩大冲突': 'red',
  '安全回复': 'purple',
  '释放性信息': 'orange',
};

const STEP_ITEMS = [
  { key: 'analyze', label: '分析消息' },
  { key: 'generating', label: '识别信号与匹配策略' },
  { key: 'parsing', label: '生成回复' },
  { key: 'done', label: '完成' },
];

function getStepIndex(step: GenerationStep): number {
  const idx = STEP_ITEMS.findIndex(s => s.key === step);
  return idx >= 0 ? idx : 0;
}

function ThoughtChainSteps({ currentStep }: { currentStep: GenerationStep }) {
  const activeIdx = getStepIndex(currentStep);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '4px 0' }}>
      {STEP_ITEMS.map((item, idx) => {
        const isDone = idx < activeIdx;
        const isActive = idx === activeIdx;

        return (
          <div key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 36 }}>
              {isDone ? (
                <CheckCircleFilled style={{ fontSize: 16, color: '#52c41a' }} />
              ) : isActive ? (
                <LoadingOutlined style={{ fontSize: 16, color: '#1677ff' }} spin />
              ) : (
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #d9d9d9', background: '#fff' }} />
              )}
              {idx < STEP_ITEMS.length - 1 && (
                <div style={{ width: 2, flex: 1, minHeight: 14, background: isDone ? '#52c41a' : '#f0f0f0', marginTop: 2 }} />
              )}
            </div>
            <span style={{
              fontSize: 13, lineHeight: '20px',
              color: isDone ? '#52c41a' : isActive ? '#1677ff' : '#999',
              fontWeight: isActive ? 600 : 400,
            }}>
              {item.label}
              {isActive && <span style={{ marginLeft: 6, fontSize: 11, color: '#999' }}>处理中...</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FeedbackReplyCard({ reply, onSelectReply, onFeedback }: {
  reply: ReplyOption;
  onSelectReply: (reply: ReplyOption) => void;
  onFeedback: (replyId: number, rating: 'thumbs_up' | 'thumbs_down') => void;
}) {
  const [feedback, setFeedback] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [selected, setSelected] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleFeedback = (rating: 'thumbs_up' | 'thumbs_down') => {
    if (feedback) return;
    setFeedback(rating);
    onFeedback(reply.id, rating);
    messageApi.success({
      content: rating === 'thumbs_up' ? '已点赞，AI 会多推荐这类风格' : '已反馈，AI 会减少这类风格',
      duration: 2,
    });
  };

  const handleClick = () => {
    setSelected(true);
    onSelectReply(reply);
  };

  return (
    <>
      {contextHolder}
      <div
        onClick={handleClick}
        style={{
          padding: '8px 10px',
          border: selected ? '2px solid #1677ff' : '1px solid #e8e8e8',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.2s',
          background: selected ? '#f0f5ff' : '#fff',
          boxShadow: selected ? '0 0 0 2px rgba(22,119,255,0.1)' : 'none',
          animation: 'replyFadeIn 0.3s ease-out',
        }}
        onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = '#3b5998'; }}
        onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = '#e8e8e8'; }}
      >
        <Tag color={strategyTagColor[reply.strategy] || 'default'} style={{ marginBottom: 4 }}>
          {reply.strategy}
        </Tag>
        {selected && <Tag color="success" style={{ marginBottom: 4 }}>已选择</Tag>}
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.5 }}>{reply.text}</div>
        <div style={{ fontSize: 11, color: '#999', lineHeight: 1.4 }}>{reply.reason}</div>
        <Space size={4} style={{ marginTop: 4 }}>
          <Tooltip title={feedback ? '已反馈' : '点赞：AI 会多推荐这类风格'}>
            <Button type="text" size="small"
              icon={feedback === 'thumbs_up' ? <LikeFilled /> : <LikeOutlined />}
              style={feedback === 'thumbs_up' ? { color: '#1890ff' } : undefined}
              disabled={feedback === 'thumbs_down'}
              onClick={e => { e.stopPropagation(); handleFeedback('thumbs_up'); }} />
          </Tooltip>
          <Tooltip title={feedback ? '已反馈' : '踩：AI 会减少这类风格'}>
            <Button type="text" size="small"
              icon={feedback === 'thumbs_down' ? <DislikeFilled /> : <DislikeOutlined />}
              style={feedback === 'thumbs_down' ? { color: '#ff4d4f' } : undefined}
              disabled={feedback === 'thumbs_up'}
              onClick={e => { e.stopPropagation(); handleFeedback('thumbs_down'); }} />
          </Tooltip>
        </Space>
      </div>
    </>
  );
}

function VersionSwitcher({ current, total, onSwitch }: {
  current: number; total: number; onSwitch: (idx: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
      <Button size="small" type="text"
        icon={<span style={{ fontSize: 12 }}>←</span>}
        disabled={current <= 0}
        onClick={() => onSwitch(current - 1)}
      />
      <span style={{ fontSize: 12, color: '#666', userSelect: 'none' }}>
        {current + 1} / {total}
      </span>
      <Button size="small" type="text"
        icon={<span style={{ fontSize: 12 }}>→</span>}
        disabled={current >= total - 1}
        onClick={() => onSwitch(current + 1)}
      />
    </div>
  );
}

function CurrentRoundCard({
  analysis,
  replies,
  isGenerating,
  generationStep,
  streamingText,
  favorabilityHistory,
  replyVersions,
  activeVersionIndex,
  onSwitchVersion,
  onSelectReply,
  onCustomReply,
  onRegenerate,
  onFeedback,
}: {
  analysis: AnalysisData | null;
  replies: ReplyOption[] | null;
  isGenerating: boolean;
  generationStep: GenerationStep;
  streamingText: string;
  favorabilityHistory: FavorabilityRecord[];
  replyVersions: ReplyVersion[];
  activeVersionIndex: number;
  onSwitchVersion: (index: number) => void;
  onSelectReply: (reply: ReplyOption, aiMessageId?: string) => void;
  onCustomReply: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (replyId: number, rating: 'thumbs_up' | 'thumbs_down') => void;
}) {
  const [customText, setCustomText] = useState('');

  // Get current version's aiMessageId for version-aware selection
  const currentAiMessageId = replyVersions[activeVersionIndex]?.aiMessageId;

  // First-time generation: no replies yet, show ThoughtChainSteps card
  if (isGenerating && !replies) {
    return (
      <Card size="small" style={{ borderLeft: '3px solid #3b5998' }}>
        <ThoughtChainSteps currentStep={generationStep} />
        {streamingText && generationStep === 'parsing' && (() => {
          const match = streamingText.match(/"signalText"\s*:\s*"([\s\S]*?)"/);
          const displayText = match ? match[1].replace(/\\n/g, ' ').trim() : '';
          return displayText ? (
            <div style={{
              marginTop: 8, padding: '8px 10px', background: '#f6f8fa',
              borderRadius: 6, fontSize: 12, color: '#333', lineHeight: 1.8,
              maxHeight: 200, overflow: 'hidden',
            }}>
              {displayText}
              <span style={{ animation: 'blink 1s infinite', color: '#1677ff' }}>|</span>
            </div>
          ) : null;
        })()}
      </Card>
    );
  }

  if (!analysis && !replies) return null;

  const handleCustomSend = () => {
    const trimmed = customText.trim();
    if (trimmed) { onCustomReply(trimmed); setCustomText(''); }
  };

  const currentFav = analysis?.favorability ?? 0;
  const currentFavReason = analysis?.favorabilityReason || '';
  const prevFav = favorabilityHistory.length > 1 ? favorabilityHistory[favorabilityHistory.length - 2]?.value : null;
  const favDelta = prevFav !== null ? currentFav - prevFav : null;
  const isRegenerating = isGenerating && replyVersions.length > 0;

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#3b5998', fontWeight: 600 }}>当前轮次</span>
          {isGenerating && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Spin size="small" />
              <span style={{ fontSize: 11, color: '#999' }}>重新生成中...</span>
            </span>
          )}
          {analysis && (
            <Tooltip title={currentFavReason ? `好感度：${currentFavReason}` : undefined}>
              <Tag color={currentFav >= 70 ? 'green' : currentFav >= 40 ? 'orange' : 'red'} style={{ marginLeft: 'auto', cursor: 'default' }}>
                {`好感度 ${currentFav}`}
                {favDelta !== null && favDelta !== 0 && (
                  <span style={{ marginLeft: 4 }}>{favDelta > 0 ? `+${favDelta}` : `${favDelta}`}</span>
                )}
              </Tag>
            </Tooltip>
          )}
        </div>
      }
      style={{ borderLeft: '3px solid #3b5998' }}
      styles={{ body: { position: 'relative' } } as any}
    >
      {/* Regeneration mask — covers entire card body */}
      {isRegenerating && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(2px)',
          borderRadius: '0 0 8px 8px',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          padding: '16px 20px',
          cursor: 'default',
        }}>
          <div style={{ width: '100%', maxWidth: 260 }}>
            <ThoughtChainSteps currentStep={generationStep} />
          </div>
        </div>
      )}

      {/* Analysis */}
      {analysis && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {analysis.stage && <Tag color="green">{analysis.stage}</Tag>}
            {analysis.signal && <Tag color="blue">{analysis.signal}</Tag>}
            {analysis.strategy && <Tag color="orange">{analysis.strategy}</Tag>}
          </div>
          {analysis.signalText && <div style={{ fontSize: 12, color: '#333', lineHeight: 1.5 }}>{analysis.signalText}</div>}
          {analysis.emotions?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {analysis.emotions.map((e, i) => <Tag key={i} color="blue">{e}</Tag>)}
            </div>
          )}
        </div>
      )}

      {/* Version switcher */}
      {replyVersions.length > 1 && !isGenerating && (
        <VersionSwitcher
          current={activeVersionIndex}
          total={replyVersions.length}
          onSwitch={onSwitchVersion}
        />
      )}

      {/* Reply cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(replies ?? []).map(reply => (
          <FeedbackReplyCard key={reply.id} reply={reply} onSelectReply={(r) => onSelectReply(r, currentAiMessageId)} onFeedback={onFeedback} />
        ))}
      </div>

      {/* Actions */}
      <Space style={{ marginTop: 10 }} size={8}>
        <Button size="small" icon={<ReloadOutlined />} onClick={onRegenerate} disabled={isGenerating}>重新生成</Button>
      </Space>

      {/* Custom reply */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #ddd' }}>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>不满意？自己写：</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Input.TextArea
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder="输入自定义回复..."
            autoSize={{ minRows: 1, maxRows: 3 }}
            onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleCustomSend(); } }}
            style={{ flex: 1 }}
          />
          <Button type="primary" ghost icon={<SendOutlined />} onClick={handleCustomSend}>发送</Button>
        </div>
      </div>
    </Card>
  );
}

/** Stateful content inside a historical Collapse panel — proper React component so hooks are stable. */
function HistoryRoundContent({ round }: { round: HistoricalRound }) {
  const [versionIdx, setVersionIdx] = useState(round.versions.length - 1);
  const v = round.versions[versionIdx] || round.versions[0];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {v.analysis.stage && <Tag color="green">{v.analysis.stage}</Tag>}
        {v.analysis.signal && <Tag color="blue">{v.analysis.signal}</Tag>}
        {v.analysis.strategy && <Tag color="orange">{v.analysis.strategy}</Tag>}
      </div>
      {v.analysis.signalText && (
        <div style={{ fontSize: 12, color: '#333', lineHeight: 1.5, marginBottom: 6 }}>{v.analysis.signalText}</div>
      )}
      {v.analysis.favorabilityReason && (
        <div style={{ fontSize: 11, color: '#52c41a', lineHeight: 1.4, marginBottom: 6 }}>
          好感度分析：{v.analysis.favorabilityReason}
        </div>
      )}
      {v.analysis.emotions?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {v.analysis.emotions.map((e, i) => <Tag key={i} color="blue">{e}</Tag>)}
        </div>
      )}

      {round.versions.length > 1 && (
        <VersionSwitcher current={versionIdx} total={round.versions.length} onSwitch={setVersionIdx} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {v.replies.map(reply => {
          const isSelected = round.selectedReplyText && reply.text === round.selectedReplyText
            && (!round.selectedAiMessageId || v.aiMessageId === round.selectedAiMessageId);
          return (
            <div key={reply.id} style={{
              padding: '6px 8px',
              background: isSelected ? '#f0f5ff' : '#fafafa',
              borderRadius: 6,
              border: isSelected ? '1px solid #1677ff' : '1px solid #eee',
              display: 'flex', alignItems: 'flex-start', gap: 6,
            }}>
              <div style={{ flex: 1 }}>
                <Tag color={strategyTagColor[reply.strategy] || 'default'} style={{ marginBottom: 2 }}>
                  {reply.strategy}
                </Tag>
                <div style={{ fontSize: 12, color: '#333', lineHeight: 1.4 }}>{reply.text}</div>
              </div>
              {isSelected && (
                <CheckOutlined style={{ color: '#1677ff', fontSize: 14, marginTop: 4, flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Build a Collapse item for a historical round (no hooks — safe to call in map). */
function buildCollapseItem(round: HistoricalRound, idx: number) {
  const first = round.versions[round.versions.length - 1] || round.versions[0];
  return {
    key: String(idx),
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Round #{idx + 1}</span>
        <Tag color={strategyTagColor[first.analysis.strategy] || 'default'}>{first.analysis.strategy}</Tag>
        {first.analysis.signal && <Tag color="blue">{first.analysis.signal}</Tag>}
        {first.analysis.favorability != null && (
          <Tooltip title={first.analysis.favorabilityReason || undefined}>
            <Tag color={first.analysis.favorability >= 70 ? 'green' : first.analysis.favorability >= 40 ? 'orange' : 'red'}>
              好感度 {first.analysis.favorability}
            </Tag>
          </Tooltip>
        )}
      </div>
    ),
    children: <HistoryRoundContent round={round} />,
  };
}

const RoundTimeline = React.memo(function RoundTimeline({
  aiMessages,
  replySelections,
  phase,
  currentAnalysis,
  currentReplies,
  isGenerating,
  generationStep,
  streamingText,
  favorabilityHistory,
  replyVersions,
  activeVersionIndex,
  onSwitchVersion,
  onSelectReply,
  onCustomReply,
  onRegenerate,
  onFeedback,
}: RoundTimelineProps) {
  const rawRounds = useMemo(() => parseAiMessages(aiMessages), [aiMessages]);
  const historicalRounds = useMemo(() => matchSelectedReplies(rawRounds, replySelections), [rawRounds, replySelections]);

  // Hide the last historical round when it matches the current active generation
  const displayRounds = phase === 'waiting_select' && currentAnalysis && currentReplies
    ? historicalRounds.slice(0, -1)
    : historicalRounds;

  const collapseItems = displayRounds.map((round, idx) => buildCollapseItem(round, idx));

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
      {/* History */}
      {displayRounds.length > 0 && (
        <Collapse
          items={collapseItems}
          bordered={false}
          size="small"
          style={{ marginBottom: 8, background: 'transparent' }}
        />
      )}

      {/* Current round */}
      <CurrentRoundCard
        analysis={currentAnalysis}
        replies={currentReplies}
        isGenerating={isGenerating}
        generationStep={generationStep}
        streamingText={streamingText}
        favorabilityHistory={favorabilityHistory}
        replyVersions={replyVersions}
        activeVersionIndex={activeVersionIndex}
        onSwitchVersion={onSwitchVersion}
        onSelectReply={onSelectReply}
        onCustomReply={onCustomReply}
        onRegenerate={onRegenerate}
        onFeedback={onFeedback}
      />
    </div>
  );
});

export default RoundTimeline;

// Progressive reply card fade-in animation
const styleEl = document.createElement('style');
styleEl.textContent = `@keyframes replyFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
document.head.appendChild(styleEl);

import { useState } from 'react';
import { Collapse, Tag, Card, Button, Space, Input, Spin, Tooltip } from 'antd';
import {
  LikeOutlined, DislikeOutlined,
  ReloadOutlined, AimOutlined, SendOutlined,
  CheckCircleFilled, LoadingOutlined,
} from '@ant-design/icons';
import type { AIMessage, AnalysisData, ReplyOption, AppPhase, GenerationStep, FavorabilityRecord } from '../types';

interface RoundTimelineProps {
  aiMessages: AIMessage[];
  phase: AppPhase;
  currentAnalysis: AnalysisData | null;
  currentReplies: ReplyOption[] | null;
  isGenerating: boolean;
  generationStep: GenerationStep;
  streamingText: string;
  favorabilityHistory: FavorabilityRecord[];
  onSelectReply: (reply: ReplyOption) => void;
  onCustomReply: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (replyId: number, rating: 'thumbs_up' | 'thumbs_down') => void;
}

interface RoundData {
  analysis: AnalysisData;
  replies: ReplyOption[];
  plan?: { goal: string; nextStep: string };
}

function parseAiMessages(aiMessages: AIMessage[]): RoundData[] {
  const rounds: RoundData[] = [];
  for (const msg of aiMessages) {
    if (msg.role !== 'assistant') continue;
    try {
      const data = JSON.parse(msg.content);
      if (data.analysis && data.replies) {
        rounds.push({
          analysis: data.analysis,
          replies: data.replies,
          plan: data.plan,
        });
      }
    } catch {
      // skip unparseable
    }
  }
  return rounds;
}

/** Extract signalText from streaming JSON — only show signalText content */
function formatStreamingText(raw: string): string {
  const match = raw.match(/"signalText"\s*:\s*"([\s\S]*?)"/);
  if (match) return match[1].replace(/\\n/g, ' ').trim();
  return '';
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
            {/* Timeline dot + line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 36 }}>
              {isDone ? (
                <CheckCircleFilled style={{ fontSize: 16, color: '#52c41a' }} />
              ) : isActive ? (
                <LoadingOutlined style={{ fontSize: 16, color: '#1677ff' }} spin />
              ) : (
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid #d9d9d9', background: '#fff',
                }} />
              )}
              {idx < STEP_ITEMS.length - 1 && (
                <div style={{
                  width: 2, flex: 1, minHeight: 14,
                  background: isDone ? '#52c41a' : '#f0f0f0',
                  marginTop: 2,
                }} />
              )}
            </div>
            {/* Label */}
            <span style={{
              fontSize: 13, lineHeight: '20px', paddingTop: isDone || isActive ? 0 : 0,
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

function CurrentRoundCard({
  analysis,
  replies,
  isGenerating,
  generationStep,
  streamingText,
  favorabilityHistory,
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
  onSelectReply: (reply: ReplyOption) => void;
  onCustomReply: (text: string) => void;
  onRegenerate: () => void;
  onFeedback: (replyId: number, rating: 'thumbs_up' | 'thumbs_down') => void;
}) {
  const [customText, setCustomText] = useState('');

  // Show generation steps when generating (before analysis arrives)
  if (isGenerating && !analysis) {
    return (
      <Card size="small" style={{ borderLeft: '3px solid #3b5998' }}>
        <ThoughtChainSteps currentStep={generationStep} />
        {streamingText && generationStep === 'parsing' && (() => {
          const displayText = formatStreamingText(streamingText);
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

  // Don't render anything when idle with no data
  if (!analysis && !replies) {
    return null;
  }

  const handleCustomSend = () => {
    const trimmed = customText.trim();
    if (trimmed) {
      onCustomReply(trimmed);
      setCustomText('');
    }
  };

  const currentFav = analysis?.favorability ?? 0;
  const currentFavReason = analysis?.favorabilityReason || '';
  const prevFav = favorabilityHistory.length > 1 ? favorabilityHistory[favorabilityHistory.length - 2]?.value : null;
  const favDelta = prevFav !== null ? currentFav - prevFav : null;

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#3b5998', fontWeight: 600 }}>当前轮次</span>
          {isGenerating && !replies && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Spin size="small" />
              <span style={{ fontSize: 11, color: '#999' }}>生成回复中...</span>
            </span>
          )}
          {analysis && (
            <Tooltip title={currentFavReason ? `好感度：${currentFavReason}` : undefined}>
              <Tag color={currentFav >= 70 ? 'green' : currentFav >= 40 ? 'orange' : 'red'} style={{ marginLeft: 'auto', cursor: 'default' }}>
                {`好感度 ${currentFav}`}
                {favDelta !== null && favDelta !== 0 && (
                  <span style={{ marginLeft: 4 }}>
                    {favDelta > 0 ? `+${favDelta}` : `${favDelta}`}
                  </span>
                )}
              </Tag>
            </Tooltip>
          )}
        </div>
      }
      style={{ borderLeft: '3px solid #3b5998' }}
    >
      {/* Analysis */}
      {analysis && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {analysis.stage && <Tag color="green">{analysis.stage}</Tag>}
            {analysis.signal && <Tag color="blue">{analysis.signal}</Tag>}
            {analysis.strategy && <Tag color="orange">{analysis.strategy}</Tag>}
          </div>
          {analysis.signalText && (
            <div style={{ fontSize: 12, color: '#333', lineHeight: 1.5 }}>{analysis.signalText}</div>
          )}
          {analysis.emotions?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {analysis.emotions.map((e, i) => <Tag key={i} color="blue">{e}</Tag>)}
            </div>
          )}
        </div>
      )}

      {/* Reply options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(replies ?? []).map(reply => (
          <div
            key={reply.id}
            onClick={() => onSelectReply(reply)}
            style={{
              padding: '8px 10px',
              border: '1px solid #e8e8e8',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#3b5998')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
          >
            <Tag color={strategyTagColor[reply.strategy] || 'default'} style={{ marginBottom: 4 }}>
              {reply.strategy}
            </Tag>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.5 }}>{reply.text}</div>
            <div style={{ fontSize: 11, color: '#999', lineHeight: 1.4 }}>{reply.reason}</div>
            <Space size={4} style={{ marginTop: 4 }}>
              <Button type="text" size="small" icon={<LikeOutlined />}
                onClick={e => { e.stopPropagation(); onFeedback(reply.id, 'thumbs_up'); }} />
              <Button type="text" size="small" icon={<DislikeOutlined />}
                onClick={e => { e.stopPropagation(); onFeedback(reply.id, 'thumbs_down'); }} />
            </Space>
          </div>
        ))}
      </div>

      {/* Actions */}
      <Space style={{ marginTop: 10 }} size={8}>
        <Button size="small" icon={<ReloadOutlined />} onClick={onRegenerate}>重新生成</Button>
        <Button size="small" icon={<AimOutlined />}>指定策略</Button>
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

export default function RoundTimeline({
  aiMessages,
  phase,
  currentAnalysis,
  currentReplies,
  isGenerating,
  generationStep,
  streamingText,
  favorabilityHistory,
  onSelectReply,
  onCustomReply,
  onRegenerate,
  onFeedback,
}: RoundTimelineProps) {
  const historicalRounds = parseAiMessages(aiMessages);
  const displayRounds = phase === 'waiting_select' && currentAnalysis && currentReplies
    ? historicalRounds.slice(0, -1)
    : historicalRounds;

  const collapseItems = displayRounds.map((round, idx) => ({
    key: String(idx),
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Round #{idx + 1}</span>
        <Tag color={strategyTagColor[round.analysis.strategy] || 'default'}>
          {round.analysis.strategy}
        </Tag>
        {round.analysis.signal && <Tag color="blue">{round.analysis.signal}</Tag>}
        {round.analysis.favorability != null && (
          <Tooltip title={round.analysis.favorabilityReason || undefined}>
            <Tag color={round.analysis.favorability >= 70 ? 'green' : round.analysis.favorability >= 40 ? 'orange' : 'red'}>
              好感度 {round.analysis.favorability}
            </Tag>
          </Tooltip>
        )}
      </div>
    ),
    children: (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {round.analysis.stage && <Tag color="green">{round.analysis.stage}</Tag>}
          {round.analysis.signal && <Tag color="blue">{round.analysis.signal}</Tag>}
          {round.analysis.strategy && <Tag color="orange">{round.analysis.strategy}</Tag>}
        </div>
        {round.analysis.signalText && (
          <div style={{ fontSize: 12, color: '#333', lineHeight: 1.5, marginBottom: 6 }}>
            {round.analysis.signalText}
          </div>
        )}
        {round.analysis.favorabilityReason && (
          <div style={{ fontSize: 11, color: '#52c41a', lineHeight: 1.4, marginBottom: 6 }}>
            好感度分析：{round.analysis.favorabilityReason}
          </div>
        )}
        {round.analysis.emotions?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {round.analysis.emotions.map((e, i) => <Tag key={i} color="blue">{e}</Tag>)}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {round.replies.map(reply => (
            <div key={reply.id} style={{
              padding: '6px 8px',
              background: '#fafafa',
              borderRadius: 6,
              border: '1px solid #eee',
            }}>
              <Tag color={strategyTagColor[reply.strategy] || 'default'} style={{ marginBottom: 2 }}>
                {reply.strategy}
              </Tag>
              <div style={{ fontSize: 12, color: '#333', lineHeight: 1.4 }}>{reply.text}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  }));

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
        onSelectReply={onSelectReply}
        onCustomReply={onCustomReply}
        onRegenerate={onRegenerate}
        onFeedback={onFeedback}
      />
    </div>
  );
}

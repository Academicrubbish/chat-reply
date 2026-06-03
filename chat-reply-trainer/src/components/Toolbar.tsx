import React from 'react';
import { Button, Progress, Select, Tag, Tooltip, Popconfirm } from 'antd';
import { EditOutlined, RobotOutlined, PlusOutlined, UnorderedListOutlined, DeleteOutlined, BulbOutlined, BarChartOutlined, HistoryOutlined, AimOutlined } from '@ant-design/icons';
import type { ChatTarget, AISession, ModelOption, AnalysisData, AiMode, TargetDiagnosis } from '../types';

const tagColorMap: Record<string, string> = {
  aggressive: 'red', moderate: 'blue', conservative: 'green',
  practice: 'cyan', pursuing: 'magenta', friendship: 'geekblue',
};
const tagLabelMap: Record<string, string> = {
  aggressive: '进攻型', moderate: '适中', conservative: '保守型',
  practice: '练习聊天', pursuing: '追求中', friendship: '交朋友',
};

interface ToolbarProps {
  // Person
  target: ChatTarget | null;
  onEditTarget: () => void;
  // AI
  onAIAssist: () => void;
  isGenerating: boolean;
  aiMode: AiMode;
  // Session
  session: AISession | null;
  sessions: AISession[];
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  // Model
  models?: ModelOption[];
  selectedProvider?: string;
  onSelectProvider?: (provider: string) => void;
  // Analysis
  onTriggerAnalysis?: (mode: 'advisor' | 'review') => void;
  onShowHistory?: () => void;
  isAnalyzing?: boolean;
  analysisMode?: 'advisor' | 'review' | null;
  // Context
  analysis: AnalysisData | null;
  // Diagnosis
  activeDiagnosis?: TargetDiagnosis | null;
  isDiagnosing?: boolean;
  onDiagnose?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  target, onEditTarget, onAIAssist, isGenerating, aiMode,
  session, sessions, onSelectSession, onCreateSession, onDeleteSession,
  models = [], selectedProvider = 'zhipu', onSelectProvider,
  onTriggerAnalysis, onShowHistory, isAnalyzing = false, analysisMode = null,
  analysis, activeDiagnosis, isDiagnosing = false, onDiagnose,
}) => {
  const currentIndex = session ? sessions.findIndex(s => s.id === session.id) : -1;
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  const roundCount = session?.round_count ?? 0;
  const contextPercentage = session?.context_tokens
    ? Math.min(100, Math.round((session.context_tokens / 4000) * 100))
    : 0;
  const isQuick = aiMode === 'quick';

  return (
    <div style={{ borderBottom: '1px solid #ebeef5', flexShrink: 0 }} data-tour-id="session-bar">
      {/* Row 1: Person Info + AI Assist */}
      <div style={{ padding: '10px 20px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, background: '#f48fb1', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 16, fontWeight: 600, flexShrink: 0,
          }}>
            {target ? target.name.charAt(0) : '?'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {target?.name || '请选择对象'}
              </span>
              {target && (
                <span style={{ width: 6, height: 6, background: '#52c41a', borderRadius: '50%', flexShrink: 0 }} />
              )}
              {target && (
                <Button size="small" type="text" icon={<EditOutlined />} onClick={onEditTarget} style={{ flexShrink: 0 }} />
              )}
            </div>
            {target && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2, alignItems: 'center' }}>
                {[target.meet_scene, target.goal_intent, target.tone_level].filter(Boolean).map((tag, i) => (
                  <Tag key={i} color={tagColorMap[tag] || 'default'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                    {tagLabelMap[tag] || tag}
                  </Tag>
                ))}
                {analysis?.stage && <Tag color="green" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>{analysis.stage}</Tag>}
                {analysis?.signal && <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>{analysis.signal}</Tag>}
                {analysis?.strategy && <Tag color="orange" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>{analysis.strategy}</Tag>}
                {activeDiagnosis && (
                  <Tag color="purple" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                    {activeDiagnosis.stage} · {activeDiagnosis.strategy}
                  </Tag>
                )}
              </div>
            )}
          </div>
        </div>
        <Button
          data-tour-id="ai-assist-btn"
          type="primary"
          icon={<RobotOutlined />}
          onClick={onAIAssist}
          loading={isGenerating}
          style={{ flexShrink: 0 }}
        >
          {isGenerating ? (isQuick ? '快速生成中...' : '分析中...') : 'AI 辅助'}
        </Button>
      </div>

      {/* Row 2: Session + Context + Analysis Tools */}
      <div style={{ padding: '4px 20px 8px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#3b5998', background: '#e8f0fe', padding: '2px 10px', borderRadius: 10, whiteSpace: 'nowrap' }}>
          窗口 #{displayIndex || '-'}
        </span>
        <span style={{ fontSize: 11, color: '#999', whiteSpace: 'nowrap' }}>
          {roundCount} 轮对话
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>上下文</span>
          <Progress
            percent={contextPercentage}
            size="small"
            strokeColor={contextPercentage > 80 ? '#fa8c16' : '#52c41a'}
            showInfo
            format={() => `${contextPercentage}%`}
            style={{ width: 80, marginBottom: 0 }}
          />
        </div>

        {onDiagnose && (
          <Tooltip title={activeDiagnosis ? `当前方案：${activeDiagnosis.stage} - ${activeDiagnosis.action}` : '基于聊天记录制定诊断方案，回复将围绕方案方向生成'}>
            <Button size="small"
              type={activeDiagnosis ? 'default' : 'primary'}
              icon={<AimOutlined />}
              loading={isDiagnosing}
              onClick={onDiagnose}
            >
              {activeDiagnosis ? '重新诊断' : '制定方案'}
            </Button>
          </Tooltip>
        )}

        {onTriggerAnalysis && (
          <>
            <Tooltip title="分析对方态度、情绪、想法，给出下一步方案">
              <Button size="small" icon={<BulbOutlined />}
                loading={isAnalyzing && analysisMode === 'advisor'}
                disabled={isAnalyzing}
                onClick={() => onTriggerAnalysis('advisor')}
              >军师</Button>
            </Tooltip>
            <Tooltip title="复盘聊天亮点与踩坑，帮助提升技巧">
              <Button size="small" icon={<BarChartOutlined />}
                loading={isAnalyzing && analysisMode === 'review'}
                disabled={isAnalyzing}
                onClick={() => onTriggerAnalysis('review')}
              >复盘</Button>
            </Tooltip>
            {onShowHistory && (
              <Tooltip title="查看历史分析记录">
                <Button size="small" icon={<HistoryOutlined />} onClick={onShowHistory} />
              </Tooltip>
            )}
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          {models.length > 1 && onSelectProvider && (
            <Select size="small" value={selectedProvider} style={{ width: 120 }}
              onChange={onSelectProvider}
              options={models.map(m => ({ value: m.provider, label: m.label }))}
            />
          )}
          <Select size="small" value={session?.id} placeholder="选择窗口" style={{ width: 140 }}
            onChange={onSelectSession}
            options={sessions.map((s, i) => ({ value: s.id, label: s.title || `窗口 ${i + 1}` }))}
            suffixIcon={<UnorderedListOutlined />}
          />
          <Button size="small" icon={<PlusOutlined />} onClick={onCreateSession}>新窗口</Button>
          {session && (
            <Popconfirm title="确定删除该窗口？" description="窗口内的对话记录将一并删除"
              onConfirm={() => onDeleteSession(session.id)} okText="删除" cancelText="取消" okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;

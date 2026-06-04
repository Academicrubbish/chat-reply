import React, { useState, useCallback } from 'react';
import { Drawer, Card, Tag, Collapse, Empty, Divider, Tooltip, Modal, Tabs, Button, Descriptions, Spin } from 'antd';
import { LikeOutlined, WarningOutlined, BulbOutlined, AimOutlined, HeartOutlined, HeartFilled, SmileOutlined, CheckCircleFilled, LoadingOutlined, HistoryOutlined, SafetyCertificateOutlined, RadarChartOutlined, BarChartOutlined, CheckOutlined, CloseOutlined, InfoCircleOutlined, MessageOutlined, EyeOutlined, PaperClipOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { AdvisorAnalysis, ReviewAnalysis, ReviewScores, AnalysisRecord, TargetDiagnosis } from '../types';
import { getKnowledgeUnit } from '../services/api';

// ===== Analysis Step Chain =====
type AnalysisStep = 'idle' | 'analyzing' | 'generating' | 'parsing' | 'done';

const ANALYSIS_STEP_ITEMS = [
  { key: 'analyzing', label: '收集数据' },
  { key: 'generating', label: '深度分析' },
  { key: 'parsing', label: '生成报告' },
];

export function AnalysisSteps({ currentStep }: { currentStep: AnalysisStep }) {
  const stepOrder: Record<string, number> = { idle: -1, analyzing: 0, generating: 1, parsing: 2, done: 3 };
  const activeIdx = stepOrder[currentStep] ?? -1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {ANALYSIS_STEP_ITEMS.map((item, idx) => {
        const isDone = idx < activeIdx;
        const isActive = idx === activeIdx;
        return (
          <div key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 36 }}>
              {isDone ? (
                <CheckCircleFilled style={{ fontSize: 16, color: '#52c41a' }} />
              ) : isActive ? (
                <LoadingOutlined style={{ fontSize: 16, color: '#1677ff', marginRight: 0 }} spin />
              ) : (
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #d9d9d9', background: '#fff' }} />
              )}
              {idx < ANALYSIS_STEP_ITEMS.length - 1 && (
                <div style={{ width: 2, flex: 1, minHeight: 14, background: isDone ? '#52c41a' : '#f0f0f0', marginTop: 2 }} />
              )}
            </div>
            <span style={{
              fontSize: 13, lineHeight: '20px',
              color: isDone ? '#52c41a' : isActive ? '#1677ff' : '#999',
              fontWeight: isActive ? 600 : 400,
            }}>
              {item.label}{isActive ? ' 处理中...' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ===== 五维雷达图 =====
function RadarChart({ scores }: { scores: ReviewScores }) {
  const dims = [
    { key: 'signalRecognition', label: '信号识别' },
    { key: 'strategySelection', label: '策略选择' },
    { key: 'rhythmControl', label: '节奏控制' },
    { key: 'emotionManagement', label: '情绪管理' },
    { key: 'responseQuality', label: '回应质量' },
  ] as const;

  const cx = 100, cy = 100, R = 72;
  const n = dims.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const getPoint = (i: number, r: number) => ({
    x: cx + r * Math.cos(startAngle + i * angleStep),
    y: cy + r * Math.sin(startAngle + i * angleStep),
  });

  const polygon = (r: number) => dims.map((_, i) => { const p = getPoint(i, r); return `${p.x},${p.y}`; }).join(' ');
  const dataPoints = dims.map((d, i) => {
    const v = (scores as any)[d.key] ?? 0;
    const r = R * (v / 5);
    return getPoint(i, r);
  });

  const avg = dims.reduce((s, d) => s + ((scores as any)[d.key] ?? 0), 0) / n;
  const color = avg >= 4 ? '#52c41a' : avg >= 3 ? '#1677ff' : avg >= 2 ? '#fa8c16' : '#f5222d';

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={200} height={200} viewBox="0 0 200 200"
        role="img"
        aria-label={`五维雷达图: 信号识别${scores.signalRecognition}, 策略选择${scores.strategySelection}, 节奏控制${scores.rhythmControl}, 情绪管理${scores.emotionManagement}, 回应质量${scores.responseQuality}`}
      >
        {/* Grid rings */}
        {[1, 2, 3, 4, 5].map(level => (
          <polygon key={level} points={polygon(R * level / 5)} fill="none" stroke="#e8e8e8" strokeWidth={0.5} />
        ))}
        {/* Axes */}
        {dims.map((_, i) => {
          const p = getPoint(i, R);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e8e8e8" strokeWidth={0.5} />;
        })}
        {/* Data polygon */}
        <polygon points={dataPoints.map(p => `${p.x},${p.y}`).join(' ')} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />
        {/* Data dots + labels */}
        {dims.map((d, i) => {
          const p = dataPoints[i];
          const lp = getPoint(i, R + 16);
          const v = (scores as any)[d.key] ?? 0;
          return (
            <g key={d.key}>
              <circle cx={p.x} cy={p.y} r={3.5} fill={color} />
              <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 10, fill: '#666' }}>
                {d.label} {v}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ===== 知识单元标签（点击查看详情）=====
const UNIT_TYPE_MAP: Record<string, { label: string; color: string }> = {
  framework: { label: '框架', color: 'blue' },
  principle: { label: '原则', color: 'green' },
  scenario: { label: '场景', color: 'orange' },
  concept: { label: '概念', color: 'purple' },
};

function KnowledgeTag({ id }: { id: string }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = useCallback(async () => {
    setModalOpen(true);
    if (detail) return; // already loaded
    setLoading(true);
    try {
      const res = await getKnowledgeUnit(id);
      setDetail(res.unit);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id, detail]);

  const typeInfo = detail ? UNIT_TYPE_MAP[detail.type] : null;

  return (
    <>
      <Tooltip title={`点击查看知识单元 ${id}`}>
        <Tag
          onClick={handleClick}
          style={{ fontSize: 10, padding: '0 6px', lineHeight: '18px', cursor: 'pointer', background: '#e6f4ff', border: '1px solid #91caff' }}
        >
          {id}
        </Tag>
      </Tooltip>
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width="min(90vw, 640px)"
        title={detail ? `${detail.id} ${detail.title}` : `知识单元 ${id}`}
        styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : detail ? (
          <div>
            {typeInfo && <Tag color={typeInfo.color} style={{ marginBottom: 12 }}>{typeInfo.label}</Tag>}
            {detail.reading && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}><InfoCircleOutlined style={{ marginRight: 4 }} />原文引用</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, background: '#f6f8fa', padding: '8px 12px', borderRadius: 6 }}>{detail.reading}</div>
              </div>
            )}
            {detail.interpretation && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}><BulbOutlined style={{ marginRight: 4 }} />方法论</div>
                <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{detail.interpretation}</div>
              </div>
            )}
            {detail.execution?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}><AimOutlined style={{ marginRight: 4 }} />操作步骤</div>
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  {detail.execution.map((s: any, i: number) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 4 }}>
                      {s.action}
                      {s.stopCondition && <span style={{ color: '#fa8c16' }}>（判停：{s.stopCondition}）</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {detail.boundary?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}><WarningOutlined style={{ marginRight: 4 }} />边界条件</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#666' }}>{detail.boundary.join('；')}</div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载失败</div>
        )}
      </Modal>
    </>
  );
}

// ===== 警告徽章 =====
function WarningBadge({ level }: { level: 'green' | 'yellow' | 'red' }) {
  const config = {
    green: { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', icon: <CheckOutlined style={{ fontSize: 12 }} />, text: '状态健康' },
    yellow: { color: '#fa8c16', bg: '#fff7e6', border: '#ffd591', icon: <WarningOutlined style={{ fontSize: 12 }} />, text: '需要调整' },
    red: { color: '#f5222d', bg: '#fff1f0', border: '#ffa39e', icon: <CloseOutlined style={{ fontSize: 12 }} />, text: '存在风险' },
  }[level];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 12, background: config.bg, border: `1px solid ${config.border}`, fontSize: 12, color: config.color, fontWeight: 600 }}>
      {config.icon} {config.text}
    </div>
  );
}

// ===== 好感级别指示 =====
const ATTITUDE_LEVELS: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  '回应': { icon: <MessageOutlined style={{ fontSize: 12 }} />, color: '#1677ff', label: '基础回应' },
  '倾诉': { icon: <HeartOutlined style={{ fontSize: 12 }} />, color: '#722ed1', label: '主动倾诉' },
  '关注': { icon: <EyeOutlined style={{ fontSize: 12 }} />, color: '#fa8c16', label: '特别关注' },
  '依顺': { icon: <HeartFilled style={{ fontSize: 12 }} />, color: '#eb2f96', label: '好感依顺' },
};

// ===== Advisor View =====
function AdvisorView({ data }: { data: AdvisorAnalysis }) {
  const attitude = data.attitude || { status: '未知', detail: '', evidence: '' };
  const emotion = data.emotion || { type: '未知', detail: '', evidence: '' };
  const thought = data.thought || { intention: '', expectation: '', detail: '' };
  const nextStep = data.nextStep || { action: '', strategy: '', keyPoints: [], warnings: [] };
  const diagnosis = data.diagnosis;

  const levelInfo = ATTITUDE_LEVELS[attitude.level || ''] || { icon: <InfoCircleOutlined style={{ fontSize: 12 }} />, color: '#999', label: attitude.status || '未知' };

  const sections = [
    {
      key: 'attitude',
      label: <span><AimOutlined style={{ marginRight: 6 }} />态度分析</span>,
      children: (
        <div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            {attitude.level && (
              <Tag color={levelInfo.color} style={{ fontWeight: 600 }}>
                {levelInfo.icon} {attitude.level}
              </Tag>
            )}
            {!attitude.level && (
              <Tag color={attitude.status === '积极' ? 'green' : attitude.status === '消极' ? 'red' : 'orange'}>
                {attitude.status}
              </Tag>
            )}
            {attitude.languagePattern && (
              <Tag color="cyan" style={{ fontSize: 11 }}><MessageOutlined style={{ marginRight: 4, fontSize: 10 }} />{attitude.languagePattern}</Tag>
            )}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{attitude.detail}</div>
          {attitude.evidence && (
            <div style={{ fontSize: 12, color: '#888', background: '#f6f8fa', padding: '6px 10px', borderRadius: 6 }}>
              <PaperClipOutlined style={{ marginRight: 4 }} />{attitude.evidence}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'emotion',
      label: <span><HeartOutlined style={{ marginRight: 6 }} />情绪判断</span>,
      children: (
        <div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <Tag color="purple">{emotion.type}</Tag>
            {emotion.valence && (
              <Tag color={emotion.valence === '正向' ? 'green' : emotion.valence === '负向' ? 'red' : 'default'}>
                {emotion.valence}
              </Tag>
            )}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{emotion.detail}</div>
          {emotion.evidence && (
            <div style={{ fontSize: 12, color: '#888', background: '#f6f8fa', padding: '6px 10px', borderRadius: 6 }}>
              <PaperClipOutlined style={{ marginRight: 4 }} /> {emotion.evidence}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'thought',
      label: <span><SmileOutlined style={{ marginRight: 6 }} />想法推测</span>,
      children: (
        <div>
          <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
            <strong>可能的意图：</strong>{thought.intention}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
            <strong>可能期待：</strong>{thought.expectation}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{thought.detail}</div>
        </div>
      ),
    },
  ];

  // 诊断块
  const diagnosisSection = diagnosis ? {
    key: 'diagnosis',
    label: <span><SafetyCertificateOutlined style={{ marginRight: 6 }} />关系诊断</span>,
    children: (
      <div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          {diagnosis.stage && <Tag color="blue"><EnvironmentOutlined style={{ marginRight: 4, fontSize: 10 }} />{diagnosis.stage}</Tag>}
          <Tag color={diagnosis.upgradeReady ? 'green' : 'default'}>
            {diagnosis.upgradeReady ? '可升级' : '暂不宜升级'}
          </Tag>
        </div>
        {diagnosis.upgradeReason && (
          <div style={{ fontSize: 12, color: '#666', marginBottom: 8, lineHeight: 1.5 }}>
            {diagnosis.upgradeReason}
          </div>
        )}
        {diagnosis.warnings?.length > 0 && (
          <div style={{ marginBottom: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {diagnosis.warnings.map((w, i) => (
              <Tag key={i} color="warning" icon={<WarningOutlined />}>{w}</Tag>
            ))}
          </div>
        )}
        {diagnosis.knowledgeIds?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {diagnosis.knowledgeIds.map((kid) => <KnowledgeTag key={kid} id={kid} />)}
          </div>
        )}
      </div>
    ),
  } : null;

  if (diagnosisSection) sections.push(diagnosisSection as any);

  return (
    <div>
      <Collapse items={sections} defaultActiveKey={['attitude', 'emotion', 'thought', ...(diagnosis ? ['diagnosis'] : [])]} ghost style={{ marginBottom: 16 }} />

      {nextStep && (nextStep.action || nextStep.strategy) && (
        <Card
          size="small"
          title={<span><BulbOutlined style={{ marginRight: 6, color: '#fa8c16' }} />下一步方案</span>}
          style={{ background: '#fffbe6', border: '1px solid #ffe58f' }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{nextStep.action}</div>
          <Tag color="blue" style={{ marginBottom: 6 }}>策略：{nextStep.strategy}</Tag>
          {nextStep.keyPoints?.length > 0 && (
            <ul style={{ paddingLeft: 16, margin: '8px 0' }}>
              {nextStep.keyPoints.map((p, i) => <li key={i} style={{ fontSize: 12, lineHeight: 1.6 }}>{p}</li>)}
            </ul>
          )}
          {nextStep.warnings?.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {nextStep.warnings.map((w, i) => (
                <Tag key={i} color="warning" icon={<WarningOutlined />}>{w}</Tag>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ===== Review View =====
function ReviewView({ data }: { data: ReviewAnalysis }) {
  const overall = data.overall || { score: 0, total: 0, summary: '', strengths: [], weaknesses: [], advice: '' };
  const highlights = data.highlights || [];
  const mistakes = data.mistakes || [];
  const scores = data.scores;
  const score = overall.total ?? overall.score;
  const scoreColor = score >= 75 ? '#52c41a' : score >= 50 ? '#fa8c16' : '#f5222d';

  return (
    <div>
      {/* Warning Level Badge */}
      {overall.warningLevel && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <WarningBadge level={overall.warningLevel} />
        </div>
      )}

      {/* Radar Chart + Score */}
      {scores ? (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: scoreColor }}>{score}</div>
            <div style={{ fontSize: 12, color: '#999' }}>综合评分</div>
          </div>
          <RadarChart scores={scores} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: scoreColor }}>{score}</div>
          <div style={{ fontSize: 12, color: '#999' }}>综合评分</div>
        </div>
      )}

      {overall.summary && (
        <div style={{ fontSize: 13, lineHeight: 1.6, textAlign: 'center', marginBottom: 16, color: '#333' }}>
          {overall.summary}
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#52c41a', fontWeight: 600, marginBottom: 4 }}>优势</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {overall.strengths?.map((s, i) => <Tag key={i} color="success">{s}</Tag>)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 12, color: '#fa8c16', fontWeight: 600, marginBottom: 4 }}>待提升</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {overall.weaknesses?.map((w, i) => <Tag key={i} color="warning">{w}</Tag>)}
          </div>
        </div>
      </div>

      {/* Knowledge Gaps */}
      {overall.knowledgeGaps && overall.knowledgeGaps.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 600, marginBottom: 4 }}>
            <RadarChartOutlined style={{ marginRight: 4 }} />建议补强的知识
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {overall.knowledgeGaps.map((kid: string) => <KnowledgeTag key={kid} id={kid} />)}
          </div>
        </div>
      )}

      <Divider style={{ margin: '12px 0' }} />

      {/* Highlights */}
      {highlights.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#52c41a', marginBottom: 8 }}>
            <LikeOutlined style={{ marginRight: 4 }} />亮点 ({highlights.length})
          </div>
          {highlights.map((h, i) => (
            <Card key={i} size="small" style={{ marginBottom: 6, borderLeft: '3px solid #52c41a', background: '#f6ffed' }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>Round {h.round}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{h.action}</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>{h.whyGood || h.why}</div>
              {h.tip && <div style={{ fontSize: 12, color: '#52c41a' }}><BulbOutlined style={{ marginRight: 4 }} />{h.tip}</div>}
            </Card>
          ))}
        </div>
      )}

      {/* Mistakes */}
      {mistakes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fa8c16', marginBottom: 8 }}>
            <WarningOutlined style={{ marginRight: 4 }} />踩坑 ({mistakes.length})
          </div>
          {mistakes.map((m, i) => (
            <Card key={i} size="small" style={{ marginBottom: 6, borderLeft: '3px solid #fa8c16', background: '#fff7e6' }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>Round {m.round}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{m.action}</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>{m.whyBad || m.why}</div>
              {m.better && <div style={{ fontSize: 12, color: '#1677ff' }}>更好的做法：{m.better}</div>}
            </Card>
          ))}
        </div>
      )}

      {/* Advice */}
      {overall.advice && (
        <Card size="small" style={{ background: '#f0f5ff', border: '1px solid #adc6ff', marginTop: 8 }}>
          <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 600, marginBottom: 4 }}>
            <BulbOutlined style={{ marginRight: 4 }} />进阶建议
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{overall.advice}</div>
        </Card>
      )}
    </div>
  );
}

// ===== History List =====
function HistoryList({ history, onSelect }: { history: AnalysisRecord[]; onSelect: (record: AnalysisRecord) => void }) {
  if (history.length === 0) return null;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div>
      <Divider style={{ margin: '16px 0 8px' }}>
        <span style={{ fontSize: 11, color: '#999' }}><HistoryOutlined style={{ marginRight: 4 }} />历史记录</span>
      </Divider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {history.map((record) => (
          <div
            key={record.id}
            onClick={() => onSelect(record)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
              background: '#fafafa', border: '1px solid #eee',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b5998'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#eee'; }}
          >
            <span style={{ fontSize: 14 }}>{record.msg_type === 'advisor' ? <AimOutlined /> : <BarChartOutlined />}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#333' }}>
              {record.msg_type === 'advisor' ? '军师分析' : '复盘总结'}
            </span>
            <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>{formatTime(record.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Main Drawer =====
interface AnalysisDrawerProps {
  open: boolean;
  onClose: () => void;
  analysisMode: 'advisor' | 'review' | null;
  result: AdvisorAnalysis | ReviewAnalysis | null;
  targetName: string;
  history: AnalysisRecord[];
  onSelectHistory: (record: AnalysisRecord) => void;
}

const AnalysisDrawer: React.FC<AnalysisDrawerProps> = ({
  open, onClose, analysisMode, result, targetName,
  history, onSelectHistory,
}) => {
  const title = analysisMode === 'advisor'
    ? `军师分析 — ${targetName}`
    : analysisMode === 'review'
      ? `复盘总结 — ${targetName}`
      : `历史记录 — ${targetName}`;

  return (
    <Drawer
      title={title}
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: '16px 20px', overflowY: 'auto' } }}
    >
      {result ? (
        analysisMode === 'advisor' ? (
          <AdvisorView data={result as AdvisorAnalysis} />
        ) : (
          <ReviewView data={result as ReviewAnalysis} />
        )
      ) : history.length > 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontSize: 13 }}>
          点击下方历史记录查看分析结果
        </div>
      ) : (
        <Empty description="暂无分析结果" />
      )}

      <HistoryList history={history} onSelect={onSelectHistory} />
    </Drawer>
  );
};

export default AnalysisDrawer;

// ===== Diagnosis Tab =====
function DiagnosisTab({
  diagnosis,
  diagnosisHistory = [],
  isDiagnosing,
  onDiagnose,
}: {
  diagnosis: TargetDiagnosis | null;
  diagnosisHistory?: TargetDiagnosis[];
  isDiagnosing: boolean;
  onDiagnose: () => void;
}) {
  if (isDiagnosing) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#999' }}>正在制定方案...</div>
      </div>
    );
  }

  if (!diagnosis) {
    return (
      <Empty description="暂无诊断方案">
        <Button type="primary" onClick={onDiagnose}>
          立即制定方案
        </Button>
      </Empty>
    );
  }

  return (
    <div>
      <Descriptions column={window.innerWidth < 500 ? 1 : 2} bordered size="small">
        <Descriptions.Item label="关系阶段">
          <Tag color="blue">{diagnosis.stage}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="推荐策略">
          <Tag color="green">{diagnosis.strategy}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="对方态度">{diagnosis.attitude_level}</Descriptions.Item>
        <Descriptions.Item label="情绪状态">{diagnosis.emotion_type}</Descriptions.Item>
        <Descriptions.Item label="语言模式">{diagnosis.language_pattern}</Descriptions.Item>
        <Descriptions.Item label="情绪倾向">
          <Tag color={diagnosis.emotion_valence === '正向' ? 'green' : diagnosis.emotion_valence === '负向' ? 'red' : 'default'}>
            {diagnosis.emotion_valence}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="可升级">
          <Tag color={diagnosis.upgrade_ready ? 'green' : 'default'}>
            {diagnosis.upgrade_ready ? '是' : '否'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="升级原因">{diagnosis.upgrade_reason || '—'}</Descriptions.Item>
        <Descriptions.Item label="建议行动" span={2}>{diagnosis.action}</Descriptions.Item>
      </Descriptions>

      {diagnosis.warnings?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            <WarningOutlined style={{ marginRight: 4, color: '#fa8c16' }} />注意事项
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {diagnosis.warnings.map((w, i) => (
              <Tag key={i} color="warning">{w}</Tag>
            ))}
          </div>
        </div>
      )}

      {diagnosis.knowledgeIds?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            <SafetyCertificateOutlined style={{ marginRight: 4, color: '#1677ff' }} />关联知识
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {diagnosis.knowledgeIds.map((kid) => <KnowledgeTag key={kid} id={kid} />)}
          </div>
        </div>
      )}

      {/* 诊断历史 */}
      {diagnosisHistory.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <Divider style={{ margin: '8px 0' }}>
            <span style={{ fontSize: 11, color: '#999' }}><HistoryOutlined style={{ marginRight: 4 }} />历史诊断</span>
          </Divider>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
            {diagnosisHistory.filter(d => d.id !== diagnosis?.id).map((record) => {
              const d = new Date(record.created_at);
              const timeStr = `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              return (
                <div key={record.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 6, background: '#fafafa', border: '1px solid #eee', fontSize: 12,
                }}>
                  <AimOutlined />
                  <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{record.stage}</Tag>
                  <span style={{ color: '#666', flex: 1 }}>{record.strategy}</span>
                  <span style={{ color: '#999', fontSize: 11 }}>{timeStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button onClick={onDiagnose} loading={isDiagnosing}>重新诊断</Button>
      </div>
    </div>
  );
}

// ===== Analysis Modal (定制方案 + 军师分析) =====
export interface AnalysisModalProps {
  open: boolean;
  onClose: () => void;
  targetName: string;
  // Diagnosis
  activeDiagnosis: TargetDiagnosis | null;
  diagnosisHistory?: TargetDiagnosis[];
  isDiagnosing: boolean;
  onDiagnose: () => void;
  // Advisor analysis
  advisorResult: AdvisorAnalysis | null;
  isAnalyzing: boolean;
  analysisMode: 'advisor' | 'review' | null;
  onTriggerAnalysis: (mode: 'advisor' | 'review') => void;
  // History
  history: AnalysisRecord[];
  onSelectHistory: (record: AnalysisRecord) => void;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  open, onClose, targetName,
  activeDiagnosis, diagnosisHistory, isDiagnosing, onDiagnose,
  advisorResult, isAnalyzing, analysisMode, onTriggerAnalysis,
  history, onSelectHistory,
}) => {
  const [activeTab, setActiveTab] = useState('diagnosis');
  const advisorHistory = history.filter(h => h.msg_type === 'advisor');

  // Only show advisor result when it's actually an advisor analysis
  const isAdvisorResult = analysisMode === 'advisor' && advisorResult;

  const handleSelectHistory = (record: AnalysisRecord) => {
    onSelectHistory(record);
    if (record.msg_type === 'advisor') setActiveTab('advisor');
  };

  return (
    <Modal
      title={`${targetName} 的分析方案`}
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(90vw, 900px)"
      styles={{ body: { padding: '12px 0', maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ padding: '0 24px' }}
        items={[
          {
            key: 'diagnosis',
            label: (
              <span>
                <AimOutlined /> 定制方案
                {activeDiagnosis && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>已制定</Tag>}
              </span>
            ),
            children: (
              <DiagnosisTab
                diagnosis={activeDiagnosis}
                diagnosisHistory={diagnosisHistory}
                isDiagnosing={isDiagnosing}
                onDiagnose={onDiagnose}
              />
            ),
          },
          {
            key: 'advisor',
            label: (
              <span>
                <BulbOutlined /> 军师分析
                {isAnalyzing && analysisMode === 'advisor' && <LoadingOutlined style={{ marginLeft: 4, color: '#1677ff' }} spin />}
              </span>
            ),
            children: (
              <div>
                {isAnalyzing && analysisMode === 'advisor' ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16, color: '#999' }}>军师分析中...</div>
                  </div>
                ) : isAdvisorResult ? (
                  <AdvisorView data={advisorResult} />
                ) : (
                  <Empty description="暂无军师分析">
                    <Button onClick={() => onTriggerAnalysis('advisor')}>开始分析</Button>
                  </Empty>
                )}
                <HistoryList history={advisorHistory} onSelect={handleSelectHistory} />
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};

// ===== Review Modal (独立复盘弹窗) =====
export interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  targetName: string;
  isAnalyzing: boolean;
  analysisMode: 'advisor' | 'review' | null;
  analysisStep: 'idle' | 'analyzing' | 'generating' | 'parsing' | 'done';
  onTriggerReview: () => void;
  history: AnalysisRecord[];
  onSelectHistory: (record: AnalysisRecord) => void;
  currentResult: ReviewAnalysis | null;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  open, onClose, targetName,
  isAnalyzing, analysisMode, analysisStep,
  onTriggerReview, history, onSelectHistory, currentResult,
}) => {
  const reviewHistory = history.filter(h => h.msg_type === 'review');

  // Latest review: prefer currentResult (user-selected or freshly analyzed), fallback to history
  const latestFromHistory = reviewHistory[0]
    ? (() => { try { return JSON.parse(reviewHistory[0].content) as ReviewAnalysis; } catch { return null; } })()
    : null;
  const reviewResult = currentResult || latestFromHistory;

  const handleSelectHistory = (record: AnalysisRecord) => {
    onSelectHistory(record);
  };

  const isReviewAnalyzing = isAnalyzing && analysisMode === 'review';

  return (
    <Modal
      title={`${targetName} 的复盘总结`}
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(90vw, 900px)"
      styles={{ body: { padding: '16px 24px', maxHeight: '75vh', overflowY: 'auto' } }}
    >
      {isReviewAnalyzing ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <AnalysisSteps currentStep={analysisStep} />
          <div style={{ marginTop: 16, color: '#999' }}>复盘分析中...</div>
        </div>
      ) : reviewResult ? (
        <ReviewView data={reviewResult} />
      ) : (
        <Empty description="暂无复盘总结">
          <Button type="primary" onClick={onTriggerReview}>开始复盘</Button>
        </Empty>
      )}

      {/* 复盘/重新复盘按钮 */}
      <div style={{ marginTop: 16, textAlign: 'right', borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
        <Button
          type={reviewResult ? 'default' : 'primary'}
          icon={<BarChartOutlined />}
          loading={isReviewAnalyzing}
          onClick={onTriggerReview}
        >
          {reviewResult ? '重新复盘' : '开始复盘'}
        </Button>
      </div>

      <HistoryList history={reviewHistory} onSelect={handleSelectHistory} />
    </Modal>
  );
};

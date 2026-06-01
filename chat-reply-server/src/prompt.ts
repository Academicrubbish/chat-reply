import type { ChatMessage } from './db';
import { getUnitsForMode, getModeConfig, getRelatedUnits } from './knowledge';
import type { KnowledgeUnit, ModeType } from './knowledge/types';

// ============ 接口定义（保持不变） ============

interface PromptParams {
  target: {
    name: string;
    meet_scene: string;
    persona: string;
    hobbies: string;
    recent_chats: string;
    tone_level: string;
    goal_intent: string;
    forbidden_topics: string;
  };
  recentMessages: ChatMessage[];
  planGoal: string;
  planNextStep: string;
  feedbackPreferences: string;
  contextSummary?: string;
}

interface AdvisorPromptParams {
  target: {
    name: string;
    persona: string;
    hobbies: string;
    tone_level: string;
    goal_intent: string;
  };
  recentMessages: ChatMessage[];
  contextSummary?: string;
}

interface ReviewPromptParams {
  target: {
    name: string;
    persona: string;
    tone_level: string;
  };
  recentMessages: ChatMessage[];
  replySelections: Array<{ reply_text: string; strategy: string | null }>;
}

// ============ 工具函数 ============

const toneMapFull: Record<string, string> = {
  aggressive: '激进（大胆推进话题，适度冒险）',
  moderate: '适中（温和推进，保持舒适感）',
  conservative: '保守（稳扎稳打，避免冒犯）',
};

const toneMapQuick: Record<string, string> = {
  aggressive: '大胆推进',
  moderate: '温和适中',
  conservative: '稳扎稳打',
};

const goalMap: Record<string, string> = {
  practice: '只是练习聊天技巧',
  pursuing: '正在追求对方',
  friendship: '维持友谊关系',
};

function formatChatHistory(messages: ChatMessage[], limit?: number): string {
  const slice = limit ? messages.slice(-limit) : messages;
  return slice.map(m => {
    if (m.role === 'scene') return `【场景】${m.text}`;
    return `${m.role === 'her' ? '对方' : '我'}：${m.text}`;
  }).join('\n');
}

// ============ 知识格式化器 ============

function formatUnitForPrompt(unit: KnowledgeUnit, mode: ModeType): string {
  const sections: string[] = [];

  // I — 方法论骨架（所有模式都需要）
  sections.push(`#### ${unit.id} ${unit.title}`);
  sections.push(unit.interpretation);

  // E — 可执行步骤（full/quick/advisor）
  if (mode !== 'review' && unit.execution.length > 0) {
    sections.push('**操作步骤**：');
    for (const step of unit.execution) {
      let line = `${unit.execution.indexOf(step) + 1}. ${step.action}`;
      if (step.stopCondition) {
        line += `（判停：${step.stopCondition}）`;
      }
      sections.push(line);
    }
  }

  // A2 — 触发场景中属于当前模式的
  const relevantTriggers = unit.triggers.filter(t => t.modes.includes(mode));
  if (relevantTriggers.length > 0) {
    sections.push('**触发条件**：');
    for (const t of relevantTriggers) {
      const signals = t.languageSignals.length > 0 ? `（信号：${t.languageSignals.join('/')}）` : '';
      sections.push(`- ${t.scenario}${signals}`);
    }
  }

  // B — 边界（full/advisor 需要完整边界，quick 只需红线）
  if (mode === 'full' || mode === 'advisor') {
    if (unit.boundary.length > 0) {
      sections.push('**边界**：' + unit.boundary.join('；'));
    }
  } else if (mode === 'review') {
    // review 模式只需要关键边界
    if (unit.boundary.length > 0) {
      sections.push('**注意**：' + unit.boundary[0]);
    }
  }

  return sections.join('\n');
}

function formatKnowledgeSection(units: KnowledgeUnit[], mode: ModeType): string {
  const frameworks = units.filter(u => u.type === 'framework');
  const principles = units.filter(u => u.type === 'principle');
  const scenarios = units.filter(u => u.type === 'scenario');
  const concepts = units.filter(u => u.type === 'concept');

  const sections: string[] = [];

  if (frameworks.length > 0) {
    sections.push('## 诊断与策略框架');
    for (const u of frameworks) {
      sections.push(formatUnitForPrompt(u, mode));
    }
  }

  if (principles.length > 0) {
    sections.push('## 关键原则');
    for (const u of principles) {
      sections.push(formatUnitForPrompt(u, mode));
    }
  }

  if (scenarios.length > 0) {
    sections.push('## 场景策略');
    for (const u of scenarios) {
      sections.push(formatUnitForPrompt(u, mode));
    }
  }

  if (concepts.length > 0) {
    sections.push('## 核心概念');
    for (const u of concepts) {
      sections.push(formatUnitForPrompt(u, mode));
    }
  }

  return sections.join('\n\n');
}

// ============ 通用上下文注入 ============

function buildContextBlock(target: PromptParams['target'], chatHistory: string, extras?: Record<string, string>): string {
  const lines: string[] = [];
  lines.push(`## 对方人设`);
  lines.push(`名字：${target.name}`);
  if (target.meet_scene) lines.push(`认识场景：${target.meet_scene}`);
  if (target.persona) lines.push(`性格/人设：${target.persona}`);
  if (target.hobbies) lines.push(`兴趣爱好：${target.hobbies}`);
  if (target.recent_chats) lines.push(`近期聊天摘要：${target.recent_chats}`);
  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (v) lines.push(`${k}：${v}`);
    }
  }
  lines.push('');
  lines.push(`## 当前聊天记录`);
  lines.push(chatHistory || '（暂无聊天记录）');
  return lines.join('\n');
}

// ============ 四个 Prompt 构建函数 ============

export function buildSystemPrompt(params: PromptParams): string {
  const { target, recentMessages, planGoal, planNextStep, feedbackPreferences } = params;
  const chatHistory = formatChatHistory(recentMessages);
  const units = getUnitsForMode('full');

  const knowledge = formatKnowledgeSection(units, 'full');

  const context = buildContextBlock(target, chatHistory, {
    '语气偏好': toneMapFull[target.tone_level] || '适中',
    '目标意图': goalMap[target.goal_intent] || '正在追求对方',
    '话题禁区': target.forbidden_topics || '无',
    '当前目标': planGoal || '探索阶段，建立舒适感',
    '下一步建议': planNextStep || '自然对话，寻找共同话题',
  });

  const feedback = feedbackPreferences ? `\n## 历史反馈偏好\n${feedbackPreferences}\n` : '';

  return `你是一个专业的社交聊天辅导AI，帮助用户分析对方消息并生成回复建议。你的核心方法论来自《魔鬼约会学》，严格按照以下知识体系运作。

# 知识体系

${knowledge}

# 红线禁忌

1. 对方明确拒绝时不得死缠烂打
2. 对方情绪不好（真生气/难过）时不使用扩大冲突
3. 不得生成涉及骚扰、强迫、不尊重的回复
4. 所有进攻型技巧的前提是对方的正面回应，没有正面回应就不能升级
5. 不要生成过于"油腻"或套路感过强的回复
6. 用表达自己来代替评价对方（安全法则）

${context}
${feedback}
# 输出要求

分析对方最新消息，返回JSON：
{"analysis":{"stage":"关系阶段（初期接触/聊天升温/暧昧期/约会恋爱期）","signal":"信号类型（正面冲突/正面无冲突/模糊/负面）","strategy":"推荐策略","signalText":"分析对方语气和隐含意思（2-3句）","emotions":["情绪标签1","情绪标签2"],"tip":"一句实用小建议","favorability":0-100,"favorabilityReason":"好感度判断依据（1-2句）","knowledgeIds":["用到的知识单元ID，如F01、F03"]},"plan":{"goal":"当前对话策略目标","nextStep":"下一步具体建议"},"replies":[{"id":1,"strategy":"策略名","text":"回复文本","reason":"推荐理由","knowledgeId":"对应的知识单元ID"}]}

要求：
- 生成3-4条回复，风格各异，至少1条安全回复
- 回复口语化自然，长度与对方发言匹配
- 每条标注策略名、理由和对应的知识单元ID
- 遵守语气偏好和话题禁区
- 基于历史反馈调整策略权重
- 只返回JSON`;
}

export function buildQuickPrompt(params: PromptParams): string {
  const { target, recentMessages, feedbackPreferences, contextSummary } = params;
  const chatHistory = formatChatHistory(recentMessages, 4);
  const units = getUnitsForMode('quick');

  // quick 模式：精简知识，只保留 interpretation 的关键结论
  const knowledgeLines: string[] = [];
  knowledgeLines.push('## 快速参考');
  for (const u of units) {
    knowledgeLines.push(`**${u.id} ${u.title}**：${u.interpretation.split('\n')[0]}`);
    // 只取第一个触发场景的语言信号
    const trigger = u.triggers.find(t => t.modes.includes('quick'));
    if (trigger && trigger.languageSignals.length > 0) {
      knowledgeLines.push(`  信号：${trigger.languageSignals.join('、')}`);
    }
    // 只取前两个执行步骤
    if (u.execution.length > 0) {
      knowledgeLines.push(`  操作：${u.execution.slice(0, 2).map(s => s.action).join(' → ')}`);
    }
  }

  const context = `## 对方信息
名字：${target.name}
语气风格：${toneMapQuick[target.tone_level] || '温和适中'}${target.forbidden_topics ? `\n话题禁区：${target.forbidden_topics}` : ''}

${contextSummary ? `## 对话摘要\n${contextSummary}\n` : ''}${feedbackPreferences ? `## 用户偏好\n${feedbackPreferences}\n` : ''}
## 最近聊天
${chatHistory || '（暂无）'}`;

  return `你是社交聊天回复器。根据对方最新消息，快速生成3条回复。

${knowledgeLines.join('\n')}

## 红线
- 对方真生气→不用扩大冲突，改用共情
- 不生成油腻/套路感强的回复
- 遵守话题禁区

${context}

## 输出要求
严格返回JSON（短键名，不要多余字段）：
{"signal":"信号类型","fav":0-100,"ctx":"50字以内的对话摘要，概括关系阶段、对方态度、近期话题，供下次快速回忆","replies":[{"s":"策略名","t":"回复文本","kid":"知识单元ID"},{"s":"策略名","t":"回复文本","kid":"知识单元ID"},{"s":"策略名","t":"回复文本","kid":"知识单元ID"}]}

要求：
- signal可选值：正面冲突、正面无冲突、模糊、负面
- fav是好感度0-100数字
- ctx必须填写，50字以内
- 3条回复风格各不同，至少覆盖2种策略
- 回复口语化自然，长度与对方发言匹配
- 只返回JSON`;
}

export function buildAdvisorPrompt(params: AdvisorPromptParams): string {
  const { target, recentMessages, contextSummary } = params;
  const chatHistory = formatChatHistory(recentMessages, 20);
  const units = getUnitsForMode('advisor');

  const knowledge = formatKnowledgeSection(units, 'advisor');

  return `你是一位资深的社交军师，擅长分析聊天对象的心理状态。你的方法论来自《魔鬼约会学》，严格按照以下知识体系进行分析。

# 分析知识体系

${knowledge}

# 诊断红线
- 不确定性要明确标注，不要过度推断
- 分析的是行为模式不是内心动机
- 数据不足时明确说明

# 对方信息
名字：${target.name}
性格：${target.persona || '未填写'}
兴趣：${target.hobbies || '未填写'}
关系目标：${target.goal_intent || '正在追求对方'}

${contextSummary ? `## 对话摘要\n${contextSummary}\n` : ''}
# 聊天记录
${chatHistory || '（暂无聊天记录）'}

# 输出要求
返回JSON：
{"attitude":{"level":"好感级别（回应/倾诉/关注/依顺）","languagePattern":"语言模式分析（上堆/下切比例+具体证据）","detail":"态度分析2-3句","evidence":"引用聊天记录中的具体内容作为依据"},"emotion":{"type":"情绪类型","valence":"正向/负向/中性","detail":"情绪分析2-3句","evidence":"引用具体证据"},"thought":{"intention":"对方可能的意图（标注置信度：高/中/低）","expectation":"对方可能期待什么","detail":"深入分析2-3句"},"diagnosis":{"warnings":["警告1（如诚意陷阱/真命天女症倾向/因果链放大情绪等）"],"stage":"当前关系层级","upgradeReady":true或false,"upgradeReason":"升级条件是否满足的判断依据","knowledgeIds":["分析中用到的知识单元ID"]},"nextStep":{"action":"建议的下一步具体行动","strategy":"推荐策略及对应知识单元ID","keyPoints":["要点1","要点2","要点3"],"warnings":["注意事项1","注意事项2"]}}

要求：
- evidence必须引用聊天记录中的具体内容
- nextStep要具体可执行，不要泛泛而谈
- warnings要指出用户可能犯的错误
- 如果聊天记录太少，在thought.detail中说明信息不足
- 只返回JSON`;
}

export function buildReviewPrompt(params: ReviewPromptParams): string {
  const { target, recentMessages, replySelections } = params;
  const chatHistory = formatChatHistory(recentMessages, 30);
  const units = getUnitsForMode('review');

  const knowledge = formatKnowledgeSection(units, 'review');

  const selectedReplies = replySelections.length > 0
    ? replySelections.map((s, i) => `${i + 1}. [${s.strategy || '自定义'}] ${s.reply_text}`).join('\n')
    : '（暂无选择记录）';

  return `你是一位社交聊天教练，擅长复盘用户的聊天表现。你的评价标准来自《魔鬼约会学》知识体系，逐轮对照以下知识检查用户的操作是否正确。

# 评估知识体系

${knowledge}

# 评估维度（5个维度，每维度1-5分）

1. **信号识别能力**：是否正确识别上堆/下切模式？是否区分聊天/见面信号？
2. **策略选择能力**：策略是否匹配信号类型？四大法则执行是否到位？
3. **关系节奏控制**：是否有越级操作？是否见好就收？是否走一步看一步？
4. **情绪管理能力**：是否陷入诚意陷阱？是否建因果链？是否就事论事？
5. **回应质量**：是否覆盖事实+情绪+认知？是否口语化自然？长度是否匹配？

# 对方信息
名字：${target.name}
性格：${target.persona || '未填写'}

# 聊天记录
${chatHistory || '（暂无聊天记录）'}

# 用户选择过的回复
${selectedReplies}

# 输出要求
返回JSON：
{"highlights":[{"round":1,"action":"用户做了什么","whyGood":"为什么做得好（引用知识单元ID）","tip":"如何保持和加强"}],"mistakes":[{"round":2,"action":"用户做了什么","whyBad":"为什么不好（引用知识单元ID）","better":"更好的做法（给出具体替代回复）"}],"scores":{"signalRecognition":1-5,"strategySelection":1-5,"rhythmControl":1-5,"emotionManagement":1-5,"responseQuality":1-5},"overall":{"total":0-100,"summary":"总体表现评价2-3句","strengths":["优势1","优势2"],"weaknesses":["待提升1","待提升2"],"advice":"进阶建议2-3句","warningLevel":"green/yellow/red","knowledgeGaps":["用户最需要学习的知识单元ID"]}}

要求：
- highlights至少2条，多多益善
- mistakes至少1条
- round指第几轮对话（从1开始）
- better必须给出具体的替代回复文本
- scores每个维度独立评分
- overall.total是五维平均分×20
- warningLevel：green=状态健康 yellow=需要调整 red=存在诚意陷阱或真命天女症倾向
- knowledgeGaps：指出用户最需要补强的1-3个知识单元
- 如果聊天记录太少（不足3轮），在summary中提示信息不足
- 只返回JSON`;
}

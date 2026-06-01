// 知识单元类型定义 — 基于 cangjie-skill RIA-TV++ 方法论

export type UnitType = 'framework' | 'principle' | 'scenario' | 'concept';
export type ModeType = 'full' | 'quick' | 'advisor' | 'review';
export type RelationType = 'depends-on' | 'contrasts-with' | 'composes-with';

export interface Trigger {
  scenario: string;      // 触发场景描述
  languageSignals: string[];  // 语言信号关键词
  modes: ModeType[];
}

export interface ExecutionStep {
  action: string;        // 步骤描述
  completionCriteria: string;  // 完成标准
  stopCondition?: string;      // 判停条件
}

export interface Case {
  title: string;
  problem: string;
  method: string;
  conclusion: string;
  result?: string;
}

export interface KnowledgeUnit {
  id: string;
  title: string;
  type: UnitType;
  modes: ModeType[];
  priority: number;      // 1-5, BOOK_OVERVIEW 中的应用潜力优先级

  // RIA++ 六段
  reading: string;           // R: 原文引用（≤150字 + 来源章节）
  interpretation: string;    // I: 方法论骨架（5-15行自述）
  cases: Case[];             // A1: 书中案例（1-3条）
  triggers: Trigger[];       // A2: 触发场景 + 语言信号 + 模式映射
  execution: ExecutionStep[];// E: 可执行步骤
  boundary: string[];        // B: 边界（何时不用 + 失败模式 + 作者盲点）

  // 关系
  dependsOn: string[];
  composesWith: string[];
  contrastsWith: string[];
}

export interface Relation {
  from: string;
  to: string;
  type: RelationType;
  description?: string;
}

export interface ModeConfig {
  mode: ModeType;
  label: string;
  description: string;
  activatedUnits: string[];  // 激活的知识单元 ID 列表
  outputTokenBudget: number;
  customInstructions: string;  // 模式专属指令
}

// 知识库完整类型
export interface KnowledgeBase {
  units: KnowledgeUnit[];
  relations: Relation[];
  modes: ModeConfig[];
}

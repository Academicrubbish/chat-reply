export interface ChatTarget {
  id: string;
  name: string;
  meet_scene: string;
  persona: string;
  attraction_score?: number | null;
  hobbies: string;
  recent_chats: string;
  tone_level: 'aggressive' | 'moderate' | 'conservative';
  goal_intent: 'practice' | 'pursuing' | 'friendship';
  forbidden_topics: string;
  created_at: number;
}

export interface ChatMessage {
  id: string;
  target_id: string;
  role: 'her' | 'me' | 'scene';
  text: string;
  source: '手动输入' | 'AI建议' | '自定义回复' | '历史记录' | '场景补充';
  strategy: string | null;
  session_id: string | null;
  created_at: number;
}

export interface AISession {
  id: string;
  target_id: string;
  title: string;
  is_active: number;
  round_count: number;
  context_tokens: number;
  plan_goal: string;
  plan_next_step: string;
  context_summary: string;
  created_at: number;
}

export interface AIMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  round_id: string | null;
  version: number;
  created_at: number;
}

export interface ReplySelection {
  id: string;
  session_id: string;
  ai_message_id: string;
  reply_id: number;
  reply_text: string;
  strategy: string | null;
  chat_message_id: string;
  created_at: number;
}

export interface AnalysisData {
  stage: string;
  signal: string;
  strategy: string;
  signalText: string;
  emotions: string[];
  tip: string;
  favorability: number;
  favorabilityReason: string;
}

export type GenerationStep = 'idle' | 'diagnosing' | 'analyze' | 'generating' | 'parsing' | 'done';

export interface FavorabilityRecord {
  value: number;
  reason: string;
  round: number;
}

export interface ReplyVersion {
  analysis: AnalysisData;
  replies: ReplyOption[];
  aiMessageId?: string;
  roundId?: string;
}

export interface ReplyOption {
  id: number;
  strategy: string;
  text: string;
  reason: string;
}

export interface GenerateResponse {
  analysis: AnalysisData;
  plan: {
    goal: string;
    nextStep: string;
  };
  contextUsage: {
    estimatedTokens: number;
    maxTokens: number;
    percentage: number;
  };
  replies: ReplyOption[];
  roundId?: string;
  version?: number;
}

export type GenerateMode = 'full' | 'quick';
export type AnalysisMode = 'advisor' | 'review';
export type AiMode = GenerateMode | AnalysisMode;

export interface AdvisorAnalysis {
  attitude: { status: string; level?: string; languagePattern?: string; detail: string; evidence: string };
  emotion: { type: string; valence?: string; detail: string; evidence: string };
  thought: { intention: string; expectation: string; detail: string };
  diagnosis?: {
    warnings: string[];
    stage: string;
    upgradeReady: boolean;
    upgradeReason: string;
    knowledgeIds: string[];
  };
  nextStep: { action: string; strategy: string; keyPoints: string[]; warnings: string[] };
}

export interface TargetDiagnosis {
  id: string;
  target_id: string;
  attitude_level: string;
  language_pattern: string;
  emotion_type: string;
  emotion_valence: string;
  stage: string;
  upgrade_ready: boolean;
  upgrade_reason: string;
  warnings: string[];
  action: string;
  strategy: string;
  knowledgeIds: string[];
  attraction?: { score: number; reason: string };
  created_at: number;
}

export interface ReviewScores {
  signalRecognition: number;
  strategySelection: number;
  rhythmControl: number;
  emotionManagement: number;
  responseQuality: number;
}

export interface ReviewAnalysis {
  highlights: Array<{ round: number; action: string; why: string; whyGood?: string; tip: string }>;
  mistakes: Array<{ round: number; action: string; why: string; whyBad?: string; better: string }>;
  scores?: ReviewScores;
  overall: {
    score: number;
    total?: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    advice: string;
    warningLevel?: 'green' | 'yellow' | 'red';
    knowledgeGaps?: string[];
  };
}

export interface AnalysisRecord {
  id: string;
  msg_type: 'advisor' | 'review';
  content: string;
  created_at: number;
}

export type AppPhase = 'idle' | 'her_sent' | 'generating' | 'waiting_select';

export interface ModelOption {
  provider: string;
  label: string;
  model: string;
}

export interface AppState {
  phase: AppPhase;
  generationStep: GenerationStep;
  targets: ChatTarget[];
  currentTargetId: string | null;
  messages: ChatMessage[];
  sessions: AISession[];
  currentSessionId: string | null;
  currentAnalysis: AnalysisData | null;
  currentReplies: ReplyOption[] | null;
  currentPlan: { goal: string; nextStep: string } | null;
  contextUsage: { estimatedTokens: number; maxTokens: number; percentage: number } | null;
  aiMessages: AIMessage[];
  streamingText: string;
  error: string | null;
  modalOpen: boolean;
  editingTarget: ChatTarget | null;
  favorabilityHistory: FavorabilityRecord[];
  attraction: { score: number; reason: string } | null;
  replyVersions: ReplyVersion[];
  activeVersionIndex: number;
  replySelections: ReplySelection[];
  analysisResult: AdvisorAnalysis | ReviewAnalysis | null;
  analysisMode: 'advisor' | 'review' | null;
  isAnalyzing: boolean;
  analysisStep: 'idle' | 'analyzing' | 'generating' | 'parsing' | 'done';
  analysisHistory: AnalysisRecord[];
  activeDiagnosis: TargetDiagnosis | null;
  isDiagnosing: boolean;
  diagnosisStep: 'idle' | 'analyzing' | 'generating' | 'parsing' | 'done';
  diagnosisHistory: TargetDiagnosis[];
  diagnosisJustGenerated: boolean;
  errorTimestamp: number | null;
}

export type AppAction =
  | { type: 'SET_TARGETS'; targets: ChatTarget[] }
  | { type: 'SELECT_TARGET'; targetId: string; messages: ChatMessage[]; sessions: AISession[] }
  | { type: 'SEND_HER_MESSAGE'; message: ChatMessage }
  | { type: 'TRIGGER_AI'; mode: AiMode }
  | { type: 'STREAM_REPLY_READY'; reply: ReplyOption; index: number }
  | { type: 'GENERATE_SUCCESS'; data: GenerateResponse }
  | { type: 'GENERATE_FAILURE'; error: string }
  | { type: 'CANCEL_GENERATION' }
  | { type: 'SELECT_REPLY'; message: ChatMessage }
  | { type: 'CUSTOM_REPLY'; message: ChatMessage }
  | { type: 'UPDATE_SESSIONS'; sessions: AISession[]; currentSessionId: string | null }
  | { type: 'SET_PLAN'; plan: { goal: string; nextStep: string } }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'OPEN_MODAL'; target?: ChatTarget | null }
  | { type: 'CLOSE_MODAL' }
  | { type: 'ADD_TARGET'; target: ChatTarget }
  | { type: 'UPDATE_TARGET'; target: ChatTarget }
  | { type: 'EDIT_MESSAGE'; id: string; text: string }
  | { type: 'DELETE_MESSAGE'; id: string }
  | { type: 'SET_AI_MESSAGES'; aiMessages: AIMessage[] }
  | { type: 'STREAM_ANALYSIS'; analysis: AnalysisData }
  | { type: 'STREAM_DELTA'; text: string }
  | { type: 'STREAM_REPLIES'; replies: ReplyOption[] }
  | { type: 'STREAM_DONE'; contextUsage: { estimatedTokens: number; maxTokens: number; percentage: number }; roundId?: string }
  | { type: 'SET_GENERATION_STEP'; step: GenerationStep }
  | { type: 'TRIGGER_REGENERATE' }
  | { type: 'SWITCH_VERSION'; index: number }
  | { type: 'ADVANCE_REGEN_STEP' }
  | { type: 'SET_REPLY_SELECTIONS'; selections: ReplySelection[] }
  | { type: 'TRIGGER_ANALYSIS'; analysisMode: 'advisor' | 'review' }
  | { type: 'ANALYSIS_SUCCESS'; analysisMode: 'advisor' | 'review'; data: any }
  | { type: 'ANALYSIS_FAILURE'; error: string }
  | { type: 'ANALYSIS_STEP'; step: 'analyzing' | 'generating' | 'parsing' | 'done' }
  | { type: 'ANALYSIS_DELTA'; text: string }
  | { type: 'SET_ANALYSIS_HISTORY'; history: AnalysisRecord[] }
  | { type: 'VIEW_HISTORY_ANALYSIS'; analysisMode: 'advisor' | 'review'; data: any }
  | { type: 'SET_ACTIVE_DIAGNOSIS'; diagnosis: TargetDiagnosis | null }
  | { type: 'TRIGGER_DIAGNOSE' }
  | { type: 'DIAGNOSIS_SUCCESS'; diagnosis: TargetDiagnosis }
  | { type: 'DIAGNOSIS_FAILURE'; error: string }
  | { type: 'DIAGNOSIS_STEP'; step: 'idle' | 'analyzing' | 'generating' | 'parsing' | 'done' }
  | { type: 'CLEAR_DIAGNOSIS' }
  | { type: 'SET_DIAGNOSIS_HISTORY'; history: TargetDiagnosis[] }
  | { type: 'SHOW_DIAGNOSIS' }
  | { type: 'DISMISS_DIAGNOSIS' }
  | { type: 'SET_ATTRACTION'; attraction: { score: number; reason: string } | null };

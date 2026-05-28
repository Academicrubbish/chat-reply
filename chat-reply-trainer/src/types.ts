export interface ChatTarget {
  id: string;
  name: string;
  meet_scene: string;
  persona: string;
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
  role: 'her' | 'me';
  text: string;
  source: '手动输入' | 'AI建议' | '自定义回复' | '历史记录';
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
  created_at: number;
}

export interface AIMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
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
}

export type AppPhase = 'idle' | 'her_sent' | 'generating' | 'waiting_select';

export interface AppState {
  phase: AppPhase;
  targets: ChatTarget[];
  currentTargetId: string | null;
  messages: ChatMessage[];
  sessions: AISession[];
  currentSessionId: string | null;
  currentAnalysis: AnalysisData | null;
  currentReplies: ReplyOption[] | null;
  currentPlan: { goal: string; nextStep: string } | null;
  contextUsage: { estimatedTokens: number; maxTokens: number; percentage: number } | null;
  error: string | null;
  modalOpen: boolean;
  editingTarget: ChatTarget | null;
}

export type AppAction =
  | { type: 'SET_TARGETS'; targets: ChatTarget[] }
  | { type: 'SELECT_TARGET'; targetId: string; messages: ChatMessage[]; sessions: AISession[] }
  | { type: 'SEND_HER_MESSAGE'; message: ChatMessage }
  | { type: 'TRIGGER_AI' }
  | { type: 'GENERATE_SUCCESS'; data: GenerateResponse }
  | { type: 'GENERATE_FAILURE'; error: string }
  | { type: 'SELECT_REPLY'; message: ChatMessage }
  | { type: 'CUSTOM_REPLY'; message: ChatMessage }
  | { type: 'UPDATE_SESSIONS'; sessions: AISession[]; currentSessionId: string }
  | { type: 'SET_PLAN'; plan: { goal: string; nextStep: string } }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'OPEN_MODAL'; target?: ChatTarget | null }
  | { type: 'CLOSE_MODAL' }
  | { type: 'ADD_TARGET'; target: ChatTarget }
  | { type: 'UPDATE_TARGET'; target: ChatTarget };

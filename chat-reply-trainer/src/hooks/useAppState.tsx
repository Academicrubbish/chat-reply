import { createContext, useContext, useReducer, useRef, useEffect, useState, type Dispatch, type ReactNode } from 'react';
import type { AppState, AppAction, ChatMessage, ModelOption, GenerationStep } from '../types';
import * as api from '../services/api';

const STEP_ORDER: Record<string, number> = { idle: 0, analyze: 1, generating: 2, parsing: 3, done: 4 };

const initialState: AppState = {
  phase: 'idle',
  generationStep: 'idle',
  targets: [],
  currentTargetId: null,
  messages: [],
  sessions: [],
  currentSessionId: null,
  currentAnalysis: null,
  currentReplies: null,
  currentPlan: null,
  contextUsage: null,
  aiMessages: [],
  streamingText: '',
  error: null,
  modalOpen: false,
  editingTarget: null,
  favorabilityHistory: [],
  replyVersions: [],
  activeVersionIndex: 0,
  replySelections: [],
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_TARGETS':
      return { ...state, targets: action.targets };
    case 'SELECT_TARGET': {
      const activeSession = action.sessions.find(s => s.is_active === 1);
      return {
        ...state,
        currentTargetId: action.targetId,
        messages: action.messages,
        sessions: action.sessions,
        currentSessionId: activeSession?.id || null,
        currentAnalysis: null,
        currentReplies: null,
        currentPlan: null,
        contextUsage: null,
        aiMessages: [],
        error: null,
        phase: 'idle',
        generationStep: 'idle',
        streamingText: '',
        favorabilityHistory: [],
      };
    }
    case 'SEND_HER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
        phase: action.message.role === 'her' ? 'her_sent' : state.phase,
        error: null,
      };
    case 'TRIGGER_AI':
      return {
        ...state,
        phase: 'generating',
        generationStep: action.mode === 'quick' ? 'generating' : 'analyze',
        streamingText: '', error: null, replyVersions: [], activeVersionIndex: 0,
      };
    case 'GENERATE_SUCCESS': {
      const { analysis, plan, contextUsage, replies, roundId } = action.data;
      const newHistory = analysis
        ? [...state.favorabilityHistory, {
            value: analysis.favorability,
            reason: analysis.favorabilityReason || '',
            round: state.favorabilityHistory.length + 1,
          }]
        : state.favorabilityHistory;
      const newVersion = { analysis, replies, roundId };
      const versions = state.replyVersions.length > 0
        ? [...state.replyVersions, newVersion]
        : [newVersion];
      return {
        ...state,
        phase: 'waiting_select',
        generationStep: 'done',
        currentAnalysis: analysis,
        currentReplies: replies,
        currentPlan: plan,
        contextUsage,
        error: null,
        favorabilityHistory: newHistory,
        replyVersions: versions,
        activeVersionIndex: versions.length - 1,
      };
    }
    case 'GENERATE_FAILURE':
      return { ...state, phase: 'waiting_select', generationStep: 'idle', streamingText: '', error: action.error };
    case 'STREAM_ANALYSIS': {
      const newHistory = [...state.favorabilityHistory, {
        value: action.analysis.favorability,
        reason: action.analysis.favorabilityReason || '',
        round: state.favorabilityHistory.length + 1,
      }];
      return { ...state, currentAnalysis: action.analysis, favorabilityHistory: newHistory };
    }
    case 'STREAM_DELTA': {
      // Only advance step forward, never backward — prevents skipping 'generating' on fast responses
      const nextStep = (STEP_ORDER[state.generationStep] ?? 0) < STEP_ORDER['parsing']
        ? 'parsing' as const
        : state.generationStep;
      return {
        ...state,
        generationStep: nextStep,
        streamingText: state.streamingText + action.text,
      };
    }
    case 'STREAM_REPLIES': {
      const newVersion = { analysis: state.currentAnalysis, replies: action.replies };
      const versions = state.replyVersions.length > 0
        ? [...state.replyVersions, newVersion]
        : [newVersion];
      return {
        ...state,
        phase: 'waiting_select',
        generationStep: 'done',
        currentReplies: action.replies,
        streamingText: '',
        error: null,
        replyVersions: versions,
        activeVersionIndex: versions.length - 1,
      };
    }
    case 'STREAM_REPLY_READY': {
      // Progressive: add individual reply as it arrives (quick mode only)
      const current = state.currentReplies || [];
      if (current.some(r => r.id === action.reply.id)) return state;
      const updated = [...current, action.reply];
      return {
        ...state,
        phase: 'waiting_select',
        currentReplies: updated,
        streamingText: '',
        replyVersions: state.replyVersions.length > 0
          ? state.replyVersions.map((v, i) =>
              i === state.replyVersions.length - 1 ? { ...v, replies: updated } : v)
          : [{ analysis: state.currentAnalysis, replies: updated }],
        activeVersionIndex: Math.max(0, state.replyVersions.length - 1),
      };
    }
    case 'STREAM_DONE': {
      // Attach roundId to the latest replyVersion if available
      const versions = state.replyVersions.length > 0
        ? state.replyVersions.map((v, i) =>
            i === state.replyVersions.length - 1 && action.roundId
              ? { ...v, roundId: action.roundId }
              : v
          )
        : state.replyVersions;
      return { ...state, phase: 'waiting_select', generationStep: 'done', contextUsage: action.contextUsage, replyVersions: versions };
    }
    case 'SET_GENERATION_STEP':
      return { ...state, generationStep: action.step };
    case 'SELECT_REPLY':
    case 'CUSTOM_REPLY':
      return {
        ...state,
        messages: [...state.messages, action.message],
        phase: 'idle',
        generationStep: 'idle',
        currentAnalysis: null,
        currentReplies: null,
        error: null,
        replyVersions: [],
        activeVersionIndex: 0,
      };
    case 'UPDATE_SESSIONS':
      return { ...state, sessions: action.sessions, currentSessionId: action.currentSessionId };
    case 'SET_AI_MESSAGES':
      return { ...state, aiMessages: action.aiMessages };
    case 'SET_REPLY_SELECTIONS':
      return { ...state, replySelections: action.selections };
    case 'SET_PLAN':
      return { ...state, currentPlan: action.plan };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'OPEN_MODAL':
      return { ...state, modalOpen: true, editingTarget: action.target || null };
    case 'CLOSE_MODAL':
      return { ...state, modalOpen: false, editingTarget: null };
    case 'ADD_TARGET':
      return { ...state, targets: [action.target, ...state.targets] };
    case 'UPDATE_TARGET':
      return {
        ...state,
        targets: state.targets.map(t => t.id === action.target.id ? action.target : t),
      };
    case 'EDIT_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(m => m.id === action.id ? { ...m, text: action.text } : m),
      };
    case 'DELETE_MESSAGE':
      return {
        ...state,
        messages: state.messages.filter(m => m.id !== action.id),
      };
    case 'TRIGGER_REGENERATE':
      return {
        ...state,
        phase: 'generating',
        generationStep: 'analyze',
        streamingText: '',
        error: null,
      };
    case 'SWITCH_VERSION': {
      const v = state.replyVersions[action.index];
      if (!v) return state;
      return {
        ...state,
        activeVersionIndex: action.index,
        currentAnalysis: v.analysis,
        currentReplies: v.replies,
      };
    }
    case 'ADVANCE_REGEN_STEP': {
      const order: Record<string, GenerationStep> = { analyze: 'generating', generating: 'parsing', parsing: 'parsing' };
      const next = order[state.generationStep];
      return next ? { ...state, generationStep: next } : state;
    }
    default:
      return state;
  }
}

async function loadSessionAiMessages(sessionId: string, dispatch: Dispatch<AppAction>) {
  if (!sessionId) return;
  try {
    const [aiMessages, selections] = await Promise.all([
      api.getSessionMessages(sessionId),
      api.getReplySelections(sessionId),
    ]);
    dispatch({ type: 'SET_AI_MESSAGES', aiMessages });
    dispatch({ type: 'SET_REPLY_SELECTIONS', selections });
  } catch {
    dispatch({ type: 'SET_AI_MESSAGES', aiMessages: [] });
    dispatch({ type: 'SET_REPLY_SELECTIONS', selections: [] });
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  selectTarget: (id: string) => Promise<void>;
  sendHerMessage: (text: string) => void;
  triggerAI: () => Promise<void>;
  selectReplyAction: (reply: { id: number; text: string; strategy: string }, aiMessageId?: string) => Promise<void>;
  sendCustomReply: (text: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  models: ModelOption[];
  selectedProvider: string;
  setSelectedProvider: (provider: string) => void;
  quickMode: boolean;
  setQuickMode: (mode: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const activeAbortRef = useRef<AbortController | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('zhipu');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [quickMode, setQuickMode] = useState(false);

  useEffect(() => {
    api.getModels().then(({ models }) => setModels(models)).catch(() => {});
  }, []);

  // Cleanup: abort any in-flight SSE on unmount
  useEffect(() => () => { activeAbortRef.current?.abort(); }, []);

  const selectTarget = async (id: string) => {
    // Cancel any in-flight generation before switching target
    activeAbortRef.current?.abort();
    activeAbortRef.current = null;
    const [messages, sessions] = await Promise.all([
      api.getMessages(id),
      api.getSessions(id),
    ]);
    dispatch({ type: 'SELECT_TARGET', targetId: id, messages, sessions });
    const activeSession = sessions.find(s => s.is_active === 1);
    if (activeSession) {
      await loadSessionAiMessages(activeSession.id, dispatch);
    }
  };

  const sendHerMessage = (text: string) => {
    if (!state.currentTargetId) return;
    api.addMessage(state.currentTargetId, {
      role: 'her',
      text,
      source: '手动输入',
    }).then(msg => {
      dispatch({ type: 'SEND_HER_MESSAGE', message: msg });
    });
  };

  const triggerAI = async () => {
    if (!state.currentTargetId) return;
    // Cancel any previous in-flight request
    activeAbortRef.current?.abort();
    dispatch({ type: 'TRIGGER_AI', mode: quickMode ? 'quick' : 'full' });

    const mode = quickMode ? 'quick' : 'full';

    let sessionId = state.currentSessionId;
    if (!sessionId) {
      try {
        const session = await api.createSession(state.currentTargetId);
        const sessions = await api.getSessions(state.currentTargetId);
        dispatch({ type: 'UPDATE_SESSIONS', sessions, currentSessionId: session.id });
        sessionId = session.id;
      } catch (err: any) {
        dispatch({ type: 'GENERATE_FAILURE', error: '创建会话失败: ' + err.message });
        return;
      }
    }
    const lastHerMsg = [...state.messages].reverse().find(m => m.role === 'her');

    // 2s timeout: transition from 'analyze' to 'generating' if no delta yet
    const analyzeTimer = setTimeout(() => {
      dispatch({ type: 'SET_GENERATION_STEP', step: 'generating' });
    }, 2000);

    // Heartbeat timeout: 15s without any event = connection lost
    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
    const resetHeartbeat = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(() => {
        dispatch({ type: 'GENERATE_FAILURE', error: '连接超时，请重试' });
      }, 15000);
    };
    resetHeartbeat();

    const ctrl = api.generateReplyStream(
      sessionId,
      lastHerMsg?.text || '',
      selectedProvider,
      (evt) => {
        resetHeartbeat();
        if (evt.event !== 'heartbeat' && evt.event !== 'delta') {
          console.log('[SSE]', evt.event, evt.data);
        }
        switch (evt.event) {
          case 'step':
            // Step transitions are driven by delta events on frontend; ignore backend step events
            break;
          case 'delta':
            clearTimeout(analyzeTimer);
            dispatch({ type: 'STREAM_DELTA', text: evt.data.text });
            break;
          case 'analysis':
            dispatch({ type: 'STREAM_ANALYSIS', analysis: evt.data });
            break;
          case 'plan':
            dispatch({ type: 'SET_PLAN', plan: evt.data });
            break;
          case 'replies':
            dispatch({ type: 'STREAM_REPLIES', replies: evt.data });
            break;
          case 'reply_ready':
            dispatch({ type: 'STREAM_REPLY_READY', reply: evt.data.reply, index: evt.data.index });
            break;
          case 'done':
            clearTimeout(analyzeTimer);
            if (heartbeatTimer) clearTimeout(heartbeatTimer);
            dispatch({ type: 'STREAM_DONE', contextUsage: evt.data.contextUsage, roundId: evt.data.roundId });
            loadSessionAiMessages(sessionId, dispatch);
            // Refresh sessions to update context_tokens in SessionBar
            if (state.currentTargetId) {
              api.getSessions(state.currentTargetId).then(sessions => {
                dispatch({ type: 'UPDATE_SESSIONS', sessions, currentSessionId: sessionId });
              });
            }
            break;
          case 'error':
            clearTimeout(analyzeTimer);
            if (heartbeatTimer) clearTimeout(heartbeatTimer);
            dispatch({ type: 'GENERATE_FAILURE', error: evt.data.message });
            break;
        }
      },
      (err) => {
        clearTimeout(analyzeTimer);
        if (heartbeatTimer) clearTimeout(heartbeatTimer);
        if (err.name !== 'AbortError') {
          dispatch({ type: 'GENERATE_FAILURE', error: err.message });
        }
      },
      mode,
    );
    activeAbortRef.current = ctrl;
  };

  const selectReplyAction = async (reply: { id: number; text: string; strategy: string }, aiMessageId?: string) => {
    if (!state.currentSessionId || !state.currentTargetId) return;
    try {
      const result = await api.selectReply(state.currentSessionId, reply.id, aiMessageId);
      const msg: ChatMessage = {
        id: result.messageId || '', target_id: state.currentTargetId, role: 'me',
        text: reply.text, source: 'AI建议', strategy: reply.strategy,
        session_id: state.currentSessionId, created_at: Date.now(),
      };
      dispatch({ type: 'SELECT_REPLY', message: msg });
      // Refresh aiMessages and selections
      await loadSessionAiMessages(state.currentSessionId, dispatch);
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message });
    }
  };

  const sendCustomReply = async (text: string) => {
    if (!state.currentSessionId || !state.currentTargetId) return;
    try {
      const result = await api.customReply(state.currentSessionId, text);
      const msg: ChatMessage = {
        id: result.messageId || '', target_id: state.currentTargetId, role: 'me',
        text, source: '自定义回复', strategy: null,
        session_id: state.currentSessionId, created_at: Date.now(),
      };
      dispatch({ type: 'CUSTOM_REPLY', message: msg });
      await loadSessionAiMessages(state.currentSessionId, dispatch);
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message });
    }
  };

  const createNewSession = async () => {
    if (!state.currentTargetId) return;
    const session = await api.createSession(state.currentTargetId);
    const sessions = await api.getSessions(state.currentTargetId);
    dispatch({ type: 'UPDATE_SESSIONS', sessions, currentSessionId: session.id });
    dispatch({ type: 'SET_AI_MESSAGES', aiMessages: [] });
  };

  const switchSession = async (sessionId: string) => {
    dispatch({ type: 'UPDATE_SESSIONS', sessions: state.sessions, currentSessionId: sessionId });
    await loadSessionAiMessages(sessionId, dispatch);
  };

  const deleteSession = async (sessionId: string) => {
    if (!state.currentTargetId) return;
    await api.deleteSession(sessionId);
    const sessions = await api.getSessions(state.currentTargetId);
    const activeSession = sessions.find(s => s.is_active === 1);
    dispatch({ type: 'UPDATE_SESSIONS', sessions, currentSessionId: activeSession?.id || null });
    if (activeSession) {
      await loadSessionAiMessages(activeSession.id, dispatch);
    } else {
      dispatch({ type: 'SET_AI_MESSAGES', aiMessages: [] });
    }
  };

  return (
    <AppContext.Provider value={{
      state, dispatch, selectTarget, sendHerMessage, triggerAI,
      selectReplyAction, sendCustomReply, createNewSession, switchSession, deleteSession,
      models, selectedProvider, setSelectedProvider,
      quickMode, setQuickMode,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}

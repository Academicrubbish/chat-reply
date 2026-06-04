import { createContext, useContext, useReducer, useRef, useEffect, useState, type Dispatch, type ReactNode } from 'react';
import type { AppState, AppAction, ChatMessage, ModelOption, GenerationStep, GenerateMode } from '../types';
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
  analysisDrawerOpen: false,
  analysisResult: null,
  analysisMode: null,
  isAnalyzing: false,
  analysisStep: 'idle' as const,
  analysisHistory: [],
  activeDiagnosis: null,
  isDiagnosing: false,
  diagnosisStep: 'idle' as const,
  diagnosisHistory: [],
  diagnosisJustGenerated: false,
  errorTimestamp: null,
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
        replyVersions: [],
        activeVersionIndex: 0,
        activeDiagnosis: null,
        isDiagnosing: false,
        diagnosisStep: 'idle' as const,
        diagnosisHistory: [],
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
      return {
        ...state,
        phase: state.replyVersions.length > 0 ? 'waiting_select' : 'idle',
        generationStep: 'idle',
        streamingText: '',
        currentReplies: state.replyVersions.length > 0 ? state.currentReplies : null,
        currentAnalysis: state.replyVersions.length > 0 ? state.currentAnalysis : null,
        error: action.error,
        errorTimestamp: Date.now(),
      };
    case 'CANCEL_GENERATION':
      return {
        ...state,
        phase: state.replyVersions.length > 0 ? 'waiting_select' : 'idle',
        generationStep: 'idle',
        streamingText: '',
        error: null,
      };
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
      const newVersion = { analysis: state.currentAnalysis!, replies: action.replies };
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
          : [{ analysis: state.currentAnalysis!, replies: updated }],
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
    case 'UPDATE_SESSIONS': {
      // Only clear reply state when session actually changes (switching), not on refresh
      const sessionChanged = action.currentSessionId !== state.currentSessionId;
      return {
        ...state,
        sessions: action.sessions,
        currentSessionId: action.currentSessionId,
        ...(sessionChanged ? {
          phase: 'idle',
          generationStep: 'idle',
          currentAnalysis: null,
          currentReplies: null,
          currentPlan: null,
          contextUsage: null,
          replyVersions: [],
          activeVersionIndex: 0,
          streamingText: '',
          error: null,
        } : {}),
      };
    }
    case 'SET_AI_MESSAGES':
      return { ...state, aiMessages: action.aiMessages };
    case 'SET_REPLY_SELECTIONS':
      return { ...state, replySelections: action.selections };
    case 'SET_PLAN':
      return { ...state, currentPlan: action.plan };
    case 'SET_ERROR':
      return { ...state, error: action.error, errorTimestamp: Date.now() };
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
    case 'TRIGGER_ANALYSIS':
      return {
        ...state,
        analysisDrawerOpen: false,
        analysisMode: action.analysisMode,
        analysisResult: null,
        isAnalyzing: true,
        analysisStep: 'analyzing' as const,
        streamingText: '',
        error: null,
      };
    case 'ANALYSIS_SUCCESS':
      return { ...state, analysisResult: action.data, analysisMode: action.analysisMode, isAnalyzing: false, analysisStep: 'idle' as const, analysisDrawerOpen: true };
    case 'ANALYSIS_FAILURE':
      return { ...state, isAnalyzing: false, analysisStep: 'idle' as const, error: action.error, errorTimestamp: Date.now() };
    case 'CLOSE_ANALYSIS_DRAWER':
      return { ...state, analysisDrawerOpen: false };
    case 'OPEN_ANALYSIS_DRAWER':
      return { ...state, analysisDrawerOpen: true, analysisResult: null, analysisMode: null };
    case 'ANALYSIS_STEP':
      return { ...state, analysisStep: action.step };
    case 'ANALYSIS_DELTA':
      return { ...state, streamingText: state.streamingText + action.text };
    case 'SET_ANALYSIS_HISTORY':
      return { ...state, analysisHistory: action.history };
    case 'VIEW_HISTORY_ANALYSIS':
      return { ...state, analysisResult: action.data, analysisMode: action.analysisMode, analysisDrawerOpen: true };
    // Diagnosis actions
    case 'SET_ACTIVE_DIAGNOSIS':
      return { ...state, activeDiagnosis: action.diagnosis };
    case 'TRIGGER_DIAGNOSE':
      return { ...state, isDiagnosing: true, diagnosisStep: 'analyzing' as const, streamingText: '', error: null };
    case 'DIAGNOSIS_SUCCESS':
      return { ...state, isDiagnosing: false, diagnosisStep: 'done' as const, activeDiagnosis: action.diagnosis };
    case 'DIAGNOSIS_FAILURE':
      return { ...state, isDiagnosing: false, diagnosisStep: 'idle' as const, error: action.error, errorTimestamp: Date.now() };
    case 'DIAGNOSIS_STEP':
      return { ...state, diagnosisStep: action.step };
    case 'CLEAR_DIAGNOSIS':
      return { ...state, activeDiagnosis: null };
    case 'SET_DIAGNOSIS_HISTORY':
      return { ...state, diagnosisHistory: action.history };
    case 'SHOW_DIAGNOSIS':
      return { ...state, diagnosisJustGenerated: true };
    case 'DISMISS_DIAGNOSIS':
      return { ...state, diagnosisJustGenerated: false };
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
  aiMode: GenerateMode;
  setAiMode: (mode: GenerateMode) => void;
  triggerAnalysis: (mode: 'advisor' | 'review') => Promise<void>;
  diagnoseTarget: () => Promise<void>;
  clearDiagnosis: () => Promise<void>;
  regenAbortRef: React.MutableRefObject<AbortController | null>;
  abortAllStreams: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const activeAbortRef = useRef<AbortController | null>(null);
  const regenAbortRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [selectedProvider, setSelectedProvider] = useState('zhipu');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [aiMode, setAiMode] = useState<GenerateMode>('full');

  // Unified abort: stops all in-flight SSE streams
  const abortAllStreams = () => {
    activeAbortRef.current?.abort();
    activeAbortRef.current = null;
    regenAbortRef.current?.abort();
    regenAbortRef.current = null;
  };

  useEffect(() => {
    api.getModels().then(({ models }) => setModels(models)).catch(() => {});
  }, []);

  // Cleanup: abort any in-flight SSE on unmount
  useEffect(() => () => { abortAllStreams(); }, []);

  const selectTarget = async (id: string) => {
    // Cancel any in-flight generation before switching target
    abortAllStreams();
    const [messages, sessions] = await Promise.all([
      api.getMessages(id),
      api.getSessions(id),
    ]);
    dispatch({ type: 'SELECT_TARGET', targetId: id, messages, sessions });
    const activeSession = sessions.find(s => s.is_active === 1);
    if (activeSession) {
      await loadSessionAiMessages(activeSession.id, dispatch);
    }
    // Load analysis history for this target
    api.getAnalyses(id).then(h => dispatch({ type: 'SET_ANALYSIS_HISTORY', history: h })).catch(() => {});
    // Load active diagnosis for this target
    api.getActiveDiagnosis(id).then(r => dispatch({ type: 'SET_ACTIVE_DIAGNOSIS', diagnosis: r.diagnosis })).catch(() => {});
    // Load diagnosis history
    api.getDiagnoses(id).then(h => dispatch({ type: 'SET_DIAGNOSIS_HISTORY', history: h })).catch(() => {});
  };

  const sendHerMessage = (text: string) => {
    const targetId = stateRef.current.currentTargetId;
    if (!targetId) return;
    api.addMessage(targetId, {
      role: 'her',
      text,
      source: '手动输入',
    }).then(msg => {
      dispatch({ type: 'SEND_HER_MESSAGE', message: msg });

      // 预请求：确保 session 已存在，这样 triggerAI 时可以跳过 createSession 等待
      if (!stateRef.current.currentSessionId && stateRef.current.currentTargetId) {
        api.createSession(stateRef.current.currentTargetId!).then(session => {
          api.getSessions(stateRef.current.currentTargetId!).then(sessions => {
            dispatch({ type: 'UPDATE_SESSIONS', sessions, currentSessionId: session.id });
          });
        }).catch(() => {});
      }
    }).catch(err => {
      dispatch({ type: 'SET_ERROR', error: '消息发送失败: ' + (err.message || '网络错误') });
    });
  };

  const triggerAI = async () => {
    const targetId = stateRef.current.currentTargetId;
    if (!targetId) return;
    // Cancel any previous in-flight request
    abortAllStreams();

    const mode = aiMode === 'quick' ? 'quick' : 'full';

    // Ensure session exists BEFORE dispatching TRIGGER_AI (UPDATE_SESSIONS resets phase)
    let sessionId = stateRef.current.currentSessionId;
    if (!sessionId) {
      try {
        const session = await api.createSession(targetId);
        const sessions = await api.getSessions(targetId);
        dispatch({ type: 'UPDATE_SESSIONS', sessions, currentSessionId: session.id });
        sessionId = session.id;
      } catch (err: any) {
        dispatch({ type: 'GENERATE_FAILURE', error: '创建会话失败: ' + err.message });
        return;
      }
    }

    dispatch({ type: 'TRIGGER_AI', mode });
    const lastHerMsg = [...stateRef.current.messages].reverse().find(m => m.role === 'her');

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
            if (evt.data.step === 'auto_diagnosing') {
              dispatch({ type: 'SET_GENERATION_STEP', step: 'analyze' });
            }
            break;
          case 'delta':
            clearTimeout(analyzeTimer);
            dispatch({ type: 'STREAM_DELTA', text: evt.data.text });
            break;
          case 'diagnosis_ready':
            dispatch({ type: 'SET_ACTIVE_DIAGNOSIS', diagnosis: evt.data.diagnosis });
            dispatch({ type: 'SHOW_DIAGNOSIS' });
            break;
          case 'debug_raw':
            console.error('[LLM Parse Failed] Source:', evt.data.source, 'Length:', evt.data.rawLength, '\nRaw output (first 800 chars):\n', evt.data.rawPreview);
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
            if (stateRef.current.currentTargetId) {
              api.getSessions(stateRef.current.currentTargetId).then(sessions => {
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

  const triggerAnalysis = async (mode: 'advisor' | 'review') => {
    const targetId = stateRef.current.currentTargetId;
    if (!targetId) return;
    abortAllStreams();

    // Ensure session exists BEFORE dispatching TRIGGER_ANALYSIS (UPDATE_SESSIONS resets state)
    let sessionId = stateRef.current.currentSessionId;
    if (!sessionId) {
      try {
        const session = await api.createSession(targetId);
        sessionId = session.id;
        dispatch({ type: 'UPDATE_SESSIONS', sessions: await api.getSessions(targetId), currentSessionId: sessionId });
      } catch { return; }
    }
    dispatch({ type: 'TRIGGER_ANALYSIS', analysisMode: mode });

    const ctrl = api.analyzeStream(
      sessionId, mode, selectedProvider,
      (evt) => {
        if (evt.event === 'step') {
          dispatch({ type: 'ANALYSIS_STEP', step: evt.data.step });
        } else if (evt.event === 'delta') {
          dispatch({ type: 'ANALYSIS_DELTA', text: evt.data.text });
        } else if (evt.event === 'debug_raw') {
          console.error('[LLM Parse Failed] Source:', evt.data.source, 'Length:', evt.data.rawLength, '\nRaw output (first 800 chars):\n', evt.data.rawPreview);
        } else if (evt.event === 'analysis_done') {
          dispatch({ type: 'ANALYSIS_SUCCESS', analysisMode: mode, data: evt.data.result });
          dispatch({ type: 'ANALYSIS_STEP', step: 'done' });
          // Refresh history after successful analysis
          if (stateRef.current.currentTargetId) {
            api.getAnalyses(stateRef.current.currentTargetId).then(h => dispatch({ type: 'SET_ANALYSIS_HISTORY', history: h })).catch(() => {});
          }
        } else if (evt.event === 'error') {
          // Handle SSE error events to prevent frontend stuck in loading
          dispatch({ type: 'ANALYSIS_FAILURE', error: evt.data.message || '分析服务异常' });
        }
      },
      (err) => {
        if (err.name !== 'AbortError') {
          dispatch({ type: 'ANALYSIS_FAILURE', error: err.message });
        }
      },
    );
    activeAbortRef.current = ctrl;
  };

  const diagnoseTarget = async () => {
    const targetId = stateRef.current.currentTargetId;
    if (!targetId) return;
    abortAllStreams();

    dispatch({ type: 'TRIGGER_DIAGNOSE' });

    const ctrl = api.diagnoseStream(
      targetId,
      selectedProvider,
      (evt) => {
        if (evt.event === 'step') {
          dispatch({ type: 'DIAGNOSIS_STEP', step: evt.data.step === 'analyzing' ? 'analyzing' : evt.data.step === 'parsing' ? 'parsing' : 'generating' });
        } else if (evt.event === 'delta') {
          // Optionally stream text during diagnosis
        } else if (evt.event === 'debug_raw') {
          console.error('[LLM Parse Failed] Source:', evt.data.source, 'Length:', evt.data.rawLength, '\nRaw output (first 800 chars):\n', evt.data.rawPreview);
        } else if (evt.event === 'diagnosis_done') {
          dispatch({ type: 'DIAGNOSIS_SUCCESS', diagnosis: evt.data.diagnosis });
          // Refresh diagnosis history
          if (stateRef.current.currentTargetId) {
            api.getDiagnoses(stateRef.current.currentTargetId).then(h => dispatch({ type: 'SET_DIAGNOSIS_HISTORY', history: h })).catch(() => {});
          }
        } else if (evt.event === 'error') {
          dispatch({ type: 'DIAGNOSIS_FAILURE', error: evt.data.message || '诊断服务异常' });
        }
      },
      (err) => {
        if (err.name !== 'AbortError') {
          dispatch({ type: 'DIAGNOSIS_FAILURE', error: err.message });
        }
      },
    );
    activeAbortRef.current = ctrl;
  };

  const clearDiagnosis = async () => {
    const targetId = stateRef.current.currentTargetId;
    if (!targetId) return;
    try {
      await api.clearActiveDiagnosis(targetId);
      dispatch({ type: 'CLEAR_DIAGNOSIS' });
    } catch {}
  };

  const selectReplyAction = async (reply: { id: number; text: string; strategy: string }, aiMessageId?: string) => {
    const s = stateRef.current;
    if (!s.currentSessionId || !s.currentTargetId) {
      dispatch({ type: 'SET_ERROR', error: '请先创建辅导窗口' });
      return;
    }
    try {
      const result = await api.selectReply(s.currentSessionId, reply.id, aiMessageId);
      const msg: ChatMessage = {
        id: result.messageId || '', target_id: s.currentTargetId, role: 'me',
        text: reply.text, source: 'AI建议', strategy: reply.strategy,
        session_id: s.currentSessionId, created_at: Date.now(),
      };
      dispatch({ type: 'SELECT_REPLY', message: msg });
      await loadSessionAiMessages(s.currentSessionId, dispatch);
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message });
    }
  };

  const sendCustomReply = async (text: string) => {
    const s = stateRef.current;
    if (!s.currentSessionId || !s.currentTargetId) {
      dispatch({ type: 'SET_ERROR', error: '请先创建辅导窗口' });
      return;
    }
    try {
      const result = await api.customReply(s.currentSessionId, text);
      const msg: ChatMessage = {
        id: (result as any).messageId || '', target_id: s.currentTargetId, role: 'me',
        text, source: '自定义回复', strategy: null,
        session_id: s.currentSessionId, created_at: Date.now(),
      };
      dispatch({ type: 'CUSTOM_REPLY', message: msg });
      await loadSessionAiMessages(s.currentSessionId, dispatch);
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message });
    }
  };

  const createNewSession = async () => {
    const targetId = stateRef.current.currentTargetId;
    if (!targetId) return;
    const session = await api.createSession(targetId);
    const sessions = await api.getSessions(targetId);
    dispatch({ type: 'UPDATE_SESSIONS', sessions, currentSessionId: session.id });
    dispatch({ type: 'SET_AI_MESSAGES', aiMessages: [] });
  };

  const switchSession = async (sessionId: string) => {
    abortAllStreams();
    dispatch({ type: 'UPDATE_SESSIONS', sessions: stateRef.current.sessions, currentSessionId: sessionId });
    await loadSessionAiMessages(sessionId, dispatch);
  };

  const deleteSession = async (sessionId: string) => {
    const targetId = stateRef.current.currentTargetId;
    if (!targetId) return;
    abortAllStreams();
    await api.deleteSession(sessionId);
    const sessions = await api.getSessions(targetId);
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
      aiMode, setAiMode, triggerAnalysis, diagnoseTarget, clearDiagnosis,
      regenAbortRef, abortAllStreams,
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

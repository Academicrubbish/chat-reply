import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import type { AppState, AppAction, ChatMessage } from '../types';
import * as api from '../services/api';

const initialState: AppState = {
  phase: 'idle',
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
  error: null,
  modalOpen: false,
  editingTarget: null,
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
      return { ...state, phase: 'generating', error: null };
    case 'GENERATE_SUCCESS': {
      const { analysis, plan, contextUsage, replies } = action.data;
      return {
        ...state,
        phase: 'waiting_select',
        currentAnalysis: analysis,
        currentReplies: replies,
        currentPlan: plan,
        contextUsage,
        error: null,
      };
    }
    case 'GENERATE_FAILURE':
      return { ...state, phase: 'idle', error: action.error };
    case 'STREAM_ANALYSIS':
      return { ...state, currentAnalysis: action.analysis };
    case 'STREAM_REPLIES':
      return { ...state, phase: 'waiting_select', currentReplies: action.replies, error: null };
    case 'STREAM_DONE':
      return { ...state, contextUsage: action.contextUsage };
    case 'SELECT_REPLY':
    case 'CUSTOM_REPLY':
      return {
        ...state,
        messages: [...state.messages, action.message],
        phase: 'idle',
        currentAnalysis: null,
        currentReplies: null,
        error: null,
      };
    case 'UPDATE_SESSIONS':
      return { ...state, sessions: action.sessions, currentSessionId: action.currentSessionId };
    case 'SET_AI_MESSAGES':
      return { ...state, aiMessages: action.aiMessages };
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
    default:
      return state;
  }
}

async function loadSessionAiMessages(sessionId: string, dispatch: Dispatch<AppAction>) {
  if (!sessionId) return;
  try {
    const aiMessages = await api.getSessionMessages(sessionId);
    dispatch({ type: 'SET_AI_MESSAGES', aiMessages });
  } catch {
    dispatch({ type: 'SET_AI_MESSAGES', aiMessages: [] });
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  selectTarget: (id: string) => Promise<void>;
  sendHerMessage: (text: string) => void;
  triggerAI: () => Promise<void>;
  selectReplyAction: (reply: { id: number; text: string; strategy: string }) => Promise<void>;
  sendCustomReply: (text: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const selectTarget = async (id: string) => {
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
    dispatch({ type: 'TRIGGER_AI' });

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
    api.generateReplyStream(
      sessionId,
      lastHerMsg?.text || '',
      (evt) => {
        switch (evt.event) {
          case 'analysis':
            dispatch({ type: 'STREAM_ANALYSIS', analysis: evt.data });
            break;
          case 'plan':
            dispatch({ type: 'SET_PLAN', plan: evt.data });
            break;
          case 'replies':
            dispatch({ type: 'STREAM_REPLIES', replies: evt.data });
            break;
          case 'done':
            dispatch({ type: 'STREAM_DONE', contextUsage: evt.data.contextUsage });
            loadSessionAiMessages(sessionId, dispatch);
            break;
          case 'error':
            dispatch({ type: 'GENERATE_FAILURE', error: evt.data.message });
            break;
        }
      },
      (err) => {
        dispatch({ type: 'GENERATE_FAILURE', error: err.message });
      },
    );
  };

  const selectReplyAction = async (reply: { id: number; text: string; strategy: string }) => {
    if (!state.currentSessionId || !state.currentTargetId) return;
    try {
      await api.selectReply(state.currentSessionId, reply.id);
      const msg: ChatMessage = {
        id: '', target_id: state.currentTargetId, role: 'me',
        text: reply.text, source: 'AI建议', strategy: reply.strategy,
        session_id: state.currentSessionId, created_at: Date.now(),
      };
      dispatch({ type: 'SELECT_REPLY', message: msg });
      // Refresh aiMessages to include the new round
      await loadSessionAiMessages(state.currentSessionId, dispatch);
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message });
    }
  };

  const sendCustomReply = async (text: string) => {
    if (!state.currentSessionId || !state.currentTargetId) return;
    try {
      await api.customReply(state.currentSessionId, text);
      const msg: ChatMessage = {
        id: '', target_id: state.currentTargetId, role: 'me',
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

  return (
    <AppContext.Provider value={{
      state, dispatch, selectTarget, sendHerMessage, triggerAI,
      selectReplyAction, sendCustomReply, createNewSession, switchSession,
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

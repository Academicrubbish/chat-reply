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
        error: null,
        phase: 'idle',
      };
    }
    case 'SEND_HER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
        phase: 'her_sent',
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
    default:
      return state;
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
  switchSession: (sessionId: string) => void;
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
    if (!state.currentSessionId) return;
    dispatch({ type: 'TRIGGER_AI' });
    try {
      const lastHerMsg = [...state.messages].reverse().find(m => m.role === 'her');
      const data = await api.generateReply(state.currentSessionId, lastHerMsg?.text || '');
      dispatch({ type: 'GENERATE_SUCCESS', data });
    } catch (err: any) {
      dispatch({ type: 'GENERATE_FAILURE', error: err.message });
    }
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
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.message });
    }
  };

  const createNewSession = async () => {
    if (!state.currentTargetId) return;
    const session = await api.createSession(state.currentTargetId);
    const sessions = await api.getSessions(state.currentTargetId);
    dispatch({ type: 'UPDATE_SESSIONS', sessions, currentSessionId: session.id });
  };

  const switchSession = (sessionId: string) => {
    dispatch({ type: 'UPDATE_SESSIONS', sessions: state.sessions, currentSessionId: sessionId });
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

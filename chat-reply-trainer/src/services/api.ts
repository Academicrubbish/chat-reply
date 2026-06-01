import type { ChatTarget, ChatMessage, AISession, GenerateResponse, ModelOption, ReplySelection, AnalysisRecord } from '../types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${url}`, { headers, ...options });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.reload();
    throw new Error('认证失败，请重新登录');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `请求失败 (${res.status})`);
  }
  return res.json();
}

// Auth
export const getAuthStatus = () => request<{ initialized: boolean }>('/auth/status');

export const setupAccount = (username: string, password: string) =>
  request<{ token: string }>('/auth/setup', { method: 'POST', body: JSON.stringify({ username, password }) });

export const login = (username: string, password: string) =>
  request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const register = (username: string, password: string) =>
  request<{ token: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });

export const getModels = () => request<{ models: ModelOption[] }>('/models');

// Targets
export const getTargets = () => request<ChatTarget[]>('/targets');

export const createTarget = (data: Partial<ChatTarget>) =>
  request<ChatTarget>('/targets', { method: 'POST', body: JSON.stringify(data) });

export const getTarget = (id: string) => request<ChatTarget>(`/targets/${id}`);

export const updateTarget = (id: string, data: Partial<ChatTarget>) =>
  request<ChatTarget>(`/targets/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTarget = (id: string) =>
  request<{ success: boolean }>(`/targets/${id}`, { method: 'DELETE' });

// Messages
export const getMessages = (targetId: string) =>
  request<ChatMessage[]>(`/targets/${targetId}/messages`);

export const addMessage = (targetId: string, data: Partial<ChatMessage>) =>
  request<ChatMessage>(`/targets/${targetId}/messages`, { method: 'POST', body: JSON.stringify(data) });

export const clearMessages = (targetId: string) =>
  request<{ success: boolean }>(`/targets/${targetId}/messages`, { method: 'DELETE' });

export const updateMessage = (msgId: string, text: string) =>
  request<ChatMessage>(`/messages/${msgId}`, { method: 'PUT', body: JSON.stringify({ text }) });

export const deleteMessage = (msgId: string) =>
  request<{ success: boolean }>(`/messages/${msgId}`, { method: 'DELETE' });

// Sessions
export const getSessions = (targetId: string) =>
  request<AISession[]>(`/targets/${targetId}/sessions`);

export const createSession = (targetId: string) =>
  request<AISession>(`/targets/${targetId}/sessions`, { method: 'POST' });

export const getSessionMessages = (sessionId: string) =>
  request<any[]>(`/sessions/${sessionId}/messages`);

export const deleteSession = (sessionId: string) =>
  request<{ success: boolean }>(`/sessions/${sessionId}`, { method: 'DELETE' });

// AI Generate
export const generateReply = (sessionId: string, herMessage: string) =>
  request<GenerateResponse>(`/sessions/${sessionId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ herMessage }),
  });

export type SSEEvent = {
  event: string;
  data: any;
};

export function generateReplyStream(
  sessionId: string,
  herMessage: string,
  provider: string = 'zhipu',
  onEvent: (evt: SSEEvent) => void,
  onError?: (err: Error) => void,
  mode: string = 'full',
): AbortController {
  const ctrl = new AbortController();
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  fetch(`${BASE}/sessions/${sessionId}/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ herMessage, provider, mode }),
    signal: ctrl.signal,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      onError?.(new Error(body.error || `请求失败 (${res.status})`));
      return;
    }
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent({ event: currentEvent, data });
          } catch {
            // skip
          }
        }
      }
    }
  }).catch(err => {
    if (err.name !== 'AbortError') onError?.(err);
  });
  return ctrl;
}

export const selectReply = (sessionId: string, replyId: number, aiMessageId?: string) =>
  request<{ success: boolean; messageId: string }>(`/sessions/${sessionId}/select-reply`, {
    method: 'POST',
    body: JSON.stringify({ replyId, aiMessageId }),
  });

export const customReply = (sessionId: string, text: string) =>
  request<{ success: boolean }>(`/sessions/${sessionId}/custom-reply`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

export const regenerate = (sessionId: string, opts?: { preferredStrategy?: string; mode?: string; provider?: string; roundId?: string }) =>
  request<GenerateResponse>(`/sessions/${sessionId}/regenerate`, {
    method: 'POST',
    body: JSON.stringify(opts ?? {}),
  });

export const getReplySelections = (sessionId: string) =>
  request<ReplySelection[]>(`/sessions/${sessionId}/selections`);

export function analyzeStream(
  sessionId: string,
  mode: 'advisor' | 'review',
  provider: string = 'zhipu',
  onEvent: (evt: SSEEvent) => void,
  onError?: (err: Error) => void,
): AbortController {
  const ctrl = new AbortController();
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  fetch(`${BASE}/sessions/${sessionId}/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ mode, provider }),
    signal: ctrl.signal,
  }).then(async (res) => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: '请求失败' }));
      onError?.(new Error(data.error || '分析失败'));
      return;
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('event: ')) currentEvent = line.slice(7).trim();
        else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent({ event: currentEvent, data });
          } catch {}
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError?.(err);
  });
  return ctrl;
}

export const getAnalyses = (targetId: string, type?: 'advisor' | 'review') =>
  request<AnalysisRecord[]>(`/targets/${targetId}/analyses${type ? `?type=${type}` : ''}`);

export const sendFeedback = (sessionId: string, replyId: number, rating: 'thumbs_up' | 'thumbs_down') =>
  request<{ success: boolean }>(`/sessions/${sessionId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ replyId, rating }),
  });

// Evaluations & Diagnoses
export const getEvaluations = (targetId: string) =>
  request<any[]>(`/targets/${targetId}/evaluations`);

export const getDiagnoses = (targetId: string) =>
  request<any[]>(`/targets/${targetId}/diagnoses`);

export const getWarnings = (targetId: string) =>
  request<any[]>(`/targets/${targetId}/warnings`);

// Knowledge base
export const getKnowledgeUnits = () =>
  request<{ units: any[]; total: number }>('/knowledge/units');

export const getKnowledgeMode = (mode: string) =>
  request<any>(`/knowledge/mode/${mode}`);

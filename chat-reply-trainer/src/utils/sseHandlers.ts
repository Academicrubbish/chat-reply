import type { Dispatch } from 'react';
import type { AppAction, GenerationStep } from '../types';

export type SSEEventHandler = (evt: { event: string; data: any }) => void;
export type SSEErrorHandler = (err: Error) => void;
export interface SSEHandlers {
  onEvent: SSEEventHandler;
  onError: SSEErrorHandler;
  cleanup: () => void;
}

export function createSSEHandlers(
  dispatch: Dispatch<AppAction>,
  stateRef: React.RefObject<{ currentSessionId: string | null; currentTargetId: string | null; generationStep: GenerationStep }>,
  opts: {
    tag?: string;
    extra?: Partial<Record<string, (data: any) => void>>;
    onDone?: (data: any) => void;
  } = {},
): SSEHandlers {
  const { tag = 'SSE', extra = {}, onDone } = opts;

  const stepTimer = setTimeout(() => {
    const cur = stateRef.current.generationStep;
    const next = cur === 'diagnosing' ? 'analyze' : 'generating';
    dispatch({ type: 'SET_GENERATION_STEP', step: next });
  }, 3000);

  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  const resetHeartbeat = () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      dispatch({ type: 'GENERATE_FAILURE', error: '连接超时，请重试' });
    }, 45000);
  };
  resetHeartbeat();

  const cleanup = () => {
    clearTimeout(stepTimer);
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
  };

  const onEvent: SSEEventHandler = (evt) => {
    resetHeartbeat();
    if (evt.event !== 'hb' && evt.event !== 'delta') {
      console.log(`[${tag}]`, evt.event, evt.data);
    }
    switch (evt.event) {
      case 'step':
        if (evt.data.step === 'auto_diagnosing') {
          dispatch({ type: 'SET_GENERATION_STEP', step: 'diagnosing' });
        }
        extra.step?.(evt.data);
        break;
      case 'delta':
        clearTimeout(stepTimer);
        dispatch({ type: 'STREAM_DELTA', text: evt.data.text });
        extra.delta?.(evt.data);
        break;
      case 'diagnosis_ready':
        dispatch({ type: 'SET_ACTIVE_DIAGNOSIS', diagnosis: evt.data.diagnosis });
        dispatch({ type: 'SHOW_DIAGNOSIS' });
        if (stateRef.current.generationStep === 'diagnosing') {
          dispatch({ type: 'SET_GENERATION_STEP', step: 'analyze' });
        }
        if (evt.data.diagnosis?.attraction) {
          dispatch({ type: 'SET_ATTRACTION', attraction: evt.data.diagnosis.attraction });
        }
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
        cleanup();
        dispatch({ type: 'STREAM_DONE', contextUsage: evt.data.contextUsage, roundId: evt.data.roundId });
        if (evt.data.attraction) {
          dispatch({ type: 'SET_ATTRACTION', attraction: evt.data.attraction });
        }
        onDone?.(evt.data);
        break;
      case 'error':
        cleanup();
        dispatch({ type: 'GENERATE_FAILURE', error: evt.data.message });
        break;
    }
  };

  const onError: SSEErrorHandler = (err) => {
    cleanup();
    if (err.name !== 'AbortError') {
      dispatch({ type: 'GENERATE_FAILURE', error: err.message });
    }
  };

  return { onEvent, onError, cleanup };
}

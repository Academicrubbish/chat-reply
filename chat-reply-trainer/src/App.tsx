import { useEffect, useRef, useState } from 'react';
import { Button, message, Segmented, Skeleton } from 'antd';
import { LogoutOutlined, CrownOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { AppProvider, useAppState } from './hooks/useAppState';
import * as api from './services/api';
import { parseChatWithMeta } from './utils/parseChat';
import type { ParsedMessage } from './utils/parseChat';
import { createSSEHandlers } from './utils/sseHandlers';
import { shouldStartTour, startTour } from './utils/tourGuide';
import ErrorBoundary from './components/ErrorBoundary';
import SetupPage from './components/SetupPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import OnboardingPage from './components/OnboardingPage';
import AdminPage from './components/AdminPage';
import TargetSelector from './components/TargetSelector';
import TargetModal from './components/TargetModal';
import Toolbar from './components/Toolbar';
import AttractionBar from './components/AttractionBar';
import RoundTimeline from './components/RoundTimeline';
import ChatHeader from './components/ChatHeader';
import ChatHistory from './components/ChatHistory';
import MessageInput from './components/MessageInput';
import { AnalysisSteps, AnalysisModal, ReviewModal } from './components/AnalysisDrawer';
import { Card } from 'antd';

function AppContent() {
  const { state, dispatch, selectTarget, sendHerMessage, triggerAI, selectReplyAction, sendCustomReply, createNewSession, switchSession, deleteSession, models, selectedProvider, setSelectedProvider, aiMode, setAiMode, triggerAnalysis, diagnoseTarget, regenAbortRef, abortAllStreams } = useAppState();
  const currentTarget = state.targets.find(t => t.id === state.currentTargetId) || null;
  const [mobileTab, setMobileTab] = useState<'chat' | 'ai'>('chat');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Auto-open diagnosis modal when a new diagnosis is generated during AI assist
  useEffect(() => {
    if (state.diagnosisJustGenerated) {
      setAnalysisModalOpen(true);
      dispatch({ type: 'DISMISS_DIAGNOSIS' });
    }
  }, [state.diagnosisJustGenerated]);

  // Check admin status on mount
  useEffect(() => {
    api.checkAdmin().then(r => setIsAdmin(r.isAdmin)).catch(() => {});
  }, []);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Auto-start guided tour only for newly registered users
  useEffect(() => {
    if (state.targets.length > 0 && shouldStartTour()) {
      const timer = setTimeout(startTour, 800);
      return () => clearTimeout(timer);
    }
  }, [state.targets.length]);

  // Load targets on mount
  useEffect(() => {
    api.getTargets().then(targets => {
      dispatch({ type: 'SET_TARGETS', targets });
      if (targets.length > 0) {
        selectTarget(targets[0].id);
      }
    });
  }, []);

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (state.error) {
      messageApi.error(state.error);
    }
  }, [state.errorTimestamp, messageApi]);

  // Admin page guard
  if (showAdmin && isAdmin) {
    return <AdminPage onBack={() => setShowAdmin(false)} isMobile={isMobile} />;
  }

  const handleSaveTarget = async (data: any) => {
    if (state.editingTarget) {
      const updated = await api.updateTarget(state.editingTarget.id, data);
      dispatch({ type: 'UPDATE_TARGET', target: updated });
      // 只在非生成状态下刷新完整目标数据，避免中断正在进行的 AI 生成
      if (state.currentTargetId === updated.id && state.phase !== 'generating') {
        selectTarget(updated.id);
      }
    } else {
      const target = await api.createTarget(data);
      dispatch({ type: 'ADD_TARGET', target });

      // Parse and import chat messages from recent_chats
      if (data.recent_chats?.trim()) {
        const { messages } = parseChatWithMeta(data.recent_chats, data.name, data.nicknameMap);
        if (messages.length > 0) {
          await api.addMessagesBatch(target.id, messages.map(msg => ({
            role: msg.role,
            text: msg.text,
            source: '历史记录',
          })));
        }
      }

      dispatch({ type: 'CLOSE_MODAL' });
      selectTarget(target.id);
      return;
    }
    dispatch({ type: 'CLOSE_MODAL' });
  };

  const handleDeleteTarget = async (id: string) => {
    await api.deleteTarget(id);
    const targets = await api.getTargets();
    dispatch({ type: 'SET_TARGETS', targets });
    if (state.currentTargetId === id) {
      if (targets.length > 0) {
        selectTarget(targets[0].id);
      } else {
        dispatch({ type: 'SELECT_TARGET', targetId: '', messages: [], sessions: [] });
      }
    }
  };

  const handleReset = async () => {
    if (!state.currentTargetId) return;
    await api.clearMessages(state.currentTargetId);
    selectTarget(state.currentTargetId);
  };

  const handleFeedback = async (replyId: number, rating: 'thumbs_up' | 'thumbs_down') => {
    if (!state.currentSessionId) return;
    await api.sendFeedback(state.currentSessionId, replyId, rating);
  };

  const handleRegenerate = async () => {
    const s = stateRef.current;
    if (!s.currentSessionId || s.phase === 'generating') return;
    dispatch({ type: 'TRIGGER_REGENERATE' });

    const currentRoundId = s.replyVersions[s.activeVersionIndex]?.roundId;
    const mode = aiMode === 'quick' ? 'quick' : 'full';

    const handlers = createSSEHandlers(dispatch, stateRef, {
      tag: 'Regen SSE',
      extra: {
        delta: () => { dispatch({ type: 'ADVANCE_REGEN_STEP' }); },
      },
      onDone: () => {
        if (stateRef.current.currentTargetId) {
          api.getSessions(stateRef.current.currentTargetId).then(sessions => {
            dispatch({ type: 'UPDATE_SESSIONS', sessions, currentSessionId: stateRef.current.currentSessionId });
          });
        }
      },
    });

    const ctrl = api.regenerateStream(
      s.currentSessionId,
      { mode, provider: selectedProvider, roundId: currentRoundId },
      handlers.onEvent,
      handlers.onError,
    );
    regenAbortRef.current?.abort();
    regenAbortRef.current = ctrl;
  };

  const handleCancelGeneration = () => {
    abortAllStreams();
    dispatch({ type: 'CANCEL_GENERATION' });
  };

  const handleEditMessage = async (id: string, text: string) => {
    await api.updateMessage(id, text);
    dispatch({ type: 'EDIT_MESSAGE', id, text });
  };

  const handleDeleteMessage = async (id: string) => {
    await api.deleteMessage(id);
    dispatch({ type: 'DELETE_MESSAGE', id });
  };

  const handleAddScene = async (text: string) => {
    if (!state.currentTargetId) return;
    const msg = await api.addMessage(state.currentTargetId, {
      role: 'scene', text, source: '场景补充',
    });
    dispatch({ type: 'SEND_HER_MESSAGE', message: msg });
  };

  const handleImportMessages = async (parsed: ParsedMessage[]) => {
    if (!state.currentTargetId || parsed.length === 0) return;
    await api.addMessagesBatch(state.currentTargetId, parsed.map(msg => ({
      role: msg.role,
      text: msg.text,
      source: msg.role === 'scene' ? '场景补充' : '历史记录',
    })));
    selectTarget(state.currentTargetId);
  };

  // Empty state — onboarding page
  if (state.targets.length === 0 && !state.currentTargetId) {
    return (
      <>
        <div className="h-14 bg-white border-b border-border flex items-center px-6 gap-4 shrink-0">
          <div className="w-9 h-9 bg-linear-to-br from-primary to-primary-hover rounded-lg flex items-center justify-center text-white"><ThunderboltOutlined /></div>
          <div className="flex flex-col">
            <h1>聊天模拟器</h1>
            <div className="text-xs text-[#888]">Chat Simulator · AI Agent 辅助沟通</div>
          </div>
        </div>
        <OnboardingPage onStart={() => dispatch({ type: 'OPEN_MODAL' })} isMobile={isMobile} />
        <TargetModal
          open={state.modalOpen}
          target={state.editingTarget}
          onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
          onSave={handleSaveTarget}
        />
      </>
    );
  }

  return (
    <>
      {contextHolder}

      {/* Top Bar */}
      <div className="h-14 bg-white border-b border-border flex items-center shrink-0" style={{ padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? 8 : 16 }}>
        <div className="w-9 h-9 bg-linear-to-br from-primary to-primary-hover rounded-lg flex items-center justify-center text-white"><ThunderboltOutlined /></div>
        <div className="flex flex-col">
          <h1>聊天模拟器</h1>
          {!isMobile && <div className="text-xs text-[#888]">Chat Simulator · AI Agent 辅助沟通</div>}
        </div>
        <div className="flex-1" />
        <TargetSelector
          targets={state.targets}
          currentId={state.currentTargetId}
          onSelect={selectTarget}
          onCreateNew={() => dispatch({ type: 'OPEN_MODAL' })}
          onDelete={handleDeleteTarget}
        />
        {isAdmin && (
          <Button
            size="small"
            icon={<CrownOutlined />}
            onClick={() => setShowAdmin(true)}
            style={{ color: '#fa8c16', borderColor: '#ffd591' }}
          >
            {isMobile ? '' : '管理'}
          </Button>
        )}
        <Button
          size="small"
          icon={<LogoutOutlined />}
          onClick={() => { localStorage.removeItem('token'); window.location.reload(); }}
        >
          {isMobile ? '' : '退出'}
        </Button>
      </div>

      {/* Mobile Tab Bar */}
      {isMobile && (
        <div data-tour-id="mobile-tab-bar" style={{ padding: '6px 16px', borderBottom: '1px solid #e8e8e8', background: '#fff' }}>
          <Segmented
            block
            value={mobileTab}
            onChange={(val) => setMobileTab(val as 'chat' | 'ai')}
            options={[
              { label: '聊天', value: 'chat' },
              { label: 'AI 辅助', value: 'ai' },
            ]}
          />
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - AI Console */}
        <div
          className="flex-1 min-w-0 bg-white border-r border-border flex flex-col overflow-hidden"
          data-tour-id="ai-panel"
          style={isMobile ? { display: mobileTab === 'ai' ? 'flex' : 'none', flex: '1 1 100%', maxWidth: '100%', borderRight: 'none' } : undefined}
        >
          <Toolbar
            target={currentTarget}
            onEditTarget={() => dispatch({ type: 'OPEN_MODAL', target: currentTarget })}
            onAIAssist={() => { triggerAI(); if (isMobile) setMobileTab('ai'); }}
            isGenerating={state.phase === 'generating' || state.isAnalyzing}
            aiMode={aiMode}
            session={state.sessions.find(s => s.id === state.currentSessionId) || null}
            sessions={state.sessions}
            onSelectSession={switchSession}
            onCreateSession={createNewSession}
            onDeleteSession={deleteSession}
            models={models}
            selectedProvider={selectedProvider}
            onSelectProvider={setSelectedProvider}
            onTriggerAnalysis={triggerAnalysis}
            onOpenAnalysisModal={() => setAnalysisModalOpen(true)}
            onOpenReviewModal={() => setReviewModalOpen(true)}
            isAnalyzing={state.isAnalyzing}
            analysisMode={state.analysisMode}
            analysis={state.currentAnalysis}
            activeDiagnosis={state.activeDiagnosis}
            isDiagnosing={state.isDiagnosing}
            onDiagnose={diagnoseTarget}
            isMobile={isMobile}
          />
          <AttractionBar attraction={state.attraction} isMobile={isMobile} />

          {/* Analysis step chain — visible in main panel during generation */}
          {state.isAnalyzing && (
            <Card size="small" style={{ margin: '8px 20px', borderLeft: '3px solid #3b5998' }}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#3b5998' }}>
                  {state.analysisMode === 'advisor' ? '军师分析中...' : '复盘总结中...'}
                </span>
              </div>
              <AnalysisSteps currentStep={state.analysisStep} />
            </Card>
          )}

          {/* RoundTimeline replaces AgentSteps + AnalysisTabs + ReplyPopup */}
          <ErrorBoundary boundaryName="AI分析" fallback={(_err, retry) => (
            <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>AI 分析区域加载失败</div>
              <button onClick={retry} style={{ padding: '4px 16px', border: '1px solid #3b5998', borderRadius: 6, background: '#3b5998', color: '#fff', cursor: 'pointer', fontSize: 12 }}>重试</button>
            </div>
          )}>
          <RoundTimeline
            aiMessages={state.aiMessages}
            replySelections={state.replySelections}
            phase={state.phase}
            currentAnalysis={state.currentAnalysis}
            currentReplies={state.currentReplies}
            isGenerating={state.phase === 'generating'}
            generationStep={state.generationStep}
            streamingText={state.streamingText}
            favorabilityHistory={state.favorabilityHistory}
            replyVersions={state.replyVersions}
            activeVersionIndex={state.activeVersionIndex}
            onSwitchVersion={(index) => dispatch({ type: 'SWITCH_VERSION', index })}
            onSelectReply={(reply, aiMessageId) => selectReplyAction(reply, aiMessageId)}
            onCustomReply={sendCustomReply}
            onRegenerate={handleRegenerate}
            onCancel={handleCancelGeneration}
            onFeedback={handleFeedback}
          />
          </ErrorBoundary>
        </div>

        {/* Right Panel - Chat Simulator */}
        <div
          className="w-[30%] max-w-105 flex flex-col bg-chat-bg"
          style={isMobile ? { display: mobileTab === 'chat' ? 'flex' : 'none', flex: '1 1 100%', maxWidth: '100%', width: '100%' } : undefined}
        >
          <ChatHeader
            targetName={currentTarget?.name || ''}
            onReset={handleReset}
            aiMode={aiMode}
            onAiModeChange={setAiMode}
            isMobile={isMobile}
          />
          <ErrorBoundary boundaryName="聊天记录" fallback={(_err, retry) => (
            <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>聊天记录加载失败</div>
              <button onClick={retry} style={{ padding: '4px 16px', border: '1px solid #3b5998', borderRadius: 6, background: '#3b5998', color: '#fff', cursor: 'pointer', fontSize: 12 }}>重试</button>
            </div>
          )}>
          <ChatHistory
            messages={state.messages}
            targetName={currentTarget?.name || ''}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onAddScene={handleAddScene}
            onImportMessages={handleImportMessages}
          />
          </ErrorBoundary>
          {state.phase === 'her_sent' && (
            <div
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-primary bg-[#e8f0fe] border-t border-[#d0dff5] cursor-pointer"
              onClick={() => {
                triggerAI();
                if (isMobile) setMobileTab('ai');
              }}
            >
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span>点击此处获取 AI 回复建议</span>
            </div>
          )}
          <MessageInput
            onSend={sendHerMessage}
            disabled={state.phase === 'generating'}
          />
        </div>
      </div>

      {/* Modal */}
      <TargetModal
        open={state.modalOpen}
        target={state.editingTarget}
        onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
        onSave={handleSaveTarget}
      />

      {/* Analysis Modal */}
      <AnalysisModal
        open={analysisModalOpen}
        onClose={() => setAnalysisModalOpen(false)}
        targetName={currentTarget?.name || ''}
        activeDiagnosis={state.activeDiagnosis}
        diagnosisHistory={state.diagnosisHistory}
        isDiagnosing={state.isDiagnosing}
        onDiagnose={diagnoseTarget}
        advisorResult={state.analysisMode === 'advisor' ? state.analysisResult as any : null}
        isAnalyzing={state.isAnalyzing}
        analysisMode={state.analysisMode}
        onTriggerAnalysis={triggerAnalysis}
        history={state.analysisHistory}
        onSelectHistory={(record) => {
          try {
            const parsed = JSON.parse(record.content);
            dispatch({ type: 'VIEW_HISTORY_ANALYSIS', analysisMode: record.msg_type, data: parsed });
          } catch {}
        }}
      />
      <ReviewModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        targetName={currentTarget?.name || ''}
        isAnalyzing={state.isAnalyzing}
        analysisMode={state.analysisMode}
        analysisStep={state.analysisStep}
        onTriggerReview={() => {
          triggerAnalysis('review');
        }}
        history={state.analysisHistory}
        onSelectHistory={(record) => {
          try {
            const parsed = JSON.parse(record.content);
            dispatch({ type: 'VIEW_HISTORY_ANALYSIS', analysisMode: record.msg_type, data: parsed });
          } catch {}
        }}
        currentResult={state.analysisMode === 'review' ? state.analysisResult as any : null}
      />
    </>
  );
}

function App() {
  const [authState, setAuthState] = useState<'loading' | 'setup' | 'login' | 'signup' | 'authenticated'>('loading');

  useEffect(() => {
    api.getAuthStatus().then(({ initialized }) => {
      if (!initialized) {
        setAuthState('setup');
        return;
      }
      const token = localStorage.getItem('token');
      if (!token) {
        setAuthState('login');
        return;
      }
      // Verify token by making an authenticated request
      api.getTargets().then(() => setAuthState('authenticated')).catch(() => {
        localStorage.removeItem('token');
        setAuthState('login');
      });
    }).catch(() => setAuthState('login'));
  }, []);

  if (authState === 'loading') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', gap: 16, padding: '40px 24px', maxWidth: 480, margin: '0 auto' }}>
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: '40%' }} />
        <Skeleton active paragraph={{ rows: 6 }} />
        <Skeleton.Button active block style={{ height: 48 }} />
      </div>
    );
  }

  if (authState === 'setup') {
    return <SetupPage onSuccess={() => setAuthState('authenticated')} />;
  }

  if (authState === 'login') {
    return <LoginPage onSuccess={() => setAuthState('authenticated')} onSwitchToSignUp={() => setAuthState('signup')} />;
  }

  if (authState === 'signup') {
    return <SignUpPage onSuccess={() => setAuthState('authenticated')} onSwitchToLogin={() => setAuthState('login')} />;
  }

  return (
    <ErrorBoundary boundaryName="全局">
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;

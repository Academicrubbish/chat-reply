import { useEffect, useState } from 'react';
import { Button, Empty, message } from 'antd';
import { LogoutOutlined, PlusOutlined } from '@ant-design/icons';
import { AppProvider, useAppState } from './hooks/useAppState';
import * as api from './services/api';
import { parseChatWithMeta } from './utils/parseChat';
import type { ParsedMessage } from './utils/parseChat';
import { shouldStartTour, startTour } from './utils/tourGuide';
import ErrorBoundary from './components/ErrorBoundary';
import SetupPage from './components/SetupPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import OnboardingPage from './components/OnboardingPage';
import TargetSelector from './components/TargetSelector';
import TargetModal from './components/TargetModal';
import Toolbar from './components/Toolbar';
import RoundTimeline from './components/RoundTimeline';
import ChatHeader from './components/ChatHeader';
import ChatHistory from './components/ChatHistory';
import MessageInput from './components/MessageInput';
import AnalysisDrawer, { AnalysisSteps } from './components/AnalysisDrawer';
import { Card } from 'antd';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

function AppContent() {
  const { state, dispatch, selectTarget, sendHerMessage, triggerAI, selectReplyAction, sendCustomReply, createNewSession, switchSession, deleteSession, models, selectedProvider, setSelectedProvider, aiMode, setAiMode, triggerAnalysis } = useAppState();
  const currentTarget = state.targets.find(t => t.id === state.currentTargetId) || null;
  const [mobileTab, setMobileTab] = useState<'chat' | 'ai'>('chat');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
  }, [state.error, messageApi]);

  const handleSaveTarget = async (data: any) => {
    if (state.editingTarget) {
      const updated = await api.updateTarget(state.editingTarget.id, data);
      dispatch({ type: 'UPDATE_TARGET', target: updated });
      if (state.currentTargetId === updated.id) {
        selectTarget(updated.id);
      }
    } else {
      const target = await api.createTarget(data);
      dispatch({ type: 'ADD_TARGET', target });

      // Parse and import chat messages from recent_chats
      if (data.recent_chats?.trim()) {
        const { messages } = parseChatWithMeta(data.recent_chats, data.name);
        for (const msg of messages) {
          await api.addMessage(target.id, {
            role: msg.role,
            text: msg.text,
            source: '历史记录',
          });
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
    if (!state.currentSessionId || state.phase === 'generating') return;
    dispatch({ type: 'TRIGGER_REGENERATE' });

    // Simulate step chain progression (regenerate is non-streaming)
    const t1 = setTimeout(() => dispatch({ type: 'ADVANCE_REGEN_STEP' }), 1500);
    const t2 = setTimeout(() => dispatch({ type: 'ADVANCE_REGEN_STEP' }), 3500);

    // Get current round's roundId from replyVersions
    const currentRoundId = state.replyVersions[state.activeVersionIndex]?.roundId;

    try {
      const data = await api.regenerate(state.currentSessionId, {
        mode: aiMode === 'quick' ? 'quick' : 'full',
        provider: selectedProvider,
        roundId: currentRoundId,
      });
      clearTimeout(t1); clearTimeout(t2);
      dispatch({ type: 'GENERATE_SUCCESS', data });
    } catch (err: any) {
      clearTimeout(t1); clearTimeout(t2);
      dispatch({ type: 'GENERATE_FAILURE', error: err.message });
    }
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
    if (!state.currentTargetId) return;
    for (const msg of parsed) {
      await api.addMessage(state.currentTargetId, {
        role: msg.role,
        text: msg.text,
        source: msg.role === 'scene' ? '场景补充' : '历史记录',
      });
    }
    selectTarget(state.currentTargetId);
  };

  // Empty state — onboarding page
  if (state.targets.length === 0 && !state.currentTargetId) {
    return (
      <>
        <div className="h-14 bg-white border-b border-border flex items-center px-6 gap-4 shrink-0">
          <div className="w-9 h-9 bg-linear-to-br from-[#667eea] to-[#764ba2] rounded-lg flex items-center justify-center text-white font-bold text-base">AI</div>
          <div className="flex flex-col">
            <h1>聊天模拟器</h1>
            <div className="text-xs text-[#888]">Chat Simulator · AI Agent 辅助沟通</div>
          </div>
        </div>
        <OnboardingPage onStart={() => dispatch({ type: 'OPEN_MODAL' })} />
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
      <div className="h-14 bg-white border-b border-border flex items-center px-6 gap-4 shrink-0">
        <div className="w-9 h-9 bg-linear-to-br from-[#667eea] to-[#764ba2] rounded-lg flex items-center justify-center text-white font-bold text-base">AI</div>
        <div className="flex flex-col">
          <h1>聊天模拟器</h1>
          <div className="text-xs text-[#888]">Chat Simulator · AI Agent 辅助沟通</div>
        </div>
        <div className="flex-1" />
        <TargetSelector
          targets={state.targets}
          currentId={state.currentTargetId}
          onSelect={selectTarget}
          onCreateNew={() => dispatch({ type: 'OPEN_MODAL' })}
          onDelete={handleDeleteTarget}
        />
        {!DEMO_MODE && (
          <Button
            size="small"
            icon={<LogoutOutlined />}
            onClick={() => { localStorage.removeItem('token'); window.location.reload(); }}
          >
            退出
          </Button>
        )}
      </div>

      {/* Mobile Tab Bar */}
      {isMobile && (
        <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8', background: '#fff' }}>
          <button onClick={() => setMobileTab('chat')} style={{
            flex: 1, padding: '8px 0', border: 'none', background: mobileTab === 'chat' ? '#e8f0fe' : '#fff',
            color: mobileTab === 'chat' ? '#3b5998' : '#666', fontWeight: mobileTab === 'chat' ? 600 : 400,
            fontSize: 13, cursor: 'pointer', borderBottom: mobileTab === 'chat' ? '2px solid #3b5998' : '2px solid transparent',
          }}>聊天</button>
          <button onClick={() => setMobileTab('ai')} style={{
            flex: 1, padding: '8px 0', border: 'none', background: mobileTab === 'ai' ? '#e8f0fe' : '#fff',
            color: mobileTab === 'ai' ? '#3b5998' : '#666', fontWeight: mobileTab === 'ai' ? 600 : 400,
            fontSize: 13, cursor: 'pointer', borderBottom: mobileTab === 'ai' ? '2px solid #3b5998' : '2px solid transparent',
          }}>AI 辅助</button>
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
            onAIAssist={() => {
              if (aiMode === 'advisor' || aiMode === 'review') {
                triggerAnalysis(aiMode);
              } else {
                triggerAI();
              }
            }}
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
            onShowHistory={() => dispatch({ type: 'OPEN_ANALYSIS_DRAWER' })}
            isAnalyzing={state.isAnalyzing}
            analysisMode={state.analysisMode}
            analysis={state.currentAnalysis}
          />

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
          <ErrorBoundary boundaryName="AI分析" fallback={(err, retry) => (
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
          />
          <ErrorBoundary boundaryName="聊天记录" fallback={(err, retry) => (
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
            <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-primary bg-[#e8f0fe] border-t border-[#d0dff5]">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              <span>点击「AI 辅助」获取回复建议</span>
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

      {/* Analysis Drawer */}
      <AnalysisDrawer
        open={state.analysisDrawerOpen}
        onClose={() => dispatch({ type: 'CLOSE_ANALYSIS_DRAWER' })}
        analysisMode={state.analysisMode}
        result={state.analysisResult}
        targetName={currentTarget?.name || ''}
        history={state.analysisHistory}
        onSelectHistory={(record) => {
          try {
            const parsed = JSON.parse(record.content);
            dispatch({ type: 'VIEW_HISTORY_ANALYSIS', analysisMode: record.msg_type, data: parsed });
          } catch {}
        }}
      />
    </>
  );
}

function DemoBanner() {
  return (
    <div style={{
      background: 'linear-gradient(90deg, #667eea, #764ba2)',
      color: 'white',
      textAlign: 'center',
      padding: '6px 0',
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: 0.5,
      flexShrink: 0,
    }}>
      展示模式 · 所有用户共享数据 · 如需私有部署请联系我们
    </div>
  );
}

function App() {
  if (DEMO_MODE) {
    return (
      <ErrorBoundary boundaryName="全局">
        <AppProvider>
          <DemoBanner />
          <AppContent />
        </AppProvider>
      </ErrorBoundary>
    );
  }

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
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>加载中...</div>;
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

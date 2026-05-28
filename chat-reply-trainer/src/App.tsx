import { useEffect } from 'react';
import { Button, Empty, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { AppProvider, useAppState } from './hooks/useAppState';
import * as api from './services/api';
import { parseChatWithMeta } from './utils/parseChat';
import TargetSelector from './components/TargetSelector';
import TargetModal from './components/TargetModal';
import PersonCard from './components/PersonCard';
import SessionBar from './components/SessionBar';
import ContextBar from './components/ContextBar';
import PlanCard from './components/PlanCard';
import AnalysisTabs from './components/AnalysisTabs';
import AgentSteps from './components/AgentSteps';
import ChatHeader from './components/ChatHeader';
import ChatHistory from './components/ChatHistory';
import MessageInput from './components/MessageInput';
import ReplyPopup from './components/ReplyPopup';

function AppContent() {
  const { state, dispatch, selectTarget, sendHerMessage, triggerAI, selectReplyAction, sendCustomReply, createNewSession, switchSession } = useAppState();
  const currentTarget = state.targets.find(t => t.id === state.currentTargetId) || null;

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
    if (!state.currentSessionId) return;
    dispatch({ type: 'TRIGGER_AI' });
    try {
      const data = await api.regenerate(state.currentSessionId);
      dispatch({ type: 'GENERATE_SUCCESS', data });
    } catch (err: any) {
      dispatch({ type: 'GENERATE_FAILURE', error: err.message });
    }
  };

  // Empty state
  if (state.targets.length === 0 && !state.currentTargetId) {
    return (
      <>
        <div className="h-14 bg-white border-b border-border flex items-center px-6 gap-4 shrink-0">
          <div className="w-9 h-9 bg-linear-to-br from-[#667eea] to-[#764ba2] rounded-lg flex items-center justify-center text-white font-bold text-base">AI</div>
          <div className="flex flex-col">
            <h1>聊天回复训练器</h1>
            <div className="text-xs text-[#888]">Chat Reply Trainer · AI Agent 辅助沟通</div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Empty description="创建第一个聊天对象，AI 将帮你分析消息并生成回复建议">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => dispatch({ type: 'OPEN_MODAL' })}>
              新建聊天对象
            </Button>
          </Empty>
        </div>
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
          <h1>聊天回复训练器</h1>
          <div className="text-xs text-[#888]">Chat Reply Trainer · AI Agent 辅助沟通</div>
        </div>
        <div className="flex-1" />
        <TargetSelector
          targets={state.targets}
          currentId={state.currentTargetId}
          onSelect={selectTarget}
          onCreateNew={() => dispatch({ type: 'OPEN_MODAL' })}
          onDelete={handleDeleteTarget}
        />
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - AI Console */}
        <div className="w-[70%] min-w-150 bg-white border-r border-border flex flex-col overflow-hidden">
          <PersonCard
            target={currentTarget}
            onEdit={() => dispatch({ type: 'OPEN_MODAL', target: currentTarget })}
          />
          <SessionBar
            session={state.sessions.find(s => s.id === state.currentSessionId) || null}
            sessions={state.sessions}
            onSelectSession={switchSession}
            onCreateSession={createNewSession}
          />
          <ContextBar analysis={state.currentAnalysis} />
          <PlanCard
            plan={state.currentPlan}
            onEdit={(plan) => dispatch({ type: 'SET_PLAN', plan })}
          />
          <AgentSteps phase={state.phase} />
          <AnalysisTabs analysis={state.currentAnalysis} />
        </div>

        {/* Right Panel - Chat Simulator */}
        <div className="w-[30%] min-w-[320px] max-w-105 flex flex-col bg-chat-bg">
          <ChatHeader
            targetName={currentTarget?.name || ''}
            onAIAssist={triggerAI}
            onReset={handleReset}
            isGenerating={state.phase === 'generating'}
          />
          <ChatHistory
            messages={state.messages}
            targetName={currentTarget?.name || ''}
          />
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

      {/* Reply Popup */}
      {state.phase === 'waiting_select' && state.currentReplies && (
        <ReplyPopup
          open={true}
          replies={state.currentReplies}
          onClose={() => {
            dispatch({ type: 'GENERATE_FAILURE', error: '' });
          }}
          onSelectReply={(reply) => selectReplyAction(reply)}
          onCustomReply={sendCustomReply}
          onRegenerate={handleRegenerate}
          onFeedback={handleFeedback}
        />
      )}

      {/* Modal */}
      <TargetModal
        open={state.modalOpen}
        target={state.editingTarget}
        onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
        onSave={handleSaveTarget}
      />
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;

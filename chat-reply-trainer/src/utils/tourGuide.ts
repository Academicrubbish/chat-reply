import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_KEY = 'chat-reply-tour-completed';
const JUST_REGISTERED_KEY = 'chat-reply-just-registered';

export function markJustRegistered() {
  sessionStorage.setItem(JUST_REGISTERED_KEY, 'true');
}

export function shouldStartTour(): boolean {
  return sessionStorage.getItem(JUST_REGISTERED_KEY) === 'true' && localStorage.getItem(TOUR_KEY) !== 'true';
}

function switchMobileTab(tab: 'chat' | 'ai') {
  // Trigger mobile tab switch by clicking the corresponding tab button
  const buttons = document.querySelectorAll('[data-tour-id="mobile-tab-bar"] button');
  if (buttons.length >= 2) {
    const idx = tab === 'chat' ? 0 : 1;
    (buttons[idx] as HTMLElement)?.click();
  }
}

export function startTour() {
  if (!shouldStartTour()) return;

  const isMobile = window.innerWidth < 768;

  const driverObj = driver({
    showProgress: true,
    doneBtnText: '完成',
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    onDestroyStarted: () => {
      localStorage.setItem(TOUR_KEY, 'true');
      sessionStorage.removeItem(JUST_REGISTERED_KEY);
      driverObj.destroy();
    },
    steps: isMobile ? [
      // Mobile: guide through tab switching
      {
        element: '[data-tour-id="target-selector"]',
        popover: {
          title: '🎯 选择聊天对象',
          description: '在这里切换、创建或删除聊天对象。每个对象拥有独立的对话记录、诊断方案和分析历史。',
          side: 'bottom' as const,
        },
      },
      {
        element: '[data-tour-id="mobile-tab-bar"]',
        popover: {
          title: '📱 切换面板',
          description: '标签栏在「聊天」和「AI 辅助」两个面板之间切换。聊天面板输入消息，AI 面板查看分析结果。',
          side: 'top' as const,
        },
        onHighlightStarted: () => { switchMobileTab('chat'); },
      },
      {
        element: '[data-tour-id="message-input"]',
        popover: {
          title: '💬 输入对方消息',
          description: '在聊天面板输入对方（她）发来的消息，也可以粘贴整段聊天记录批量导入。系统会根据消息内容进行智能分析。',
          side: 'top' as const,
        },
        onHighlightStarted: () => { switchMobileTab('chat'); },
      },
      {
        element: '[data-tour-id="ai-assist-btn"]',
        popover: {
          title: '🤖 AI 辅助分析',
          description: '输入消息后切换到 AI 面板，点击这里让 AI 自动诊断关系状态并生成多套回复方案。首次使用会自动制定聊天策略。',
          side: 'bottom' as const,
        },
        onHighlightStarted: () => { switchMobileTab('ai'); },
      },
      {
        element: '[data-tour-id="session-bar"]',
        popover: {
          title: '🛠 窗口与方案管理',
          description: '管理对话窗口、制定诊断方案（军师分析）、复盘聊天表现。点击「制定方案」可获取关系诊断和下一步建议。',
          side: 'bottom' as const,
        },
        onHighlightStarted: () => { switchMobileTab('ai'); },
      },
    ] : [
      // Desktop: original steps
      {
        element: '[data-tour-id="target-selector"]',
        popover: {
          title: '🎯 选择聊天对象',
          description: '在这里切换、创建或删除聊天对象。每个对象拥有独立的对话记录、诊断方案和分析历史。可以编辑人设信息来优化 AI 分析准确度。',
          side: 'bottom' as const,
        },
      },
      {
        element: '[data-tour-id="message-input"]',
        popover: {
          title: '💬 输入对方消息',
          description: '在右侧聊天窗口输入对方（她）发来的消息，也可以粘贴整段微信聊天记录批量导入。系统支持自动识别微信导出格式。',
          side: 'top' as const,
        },
      },
      {
        element: '[data-tour-id="ai-assist-btn"]',
        popover: {
          title: '🤖 AI 辅助分析',
          description: '输入消息后，点击这里让 AI 自动诊断关系状态并生成 3-4 套风格各异的回复方案。首次使用会自动制定聊天策略方案。',
          side: 'left' as const,
        },
      },
      {
        element: '[data-tour-id="ai-panel"]',
        popover: {
          title: '📊 AI 分析面板',
          description: '左侧面板展示 AI 的分析结果：关系诊断、信号分析、回复方案。你可以选择 AI 建议的回复，也可以自定义回复。支持多版本重新生成。',
          side: 'right' as const,
        },
      },
      {
        element: '[data-tour-id="session-bar"]',
        popover: {
          title: '🛠 窗口与方案管理',
          description: '管理对话窗口（新建/删除）、制定诊断方案（军师分析）、复盘聊天表现。工具栏还显示上下文使用量和模型选择。',
          side: 'bottom' as const,
        },
      },
    ],
  });

  driverObj.drive();
}

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

export function startTour() {
  if (!shouldStartTour()) return;

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
    steps: [
      {
        element: '[data-tour-id="target-selector"]',
        popover: {
          title: '选择聊天对象',
          description: '在这里切换、创建或删除聊天对象，每个对象独立管理对话记录。',
          side: 'bottom' as const,
        },
      },
      {
        element: '[data-tour-id="message-input"]',
        popover: {
          title: '输入消息',
          description: '在右侧聊天窗口输入对方发的消息，模拟真实对话场景。',
          side: 'top' as const,
        },
      },
      {
        element: '[data-tour-id="ai-assist-btn"]',
        popover: {
          title: 'AI 辅助分析',
          description: '输入消息后，点击这里让 AI 分析对方信号并给出多套回复方案。',
          side: 'left' as const,
        },
      },
      {
        element: '[data-tour-id="ai-panel"]',
        popover: {
          title: 'AI 分析面板',
          description: '左侧面板会显示 AI 的信号分析、策略建议和回复选项，选择合适的回复即可。',
          side: 'right' as const,
        },
      },
      {
        element: '[data-tour-id="session-bar"]',
        popover: {
          title: '窗口管理',
          description: '可以新建对话窗口、查看上下文用量、切换 AI 模型。',
          side: 'bottom' as const,
        },
      },
    ],
  });

  driverObj.drive();
}

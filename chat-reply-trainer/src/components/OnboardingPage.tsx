import React from 'react';
import { Button } from 'antd';

interface OnboardingPageProps {
  onStart: () => void;
}

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onStart }) => {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>💬</div>
        <h2 style={{ margin: 0, fontSize: 22 }}>欢迎使用聊天模拟器</h2>
        <div style={{ color: '#888', fontSize: 14, marginTop: 8, lineHeight: 1.8 }}>
          用 AI 帮你分析对方消息的隐藏信号<br />
          并生成多种风格的回复建议
        </div>
      </div>

      <Button type="primary" size="large" onClick={onStart} style={{ marginTop: 8, height: 44, paddingInline: 32, fontSize: 15, borderRadius: 8 }}>
        开始使用 — 创建第一个聊天对象
      </Button>

      <div style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>
        创建后会有新手引导帮助你熟悉界面
      </div>
    </div>
  );
};

export default OnboardingPage;

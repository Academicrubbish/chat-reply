import React from 'react';
import { Button } from 'antd';

interface OnboardingPageProps {
  onStart: () => void;
  isMobile?: boolean;
}

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onStart, isMobile = false }) => {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: isMobile ? 16 : 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: 8 }}>💬</div>
        <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22 }}>欢迎使用聊天模拟器</h2>
        <div style={{ color: '#888', fontSize: isMobile ? 13 : 14, marginTop: 8, lineHeight: 1.8, maxWidth: 280 }}>
          用 AI 帮你分析对方消息的隐藏信号<br />
          并生成多种风格的回复建议
        </div>
      </div>

      <Button type="primary" size="large" onClick={onStart} style={{ marginTop: 8, height: 44, paddingInline: isMobile ? 20 : 32, fontSize: isMobile ? 14 : 15, borderRadius: 8, maxWidth: '90vw' }}>
        {isMobile ? '创建第一个聊天对象' : '开始使用 — 创建第一个聊天对象'}
      </Button>

      <div style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>
        创建后会有新手引导帮助你熟悉界面
      </div>
    </div>
  );
};

export default OnboardingPage;

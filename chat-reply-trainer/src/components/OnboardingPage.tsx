import React from 'react';
import { Button } from 'antd';
import { UserAddOutlined, MessageOutlined, RobotOutlined } from '@ant-design/icons';

interface OnboardingPageProps {
  onStart: () => void;
}

const steps = [
  { icon: <UserAddOutlined style={{ fontSize: 24, color: '#667eea' }} />, title: '创建聊天对象', desc: '输入对方的名字和基本信息' },
  { icon: <MessageOutlined style={{ fontSize: 24, color: '#764ba2' }} />, title: '输入消息', desc: '在右侧聊天窗口模拟对话' },
  { icon: <RobotOutlined style={{ fontSize: 24, color: '#f48fb1' }} />, title: 'AI 辅助', desc: 'AI 分析信号并给出多套回复方案' },
];

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onStart }) => {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>🎯</div>
        <h2 style={{ margin: 0, fontSize: 20 }}>聊天回复训练器</h2>
        <div style={{ color: '#888', fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
          用 AI 帮你分析对方消息<br />并生成多种风格的回复建议
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, maxWidth: 600 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: 20, borderRadius: 12, background: '#fafafa', border: '1px solid #f0f0f0',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f0f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {s.icon}
            </div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>① {s.title}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{s.desc}</div>
          </div>
        ))}
      </div>

      <Button type="primary" size="large" onClick={onStart} style={{ marginTop: 8 }}>
        开始使用 — 创建第一个对象
      </Button>
    </div>
  );
};

export default OnboardingPage;

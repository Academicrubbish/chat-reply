import React from 'react';
import { Button } from 'antd';
import { UserOutlined, MessageOutlined, RobotOutlined, AimOutlined, ThunderboltOutlined } from '@ant-design/icons';

interface OnboardingPageProps {
  onStart: () => void;
  isMobile?: boolean;
}

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onStart, isMobile = false }) => {
  const steps = [
    { icon: <UserOutlined style={{ fontSize: 20, color: '#3b5998' }} />, title: '创建聊天对象', desc: '填写对方信息和人设，导入聊天记录' },
    { icon: <MessageOutlined style={{ fontSize: 20, color: '#3b5998' }} />, title: '输入对方消息', desc: '模拟对方发来的消息，支持微信记录导入' },
    { icon: <RobotOutlined style={{ fontSize: 20, color: '#3b5998' }} />, title: 'AI 智能分析', desc: '自动诊断关系状态，生成多套回复方案' },
    { icon: <AimOutlined style={{ fontSize: 20, color: '#3b5998' }} />, title: '策略复盘', desc: '军师分析 + 复盘评分，持续提升沟通技巧' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: isMobile ? 16 : 32, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{
          width: isMobile ? 56 : 72, height: isMobile ? 56 : 72, margin: '0 auto 12px',
          background: 'linear-gradient(135deg, #3b5998, #2d4373)', borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ThunderboltOutlined style={{ fontSize: isMobile ? 28 : 36, color: '#fff' }} />
        </div>
        <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 24, color: '#333' }}>
          聊天回复训练器
        </h1>
        <div style={{ color: '#888', fontSize: isMobile ? 13 : 14, marginTop: 8, lineHeight: 1.8, maxWidth: 320 }}>
          基于《魔鬼约会学》方法论的 AI 社交辅导系统<br />
          分析信号 · 制定策略 · 生成回复 · 复盘提升
        </div>
      </div>

      {/* 使用步骤 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360 }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 10,
            background: i === 0 ? '#e8f0fe' : '#f8f9fa',
            border: i === 0 ? '1px solid #b8d4f0' : '1px solid #eee',
          }}>
            <span style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{step.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
                <span style={{ color: '#3b5998', marginRight: 4 }}>Step {i + 1}</span>
                {step.title}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <Button type="primary" size="large" onClick={onStart} style={{
        marginTop: 8, height: 48, paddingInline: isMobile ? 24 : 40,
        fontSize: isMobile ? 15 : 16, borderRadius: 10, maxWidth: '90vw',
        background: 'linear-gradient(135deg, #3b5998, #2d4373)',
        boxShadow: '0 4px 12px rgba(59, 89, 152, 0.4)',
      }}>
        开始使用 — 创建第一个聊天对象
      </Button>

      <div style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>
        创建后会有新手引导帮助你熟悉界面
      </div>
    </div>
  );
};

export default OnboardingPage;

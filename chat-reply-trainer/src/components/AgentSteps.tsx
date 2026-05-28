import React from 'react';
import { Steps } from 'antd';
import type { AppPhase } from '../types';

interface AgentStepsProps {
  phase: AppPhase;
}

const STEPS = [
  { title: '分析消息' },
  { title: '识别信号' },
  { title: '匹配策略' },
  { title: '生成回复' },
];

function getCurrentStep(phase: AppPhase): number {
  switch (phase) {
    case 'idle':
    case 'her_sent':
      return -1;
    case 'generating':
      return 2;
    case 'waiting_select':
      return 3;
    default:
      return -1;
  }
}

function getStepStatus(phase: AppPhase): 'process' | 'finish' | 'error' {
  if (phase === 'waiting_select') return 'finish';
  if (phase === 'generating') return 'process';
  return 'finish';
}

const AgentSteps: React.FC<AgentStepsProps> = ({ phase }) => {
  const current = getCurrentStep(phase);
  const status = getStepStatus(phase);

  return (
    <div style={{ padding: '10px 20px', background: '#fafbff', borderBottom: '1px solid #ebeef5' }}>
      <Steps
        size="small"
        current={current}
        status={current < 0 ? 'wait' : status}
        items={STEPS}
      />
    </div>
  );
};

export default AgentSteps;

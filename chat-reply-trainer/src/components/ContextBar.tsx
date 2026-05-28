import React from 'react';
import { Tag, Progress } from 'antd';
import type { AnalysisData } from '../types';

interface ContextBarProps {
  analysis: AnalysisData | null;
}

const ContextBar: React.FC<ContextBarProps> = ({ analysis }) => {
  const favorability = analysis ? Math.max(0, Math.min(100, analysis.favorability ?? 0)) : 0;

  return (
    <div style={{ padding: '10px 20px', background: 'linear-gradient(to bottom right, #f0f4ff, #e8eeff)', borderBottom: '1px solid #e0e6f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {analysis?.stage && <Tag color="green">{analysis.stage}</Tag>}
        {analysis?.signal && <Tag color="blue">{analysis.signal}</Tag>}
        {analysis?.strategy && <Tag color="orange">{analysis.strategy}</Tag>}
        {!analysis && <Tag color="default">等待分析</Tag>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Progress
          percent={favorability}
          size="small"
          strokeColor={{ from: '#66bb6a', to: '#43a047' }}
          style={{ flex: 1, marginBottom: 0 }}
          showInfo
          format={() => `好感度 ${favorability}`}
        />
      </div>
    </div>
  );
};

export default ContextBar;

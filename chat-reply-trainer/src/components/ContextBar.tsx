import React from 'react';
import { Tag } from 'antd';
import type { AnalysisData } from '../types';

interface ContextBarProps {
  analysis: AnalysisData | null;
}

const ContextBar: React.FC<ContextBarProps> = ({ analysis }) => {
  if (!analysis?.stage && !analysis?.signal && !analysis?.strategy) return null;

  return (
    <div style={{ padding: '10px 20px', background: 'linear-gradient(to bottom right, #f0f4ff, #e8eeff)', borderBottom: '1px solid #e0e6f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {analysis?.stage && <Tag color="green">{analysis.stage}</Tag>}
        {analysis?.signal && <Tag color="blue">{analysis.signal}</Tag>}
        {analysis?.strategy && <Tag color="orange">{analysis.strategy}</Tag>}
      </div>
    </div>
  );
};

export default ContextBar;

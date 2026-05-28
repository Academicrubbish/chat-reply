import React from 'react';
import { Tabs, Tag, Alert } from 'antd';
import type { AnalysisData } from '../types';

interface AnalysisTabsProps {
  analysis: AnalysisData | null;
}

const AnalysisTabs: React.FC<AnalysisTabsProps> = ({ analysis }) => {
  if (!analysis) {
    return (
      <div>
        <Tabs
          items={[
            { key: 'signal', label: '信号解读' },
            { key: 'strategy', label: '策略建议' },
          ]}
          activeKey="signal"
          style={{ padding: '0 20px' }}
        />
        <div style={{ padding: '0 20px 10px' }}>
          <Alert message="发送对方消息后将自动分析" type="info" showIcon />
        </div>
      </div>
    );
  }

  return (
    <Tabs
      style={{ padding: '0 20px' }}
      items={[
        {
          key: 'signal',
          label: '信号解读',
          children: (
            <div style={{ background: '#fafbff', border: '1px solid #e8ecf4', borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>{analysis.signalText}</div>
              {analysis.emotions && analysis.emotions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {analysis.emotions.map((emotion, index) => (
                    <Tag key={index} color="blue">{emotion}</Tag>
                  ))}
                </div>
              )}
              {analysis.tip && (
                <Alert
                  message={analysis.tip}
                  type="warning"
                  showIcon
                  style={{ marginTop: 10 }}
                />
              )}
            </div>
          ),
        },
        {
          key: 'strategy',
          label: '策略建议',
          children: (
            <div style={{ background: '#fafbff', border: '1px solid #e8ecf4', borderRadius: 8, padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: '#333', marginBottom: 8 }}>
                推荐策略：<strong>{analysis.strategy}</strong>
              </div>
              {analysis.signalText && (
                <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6, marginBottom: 8 }}>{analysis.signalText}</div>
              )}
              {analysis.emotions && analysis.emotions.length > 0 && (
                <ul style={{ fontSize: 12, color: '#666', paddingLeft: 16, margin: 0 }}>
                  {analysis.emotions.map((item, index) => (
                    <li key={index} style={{ marginBottom: 4 }}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ),
        },
      ]}
    />
  );
};

export default AnalysisTabs;

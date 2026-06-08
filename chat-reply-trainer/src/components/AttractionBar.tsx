import React from 'react';
import { HeartFilled } from '@ant-design/icons';

interface AttractionBarProps {
  attraction: { score: number; reason: string } | null;
  isMobile?: boolean;
}

const getColor = (score: number) =>
  score >= 80 ? '#f5222d' : score >= 60 ? '#eb2f96' : score >= 30 ? '#fa8c16' : '#999';

const AttractionBar: React.FC<AttractionBarProps> = ({ attraction, isMobile = false }) => {
  if (!attraction) return null;
  const color = getColor(attraction.score);
  return (
    <div style={{
      display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 8,
      padding: isMobile ? '6px 12px' : '8px 20px',
      borderLeft: `4px solid ${color}`,
      background: `${color}10`,
      borderBottom: '1px solid #ebeef5',
      flexShrink: 0,
      transition: 'all 0.5s ease',
      flexDirection: isMobile ? 'column' : 'row',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <HeartFilled style={{ color, fontSize: 16 }} />
        <span style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>
          {attraction.score}
        </span>
      </div>
      <span style={{
        fontSize: 12, color: '#666',
        flex: 1, minWidth: 0,
      }}>
        {attraction.reason}
      </span>
    </div>
  );
};

export default AttractionBar;

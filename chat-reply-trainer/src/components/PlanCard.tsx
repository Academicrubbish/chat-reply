import React from 'react';
import { Button, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface PlanCardProps {
  plan: { goal: string; nextStep: string } | null;
  onEdit: (plan: { goal: string; nextStep: string }) => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onEdit }) => {
  if (!plan) {
    return (
      <div style={{ padding: '10px 20px', background: 'linear-gradient(to bottom right, #f3e5f5, #e8eeff)', borderBottom: '1px solid #e0d6f0', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>暂无策略目标</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>发送消息后自动生成</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 20px', background: 'linear-gradient(to bottom right, #f3e5f5, #e8eeff)', borderBottom: '1px solid #e0d6f0', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
          <Text style={{ fontSize: 11, color: '#3b5998', fontWeight: 500, marginRight: 4 }}>当前目标</Text>
          {plan.goal}
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          <Text style={{ fontSize: 11, color: '#3b5998', fontWeight: 500, marginRight: 4 }}>下一步建议</Text>
          {plan.nextStep}
        </div>
      </div>
      <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(plan)}>
        编辑
      </Button>
    </div>
  );
};

export default PlanCard;

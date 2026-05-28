import React from 'react';
import { Avatar, Tag, Button } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { ChatTarget } from '../types';

interface PersonCardProps {
  target: ChatTarget | null;
  onEdit: () => void;
}

const tagColorMap: Record<string, string> = {
  aggressive: 'red',
  moderate: 'blue',
  conservative: 'green',
  practice: 'cyan',
  pursuing: 'magenta',
  friendship: 'geekblue',
};

const tagLabelMap: Record<string, string> = {
  aggressive: '进攻型',
  moderate: '适中',
  conservative: '保守型',
  practice: '练习聊天',
  pursuing: '追求中',
  friendship: '交朋友',
};

const PersonCard: React.FC<PersonCardProps> = ({ target, onEdit }) => {
  if (!target) {
    return (
      <div style={{ padding: '12px 20px', background: '#fafbff', borderBottom: '1px solid #ebeef5', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar size={44} style={{ backgroundColor: '#f48fb1' }}>?</Avatar>
        <div>请选择或新建对象</div>
      </div>
    );
  }

  const tags = [
    target.meet_scene,
    target.goal_intent,
    target.tone_level,
  ].filter(Boolean);

  return (
    <div style={{ padding: '12px 20px', background: '#fafbff', borderBottom: '1px solid #ebeef5', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <Avatar size={44} style={{ backgroundColor: '#f48fb1', flexShrink: 0 }}>
        {target.name.charAt(0)}
      </Avatar>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{target.name}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {tags.map((tag, index) => (
            <Tag key={index} color={tagColorMap[tag] || 'default'}>
              {tagLabelMap[tag] || tag}
            </Tag>
          ))}
        </div>
      </div>
      <Button size="small" icon={<EditOutlined />} onClick={onEdit}>
        编辑人设
      </Button>
    </div>
  );
};

export default PersonCard;

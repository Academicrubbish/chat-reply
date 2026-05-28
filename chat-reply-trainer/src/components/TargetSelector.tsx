import { Dropdown, Avatar } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ChatTarget } from '../types';

interface TargetSelectorProps {
  targets: ChatTarget[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onDelete: (id: string) => void;
}

export default function TargetSelector({ targets, currentId, onSelect, onCreateNew, onDelete }: TargetSelectorProps) {
  const current = targets.find(t => t.id === currentId);

  const menuItems: MenuProps['items'] = [
    ...targets.map(t => ({
      key: t.id,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', minWidth: 200 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
          <DeleteOutlined
            style={{ color: '#ccc', fontSize: 12 }}
            onClick={e => { e.stopPropagation(); onDelete(t.id); }}
          />
        </div>
      ),
      onClick: () => onSelect(t.id),
    })),
    { type: 'divider' as const },
    {
      key: 'create',
      icon: <PlusOutlined />,
      label: '新建聊天对象',
      onClick: () => onCreateNew(),
    },
  ];

  return (
    <Dropdown menu={{ items: menuItems, selectedKeys: currentId ? [currentId] : [] }} trigger={['click']}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
        <Avatar size={24} style={{ backgroundColor: '#3b5998', fontSize: 12 }}>
          {current ? current.name.charAt(0).toUpperCase() : '?'}
        </Avatar>
        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? current.name : '选择聊天对象'}
        </span>
      </div>
    </Dropdown>
  );
}

import { Button, Popconfirm, Segmented } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { GenerateMode } from "../types";
export default function ChatHeader({
  targetName,
  onReset,
  aiMode,
  onAiModeChange,
}: {
  targetName: string;
  onReset: () => void;
  aiMode: GenerateMode;
  onAiModeChange: (mode: GenerateMode) => void;
  isMobile?: boolean;
}) {
  return (
    <header className="chat-header">
      <div className="chat-header-top">
        <div>
          <span className="eyebrow">THE CONVERSATION</span>
          <h2 title={`与 ${targetName} 的对话`}>与 {targetName} 的对话</h2>
        </div>
        <Popconfirm
          title="清空所有聊天记录？"
          description="此操作不可恢复"
          onConfirm={onReset}
          okText="清空"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="text"
            aria-label="清空聊天记录"
            icon={<DeleteOutlined />}
          />
        </Popconfirm>
      </div>
      <div className="chat-header-bottom">
        <span>记录此刻，理解彼此。</span>
        <Segmented
          aria-label="回复生成模式"
          value={aiMode}
          onChange={(v) => onAiModeChange(v as GenerateMode)}
          options={[
            { label: "细腻", value: "full" },
            { label: "快速", value: "quick" },
          ]}
        />
      </div>
    </header>
  );
}

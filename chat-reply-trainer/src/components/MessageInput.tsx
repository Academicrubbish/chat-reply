import { useState } from "react";
import { Input, Button } from "antd";
import { ArrowUpOutlined } from "@ant-design/icons";
export default function MessageInput({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (text: string) => void | Promise<void>;
  disabled: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const send = async () => {
    const value = text.trim();
    if (!value || disabled || sending) return;
    setSending(true);
    try {
      await onSend(value);
      setText("");
    } catch {
      /* The parent displays the error; preserve the draft. */
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="composer" data-tour-id="message-input">
      <label htmlFor="incoming-message">对方刚刚说了什么？</label>
      <div className="composer-field">
        <Input.TextArea
          id="incoming-message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              e.nativeEvent.keyCode !== 229 &&
              !window.matchMedia("(pointer: coarse)").matches
            ) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={placeholder || "输入对方的消息…"}
          disabled={disabled || sending}
          autoSize={{ minRows: 2, maxRows: 5 }}
        />
        <Button
          type="primary"
          aria-label="添加对方的消息"
          icon={<ArrowUpOutlined />}
          disabled={!text.trim() || disabled}
          loading={sending}
          onClick={() => void send()}
        />
      </div>
      <div className="composer-foot">
        <span>只记录在这里，不会发送给对方</span>
        <span className="keyboard-hint">Enter 添加 · Shift + Enter 换行</span>
      </div>
    </div>
  );
}

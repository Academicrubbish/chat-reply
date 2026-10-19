import { useState } from "react";
import { Alert, Button, Input } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import * as api from "../services/api";
import { markJustRegistered } from "../utils/tourGuide";
import Brand, { ConversationArt } from "./Brand";
export default function AuthPage({
  mode,
  onSuccess,
  onSwitch,
}: {
  mode: "login" | "signup" | "setup";
  onSuccess: () => void;
  onSwitch?: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const registering = mode !== "login";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (!username.trim() || !password) {
      setError("请填写用户名和密码");
      return;
    }
    if (registering && password.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }
    if (registering && password !== confirmation) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const action =
        mode === "login"
          ? api.login
          : mode === "setup"
            ? api.setupAccount
            : api.register;
      const { token } = await action(username.trim(), password);
      localStorage.setItem("token", token);
      if (registering) markJustRegistered();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "暂时无法连接，请稍后重试");
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand light />
        <div className="auth-story-copy">
          <span className="eyebrow">LESS OVERTHINKING. MORE CONNECTION.</span>
          <h1>
            让对话自然发生，
            <br />
            <em>让心意恰好表达。</em>
          </h1>
          <p>
            读懂字里行间的情绪，找到属于你的表达。
            <br />
            一个陪你把话说好的 AI 聊天伙伴。
          </p>
        </div>
        <ConversationArt />
        <footer>
          懂得倾听，也懂得回应。<span>01 — START A CONVERSATION</span>
        </footer>
      </section>
      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <form className="auth-form" onSubmit={submit}>
          <span className="eyebrow">YOUR CONVERSATION STUDIO</span>
          <h2>
            {mode === "login"
              ? "好久不见。"
              : mode === "setup"
                ? "从这里，开始。"
                : "很高兴认识你。"}
          </h2>
          <p>
            {mode === "login"
              ? "登录言外，继续那些值得用心的对话。"
              : "创建账号，开启你的第一段对话。"}
          </p>
          <label htmlFor="username">用户名</label>
          <Input
            id="username"
            autoComplete="username"
            placeholder="你的名字"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            size="large"
            maxLength={80}
          />
          <label htmlFor="password">密码</label>
          <Input.Password
            id="password"
            autoComplete={registering ? "new-password" : "current-password"}
            placeholder={registering ? "至少 6 位字符" : "输入密码"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            size="large"
          />
          {registering && (
            <>
              <label htmlFor="confirmation">确认密码</label>
              <Input.Password
                id="confirmation"
                autoComplete="new-password"
                placeholder="再次输入密码"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                size="large"
              />
            </>
          )}
          {error && <Alert role="alert" type="error" showIcon title={error} />}
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            size="large"
          >
            {mode === "login" ? "进入我的工作台" : "创建账号并开始"}
            <ArrowRightOutlined />
          </Button>
          {onSwitch && (
            <div className="auth-switch">
              {registering ? "已经有账号？" : "第一次来到这里？"}
              <button type="button" onClick={onSwitch}>
                {registering ? "去登录" : "创建账号"} ↗
              </button>
            </div>
          )}
          <div className="auth-footnote">表达由你决定，言外帮你多想一步。</div>
        </form>
      </section>
    </main>
  );
}

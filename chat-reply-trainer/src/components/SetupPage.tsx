import React, { useState } from 'react';
import { Input, Button, message } from 'antd';
import * as api from '../services/api';

interface SetupPageProps {
  onSuccess: () => void;
}

const SetupPage: React.FC<SetupPageProps> = ({ onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!username.trim()) { setError('用户名不能为空'); return; }
    if (password.length < 6) { setError('密码至少6位'); return; }
    if (password !== confirmPassword) { setError('两次密码不一致'); return; }

    setLoading(true);
    try {
      const { token } = await api.setupAccount(username.trim(), password);
      localStorage.setItem('token', token);
      onSuccess();
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ width: 360, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, margin: '0 auto 12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 20 }}>AI</div>
          <h2 style={{ margin: 0, fontSize: 18 }}>创建管理员账号</h2>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>首次使用，请设置登录凭据</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} size="large" />
          <Input.Password placeholder="密码（至少6位）" value={password} onChange={e => setPassword(e.target.value)} size="large" />
          <Input.Password placeholder="确认密码" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} size="large" onPressEnter={handleSubmit} />
          {error && <div style={{ color: '#ff4d4f', fontSize: 12 }}>{error}</div>}
          <Button type="primary" block size="large" loading={loading} onClick={handleSubmit}>创建并登录</Button>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;

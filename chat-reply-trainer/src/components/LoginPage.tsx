import React, { useState } from 'react';
import { Input, Button } from 'antd';
import * as api from '../services/api';

interface LoginPageProps {
  onSuccess: () => void;
  onSwitchToSignUp: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onSwitchToSignUp }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!username || !password) { setError('请输入用户名和密码'); return; }

    setLoading(true);
    try {
      const { token } = await api.login(username, password);
      localStorage.setItem('token', token);
      onSuccess();
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ width: 360, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, margin: '0 auto 12px', background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 20 }}>AI</div>
          <h2 style={{ margin: 0, fontSize: 18 }}>登录</h2>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Chat Reply Trainer</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} size="large" />
          <Input.Password placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} size="large" onPressEnter={handleSubmit} />
          {error && <div style={{ color: '#ff4d4f', fontSize: 12 }}>{error}</div>}
          <Button type="primary" block size="large" loading={loading} onClick={handleSubmit}>登录</Button>
        </div>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#888' }}>
          没有账号？
          <span style={{ color: '#3b5998', cursor: 'pointer', marginLeft: 4 }} onClick={onSwitchToSignUp}>注册</span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

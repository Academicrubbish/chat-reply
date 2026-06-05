import { useEffect, useState, useRef } from 'react';
import { Modal, Form, Input, Radio, Space, Row, Col, Card, Alert, Typography, Select, Button } from 'antd';
import { WechatOutlined, EnvironmentOutlined, PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ChatTarget } from '../types';
import { parseChatWithMeta } from '../utils/parseChat';
import type { ParseResult, NicknameMap } from '../utils/parseChat';

interface TargetModalProps {
  open: boolean;
  target?: ChatTarget | null;
  onClose: () => void;
  onSave: (data: any) => void;
}

interface FormValues {
  name: string;
  meet_scene: string;
  persona: string;
  hobbies: string;
  recent_chats: string;
  tone_level: 'aggressive' | 'moderate' | 'conservative';
  goal_intent: 'practice' | 'pursuing' | 'friendship';
  forbidden_topics: string;
}

export default function TargetModal({ open, target, onClose, onSave }: TargetModalProps) {
  const [form] = Form.useForm<FormValues>();
  const isEditing = !!target;
  const [parsedResult, setParsedResult] = useState<ParseResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // WeChat nickname mapping state
  const [wechatNicknames, setWechatNicknames] = useState<string[]>([]);
  const [herNickname, setHerNickname] = useState<string>('');
  const [meNickname, setMeNickname] = useState<string>('');

  // Inline scene insert in preview
  const [insertSceneIndex, setInsertSceneIndex] = useState<number | null>(null);
  const [insertSceneText, setInsertSceneText] = useState('');

  const rawChatText = Form.useWatch('recent_chats', form);
  const nameValue = Form.useWatch('name', form);

  useEffect(() => {
    if (open && target) {
      form.setFieldsValue({
        name: target.name,
        meet_scene: target.meet_scene,
        persona: target.persona,
        hobbies: target.hobbies,
        recent_chats: target.recent_chats,
        tone_level: target.tone_level,
        goal_intent: target.goal_intent,
        forbidden_topics: target.forbidden_topics,
      });
    } else if (open) {
      form.resetFields();
      setParsedResult(null);
      setWechatNicknames([]);
      setHerNickname('');
      setMeNickname('');
    }
  }, [open, target, form]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (rawChatText?.trim()) {
        const result = parseChatWithMeta(rawChatText, nameValue);
        setParsedResult(result);

        // Detect WeChat format
        if (result.nicknames && result.nicknames.length >= 2 && result.messages.length === 0) {
          setWechatNicknames(result.nicknames);
          // Auto-select: use nameValue to match her nickname
          const matched = result.nicknames.find(n =>
            nameValue && n.includes(nameValue)
          );
          if (matched) {
            setHerNickname(matched);
            setMeNickname(result.nicknames.find(n => n !== matched) || '');
          } else {
            setHerNickname(result.nicknames[0]);
            setMeNickname(result.nicknames[1]);
          }
        } else {
          setWechatNicknames([]);
        }
      } else {
        setParsedResult(null);
        setWechatNicknames([]);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rawChatText, nameValue]);

  const handleNicknameConfirm = () => {
    if (!herNickname || !meNickname || !rawChatText?.trim()) return;
    const map: NicknameMap = { herNick: herNickname, meNick: meNickname };
    const result = parseChatWithMeta(rawChatText, nameValue, map);
    setParsedResult(result);
  };

  const handleInsertScene = (index: number) => {
    const text = insertSceneText.trim();
    if (!text || !parsedResult) return;
    const msgs = [...parsedResult.messages];
    msgs.splice(index, 0, { role: 'scene', text });
    // Rebuild raw text from messages
    const lines = msgs.map(m => m.role === 'scene' ? `场景：${m.text}` : m.role === 'her' ? `她：${m.text}` : `我：${m.text}`);
    form.setFieldValue('recent_chats', lines.join('\n'));
    setInsertSceneIndex(null);
    setInsertSceneText('');
  };

  function handleOk() {
    form.validateFields().then(values => {
      // Attach nicknameMap for WeChat format
      const data: any = { ...values };
      if (wechatNicknames.length >= 2 && herNickname && meNickname) {
        data.nicknameMap = { herNick: herNickname, meNick: meNickname };
      }
      onSave(data);
    });
  }

  const showNicknamePicker = wechatNicknames.length >= 2;

  const msgCount = parsedResult?.messages.length ?? 0;
  const herCount = parsedResult?.messages.filter(m => m.role === 'her').length ?? 0;
  const meCount = msgCount - herCount;

  return (
    <Modal
      title={isEditing ? `编辑人设 - ${target!.name}` : '新建聊天对象'}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="保存"
      cancelText="取消"
      width="min(95vw, 960px)"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ tone_level: 'moderate', goal_intent: 'practice' }}
        style={{ marginTop: 16 }}
      >
        <Row gutter={32}>
          {/* 左侧：人设信息 */}
          <Col span={12}>
            <Form.Item label="名字" name="name" rules={[{ required: true, message: '请输入名字' }]}>
              <Input />
            </Form.Item>

            <Form.Item label="兴趣爱好" name="hobbies">
              <Input />
            </Form.Item>

            <Form.Item label="认识场景" name="meet_scene">
              <Input.TextArea rows={3} />
            </Form.Item>

            <Form.Item label="人设描述" name="persona">
              <Input.TextArea rows={3} />
            </Form.Item>

            <Form.Item label="语气风格" name="tone_level">
              <Radio.Group>
                <Space>
                  <Radio value="aggressive">进攻型</Radio>
                  <Radio value="moderate">适中</Radio>
                  <Radio value="conservative">保守型</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="目标意图" name="goal_intent">
              <Radio.Group>
                <Space>
                  <Radio value="practice">练习聊天</Radio>
                  <Radio value="pursuing">追求中</Radio>
                  <Radio value="friendship">交朋友</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            <Form.Item label="禁忌话题（逗号分隔）" name="forbidden_topics">
              <Input placeholder="例：政治, 宗教" />
            </Form.Item>
          </Col>

          {/* 右侧：聊天记录 */}
          <Col span={12}>
            <Form.Item label="最近聊天内容" name="recent_chats">
              <Input.TextArea rows={8} placeholder={"她：你在干嘛\n我：在加班呢\n场景：过了两天没联系\n她：最近忙吗"} />
            </Form.Item>

            <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: -8, marginBottom: 12 }}>
              支持格式：
              <span style={{ color: '#f48fb1' }}>她：xxx</span> /
              <span style={{ color: '#66bb6a' }}>我：xxx</span> /
              <span style={{ color: '#8c6d1f' }}>场景：xxx</span> ← 插入背景说明 /
              微信聊天记录导出
            </Typography.Text>

            <Alert
              type="info"
              showIcon
              style={{ fontSize: 11, marginBottom: 12, padding: '6px 10px' }}
              title={
                <span>
                  <b>微信记录导入：</b>在微信中长按消息 → 多选 → 选择最右侧邮件转发 → 进入发送页 → 长按该条邮件 → 全选复制 → 粘贴到此处。（无需发送真实邮件）
                  系统会自动识别参与者，你只需选择谁是「她」谁是「我」即可。
                </span>
              }
            />

            {/* WeChat nickname picker */}
            {showNicknamePicker && (
              <div style={{
                marginBottom: 12, padding: '8px 10px',
                background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 6,
              }}>
                <div style={{ fontSize: 11, color: '#096dd9', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <WechatOutlined /> 检测到微信导出格式，共 {wechatNicknames.length} 位参与者，请选择角色映射：
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#f48fb1', fontWeight: 500 }}>她：</span>
                    <Select
                      size="small"
                      value={herNickname}
                      onChange={setHerNickname}
                      style={{ minWidth: 140 }}
                      options={wechatNicknames.map(n => ({ label: n, value: n }))}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#66bb6a', fontWeight: 500 }}>我：</span>
                    <Select
                      size="small"
                      value={meNickname}
                      onChange={setMeNickname}
                      style={{ minWidth: 140 }}
                      options={wechatNicknames.map(n => ({ label: n, value: n }))}
                    />
                  </div>
                  <Button size="small" type="primary" onClick={handleNicknameConfirm}
                    disabled={!herNickname || !meNickname || herNickname === meNickname}>
                    确认
                  </Button>
                </div>
                {herNickname === meNickname && herNickname && (
                  <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 4 }}>「她」和「我」不能选同一个人</div>
                )}
              </div>
            )}

            {parsedResult && msgCount > 0 && (
              <Card
                size="small"
                title={
                  <span style={{ fontSize: 12 }}>
                    解析预览 · {msgCount} 条消息（她: {herCount}，我: {meCount}）
                  </span>
                }
              >
                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Insert scene at the top */}
                  {insertSceneIndex === 0 ? (
                    <div style={{
                      background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4,
                      padding: '4px 6px', display: 'flex', gap: 4, alignItems: 'center',
                    }}>
                      <EnvironmentOutlined style={{ color: '#8c6d1f', fontSize: 10 }} />
                      <Input
                        size="small"
                        value={insertSceneText}
                        onChange={e => setInsertSceneText(e.target.value)}
                        placeholder="输入场景描述..."
                        style={{ flex: 1, fontSize: 11 }}
                        autoFocus
                        onPressEnter={() => handleInsertScene(0)}
                      />
                      <Button size="small" type="link" icon={<CheckOutlined />} style={{ fontSize: 10 }}
                        onClick={() => handleInsertScene(0)} />
                      <Button size="small" type="link" icon={<CloseOutlined />} style={{ fontSize: 10 }}
                        onClick={() => { setInsertSceneIndex(null); setInsertSceneText(''); }} />
                    </div>
                  ) : (
                    <div
                      style={{ textAlign: 'center', opacity: 0.5 }}
                      className="hover:opacity-100 cursor-pointer"
                      onClick={() => setInsertSceneIndex(0)}
                    >
                      <PlusOutlined style={{ fontSize: 10, color: '#8c6d1f' }} />
                      <span style={{ fontSize: 10, color: '#8c6d1f', marginLeft: 2 }}>场景</span>
                    </div>
                  )}

                  {parsedResult.messages.map((msg, i) => (
                    <div key={i}>
                      {msg.role === 'scene' ? (
                        <div style={{
                          background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6,
                          padding: '3px 10px', fontSize: 12, lineHeight: 1.5, color: '#8c6d1f',
                          wordBreak: 'break-all', whiteSpace: 'pre-wrap', textAlign: 'center',
                        }}>
                          {msg.text}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: msg.role === 'her' ? 'flex-start' : 'flex-end' }}>
                          <div style={{
                            maxWidth: '80%',
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontSize: 12,
                            lineHeight: 1.5,
                            background: msg.role === 'her' ? '#fff' : '#95ec69',
                            border: msg.role === 'her' ? '1px solid #e8e8e8' : 'none',
                            wordBreak: 'break-all',
                            whiteSpace: 'pre-wrap',
                          }}>
                            <span style={{ color: '#999', fontSize: 10, marginRight: 4 }}>
                              {msg.role === 'her' ? '她' : '我'}
                            </span>
                            {msg.text}
                          </div>
                        </div>
                      )}

                      {/* Insert scene between messages */}
                      {insertSceneIndex === i + 1 ? (
                        <div style={{
                          background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4,
                          padding: '4px 6px', marginTop: 2, display: 'flex', gap: 4, alignItems: 'center',
                        }}>
                          <EnvironmentOutlined style={{ color: '#8c6d1f', fontSize: 10 }} />
                          <Input
                            size="small"
                            value={insertSceneText}
                            onChange={e => setInsertSceneText(e.target.value)}
                            placeholder="输入场景描述..."
                            style={{ flex: 1, fontSize: 11 }}
                            autoFocus
                            onPressEnter={() => handleInsertScene(i + 1)}
                          />
                          <Button size="small" type="link" icon={<CheckOutlined />} style={{ fontSize: 10 }}
                            onClick={() => handleInsertScene(i + 1)} />
                          <Button size="small" type="link" icon={<CloseOutlined />} style={{ fontSize: 10 }}
                            onClick={() => { setInsertSceneIndex(null); setInsertSceneText(''); }} />
                        </div>
                      ) : (
                        <div
                          style={{ textAlign: 'center', opacity: 0.5 }}
                          className="hover:opacity-100 cursor-pointer"
                          onClick={() => setInsertSceneIndex(i + 1)}
                        >
                          <PlusOutlined style={{ fontSize: 10, color: '#8c6d1f' }} />
                          <span style={{ fontSize: 10, color: '#8c6d1f', marginLeft: 2 }}>场景</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {parsedResult.warnings.map((w, i) => (
                  <Alert key={i} title={w} type="warning" showIcon style={{ marginTop: 8, fontSize: 11 }} />
                ))}
              </Card>
            )}
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}

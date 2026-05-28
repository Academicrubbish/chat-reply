import { useEffect, useState, useRef } from 'react';
import { Modal, Form, Input, Radio, Space, Row, Col, Card, Alert, Typography } from 'antd';
import type { ChatTarget } from '../types';
import { parseChatWithMeta } from '../utils/parseChat';
import type { ParseResult } from '../utils/parseChat';

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
    }
  }, [open, target, form]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (rawChatText?.trim()) {
        setParsedResult(parseChatWithMeta(rawChatText, nameValue));
      } else {
        setParsedResult(null);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rawChatText, nameValue]);

  function handleOk() {
    form.validateFields().then(values => {
      onSave(values);
    });
  }

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
      width={960}
      destroyOnClose
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
              <Input.TextArea rows={8} placeholder="粘贴聊天记录，支持多种格式..." />
            </Form.Item>

            <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: -8, marginBottom: 12 }}>
              支持格式：她：xxx / 我：xxx / 【她】xxx / 【我】xxx / 她 &gt; xxx / 我 &gt; xxx / 他：xxx / 【他】xxx / 他 &gt; xxx（混合使用也可）
            </Typography.Text>

            {parsedResult && msgCount > 0 && (
              <Card
                size="small"
                title={
                  <span style={{ fontSize: 12 }}>
                    解析预览 · {msgCount} 条消息（她: {herCount}，我: {meCount}）
                  </span>
                }
              >
                <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {parsedResult.messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'her' ? 'flex-start' : 'flex-end' }}>
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
                  ))}
                </div>
                {parsedResult.warnings.map((w, i) => (
                  <Alert key={i} message={w} type="warning" showIcon style={{ marginTop: 8, fontSize: 11 }} />
                ))}
              </Card>
            )}
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}

import { useEffect, useState, useRef } from 'react';
import { Modal, Form, Input, Radio, Space, Row, Col, Alert } from 'antd';
import type { ChatTarget } from '../types';
import { parseChatWithMeta } from '../utils/parseChat';
import type { NicknameMap } from '../utils/parseChat';
import ChatImportPreview from './ChatImportPreview';

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
  const [parsedResult, setParsedResult] = useState<{ messages: any[]; warnings: string[]; nicknames?: string[] } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [wechatNicknames, setWechatNicknames] = useState<string[]>([]);
  const [herNickname, setHerNickname] = useState<string>('');
  const [meNickname, setMeNickname] = useState<string>('');
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

        if (result.nicknames && result.nicknames.length >= 2 && result.messages.length === 0) {
          setWechatNicknames(result.nicknames);
          const matched = result.nicknames.find(n => nameValue && n.includes(nameValue));
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
    const lines = msgs.map((m: any) => m.role === 'scene' ? `场景：${m.text}` : m.role === 'her' ? `她：${m.text}` : `我：${m.text}`);
    form.setFieldValue('recent_chats', lines.join('\n'));
    setInsertSceneIndex(null);
    setInsertSceneText('');
  };

  function handleOk() {
    form.validateFields().then(values => {
      const data: any = { ...values };
      if (wechatNicknames.length >= 2 && herNickname && meNickname) {
        data.nicknameMap = { herNick: herNickname, meNick: meNickname };
      }
      onSave(data);
    });
  }

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
          <Col span={12}>
            <Form.Item label="名字" name="name" rules={[{ required: true, message: '请输入名字' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="兴趣爱好" name="hobbies">
              <Input.TextArea rows={3} maxLength={1000} showCount />
            </Form.Item>
            <Form.Item label="认识场景" name="meet_scene">
              <Input.TextArea rows={3} maxLength={1000} showCount />
            </Form.Item>
            <Form.Item label="人设描述" name="persona">
              <Input.TextArea rows={3} maxLength={1000} showCount />
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

          <Col span={12}>
            {isEditing ? (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 30 }}
                title="聊天记录请在右侧聊天面板中管理"
                description="支持手动输入、批量导入、编辑和删除消息"
              />
            ) : (
              <>
                <Form.Item label="最近聊天内容" name="recent_chats">
                  <Input.TextArea rows={8} maxLength={30000} showCount placeholder={"她：你在干嘛\n我：在加班呢\n场景：过了两天没联系\n她：最近忙吗"} />
                </Form.Item>
                <div style={{ fontSize: 11, color: '#999', marginTop: -8, marginBottom: 12 }}>
                  支持格式：
                  <span style={{ color: '#f48fb1' }}>她：xxx</span> /
                  <span style={{ color: '#66bb6a' }}>我：xxx</span> /
                  <span style={{ color: '#8c6d1f' }}>场景：xxx</span> ← 插入背景说明 /
                  微信聊天记录导出
                </div>
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
                <ChatImportPreview
                  messages={parsedResult?.messages ?? []}
                  warnings={parsedResult?.warnings ?? []}
                  wechatNicknames={wechatNicknames}
                  herNickname={herNickname}
                  meNickname={meNickname}
                  onHerNicknameChange={setHerNickname}
                  onMeNicknameChange={setMeNickname}
                  onNicknameConfirm={handleNicknameConfirm}
                  insertSceneIndex={insertSceneIndex}
                  insertSceneText={insertSceneText}
                  onSetInsertSceneIndex={setInsertSceneIndex}
                  onSetInsertSceneText={setInsertSceneText}
                  onInsertScene={handleInsertScene}
                  variant="card"
                />
              </>
            )}
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}

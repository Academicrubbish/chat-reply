import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import * as api from "../services/api";
import type {
  WeChatBinding,
  WeChatContact,
  WeChatReaderStatus,
  WeChatSyncPreview,
} from "../types";

interface WeChatSyncPanelProps {
  targetId: string;
  targetName: string;
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

const RANGE_OPTIONS = [
  { value: 1, label: "最近 1 天" },
  { value: 7, label: "最近 7 天" },
  { value: 30, label: "最近 30 天" },
  { value: 90, label: "最近 90 天" },
  { value: 0, label: "最近可读的 1000 条" },
];

function createRange(days: number): api.WeChatSyncRange {
  if (days <= 0) return { limit: 1000 };
  const before = Date.now();
  return {
    after: before - days * 24 * 60 * 60 * 1000,
    before,
    limit: 1000,
  };
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function roleLabel(role: "her" | "me" | "scene", targetName: string): string {
  if (role === "me") return "我";
  if (role === "scene") return "系统";
  return targetName || "对方";
}

const WeChatSyncPanel = ({
  targetId,
  targetName,
  onClose,
  onImported,
}: WeChatSyncPanelProps) => {
  const [status, setStatus] = useState<WeChatReaderStatus | null>(null);
  const [binding, setBinding] = useState<WeChatBinding | null>(null);
  const [contacts, setContacts] = useState<WeChatContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [query, setQuery] = useState(targetName);
  const [rangeDays, setRangeDays] = useState(30);
  const [preview, setPreview] = useState<WeChatSyncPreview | null>(null);
  const [checking, setChecking] = useState(true);
  const [searching, setSearching] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadStatus = async () => {
    setChecking(true);
    setError("");
    try {
      setStatus(await api.getWeChatStatus());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Reader 状态检查失败");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([api.getWeChatStatus(), api.getWeChatBinding(targetId)])
      .then(([nextStatus, bindingResult]) => {
        if (!active) return;
        setStatus(nextStatus);
        setBinding(bindingResult.binding);
        if (bindingResult.binding) {
          const boundContact: WeChatContact = {
            id: bindingResult.binding.contact_id,
            name: bindingResult.binding.contact_name || bindingResult.binding.contact_id,
            type: "private",
          };
          setContacts([boundContact]);
          setSelectedContactId(boundContact.id);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "微信同步状态加载失败");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [targetId]);

  const contactOptions = useMemo(
    () => contacts.map(contact => ({
      value: contact.id,
      label: `${contact.name}${contact.type === "group" ? "（群聊）" : ""}`,
    })),
    [contacts],
  );

  const handleSearch = async (searchValue?: string) => {
    const keyword = (searchValue ?? query).trim();
    setSearching(true);
    setError("");
    setSuccess("");
    try {
      const result = await api.searchWeChatContacts(keyword);
      const merged = binding
        ? [
            {
              id: binding.contact_id,
              name: binding.contact_name || binding.contact_id,
              type: "private" as const,
            },
            ...result.contacts,
          ]
        : result.contacts;
      setContacts([...new Map(merged.map(contact => [contact.id, contact])).values()]);
      if (result.contacts.length === 1) setSelectedContactId(result.contacts[0].id);
      if (result.contacts.length === 0) setError("没有找到匹配的微信联系人");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "联系人查询失败");
    } finally {
      setSearching(false);
    }
  };

  const ensureBinding = async (): Promise<WeChatBinding> => {
    const selected = contacts.find(contact => contact.id === selectedContactId);
    if (!selected) throw new Error("请先选择微信联系人");
    if (binding?.contact_id === selected.id) return binding;
    const result = await api.saveWeChatBinding(targetId, selected);
    setBinding(result.binding);
    return result.binding;
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setError("");
    setSuccess("");
    try {
      await ensureBinding();
      setPreview(await api.previewWeChatSync(targetId, createRange(rangeDays)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "预览失败");
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    setError("");
    try {
      const result = await api.commitWeChatSync(targetId, createRange(rangeDays));
      setSuccess(
        result.count > 0
          ? `已导入 ${result.count} 条，跳过 ${result.duplicateCount} 条已有记录。`
          : `没有新记录，已跳过 ${result.duplicateCount} 条重复消息。`,
      );
      setPreview(await api.previewWeChatSync(targetId, createRange(rangeDays)));
      await onImported();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  const previewMessages = preview?.messages.slice(-80) ?? [];

  return (
    <div
      className="self-center max-w-[94%] w-full"
      style={{
        background: "#f0f9f4",
        border: "1px solid #a7d7bd",
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <Typography.Text strong>从微信同步</Typography.Text>
          <div style={{ fontSize: 11, color: "#60766c", marginTop: 2 }}>
            只读预览，确认后才写入本项目；不修改微信数据。
          </div>
        </div>
        <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
      </div>

      {checking ? (
        <div style={{ padding: 22, textAlign: "center" }}><Spin size="small" /> 正在检查 Reader...</div>
      ) : status && !status.ready ? (
        <Alert
          style={{ marginTop: 10 }}
          type={status.installed ? "warning" : "info"}
          showIcon
          title={status.installed ? "Reader 尚未就绪" : "需要先安装 Reader"}
          description={
            <div>
              <div>{status.message}</div>
              <div style={{ marginTop: 6, fontSize: 12 }}>
                系统不会自动获取密钥或修改微信；请由你完成 Reader 的用户授权配置。
              </div>
              <Button size="small" icon={<ReloadOutlined />} onClick={loadStatus} style={{ marginTop: 8 }}>
                重新检查
              </Button>
            </div>
          }
        />
      ) : status?.ready ? (
        <>
          <Alert
            style={{ marginTop: 10, padding: "6px 10px" }}
            type="success"
            showIcon
            title={binding
              ? `已绑定：${binding.contact_name || binding.contact_id}`
              : "Reader 已就绪，请搜索并绑定联系人"}
          />

          <Space.Compact block style={{ marginTop: 10 }}>
            <Input.Search
              value={query}
              onChange={event => setQuery(event.target.value)}
              onSearch={handleSearch}
              loading={searching}
              enterButton={<SearchOutlined />}
              placeholder="输入微信备注或昵称"
            />
          </Space.Compact>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 148px", gap: 8, marginTop: 8 }}>
            <Select
              value={selectedContactId || undefined}
              options={contactOptions}
              onChange={value => {
                setSelectedContactId(value);
                setPreview(null);
                setSuccess("");
              }}
              placeholder="选择微信联系人"
              notFoundContent="请先搜索联系人"
            />
            <Select
              value={rangeDays}
              options={RANGE_OPTIONS}
              onChange={value => {
                setRangeDays(value);
                setPreview(null);
                setSuccess("");
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <Button
              type="primary"
              loading={previewing}
              disabled={!selectedContactId}
              onClick={handlePreview}
            >
              预览待导入记录
            </Button>
          </div>

          {preview && (
            <>
              <Divider style={{ margin: "10px 0" }} />
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <Tag color="blue">共 {preview.total} 条</Tag>
                <Tag color="green">可导入 {preview.importableCount} 条</Tag>
                <Tag>已存在 {preview.duplicateCount} 条</Tag>
                {preview.messages.length > previewMessages.length && (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    下方仅展示最近 {previewMessages.length} 条
                  </Typography.Text>
                )}
              </div>

              {preview.total >= 1000 && (
                <Alert
                  style={{ marginTop: 8, padding: "5px 9px" }}
                  type="warning"
                  showIcon
                  title="已达第一版单次上限 1000 条；本次只会导入这 1000 条，更早记录需后续增加分页。"
                />
              )}

              <div
                style={{
                  maxHeight: 260,
                  overflowY: "auto",
                  marginTop: 8,
                  background: "rgba(255,255,255,.72)",
                  borderRadius: 8,
                  border: "1px solid #d9e9df",
                }}
              >
                {previewMessages.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", color: "#7b8f85" }}>该时间范围内没有可读取的文本消息</div>
                ) : previewMessages.map(message => (
                  <div
                    key={message.externalId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "52px 76px minmax(0, 1fr)",
                      gap: 6,
                      padding: "7px 9px",
                      borderBottom: "1px solid #edf2ef",
                      opacity: message.duplicate ? 0.5 : 1,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: message.role === "me" ? "#2f855a" : "#b35c7a" }}>
                      {roleLabel(message.role, targetName)}
                    </span>
                    <span style={{ color: "#8a9a92" }}>{formatTime(message.timestamp)}</span>
                    <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {message.text}
                      {message.duplicate && <Tag style={{ marginLeft: 6 }}>已导入</Tag>}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 9 }}>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={importing}
                  disabled={preview.importableCount === 0}
                  onClick={handleImport}
                >
                  确认导入 {preview.importableCount} 条
                </Button>
              </div>
            </>
          )}
        </>
      ) : null}

      {error && <Alert style={{ marginTop: 9 }} type="error" showIcon title={error} />}
      {success && <Alert style={{ marginTop: 9 }} type="success" showIcon title={success} />}
    </div>
  );
};

export default WeChatSyncPanel;

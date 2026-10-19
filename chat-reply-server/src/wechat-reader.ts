import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const COMMAND_TIMEOUT_MS = 30_000;
const COMMAND_MAX_BUFFER = 24 * 1024 * 1024;
const READER_FETCH_LIMIT = 3000;

type JsonObject = Record<string, unknown>;

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | string | null;
}

export interface WeChatReaderStatus {
  installed: boolean;
  ready: boolean;
  mode: 'full' | 'preview' | 'unavailable';
  message: string;
  executable?: string;
  version?: string;
}

export interface WeChatContact {
  id: string;
  name: string;
  remark?: string;
  type: 'private' | 'group' | 'unknown';
  avatar?: string;
}

export interface WeChatReaderMessage {
  externalId: string;
  role: 'her' | 'me' | 'scene';
  text: string;
  timestamp: number;
  contentHash: string;
  senderName?: string;
  messageType?: string;
}

export class WeChatReaderError extends Error {
  constructor(
    message: string,
    public readonly code: 'not_installed' | 'not_ready' | 'command_failed' | 'invalid_output',
  ) {
    super(message);
    this.name = 'WeChatReaderError';
  }
}

function readerCandidates(): string[] {
  const configured = process.env.WECHAT_READER_BIN?.trim();
  const bundledScript = path.join(os.homedir(), '.codex', 'skills', 'wechat-cli', 'scripts', 'reader.sh');
  return [...new Set([configured, bundledScript, 'rion-wechat-cli'].filter(Boolean) as string[])];
}

function canAttempt(executable: string): boolean {
  return !executable.includes(path.sep) || fs.existsSync(executable);
}

function execute(executable: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      {
        encoding: 'utf8',
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: COMMAND_MAX_BUFFER,
        env: { ...process.env },
      },
      (error, stdout, stderr) => {
        if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(error);
          return;
        }
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: error ? ((error as any).code ?? 1) : 0,
        });
      },
    );
  });
}

async function invokeReader(args: string[]): Promise<{ executable: string; result: CommandResult }> {
  for (const executable of readerCandidates()) {
    if (!canAttempt(executable)) continue;
    try {
      const result = await execute(executable, args);
      return { executable, result };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new WeChatReaderError(
    '未找到微信 Reader。请安装 rion-wechat-cli，或在后端 .env 中配置 WECHAT_READER_BIN。',
    'not_installed',
  );
}

function parseJsonOutput(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new WeChatReaderError('Reader 未返回可读数据。', 'invalid_output');
  }
  try {
    return JSON.parse(trimmed);
  } catch {}

  const lines = trimmed.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index--) {
    if (!lines[index].startsWith('{') && !lines[index].startsWith('[')) continue;
    try {
      return JSON.parse(lines[index]);
    } catch {}
  }

  const objectStart = trimmed.indexOf('{');
  const arrayStart = trimmed.indexOf('[');
  const starts = [objectStart, arrayStart].filter(index => index >= 0);
  const start = starts.length > 0 ? Math.min(...starts) : -1;
  const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {}
  }
  throw new WeChatReaderError('Reader 输出不是有效 JSON，请检查 Reader 版本。', 'invalid_output');
}

function assertSuccessfulEnvelope(value: unknown): void {
  if (!isObject(value) || value.ok !== false) return;
  const errorValue = isObject(value.error) ? value.error : value;
  const diagnostic = firstString(errorValue, ['code', 'message', 'next_action', 'nextAction']).toLowerCase();
  if (diagnostic.includes('access') || diagnostic.includes('permission') || diagnostic.includes('database') || diagnostic.includes('key')) {
    throw new WeChatReaderError(
      'Reader 已响应，但尚未具备完整历史记录的只读权限。请先运行 Reader doctor/access-plan。',
      'not_ready',
    );
  }
  throw new WeChatReaderError('Reader 返回了查询错误，请先运行 Reader doctor 检查。', 'command_failed');
}

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function findDeepValue(value: unknown, keys: string[], depth = 0): unknown {
  if (depth > 6 || !isObject(value)) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  }
  for (const child of Object.values(value)) {
    const found = findDeepValue(child, keys, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function extractArray(value: unknown, preferredKeys: string[], depth = 0): unknown[] {
  if (depth > 6) return [];
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return [];
  for (const key of preferredKeys) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
  }
  for (const key of ['data', 'result', 'payload', 'response']) {
    if (value[key] !== undefined) {
      const nested = extractArray(value[key], preferredKeys, depth + 1);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return '';
}

function firstString(record: JsonObject, keys: string[]): string {
  for (const key of keys) {
    const value = toStringValue(record[key]);
    if (value) return value;
  }
  return '';
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (['true', '1', 'yes', 'ok', 'ready'].includes(normalized)) return true;
    if (['false', '0', 'no', 'failed', 'unavailable'].includes(normalized)) return false;
  }
  return undefined;
}

function toTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  const text = toStringValue(value);
  if (!text) return 0;
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeExecutableLabel(executable: string): string {
  return executable.includes(path.sep) ? path.basename(executable) : executable;
}

function commandError(result: CommandResult): WeChatReaderError {
  const raw = `${result.stderr}\n${result.stdout}`.toLowerCase();
  if (raw.includes('access') || raw.includes('permission') || raw.includes('database') || raw.includes('key')) {
    return new WeChatReaderError(
      'Reader 已安装，但尚未具备完整历史记录的只读权限。请先在 Reader 中完成 doctor/access-plan 提示的配置。',
      'not_ready',
    );
  }
  return new WeChatReaderError('Reader 执行失败，请先运行 Reader doctor 检查。', 'command_failed');
}

export function createWeChatContentHash(role: string, text: string, timestamp: number): string {
  return crypto
    .createHash('sha256')
    .update(`${role}\u0000${Math.trunc(timestamp)}\u0000${text.trim()}`)
    .digest('hex');
}

export async function getWeChatReaderStatus(): Promise<WeChatReaderStatus> {
  try {
    const { executable, result } = await invokeReader(['doctor', '--pretty']);
    let raw: unknown;
    try {
      raw = parseJsonOutput(result.stdout);
    } catch {
      return {
        installed: true,
        ready: false,
        mode: 'unavailable',
        message: 'Reader 已找到，但 doctor 输出无法识别。请更新 Reader 后重试。',
        executable: safeExecutableLabel(executable),
      };
    }

    const liveRead = toBoolean(findDeepValue(raw, [
      'live_database_read_ok',
      'liveDatabaseReadOk',
      'database_read_ok',
      'databaseReadOk',
    ]));
    const previewRead = toBoolean(findDeepValue(raw, [
      'notification_preview_ok',
      'notificationPreviewOk',
      'preview_ok',
    ]));
    const version = toStringValue(findDeepValue(raw, ['version', 'reader_version', 'readerVersion']));

    if (liveRead === true) {
      return {
        installed: true,
        ready: true,
        mode: 'full',
        message: 'Reader 已就绪，可只读获取微信历史记录。',
        executable: safeExecutableLabel(executable),
        version: version || undefined,
      };
    }
    if (previewRead === true) {
      return {
        installed: true,
        ready: false,
        mode: 'preview',
        message: '当前只有通知预览能力，不足以完整同步历史记录。请先完成 Reader 的只读数据库配置。',
        executable: safeExecutableLabel(executable),
        version: version || undefined,
      };
    }
    return {
      installed: true,
      ready: false,
      mode: 'unavailable',
      message: result.exitCode === 0
        ? 'Reader 已安装，但完整历史记录读取尚未就绪。请按 doctor/access-plan 的提示完成配置。'
        : commandError(result).message,
      executable: safeExecutableLabel(executable),
      version: version || undefined,
    };
  } catch (error) {
    if (error instanceof WeChatReaderError) {
      return { installed: false, ready: false, mode: 'unavailable', message: error.message };
    }
    return {
      installed: false,
      ready: false,
      mode: 'unavailable',
      message: '无法检测微信 Reader。',
    };
  }
}

function normalizeContact(value: unknown): WeChatContact | null {
  if (!isObject(value)) return null;
  const id = firstString(value, [
    'talker_id', 'talkerId', 'talker', 'raw_username', 'rawUsername', 'user_name', 'username', 'wxid', 'chat_id', 'chatId', 'id',
  ]);
  if (!id) return null;
  const remark = firstString(value, ['remark', 'remark_name', 'remarkName', 'alias']);
  const name = remark || firstString(value, [
    'contact_display', 'contactDisplay', 'display_name', 'displayName', 'nickname', 'nick_name', 'name',
  ]) || id;
  const rawType = firstString(value, ['chat_type', 'chatType', 'contact_type', 'contactType', 'type']).toLowerCase();
  const type: WeChatContact['type'] = rawType.includes('group') || rawType.includes('room') || id.endsWith('@chatroom')
    ? 'group'
    : rawType.includes('private') || rawType.includes('friend') || !id.endsWith('@chatroom')
      ? 'private'
      : 'unknown';
  const avatar = firstString(value, ['avatar', 'avatar_url', 'avatarUrl', 'head_img_url', 'headImgUrl']);
  return { id, name, remark: remark || undefined, type, avatar: avatar || undefined };
}

export async function searchWeChatContacts(query: string, limit = 20): Promise<WeChatContact[]> {
  const status = await getWeChatReaderStatus();
  if (!status.installed) throw new WeChatReaderError(status.message, 'not_installed');
  if (!status.ready) throw new WeChatReaderError(status.message, 'not_ready');

  const args = ['contacts', '--limit', String(Math.min(Math.max(limit, 1), 50)), '--friends-only'];
  if (query.trim()) args.push('--keyword', query.trim());
  args.push('--pretty');
  const { result } = await invokeReader(args);
  if (result.exitCode !== 0) throw commandError(result);
  const raw = parseJsonOutput(result.stdout);
  assertSuccessfulEnvelope(raw);
  const contacts = extractArray(raw, ['contacts', 'items', 'results', 'rows'])
    .map(normalizeContact)
    .filter((contact): contact is WeChatContact => contact !== null);
  return [...new Map(contacts.map(contact => [contact.id, contact])).values()];
}

function normalizeMessage(value: unknown, talkerId: string): WeChatReaderMessage | null {
  if (!isObject(value)) return null;
  const text = firstString(value, [
    'display_text', 'displayText', 'plain_text', 'plainText', 'text', 'content', 'message', 'summary',
  ]);
  if (!text || /^<\??(?:msg|xml|appmsg)\b/i.test(text)) return null;

  const timestamp = toTimestamp(
    value.time_iso ?? value.timeIso ?? value.create_time ?? value.createTime ?? value.timestamp ?? value.time ?? value.created_at ?? value.createdAt,
  );
  if (!timestamp) return null;

  const rawType = firstString(value, ['kind', 'message_type', 'messageType', 'msg_type', 'msgType', 'type']);
  const typeName = rawType.toLowerCase();
  const systemMessage = typeName.includes('system') || typeName === '10000';
  const selfValue = value.is_from_me ?? value.isFromMe ?? value.is_self ?? value.isSelf ?? value.from_me ?? value.fromMe ?? value.is_send ?? value.isSend;
  const direction = firstString(value, ['direction', 'flow', 'sender_type', 'senderType']).toLowerCase();
  const isSelf = toBoolean(selfValue) ?? ['out', 'outgoing', 'sent', 'self', 'me'].some(token => direction.includes(token));
  const role: WeChatReaderMessage['role'] = systemMessage ? 'scene' : isSelf ? 'me' : 'her';
  const senderName = firstString(value, ['sender', 'sender_name', 'senderName', 'sender_contact_display', 'senderContactDisplay', 'display_name', 'displayName', 'nickname']);
  const contentHash = createWeChatContentHash(role, text, timestamp);
  const nestedId = isObject(value.id) ? value.id : undefined;
  const externalId = firstString(value, [
    'server_id_str', 'serverIdStr', 'server_id', 'serverId', 'message_id', 'messageId', 'msg_id', 'msgId', 'local_id', 'localId', 'id',
  ]) || (nestedId ? firstString(nestedId, [
    'server_id_str', 'serverIdStr', 'server_id', 'serverId', 'message_id', 'messageId', 'msg_id', 'msgId', 'local_id', 'localId',
  ]) : '') || crypto.createHash('sha256').update(`${talkerId}\u0000${contentHash}`).digest('hex');

  return {
    externalId,
    role,
    text,
    timestamp,
    contentHash,
    senderName: senderName || undefined,
    messageType: rawType || undefined,
  };
}

export async function getWeChatTimeline(
  talkerId: string,
  options: { after?: number; before?: number; limit?: number } = {},
): Promise<WeChatReaderMessage[]> {
  if (!talkerId.trim()) throw new WeChatReaderError('请先选择微信联系人。', 'command_failed');
  const status = await getWeChatReaderStatus();
  if (!status.installed) throw new WeChatReaderError(status.message, 'not_installed');
  if (!status.ready) throw new WeChatReaderError(status.message, 'not_ready');

  const args = [
    'timeline',
    talkerId.trim(),
    '--limit', String(READER_FETCH_LIMIT),
    '--display-order', 'asc',
    '--include-media-paths', 'false',
    '--pretty',
  ];
  const { result } = await invokeReader(args);
  if (result.exitCode !== 0) throw commandError(result);
  const raw = parseJsonOutput(result.stdout);
  assertSuccessfulEnvelope(raw);
  const requestedLimit = Math.min(Math.max(options.limit ?? 1000, 1), 1000);
  const messages = extractArray(raw, ['messages', 'timeline', 'items', 'results', 'rows'])
    .map(item => normalizeMessage(item, talkerId))
    .filter((message): message is WeChatReaderMessage => message !== null)
    .filter(message => options.after === undefined || message.timestamp >= options.after)
    .filter(message => options.before === undefined || message.timestamp <= options.before)
    .sort((a, b) => a.timestamp - b.timestamp);

  const deduped = [...new Map(messages.map(message => [message.externalId, message])).values()];
  return deduped.slice(-requestedLimit);
}

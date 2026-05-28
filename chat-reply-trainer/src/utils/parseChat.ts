export interface ParsedMessage {
  role: 'her' | 'me' | 'scene';
  text: string;
}

export interface ParseResult {
  messages: ParsedMessage[];
  warnings: string[];
}

// Format 1: 她/他：xxx / 我：xxx (fullwidth or halfwidth colon)
const FORMAT1 = /^(她|他|我)[：:]\s*(.*)$/;
// Format 2: 【她/他】xxx / 【我】xxx
const FORMAT2 = /^【(她|他|我)】\s*(.*)$/;
// Format 3: 她/他 > xxx / 我 > xxx
const FORMAT3 = /^(她|他|我)\s*>\s*(.*)$/;
// Scene format: 场景：xxx / 【场景】xxx
const FORMAT_SCENE = /^场景[：:]\s*(.*)$/;
const FORMAT_SCENE_BRACKET = /^【场景】\s*(.*)$/;
// WeChat export header: 昵称 HH:MM or HH:MM:SS
const WECHAT_HEADER = /^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$/;

const ALL_FORMATS = [FORMAT1, FORMAT2, FORMAT3];

function tryParseLine(line: string): { role: 'her' | 'me' | 'scene'; text: string } | null {
  // Scene formats first
  const sceneMatch = line.match(FORMAT_SCENE) || line.match(FORMAT_SCENE_BRACKET);
  if (sceneMatch) {
    return { role: 'scene', text: sceneMatch[1] };
  }
  for (const regex of ALL_FORMATS) {
    const match = line.match(regex);
    if (match) {
      return {
        role: match[1] === '我' ? 'me' : 'her',
        text: match[2],
      };
    }
  }
  return null;
}

function parseWeChatExport(lines: string[], herName?: string): ParseResult {
  const messages: ParsedMessage[] = [];
  const warnings: string[] = [];
  const nicknameOrder: string[] = [];
  const seen = new Set<string>();

  // Collect all header nicknames
  const headers: { nickname: string; lineIdx: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(WECHAT_HEADER);
    if (m) {
      const nick = m[1].trim();
      headers.push({ nickname: nick, lineIdx: i });
      if (!seen.has(nick)) {
        seen.add(nick);
        nicknameOrder.push(nick);
      }
    }
  }

  if (headers.length === 0) {
    return { messages: [], warnings: ['未识别到微信导出格式的消息头'] };
  }

  // Determine her/me mapping
  let herNick: string;
  let meNick: string;

  if (nicknameOrder.length === 1) {
    herNick = nicknameOrder[0];
    meNick = nicknameOrder[0];
    warnings.push('仅识别到一个昵称，所有消息将归为"她"');
  } else if (herName && nicknameOrder.includes(herName)) {
    herNick = herName;
    meNick = nicknameOrder.find(n => n !== herName) || nicknameOrder[0];
  } else {
    herNick = nicknameOrder[0];
    meNick = nicknameOrder[1];
    if (nicknameOrder.length > 2) {
      warnings.push(`识别到 ${nicknameOrder.length} 个昵称，前两个为「${herNick}」「${meNick}」，其余已忽略`);
    }
  }

  const nickToRole = (nick: string): 'her' | 'me' => {
    if (nick === herNick) return 'her';
    if (nick === meNick) return 'me';
    return 'her';
  };

  let currentMsg: ParsedMessage | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const headerMatch = line.match(WECHAT_HEADER);
    if (headerMatch) {
      const nick = headerMatch[1].trim();
      currentMsg = { role: nickToRole(nick), text: '' };
      messages.push(currentMsg);
    } else if (currentMsg) {
      currentMsg.text = currentMsg.text ? currentMsg.text + '\n' + line : line;
    }
  }

  // Filter empty
  const filtered = messages.filter(m => m.text.trim());
  return { messages: filtered, warnings };
}

export function parseChatWithMeta(raw: string, herName?: string): ParseResult {
  if (!raw?.trim()) return { messages: [], warnings: [] };

  const lines = raw.split('\n').map(l => l.trimEnd());
  const warnings: string[] = [];

  // Check if any line matches Format 1-3 or scene format
  const hasSpeakerPrefix = lines.some(l =>
    ALL_FORMATS.some(r => r.test(l)) || FORMAT_SCENE.test(l) || FORMAT_SCENE_BRACKET.test(l)
  );

  if (!hasSpeakerPrefix) {
    // Try WeChat export mode
    return parseWeChatExport(lines, herName);
  }

  // Mixed / speaker-prefix mode
  const messages: ParsedMessage[] = [];
  let currentMsg: ParsedMessage | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const parsed = tryParseLine(line);
    if (parsed) {
      currentMsg = { role: parsed.role, text: parsed.text };
      messages.push(currentMsg);
    } else if (currentMsg) {
      currentMsg.text = currentMsg.text ? currentMsg.text + '\n' + line : line;
    } else {
      warnings.push(`第 ${i + 1} 行「${line.slice(0, 20)}...」未归属到任何说话人，已跳过`);
    }
  }

  const filtered = messages.filter(m => m.text.trim());
  return { messages: filtered, warnings };
}

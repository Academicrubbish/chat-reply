export interface ParsedMessage {
  role: 'her' | 'me' | 'scene';
  text: string;
}

export interface NicknameMap {
  herNick: string;
  meNick: string;
}

export interface ParseResult {
  messages: ParsedMessage[];
  warnings: string[];
  nicknames?: string[];
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
// WeChat export header: 昵称（备注名） HH:MM or 昵称 HH:MM
const WECHAT_HEADER = /^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$/;
// WeChat export noise lines to skip
const WECHAT_SKIP = /^(【|—————|.*聊天记录如下)/;
// Date separator: ————— YYYY-MM-DD —————
const DATE_SEPARATOR = /^—————/;

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

function isWeChatExportFormat(lines: string[]): boolean {
  // Heuristic: contains date separator lines or multiple WECHAT_HEADER matches
  const hasDateSep = lines.some(l => DATE_SEPARATOR.test(l.trim()));
  if (hasDateSep) return true;
  const headerCount = lines.filter(l => WECHAT_HEADER.test(l.trim())).length;
  return headerCount >= 3;
}

function parseWeChatExport(lines: string[], nicknameMap?: NicknameMap): ParseResult {
  const warnings: string[] = [];
  const nicknameOrder: string[] = [];
  const seen = new Set<string>();

  // Phase 1: collect all valid message headers, skipping noise
  const entries: { nickname: string; textLines: string[] }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (DATE_SEPARATOR.test(line)) continue;
    if (WECHAT_SKIP.test(line)) continue;

    const m = line.match(WECHAT_HEADER);
    if (m) {
      const nick = m[1].trim();
      // Skip if nickname looks like a system label
      if (/^(Dear|聊天记录)$/.test(nick)) continue;

      entries.push({ nickname: nick, textLines: [] });
      if (!seen.has(nick)) {
        seen.add(nick);
        nicknameOrder.push(nick);
      }
    } else if (entries.length > 0) {
      // Content line: append to the last header entry
      entries[entries.length - 1].textLines.push(line);
    }
    // Lines before any header are skipped silently
  }

  if (entries.length === 0) {
    return { messages: [], warnings: ['未识别到微信导出格式的消息头'], nicknames: [] };
  }

  // Phase 2: if no nicknameMap provided, just return nicknames for UI selection
  if (!nicknameMap) {
    return { messages: [], warnings: [], nicknames: nicknameOrder };
  }

  // Phase 3: map nicknames to roles and generate messages
  const { herNick, meNick } = nicknameMap;

  const nickToRole = (nick: string): 'her' | 'me' => {
    if (nick === herNick) return 'her';
    if (nick === meNick) return 'me';
    return 'her'; // default for other participants
  };

  const messages: ParsedMessage[] = [];
  for (const entry of entries) {
    const text = entry.textLines.join('\n').trim();
    if (!text) continue;
    messages.push({ role: nickToRole(entry.nickname), text });
  }

  if (nicknameOrder.length > 2) {
    const otherNicks = nicknameOrder.filter(n => n !== herNick && n !== meNick);
    warnings.push(`群聊中有 ${nicknameOrder.length} 人，已将「${otherNicks.join('、')}」的消息归为"她"`);
  }

  return { messages, warnings };
}

export function parseChatWithMeta(raw: string, _herName?: string, nicknameMap?: NicknameMap): ParseResult {
  if (!raw?.trim()) return { messages: [], warnings: [] };

  const lines = raw.split('\n').map(l => l.trimEnd());
  const warnings: string[] = [];

  // Check if any line matches Format 1-3 or scene format
  const hasSpeakerPrefix = lines.some(l =>
    ALL_FORMATS.some(r => r.test(l)) || FORMAT_SCENE.test(l) || FORMAT_SCENE_BRACKET.test(l)
  );

  if (!hasSpeakerPrefix) {
    // Try WeChat export mode
    return parseWeChatExport(lines, nicknameMap);
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

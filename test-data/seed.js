#!/usr/bin/env node
/**
 * 一键导入测试数据到 chat-reply-server
 *
 * 用法：
 *   node test-data/seed.js [--api http://localhost:3001] [--user tester --pass test1234]
 *
 * 前提：服务器已启动 (npm run dev)
 */

const fs = require('fs');
const path = require('path');

// ─── 配置 ──────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) {
    acc[cur.slice(2)] = arr[i + 1] || true;
  }
  return acc;
}, {});

const API = args.api || 'http://localhost:3001';
const USERNAME = args.user || 'tester';
const PASSWORD = args.pass || 'test1234';

// ─── 工具函数 ──────────────────────────────────
async function request(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(`${API}${url}`, { ...options, headers });
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── 主流程 ────────────────────────────────────
async function main() {
  console.log('🚀 测试数据导入工具\n');
  console.log(`   API: ${API}`);
  console.log(`   用户: ${USERNAME}\n`);

  // 1. 确保有账号 & 拿 token
  let token;
  const status = await request('/api/auth/status');
  try {
    console.log('🔐 尝试登录...');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    token = loginRes.token;
  } catch {
    if (!status.initialized) {
      console.log('📝 首次使用，创建管理员账号...');
      const setupRes = await request('/api/auth/setup', {
        method: 'POST',
        body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
      });
      token = setupRes.token;
    } else {
      console.log('📝 注册测试账号...');
      const regRes = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
      });
      token = regRes.token;
    }
  }
  console.log('✅ 认证成功\n');

  // 2. 读取所有 JSON 场景文件
  const dataDir = __dirname;
  const files = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.log('❌ 没有找到测试数据文件');
    process.exit(1);
  }

  console.log(`📂 找到 ${files.length} 个测试场景\n`);
  console.log('─'.repeat(60));

  const results = [];

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const scene = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const label = scene.name || file;

    try {
      // 创建 target
      const target = await request('/api/targets', {
        method: 'POST',
        body: JSON.stringify(scene.target),
        headers: authHeader(token),
      });

      // 导入 messages
      let msgCount = 0;
      for (const msg of scene.messages) {
        await request(`/api/targets/${target.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            role: msg.role,
            text: msg.text,
            source: msg.source || '手动输入',
          }),
          headers: authHeader(token),
        });
        msgCount++;
      }

      results.push({ file, label, targetId: target.id, messages: msgCount, ok: true });
      console.log(`  ✅ ${label} (${msgCount} 条消息) → ${target.id}`);

    } catch (err) {
      results.push({ file, label, ok: false, error: err.message });
      console.log(`  ❌ ${label} → ${err.message}`);
    }

    // 间隔避免太快
    await sleep(100);
  }

  console.log('─'.repeat(60));
  console.log(`\n📊 导入完成: ${results.filter(r => r.ok).length}/${results.length} 成功\n`);

  if (results.some(r => r.ok)) {
    console.log('📋 已创建的聊天对象:');
    console.log('');
    for (const r of results.filter(r => r.ok)) {
      console.log(`   ${r.label.padEnd(12)} targetId: ${r.targetId}`);
    }
    console.log('');
    console.log('💡 现在可以启动前端，逐个测试 AI 辅助功能:');
    console.log('   1. 切换到对应聊天对象');
    console.log('   2. 点击"AI辅助"按钮（full 模式）');
    console.log('   3. 记录返回时间和回复质量');
    console.log('   4. 切换 quick/advisor/review 模式对比效果');
  }
}

main().catch(err => {
  console.error('❌ 导入失败:', err.message);
  process.exit(1);
});

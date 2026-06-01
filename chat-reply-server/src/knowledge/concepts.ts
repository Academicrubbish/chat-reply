import type { KnowledgeUnit } from './types';

export const concepts: KnowledgeUnit[] = [
  {
    id: 'C01',
    title: '真命天女症（感性派/理性派）',
    type: 'concept',
    modes: ['advisor', 'review'],
    priority: 3,

    reading: '"一个人执着地爱着另一个不爱自己的人，陷入单向情感投入的死循环。" — 第1章 1.1',

    interpretation: '分感性派（不了解就深陷，爱上想象）和理性派（按条件筛选后认定，不接受不确定性）。共同特征是单向投入的恶性循环——越投入越不舍，越不舍越投入。判断标准：这段关系让你往上走还是往下走。',

    cases: [
      { title: '感性派', problem: '去银行办事，一眼看见出纳员就被"击溃"，从此朝思暮想', method: '爱上的是面孔激发的想象，追求的是情感体验而非占有', conclusion: '感性派需要更多了解真实的对方' },
      { title: '理性派', problem: '调查了单位所有女同事，发现某女条件都符合，认定就是"今生今世要找的人"', method: '被拒绝后说"我们最合适，你怎么不明白？"', conclusion: '理性派需要学会接受生活的不确定性' },
    ],

    triggers: [
      { scenario: '发现自己朝思暮想一个不回应的人', languageSignals: ['放不下', '忘不了'], modes: ['advisor', 'review'] },
      { scenario: '复盘时意识到自己在单向付出', languageSignals: ['单向付出'], modes: ['review'] },
    ],

    execution: [
      { action: '自检：我了解真实的她吗？还是爱上了想象？', completionCriteria: '区分真实和想象' },
      { action: '判断：这段关系让我往上走（积极乐观）还是往下走（怨天尤人疑神疑鬼）？', completionCriteria: '明确方向' },
      { action: '往下走→果断断开', completionCriteria: '停止单向投入' },
    ],

    boundary: ['不是所有坚持都是真命天女症。如果关系让你成长可以继续。关键是"方向"而非"时间"'],

    dependsOn: ['P01'],
    composesWith: [],
    contrastsWith: [],
  },

  {
    id: 'C02',
    title: '诚意陷阱',
    type: 'concept',
    modes: ['advisor', 'review'],
    priority: 3,

    reading: '"男性在追求受挫后，将失败归因于\'诚意不够\'，于是继续加码付出。" — 第1章 1.3',

    interpretation: '被拒绝后的错误归因模式：不是交流方式出了问题，而是"诚意不够"→加码付出→对方更冷淡→"诚意还不够"→继续加码。打破循环的关键是认识到方向错了，不是力度不够。',

    cases: [
      { title: '诚意陷阱循环', problem: '被冷落后想送更贵的礼物', method: '检视：这是在"加码"吗？方向应该从投入量转向交流质量', conclusion: '诚意陷阱的本质是把方向问题归因为力度问题' },
    ],

    triggers: [
      { scenario: '被冷落后想送更贵的礼物/发更长的表白', languageSignals: ['送更贵的', '写更长的'], modes: ['advisor', 'review'] },
      { scenario: '复盘时发现自己的付出一直是单向的', languageSignals: ['一直是我主动'], modes: ['review'] },
    ],

    execution: [
      { action: '检测：我正在"加码"吗？如果是，停下', completionCriteria: '停止加码' },
      { action: '转向：检查交流质量而非投入数量', completionCriteria: '找到真正的改进方向' },
      { action: '参考P01（诚意是润滑剂不是燃料）', completionCriteria: '理解诚意的作用边界' },
    ],

    boundary: ['诚意陷阱的根源是把"她不接受我"归因为"我不够好"，而非"我们的交流方式不匹配"'],

    dependsOn: ['P01'],
    composesWith: [],
    contrastsWith: ['P01'],
  },

  {
    id: 'C03',
    title: '情绪感知能力',
    type: 'concept',
    modes: ['full', 'advisor', 'review'],
    priority: 3,

    reading: '"跟女人讲逻辑行不通，展示高价值也得你真具备才行。两人互动时，唯一可以努力的地方就是感知她的情绪。" — 第1章 1.7',

    interpretation: '情绪感知是约会中最核心的实用技能。它包括：识别对方的情绪状态、理解情绪背后的情境（而非原因）、用恰当方式回应情绪。这是可训练的能力，不是天赋。',

    cases: [
      { title: '情绪不一致', problem: '文字说"没事"但语气冷淡', method: '关注回复速度、字数、语气词的变化', conclusion: '线下判断更准确，线上需要更多样本' },
    ],

    triggers: [
      { scenario: '不确定对方是开心还是敷衍', languageSignals: ['她是在敷衍我吗'], modes: ['full', 'advisor'] },
      { scenario: '对方的语气和文字内容不一致', languageSignals: ['说的和做的不一样'], modes: ['advisor', 'review'] },
      { scenario: '复盘时发现自己完全没注意到对方情绪', languageSignals: ['没注意到她的情绪'], modes: ['review'] },
    ],

    execution: [
      { action: '观察文字中的情绪词（"烦""开心""无语"）和语气词（"哈哈""唉""哼"）', completionCriteria: '标记情绪标记' },
      { action: '判断情绪方向：正面/负面/中性', completionCriteria: '确定情绪方向' },
      { action: '回应时先回应情绪再回应内容', completionCriteria: '情绪优先于内容' },
    ],

    boundary: ['线上文字的情绪感知准确度远低于线下面对面。线上判断需要更多样本'],

    dependsOn: ['F01'],
    composesWith: [],
    contrastsWith: [],
  },

  {
    id: 'C04',
    title: '聊天信号 vs 见面信号',
    type: 'concept',
    modes: ['full', 'quick', 'advisor'],
    priority: 3,

    reading: '"\'你在做什么？\'是聊天信号，\'你在哪儿？\'是见面信号。" — 第1章 1.6',

    interpretation: '女方主动联系时需要区分意图。聊天信号=她想交流但不急于见面；见面信号=她此刻有空想见面。分不清就会操作失误——把聊天信号当邀约会给对方压力反而搞砸。',

    cases: [
      { title: '信号区分', problem: '收到"你在做什么"', method: '先充分交流→试探安排→自然邀约（统一策略）', conclusion: '不确定时先聊起来再说' },
      { title: '见面信号', problem: '收到"你在哪儿"', method: '这是百分百见面信号，立刻回应位置并提议见面', conclusion: '"你在哪儿"=她想见你' },
    ],

    triggers: [
      { scenario: '收到对方主动发来的消息', languageSignals: ['她主动发消息了'], modes: ['full', 'quick'] },
      { scenario: '不确定对方是想聊还是想见', languageSignals: ['想聊还是想见'], modes: ['quick', 'advisor'] },
    ],

    execution: [
      { action: '识别信号类型："你在做什么"=聊天；"你在哪儿"=见面', completionCriteria: '正确分类信号' },
      { action: '不确定时用统一策略：先充分交流→试探安排→自然邀约', completionCriteria: '不过早邀约也不过度聊天' },
      { action: '聊天信号不要直接跳到邀约，先聊起来', completionCriteria: '先聊再约' },
    ],

    boundary: ['深夜的主动联系多为聊天信号（无聊/孤独），不要误判为见面信号就提出约会'],

    dependsOn: [],
    composesWith: ['S03'],
    contrastsWith: [],
  },
];

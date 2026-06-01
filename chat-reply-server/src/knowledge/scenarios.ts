import type { KnowledgeUnit } from './types';

export const scenarios: KnowledgeUnit[] = [
  {
    id: 'S01',
    title: '搭讪开场与获取联系方式',
    type: 'scenario',
    modes: ['full', 'advisor'],
    priority: 3,

    reading: '"搭讪的关键在于有效交流，而非收集号码。" — 第1章 1.9',

    interpretation: '搭讪的目标不是拿到号码，而是建立有效交流。号码只是交流的副产品。外形出众的可以直收号码，外形普通的需要20分钟以上的有效交流才有后续。面对组合（多人）时需要为对方减压。',

    cases: [
      { title: '有效交流vs直收号码', problem: '搭讪后没有后续', method: '对比三种方式：直收号码（无后续）、简单寒暄10分钟（部分后续）、有效交流20分钟（高后续）', conclusion: '交流深度决定后续质量' },
      { title: '组合搭讪', problem: '目标和朋友在一起', method: '先跟同伴打招呼减轻目标的道德压力', conclusion: '道德压力是目标的真正障碍' },
    ],

    triggers: [
      { scenario: '街头搭讪开场（单人/组合）', languageSignals: ['想认识她', '怎么开场'], modes: ['full', 'advisor'] },
      { scenario: '判断搭讪后是否有有效后续', languageSignals: ['要到号了但对方不回'], modes: ['advisor'] },
    ],

    execution: [
      { action: '开场：直接表达意图（"你好，我想认识你"）', completionCriteria: '开场直接自然' },
      { action: '判断对方态度：友好→用女性思维展开；严肃→用男性思维简短回应', completionCriteria: '匹配思维模式' },
      { action: '组合搭讪：先跟同伴打招呼减轻目标的道德压力', completionCriteria: '同伴不被冷落' },
      { action: '目标是交流而非收号——能聊20分钟比拿到号码更有价值', completionCriteria: '有实质性交流' },
    ],

    boundary: [
      '搭讪不适合DHV（展示高价值）。信任未建立时展示高价值会引发反感',
      '母女组合需先与母亲打招呼体现尊重',
      '外形普通的男性必须通过有效交流建立连接，不能只靠收号',
    ],

    dependsOn: ['F02'],
    composesWith: ['P06'],
    contrastsWith: [],
  },

  {
    id: 'S02',
    title: '微信/短信沟通',
    type: 'scenario',
    modes: ['full', 'quick'],
    priority: 4,

    reading: '"微信是搭讪后续联系的最佳工具。" — 第2章 2.7',

    interpretation: '微信沟通的核心策略：首条消息用场景联系+对她关注的标准开场；之后走一步看一步；三三法则控制回合；每条消息根据对方回复决定下一条。',

    cases: [
      { title: '标准开场白', problem: '加微信后第一条消息怎么发', method: '"今天运气真不错，出门就认识了个大美女，晚上加班都不觉得困了。"', conclusion: '场景联系+对她关注+魔趣法则' },
      { title: '避免的错误开场', problem: '"你好，我是昨天认识你的某某，很高兴认识你"', method: '这是上堆结束信号，对方回复"我也很高兴"就没话题了', conclusion: '开场白要下切，不要概括' },
    ],

    triggers: [
      { scenario: '加微信后第一条消息怎么发', languageSignals: ['加微信后怎么开场'], modes: ['full', 'quick'] },
      { scenario: '日常聊天节奏控制', languageSignals: ['聊天节奏'], modes: ['quick'] },
      { scenario: '聊天中如何自然升级话题', languageSignals: ['怎么升级话题'], modes: ['full', 'quick'] },
    ],

    execution: [
      { action: '开场模板："[场景联系] + [对她状态的关注]"', completionCriteria: '开场包含场景联系和关注' },
      { action: '根据对方回复走一步看一步（P08）', completionCriteria: '每条回应基于对方上一条' },
      { action: '聊到高点主动收（P05）', completionCriteria: '在气氛好时结束' },
    ],

    boundary: ['不要一上来就"你好我是xxx，很高兴认识你"——这是上堆结束信号', '不要每次聊天都邀约，聊天本身就是目的'],

    dependsOn: ['P04', 'P05', 'P08'],
    composesWith: [],
    contrastsWith: [],
  },

  {
    id: 'S03',
    title: '邀约与约会',
    type: 'scenario',
    modes: ['full', 'quick', 'advisor'],
    priority: 4,

    reading: '"邀约回应只有三种：痛快答应、痛快拒绝、不痛快（拖延/模糊）。" — 第3章 3.14',

    interpretation: '邀约的关键：1）必须基于好感信号（F04），不在没有信号时硬邀；2）降低门槛（"刚好路过"而非"我想请你"）；3）面对"不痛快"回应不要追问，给空间后换个方式再试。',

    cases: [
      { title: '降低门槛邀约', problem: '想邀约但怕给对方压力', method: '"刚好在附近""顺便一起"', conclusion: '降低邀约的心理负担' },
      { title: '不痛快回应', problem: '她说"看看吧""再说吧"', method: '不追问，说"好，你先忙"，过几天换方式再试', conclusion: '不追问=尊重她的节奏' },
    ],

    triggers: [
      { scenario: '想邀约但不确定时机', languageSignals: ['该不该约她'], modes: ['full', 'advisor'] },
      { scenario: '对方说"看看吧/再说吧"怎么应对', languageSignals: ['看看吧', '再说吧', '到时候看'], modes: ['full', 'quick'] },
      { scenario: '邀约被拒后的下一步', languageSignals: ['邀约被拒'], modes: ['advisor'] },
    ],

    execution: [
      { action: '检查好感信号：对方是否至少到了"关注"级别（F04第二级）？', completionCriteria: '确认好感级别足够' },
      { action: '降低门槛邀约："刚好在附近""顺便一起"', completionCriteria: '邀约自然不造作' },
      { action: '面对不痛快回应：不追问，说"好，你先忙"，过几天换方式再试', completionCriteria: '给足空间' },
    ],

    boundary: ['不要每次聊天都邀约。邀约应该是自然的延伸而非每次的终点', '不要用"那你想怎样"追问模糊回应'],

    dependsOn: ['F04'],
    composesWith: [],
    contrastsWith: [],
  },

  {
    id: 'S04',
    title: '暧昧期升级',
    type: 'scenario',
    modes: ['full', 'quick', 'advisor'],
    priority: 4,

    reading: '"话语必须放在具体情景中解读，同一句话在不同关系阶段含义截然相反。" — 第2章 2.14',

    interpretation: '暧昧期的核心是识别信号+选择策略。对方的同一句话在初期可能是拒绝，在暧昧期则可能是测试。升级操作必须与当前关系级别匹配。',

    cases: [
      { title: '同一句话两种解读', problem: '"我给你介绍女朋友吧"', method: '初期=拒绝（她觉得你不够好，推给别人）；暧昧期=测试（看你是不是只对她有意思）', conclusion: '必须结合关系阶段解读' },
      { title: '小步快跑', problem: '想推进关系但怕太快', method: '"把手给我"而非"做我女朋友"', conclusion: '小步升级比大步表白风险低得多' },
    ],

    triggers: [
      { scenario: '对方说了一句模糊的话需要判断含义', languageSignals: ['这句话什么意思'], modes: ['full', 'quick', 'advisor'] },
      { scenario: '想推进关系但不确定时机', languageSignals: ['该不该表白'], modes: ['advisor'] },
      { scenario: '对方主动试探/测试你', languageSignals: ['她在测试我'], modes: ['full', 'quick'] },
    ],

    execution: [
      { action: '判断当前阶段（F04定位）', completionCriteria: '明确关系级别' },
      { action: '解读信号：结合阶段判断对方的话是拒绝、测试还是暗示', completionCriteria: '正确解读信号' },
      { action: '选择策略：参考F03四大法则，匹配对应的回应方式', completionCriteria: '策略与信号匹配' },
      { action: '升级操作：小步快跑（"把手给我"而非"做我女朋友"）', completionCriteria: '升级幅度与关系级别匹配' },
    ],

    boundary: ['升级必须基于对方的正面回应，没有正面回应就不能升级。这是红线'],

    dependsOn: ['F03', 'F04'],
    composesWith: [],
    contrastsWith: [],
  },

  {
    id: 'S05',
    title: '被拒绝后的应对',
    type: 'scenario',
    modes: ['full', 'quick', 'advisor'],
    priority: 4,

    reading: '"被拒绝时善于用\'你\'作主语。" — 第2章 2.3',

    interpretation: '被拒绝后正确应对：1）不辩解不追问；2）用"你"做主语回应（而非"我我我"）；3）体面退出或降级维持联系。不建因果链（P03），不探究原因（P02），不加大诚意（P01）。',

    cases: [
      { title: '用"你"回应', problem: '表白被拒她说"我们还是做朋友吧"', method: '"好吧，反正你说的话从来都让人没法拒绝"', conclusion: '用"你"做主语，不辩解，体面退出' },
      { title: '降级维持', problem: '被拒后还想保持联系', method: '降低联系频率但不切断，等待新的机会窗口', conclusion: '保持在场但不纠缠' },
    ],

    triggers: [
      { scenario: '表白被拒', languageSignals: ['被拒绝了'], modes: ['full', 'advisor'] },
      { scenario: '邀约被拒', languageSignals: ['约不出来'], modes: ['full', 'quick'] },
      { scenario: '对方突然冷淡', languageSignals: ['突然不理我'], modes: ['advisor'] },
    ],

    execution: [
      { action: '接受事实：对方说了不，就是不', completionCriteria: '不追问不辩解' },
      { action: '用"你"回应："好吧，反正你说的话从来都让人没法拒绝"', completionCriteria: '以"你"为主语' },
      { action: '降级但不切断：保持联系频率降低，等待新的机会窗口', completionCriteria: '保持在场但不纠缠' },
      { action: '不建因果链（P03），不追问原因（P02）', completionCriteria: '就事论事' },
    ],

    boundary: ['降级维持≠纠缠。如果对方明确要求不再联系，必须尊重'],

    dependsOn: ['P02', 'P03'],
    composesWith: [],
    contrastsWith: [],
  },
];

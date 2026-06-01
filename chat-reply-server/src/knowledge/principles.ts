import type { KnowledgeUnit } from './types';

export const principles: KnowledgeUnit[] = [
  {
    id: 'P01',
    title: '诚意是润滑剂不是燃料',
    type: 'principle',
    modes: ['full', 'advisor', 'review'],
    priority: 4,

    reading: '"诚意让双方进退自如，是必不可少的，但它无法驱动一段停滞的关系。往没油的车里加机油，结果只能是\'烧机油\'。" — 第1章 1.3',

    interpretation: '诚意是维持关系的必要条件，但不是推动关系前进的动力。被拒绝后加码付出（更多消息、更贵礼物、更深表白）不会改善关系，反而让自己越来越被动。',

    cases: [
      {
        title: '诚意陷阱循环',
        problem: '男生被疏远后更频繁发消息送礼物表白',
        method: '对方越来越冷淡',
        conclusion: '方向错误而非投入不够。应该检查交流质量而非投入量',
      },
    ],

    triggers: [
      { scenario: '被拒绝后想加大投入', languageSignals: ['想送更贵的礼物', '想写更长的表白'], modes: ['advisor', 'review'] },
      { scenario: '对方说"你不够关心我"需要判断是诚意问题还是交流问题', languageSignals: ['你不够关心我'], modes: ['advisor'] },
      { scenario: '复盘时发现自己一直在单方面付出', languageSignals: ['单向付出'], modes: ['review'] },
    ],

    execution: [
      { action: '检测：是否在"被拒绝→加码付出→被更冷淡→再加码"的循环中？', completionCriteria: '明确是否在诚意陷阱中' },
      { action: '停止加码：立刻停止增加投入', completionCriteria: '不再加码' },
      { action: '转向：检查交流质量（是否在用上堆语言？频道是否匹配？），而非投入量', completionCriteria: '找到真正的改进方向' },
    ],

    boundary: ['不要误读为"不需要诚意"。诚意必须有，但它解决的是信任问题，不是吸引问题'],

    dependsOn: [],
    composesWith: [],
    contrastsWith: ['C02'],
  },

  {
    id: 'P02',
    title: '只关注反应不探究原因',
    type: 'principle',
    modes: ['full', 'advisor'],
    priority: 4,

    reading: '"与女性交往时，只做情境层面的回应，不要试图推断她行为背后的原因，因为根本无从推断。" — 第1章 1.7',

    interpretation: '女性的行为受当下情境和情绪影响，背后的原因通常是多重且复杂的。试图推理"她为什么这样做"几乎必然出错。正确做法是只对可观察的行为和反应做回应。',

    cases: [
      { title: '突然冷淡', problem: '对方突然冷淡', method: '不追问为什么，只维持正常节奏', conclusion: '维持节奏等她回暖比追问有效' },
    ],

    triggers: [
      { scenario: '对方突然冷淡想追问原因', languageSignals: ['她为什么突然不理我了'], modes: ['full', 'advisor'] },
      { scenario: '想分析"她到底怎么想的"', languageSignals: ['她到底怎么想的'], modes: ['advisor'] },
      { scenario: '复盘时发现自己过度解读', languageSignals: ['过度解读'], modes: ['review'] },
    ],

    execution: [
      { action: '检测：是否在想"她为什么..."？如果是，立即停止', completionCriteria: '停止追问原因' },
      { action: '回到事实：她做了什么？（只描述可观察的行为）', completionCriteria: '只描述客观行为' },
      { action: '回应该行为本身，不回应你推断的原因', completionCriteria: '回应基于事实而非推断' },
    ],

    boundary: ['这不意味着完全不思考。复盘（review）模式中可以分析原因，但实时对话中不应该边聊边分析'],

    dependsOn: [],
    composesWith: ['P03', 'S05'],
    contrastsWith: [],
  },

  {
    id: 'P03',
    title: '就事论事不建因果链',
    type: 'principle',
    modes: ['full', 'advisor', 'review'],
    priority: 4,

    reading: '"智慧的人看重事实、就事论事，但不会轻易建立因果关系，从而控制住自己的情绪。" — 第2章 2.4',

    interpretation: '遭遇负面事件时，大脑本能地在多个负面事实间建立因果链，导致情绪滚雪球放大。正确做法是只处理当前这一个事实，不在事实间建立因果关联。',

    cases: [
      { title: '情绪滚雪球', problem: '女孩对别的男人有兴趣→那个男人比我有钱→她因为钱才对别人有兴趣→我很失败', method: '三个负面事实被串联，情绪从"不愉快"升级为"强烈自我否定"', conclusion: '切断因果链就能控制情绪放大' },
    ],

    triggers: [
      { scenario: '被拒绝后开始联想"是不是因为我不够好/不够有钱/不够帅"', languageSignals: ['是不是因为我不够'], modes: ['advisor', 'review'] },
      { scenario: '约会中对方表现不热情开始焦虑', languageSignals: ['她是不是不喜欢我'], modes: ['full', 'advisor'] },
      { scenario: '复盘时情绪化评价而非客观分析', languageSignals: ['情绪化评价'], modes: ['review'] },
    ],

    execution: [
      { action: '写下当前困扰你的一个事实（只用一句话描述）', completionCriteria: '只有一个客观事实陈述' },
      { action: '检查：这句话里是否有"因为""所以""说明"？', completionCriteria: '标记因果连接词' },
      { action: '如果有，拆成独立的陈述，不加因果连接词', completionCriteria: '只有独立的客观事实' },
      { action: '只回应那个独立的客观事实', completionCriteria: '回应基于单一事实' },
    ],

    boundary: ['情绪管理不是压抑情绪，而是切断情绪放大的链条。感到难过是正常的，但不要主动去搜集更多负面证据'],

    dependsOn: [],
    composesWith: ['P02', 'S05'],
    contrastsWith: [],
  },

  {
    id: 'P04',
    title: '前期多谈自己后期多谈对方',
    type: 'principle',
    modes: ['full', 'quick'],
    priority: 4,

    reading: '"搭讪阶段通过多谈自己来展现自信、把握平衡；交往后期则应多关注对方，深入对方内心世界。" — 第2章 2.3',

    interpretation: '初识阶段，用"我"做主语展示自信和真实；关系深入后，用"你"做主语表达关注。反过来操作（前期全问对方、后期只谈自己）都会出问题。',

    cases: [
      { title: '自信展示', problem: '搭讪时被问"为什么要认识我"', method: '"我觉得不认识的话会后悔"（"我"开头，坦诚自信）', conclusion: '用"我"展示自信比用"你"（"因为你很有气质"）更有效' },
    ],

    triggers: [
      { scenario: '初识阶段不确定聊什么', languageSignals: ['不知道聊什么'], modes: ['full', 'quick'] },
      { scenario: '分析对话中"我"和"你"的比例是否合适', languageSignals: ['人称比例分析'], modes: ['advisor', 'review'] },
    ],

    execution: [
      { action: '关系初期：回复中用"我"开头，描述自己的状态和感受', completionCriteria: '回复以"我"为主语' },
      { action: '关系深入后：回复中增加"你"的比例，关注对方的感受', completionCriteria: '回复中有"你"的关注' },
      { action: '检查：当前对话中"我"和"你"的比例是否与关系阶段匹配？', completionCriteria: '人称比例与阶段匹配' },
    ],

    boundary: ['"多谈自己"≠自恋，是展示真实和建立信任', '"多谈对方"≠审问，是表达关心'],

    dependsOn: [],
    composesWith: ['S02'],
    contrastsWith: [],
  },

  {
    id: 'P05',
    title: '见好就收（三三法则）',
    type: 'principle',
    modes: ['full', 'quick'],
    priority: 4,

    reading: '"见好就收，主动结束对话回合。" — 第2章 2.11',

    interpretation: '聊天聊到高潮时主动结束，给对方留下期待和余味。每次短信控制在三个回合左右主动收。趁热打铁继续聊往往会导致话题耗尽、气氛转冷。',

    cases: [
      { title: '高潮收尾', problem: '聊天聊得正开心不确定要不要继续', method: '在高点主动结束："先去忙了，回头聊"', conclusion: '留下期待比聊到冷场更好' },
    ],

    triggers: [
      { scenario: '聊天聊得正开心不确定要不要继续', languageSignals: ['聊得很开心'], modes: ['full', 'quick'] },
      { scenario: '每次都聊到无话可说才结束', languageSignals: ['总是聊到冷场'], modes: ['review'] },
    ],

    execution: [
      { action: '判断当前对话是否到了高点（对方回复积极、有情绪投入）', completionCriteria: '确认是否在高点' },
      { action: '在高点主动结束："先去忙了，回头聊"', completionCriteria: '主动收' },
      { action: '不要贪——宁可少聊一轮也不要聊到冷场', completionCriteria: '在气氛好时结束' },
    ],

    boundary: ['三三法则适用于初期接触和日常维系。如果对方主动延续话题，可以适当继续，但仍然要在氛围好的时候收'],

    dependsOn: [],
    composesWith: ['S02', 'P08'],
    contrastsWith: [],
  },

  {
    id: 'P06',
    title: '保护她的选择权（低调原则）',
    type: 'principle',
    modes: ['full', 'advisor'],
    priority: 3,

    reading: '"求爱要低调，给对方留足空间；求婚才可以高调。" — 第1章 1.1',

    interpretation: '女性在确定伴侣前需要维持选择空间。公开追求、社交媒体秀恩爱、让周围人知道"有人追她"都在缩小她的选择范围，反而损害你的利益。',

    cases: [
      { title: '办公室恋情', problem: '想追女同事', method: '众人面前保持同事关系，私下独处时展现追求意图', conclusion: '公开场合低调=保护她的选择权' },
    ],

    triggers: [
      { scenario: '想公开表白或在朋友圈秀恩爱', languageSignals: ['想公开'], modes: ['advisor'] },
      { scenario: '在共同社交圈中不知如何表现', languageSignals: ['共同社交圈'], modes: ['full', 'advisor'] },
    ],

    execution: [
      { action: '检查：你的行为是否会让她的社交圈知道你在追她？', completionCriteria: '评估行为公开程度' },
      { action: '如果是，换一种不引人注目的方式', completionCriteria: '找到低调方式' },
      { action: '私下一对一的表达 > 公开场合的表演', completionCriteria: '表达方式私密化' },
    ],

    boundary: ['这不是要你隐瞒或欺骗，而是尊重她需要时间做决定的节奏'],

    dependsOn: [],
    composesWith: ['S01'],
    contrastsWith: [],
  },

  {
    id: 'P07',
    title: '吸引≠喜欢',
    type: 'principle',
    modes: ['full', 'advisor', 'review'],
    priority: 4,

    reading: '"吸引≠喜欢。一个人可能被你吸引但并不喜欢你。" — 第3章 3.10',

    interpretation: '吸引是对方觉得你有魅力（有趣/帅/有才华），喜欢是对方想和你在一起。吸引是必要的但不充分的。被吸引≠会接受邀约，觉得有趣≠想谈恋爱。',

    cases: [
      { title: '被夸但被拒', problem: '对方夸你"你真有趣"但拒绝邀约', method: '分析：吸引存在但喜欢不够', conclusion: '不能因为有吸引就跳到表白' },
    ],

    triggers: [
      { scenario: '对方夸你但拒绝邀约', languageSignals: ['你真有趣', '但我不想'], modes: ['full', 'advisor'] },
      { scenario: '分析关系"明明聊得来为什么没进展"', languageSignals: ['聊得来但没进展'], modes: ['advisor', 'review'] },
    ],

    execution: [
      { action: '区分信号：对方是被你吸引（赞美/好奇/笑）还是喜欢你（主动邀约/服从/关心你的感受）？', completionCriteria: '明确区分吸引和喜欢' },
      { action: '如果只有吸引没有喜欢：巩固交流质量，等待升级信号，不要急于表白', completionCriteria: '不因吸引而冒进' },
    ],

    boundary: ['不要因为有吸引就过度乐观，也不要因为没有喜欢就完全否定进展。吸引是基础，需要通过交流转化为喜欢'],

    dependsOn: [],
    composesWith: [],
    contrastsWith: ['F03'],
  },

  {
    id: 'P08',
    title: '短信走一步看一步',
    type: 'principle',
    modes: ['full', 'quick'],
    priority: 4,

    reading: '"短信应走一步看一步，根据对方上一句话判断聊什么、怎么聊。" — 第2章 2.8',

    interpretation: '微信/短信聊天不需要提前规划三步五步的策略。每发一条消息只根据对方上一条回复来决定下一步。这样可以保持对话的自然流畅，避免"各说各的"频道错位。',

    cases: [
      { title: '频道错位', problem: '对方说"我是路痴"只是陈述特点，男方回"我是活地图可以找我"', method: '这是各说各的——她在说自己的特点，你在推销自己', conclusion: '应该回应她的特点而非推销自己' },
    ],

    triggers: [
      { scenario: '不知道下一条消息该发什么', languageSignals: ['不知道发什么'], modes: ['full', 'quick'] },
      { scenario: '聊天卡住了不知道怎么继续', languageSignals: ['聊不下去了'], modes: ['quick'] },
    ],

    execution: [
      { action: '重读对方最后一条消息', completionCriteria: '完整理解对方的内容' },
      { action: '提取其中的情绪/事实/关注点', completionCriteria: '标记关键要素' },
      { action: '只回应这些，不要跳到你想聊的话题', completionCriteria: '回应紧扣对方内容' },
    ],

    boundary: ['"走一步看一步"≠没有方向感。大方向（建立连接、传递吸引）不变，但具体话题跟随对方节奏'],

    dependsOn: [],
    composesWith: ['S02', 'P05'],
    contrastsWith: [],
  },
];

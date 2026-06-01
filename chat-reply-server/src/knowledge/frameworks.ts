import type { KnowledgeUnit } from './types';

export const frameworks: KnowledgeUnit[] = [
  {
    id: 'F01',
    title: '上堆/下切语言模式识别',
    type: 'framework',
    modes: ['full', 'quick', 'advisor', 'review'],
    priority: 5,

    reading: '"在交谈的时候，愿意聊天的人总喜欢把话题说得更具体，而不想聊天的人则会顺着话题的方向直接概括出结论。" — 第2章 2.1',

    interpretation: `人的语言模式分为"上堆"（概括化）和"下切"（具体化）两种。上堆对应应激/低安全感状态，像升起防护罩拉开距离；下切对应自然/高安全感状态，传达友好信任。通过观察对方语言的上堆/下切比例，可以判断其真实态度和心理状态。这是全书最底层的分析工具。`,

    cases: [
      {
        title: '瑜伽对话',
        problem: '女孩说"在家休息"，男回复"瑜伽很好"（上堆评价），对话结束。',
        method: '同一女孩在另一场景说"太羡慕了，可惜我还要收拾屋子"（下切感受+原因）',
        conclusion: '下切让对话延续，上堆让对话终结',
        result: '下切回复时对话可以继续深入，上堆回复时对方很快用口号式语言结束对话',
      },
      {
        title: '口号式收场',
        problem: 'QQ上被朋友长篇大论讲创业计划，收不住',
        method: '用"那就祝你成功了"这句口号式上堆语言',
        conclusion: '上堆语言具有结束谈话的效果',
        result: '朋友立即回应"嗯，但愿如此，有空再详聊吧"，对话成功结束',
      },
    ],

    triggers: [
      {
        scenario: '对方回复简短概括，需要判断态度',
        languageSignals: ['嗯', '好的', '谢谢关心', '周末愉快'],
        modes: ['full', 'advisor'],
      },
      {
        scenario: '对方回复具体有细节，说明愿意交流',
        languageSignals: ['哈哈我也遇到过', '太羡慕了', '可是我还要'],
        modes: ['full', 'quick'],
      },
      {
        scenario: '需要判断对方是"不想聊"还是"紧张"',
        languageSignals: ['混合信号：偶尔下切但整体上堆'],
        modes: ['full', 'advisor'],
      },
      {
        scenario: '复盘对话时分析自己的语言模式',
        languageSignals: ['自己的回复是不是太概括了'],
        modes: ['review'],
      },
    ],

    execution: [
      {
        action: '收集语言样本：取对方最近3-5条回复，标记每条是上堆还是下切',
        completionCriteria: '每条回复标注了方向（上堆/下切）',
      },
      {
        action: '计算比例：上堆占比>70%=应激/不感兴趣；下切占比>50%=放松/有兴趣',
        completionCriteria: '得出一个整体判断',
      },
      {
        action: '识别关键信号：口号式语言（"周末愉快""谢谢关心"）= 结束信号',
        completionCriteria: '标记是否有明确结束信号',
        stopCondition: '若出现明确的结束信号，停止分析，切换到安全退出策略',
      },
    ],

    boundary: [
      '不能单凭一两条消息判断，需要3-5条样本',
      '上堆可能是因为紧张而非不感兴趣（宅男面对女神也会上堆）',
      '线上聊天（文字）的判断准确度低于线下（语气/表情）',
      '框架假设所有文化中上堆=拉开距离，但某些文化中概括化表达是礼貌',
    ],

    dependsOn: [],
    composesWith: ['F02', 'F03'],
    contrastsWith: [],
  },

  {
    id: 'F02',
    title: '思维匹配原则',
    type: 'framework',
    modes: ['full', 'quick', 'advisor'],
    priority: 5,

    reading: '"搭讪时应根据女孩的讲话内容和态度判断她的思维状态，然后采用相同的思维模式与之对话。" — 第2章 2.2',

    interpretation: `识别对方当前处于男性思维（目的导向/严肃/未来时）还是女性思维（感受导向/友好/当下时），然后用相同的思维模式回应。核心不是固定用哪种思维，而是"同频共振"——你在什么频道我就切到什么频道。`,

    cases: [
      {
        title: '同一句话两种回应',
        problem: '"为什么想认识我"——同一句话需要两种完全不同的回应',
        method: '友好微笑时用女性思维（"刚才看见你突然觉得不过来会后悔"），严肃防备时用男性思维（"就是想认识你，没别的目的"）',
        conclusion: '态度决定思维模式，而非问题本身',
        result: '两种回应都得到了对方的正面反应',
      },
      {
        title: '重复性确认',
        problem: '女孩不停重复"你有什么事"',
        method: '学员连说三遍"就是想认识你"——保持男性思维一致性',
        conclusion: '对方需要多次确认你的动机是否真实',
        result: '三遍之后女孩终于给电话号码',
      },
    ],

    triggers: [
      {
        scenario: '对方严肃提问需要明确回应',
        languageSignals: ['你有什么事？', '你想怎样？', '然后呢？'],
        modes: ['full', 'quick'],
      },
      {
        scenario: '对方友好好奇可以展开交流',
        languageSignals: ['为什么呀？', '你是做什么的？', '你猜猜'],
        modes: ['full', 'quick'],
      },
      {
        scenario: '分析对话频道是否错位',
        languageSignals: ['两人各说各的，聊不到一起'],
        modes: ['advisor', 'review'],
      },
    ],

    execution: [
      {
        action: '判断对方思维状态：看态度（严肃=男性思维，友好=女性思维）+ 看时态（未来时=男性，过去/现在时=女性）',
        completionCriteria: '标记为 M（男性思维）或 F（女性思维）',
      },
      {
        action: '选择匹配策略：M→用男性思维回应（明确目的、简洁直接）；F→用女性思维回应（描述感受、具体展开）',
        completionCriteria: '回应风格与对方一致',
      },
      {
        action: '动态切换：对话中对方态度变化时立即切换',
        completionCriteria: '回应始终与对方当前频道匹配',
        stopCondition: '若对方从F切换到M，必须立刻跟切，否则会显得"听不懂话"',
      },
    ],

    boundary: [
      '不适用于情绪极度负面时的场景（对方真生气时应该共情而非匹配）',
      '不要为了匹配而刻意模仿，保持自然',
      '思维匹配是工具不是目标，目标是有效沟通',
    ],

    dependsOn: ['F01'],
    composesWith: ['F03'],
    contrastsWith: [],
  },

  {
    id: 'F03',
    title: '四大法则（扩大冲突/魔趣/平衡/释放性信息）',
    type: 'framework',
    modes: ['full', 'quick', 'advisor', 'review'],
    priority: 5,

    reading: '扩大冲突："收到冲突信号后，继续在调侃的方向上推进一步" / 魔趣法则："具有联系感的夸张行为" / 平衡艺术："一半表达赞美/愿望 + 一半用来抵消跪舔感" / 释放性信息："对对方兴趣的恰到好处的表露" — 全书贯穿',

    interpretation: `四大法则是回应生成的核心策略库：
【扩大冲突】对方调侃你→你继续调侃回去，升级暧昧。前提是对方先发起、语气轻松。
【魔趣法则】回复中包含"我和你"的联系感 + 可以想象出画面的具体行为 + 夸张成分。三要素缺一不可。
【平衡艺术】想表达好感时，一半赞美/愿望 + 一半用自嘲/抱怨/条件限制来抵消跪舔感。
【释放性信息】通过具体赞美、自我袒露、提小要求来表露兴趣，不色情但让对方感受到"我对你有意思"。`,

    cases: [
      {
        title: '扩大冲突',
        problem: '她说"你不会是个坏人吧"',
        method: '继续调侃升级暧昧',
        conclusion: '"我呀，遇到好人就是好人，遇到坏人就是坏人，这就看你了"',
        result: '既调侃了她的角色，又留了悬念',
      },
      {
        title: '魔趣法则',
        problem: '她说"你今天真帅"',
        method: '联系感（站在你身边）+ 画面（站在一起）+ 夸张（不然怎么好意思）',
        conclusion: '"对呀，不然怎么好意思站在你身边"',
        result: '三要素齐全，自然有趣',
      },
      {
        title: '平衡艺术',
        problem: '想跟她逛街，直接说显得姿态低',
        method: '愿望（想逛街）+ 条件限制（要不是加班）',
        conclusion: '"要不是加班，真想跟你一起逛个天昏地暗"',
        result: '表达了愿望但不显得跪舔',
      },
      {
        title: '释放性信息',
        problem: '她说"该怎么感谢你"',
        method: '提小要求（捏脚丫）代替常规（请吃饭）',
        conclusion: '"那就替我捏捏脚丫吧"',
        result: '出人意料，制造亲密感',
      },
    ],

    triggers: [
      {
        scenario: '对方调侃/质疑/测试你（冲突信号）',
        languageSignals: ['你真讨厌', '你不会是坏人吧', '瞧你那臭德行'],
        modes: ['full', 'quick'],
      },
      {
        scenario: '需要有趣回应的日常对话（无冲突正面信号）',
        languageSignals: ['赞美', '好奇', '分享状态'],
        modes: ['full', 'quick'],
      },
      {
        scenario: '想表达好感但怕姿态太低',
        languageSignals: ['想说"我喜欢你"', '想说"你真漂亮"'],
        modes: ['full'],
      },
      {
        scenario: '需要推进关系表达兴趣（需有正面回应基础）',
        languageSignals: ['关系已过破冰期，需要升级'],
        modes: ['full', 'advisor'],
      },
    ],

    execution: [
      {
        action: '识别信号类型：根据F01结果判断——冲突信号/正面无冲突/模糊/负面',
        completionCriteria: '确定使用哪个法则',
      },
      {
        action: '选择法则：冲突→扩大冲突；正面无冲突→魔趣；想表达好感→平衡；需推进→释放性信息',
        completionCriteria: '选定1-2个法则组合使用',
      },
      {
        action: '生成回复：按法则模板构造回复',
        completionCriteria: '回复满足法则的要素检验',
      },
      {
        action: '安全检查：关系阶段是否支持？初期不用扩大冲突；负面信号停用所有进攻型法则',
        completionCriteria: '法则使用与关系阶段匹配',
        stopCondition: '初期接触不用扩大冲突；对方负面信号时所有进攻型法则停用',
      },
    ],

    boundary: [
      '扩大冲突：对方真生气时绝对不能用。区分"讨厌"（调侃）和真生气看语气和后续行为',
      '魔趣法则：不要为了夸张而夸张失去自然感。"油腻"的根源是不自然',
      '平衡艺术：抵消部分不能用贬低对方来实现，只能自嘲或引入外部条件',
      '释放性信息：必须步步为营不能跳级。"做我女朋友"是越级，"把手给我"是适当',
      '四大法则假设对方已有基本好感，对完全无感的对象效果有限',
    ],

    dependsOn: ['F04'],
    composesWith: ['S04'],
    contrastsWith: ['F05'],
  },

  {
    id: 'F04',
    title: '四级好感信号体系',
    type: 'framework',
    modes: ['full', 'advisor', 'review'],
    priority: 5,

    reading: '"四级好感信号：第四级回应（接电话回短信但内容平淡）、第三级倾诉（聊很多心事但不接受表白）、第二级关注（关心你的生活）、第一级依顺（容易约出来、听话、接受你的要求）。" — 第1章 1.12',

    interpretation: `女孩对你的好感从低到高分为四个可观察的级别，每一级有明确的行为指标和对应的操作边界。升级必须逐层推进，越级操作是最常见的败因。判断关系时取好感程度最高的信号为准。`,

    cases: [
      {
        title: '备胎表白失败',
        problem: '处于回应→倾诉级别的男性突然表白',
        method: '女孩回应："本来想跟你做个朋友，但你非要这样，那只能算了"',
        conclusion: '倾诉级别不能表白，越级操作直接导致关系倒退',
      },
      {
        title: '依顺级别',
        problem: '需要判断是否可以大胆行动',
        method: '观察对方是否"容易约出来、听话、接受你的要求"',
        conclusion: '依顺级别可以大胆行动',
      },
    ],

    triggers: [
      {
        scenario: '需要判断当前关系处于哪个阶段',
        languageSignals: ['综合分析对方行为模式'],
        modes: ['full', 'advisor'],
      },
      {
        scenario: '决定是否可以升级（表白/邀约/身体接触）',
        languageSignals: ['想知道"现在可以了吗"'],
        modes: ['full', 'advisor'],
      },
      {
        scenario: '复盘关系进展是否合理',
        languageSignals: ['回顾对话中的信号'],
        modes: ['review'],
      },
    ],

    execution: [
      {
        action: '收集行为证据：列出对方最近5-10个互动行为',
        completionCriteria: '有具体的行为列表',
      },
      {
        action: '对照四级标准分类：每个行为对应到回应/倾诉/关注/依顺的哪一级',
        completionCriteria: '每个行为标注了级别',
      },
      {
        action: '取最高级别：以好感度最高的信号为当前关系级别',
        completionCriteria: '确定一个级别',
      },
      {
        action: '决定操作：该级别能做什么就做什么，不越级',
        completionCriteria: '操作与当前级别匹配',
        stopCondition: '回应级别只能继续聊天；倾诉级别不能表白；关注级别可以试探邀约；依顺级别可以大胆行动',
      },
    ],

    boundary: [
      '信号可能不稳定需要多次验证。一次好行为不代表升级',
      '不同女孩表达好感的方式不同，四级体系是通用框架但需个体化调整',
      '线上（聊天）的好感信号比线下（行为）弱一个级别',
    ],

    dependsOn: [],
    composesWith: ['F03', 'S04', 'F06'],
    contrastsWith: [],
  },

  {
    id: 'F05',
    title: '三维回应模型（事实→情绪→认知）',
    type: 'framework',
    modes: ['full', 'advisor', 'review'],
    priority: 4,

    reading: '"完美的回应应同时覆盖事实、认知、情绪三个层面。" — 第2章 2.5',

    interpretation: `当对方的陈述包含事实（具体问题）、认知（看法/归因）、情绪（情感状态）三要素时，好的回应应该在三个维度分别回应。大多数男性只能做到事实回应（解决问题），能同时做到情绪回应已属优秀，兼顾认知回应才是高手。`,

    cases: [
      {
        title: '换灯泡案例',
        problem: '女孩说"家里的灯泡憋了，正在换新的呢，没想到这么麻烦"',
        method: '事实=换灯泡，认知=一个人住什么事都得自己来，情绪=失落无奈烦躁。最佳回应"我做过好多年灯泡"同时回应了三层',
        conclusion: '好的回应覆盖事实（帮换）+情绪（幽默乐观）+认知（我也独身好多年）',
      },
    ],

    triggers: [
      {
        scenario: '对方分享了一个包含情绪和看法的陈述',
        languageSignals: ['好烦啊', '太累了', '没想到这么麻烦'],
        modes: ['full', 'quick'],
      },
      {
        scenario: '分析对话质量时检查回应是否完整',
        languageSignals: ['复盘自己的回复'],
        modes: ['review', 'advisor'],
      },
    ],

    execution: [
      {
        action: '拆解对方陈述：提取事实、认知、情绪三个要素',
        completionCriteria: '三个要素都标注出来',
      },
      {
        action: '检查覆盖：自己的回应覆盖了哪几层？至少覆盖事实+情绪',
        completionCriteria: '标注回应覆盖的维度',
      },
      {
        action: '补充缺失维度：如果只覆盖了事实，补充情绪回应；如果能补充认知回应更好',
        completionCriteria: '回应至少覆盖两层，最好三层',
      },
    ],

    boundary: [
      '不是每句话都包含三层，只有明显包含时才需要三层回应',
      '短信/快速聊天中不需要三层，一层情绪回应即可',
      '不要过度分析导致回应不自然',
    ],

    dependsOn: ['F01'],
    composesWith: [],
    contrastsWith: ['F03'],
  },

  {
    id: 'F06',
    title: '分层升级理论',
    type: 'framework',
    modes: ['full', 'advisor'],
    priority: 4,

    reading: '"男女关系以层级模式递进，不可越级。" — 第3章 3.01',

    interpretation: `关系发展是从搭讪→认识→交流→约会→亲密逐层递进的。每一层有明确的进入条件和操作方式。升级的标志是对方接受了更高级别的互动。越级操作（如刚认识就表白）是最常见的错误。`,

    cases: [
      {
        title: '急于邀约',
        problem: '搭讪后急于邀约，跳过了"建立连接"阶段',
        method: '要到了号码但对方不回复',
        conclusion: '缺少有效交流的号码没有后续价值',
      },
    ],

    triggers: [
      {
        scenario: '需要决定下一步行动（聊天/邀约/表白）',
        languageSignals: ['接下来该怎么做'],
        modes: ['full', 'advisor'],
      },
      {
        scenario: '分析关系是否在正常推进',
        languageSignals: ['对方行为有变化'],
        modes: ['advisor'],
      },
      {
        scenario: '复盘关系卡在哪个阶段',
        languageSignals: ['为什么一直没进展'],
        modes: ['review'],
      },
    ],

    execution: [
      {
        action: '定位当前层级：搭讪→认识→交流→约会→亲密',
        completionCriteria: '确定当前层级',
      },
      {
        action: '检验升级条件：对方是否给出了当前层级的好感信号（参考F04）',
        completionCriteria: '确认是否满足升级条件',
      },
      {
        action: '执行层级内操作：不满足条件就巩固当前层级，不急于升级',
        completionCriteria: '操作与层级匹配',
        stopCondition: '若对方未给出上一级的信号，停止尝试升级，回到巩固',
      },
    ],

    boundary: [
      '升级不是线性的，可能回退。回退时不应该追问原因',
      '女性视角下"升级"的感受和男性不同——男性视为"进展"，女性可能视为"压力"',
      '分层升级不等于拖延，信号到位就果断行动',
    ],

    dependsOn: ['F04'],
    composesWith: [],
    contrastsWith: [],
  },
];

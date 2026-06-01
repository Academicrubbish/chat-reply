import type { Relation, ModeConfig } from './types';

export const relations: Relation[] = [
  // depends-on
  { from: 'F02', to: 'F01', type: 'depends-on' },
  { from: 'F03', to: 'F04', type: 'depends-on' },
  { from: 'F06', to: 'F04', type: 'depends-on' },
  { from: 'F05', to: 'F01', type: 'depends-on' },
  { from: 'C01', to: 'P01', type: 'depends-on' },
  { from: 'C03', to: 'F01', type: 'depends-on' },
  { from: 'S01', to: 'F02', type: 'depends-on' },
  { from: 'S03', to: 'F04', type: 'depends-on' },

  // contrasts-with
  { from: 'F05', to: 'F03', type: 'contrasts-with', description: 'F03是回应策略，F05是回应质量标准，两者互补但维度不同' },
  { from: 'P01', to: 'C02', type: 'contrasts-with', description: 'P01是正确理解诚意，C02是误用诚意的陷阱' },
  { from: 'P07', to: 'F03', type: 'contrasts-with', description: 'P07提醒吸引≠喜欢，F03的释放性信息只是表达吸引而非制造喜欢' },

  // composes-with
  { from: 'F01', to: 'F03', type: 'composes-with' },
  { from: 'F02', to: 'F03', type: 'composes-with' },
  { from: 'F03', to: 'S04', type: 'composes-with' },
  { from: 'F04', to: 'S04', type: 'composes-with' },
  { from: 'P02', to: 'P03', type: 'composes-with' },
  { from: 'P02', to: 'S05', type: 'composes-with' },
  { from: 'P03', to: 'S05', type: 'composes-with' },
  { from: 'P04', to: 'S02', type: 'composes-with' },
  { from: 'P05', to: 'S02', type: 'composes-with' },
  { from: 'P08', to: 'S02', type: 'composes-with' },
  { from: 'S01', to: 'P06', type: 'composes-with' },
  { from: 'C04', to: 'S03', type: 'composes-with' },
];

export const modeConfigs: ModeConfig[] = [
  {
    mode: 'full',
    label: '完整模式',
    description: '分析+回复，激活全部知识单元',
    activatedUnits: ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'S01', 'S02', 'S03', 'S04', 'S05', 'C01', 'C02', 'C03', 'C04'],
    outputTokenBudget: 1500,
    customInstructions: '完整分析对方消息，生成3-4条风格各异的回复。输出包含analysis、plan、replies三部分。',
  },
  {
    mode: 'quick',
    label: '快速模式',
    description: '只回复不分析，跳过推理直接匹配',
    activatedUnits: ['F01', 'F02', 'F03', 'P04', 'P05', 'P08', 'S02', 'S03', 'C04'],
    outputTokenBudget: 300,
    customInstructions: '快速生成3条回复。只做信号匹配→查表→输出，不做深度推理。',
  },
  {
    mode: 'advisor',
    label: '军师模式',
    description: '只分析不回复，深度诊断',
    activatedUnits: ['F01', 'F02', 'F04', 'F05', 'F06', 'P01', 'P02', 'P03', 'P06', 'P07', 'S01', 'S03', 'S04', 'S05', 'C01', 'C02', 'C03', 'C04'],
    outputTokenBudget: 800,
    customInstructions: '深度分析对方态度、情绪、心理状态。给出诊断警告和行动建议。不生成回复。',
  },
  {
    mode: 'review',
    label: '复盘模式',
    description: '评价+打分，5维评估体系',
    activatedUnits: ['F01', 'F03', 'F04', 'F05', 'P01', 'P03', 'P07', 'C01', 'C02', 'C03', 'C04'],
    outputTokenBudget: 1000,
    customInstructions: '按5个维度（信号识别/策略选择/节奏控制/情绪管理/回应质量）评分，给出亮点、踩坑、总分和进阶建议。',
  },
];

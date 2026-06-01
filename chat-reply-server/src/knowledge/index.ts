import type { KnowledgeUnit, KnowledgeBase, ModeConfig, ModeType } from './types';
import { frameworks } from './frameworks';
import { principles } from './principles';
import { scenarios } from './scenarios';
import { concepts } from './concepts';
import { relations, modeConfigs } from './mode-mapping';

const allUnits: KnowledgeUnit[] = [
  ...frameworks,
  ...principles,
  ...scenarios,
  ...concepts,
];

export const knowledgeBase: KnowledgeBase = {
  units: allUnits,
  relations,
  modes: modeConfigs,
};

// 按 ID 查找单元
export function getUnit(id: string): KnowledgeUnit | undefined {
  return allUnits.find(u => u.id === id);
}

// 获取指定模式激活的单元
export function getUnitsForMode(mode: ModeType): KnowledgeUnit[] {
  const config = modeConfigs.find(m => m.mode === mode);
  if (!config) return [];
  return config.activatedUnits
    .map(id => allUnits.find(u => u.id === id))
    .filter((u): u is KnowledgeUnit => u !== undefined);
}

// 获取模式配置
export function getModeConfig(mode: ModeType): ModeConfig | undefined {
  return modeConfigs.find(m => m.mode === mode);
}

// 获取指定单元的关联单元
export function getRelatedUnits(unitId: string): { dependsOn: KnowledgeUnit[]; composesWith: KnowledgeUnit[]; contrastsWith: KnowledgeUnit[] } {
  const dependsOn = relations
    .filter(r => r.from === unitId && r.type === 'depends-on')
    .map(r => getUnit(r.to))
    .filter((u): u is KnowledgeUnit => u !== undefined);

  const composesWith = relations
    .filter(r => r.from === unitId && r.type === 'composes-with')
    .map(r => getUnit(r.to))
    .filter((u): u is KnowledgeUnit => u !== undefined);

  const contrastsWith = relations
    .filter(r => r.from === unitId && r.type === 'contrasts-with')
    .map(r => getUnit(r.to))
    .filter((u): u is KnowledgeUnit => u !== undefined);

  return { dependsOn, composesWith, contrastsWith };
}

// 按类型获取单元
export function getUnitsByType(type: KnowledgeUnit['type']): KnowledgeUnit[] {
  return allUnits.filter(u => u.type === type);
}

// 获取所有单元 ID
export function getAllUnitIds(): string[] {
  return allUnits.map(u => u.id);
}

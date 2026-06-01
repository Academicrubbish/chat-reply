import { Router, Request, Response } from 'express';
import { knowledgeBase, getUnitsForMode, getModeConfig, getUnit, getRelatedUnits } from '../knowledge';
import type { ModeType } from '../knowledge/types';

const router = Router();

// GET /api/knowledge/units — 获取所有知识单元
router.get('/units', (_req: Request, res: Response) => {
  const units = knowledgeBase.units.map(u => ({
    id: u.id,
    title: u.title,
    type: u.type,
    modes: u.modes,
    priority: u.priority,
    summary: u.interpretation.split('\n')[0],
  }));
  res.json({ units, total: units.length });
});

// GET /api/knowledge/units/:id — 获取单个知识单元详情
router.get('/units/:id', (req: Request, res: Response) => {
  const unit = getUnit(String(req.params.id));
  if (!unit) {
    res.status(404).json({ error: '知识单元不存在' });
    return;
  }
  const relations = getRelatedUnits(unit.id);
  res.json({ unit, relations });
});

// GET /api/knowledge/mode/:mode — 获取某模式激活的知识
router.get('/mode/:mode', (req: Request, res: Response) => {
  const mode = req.params.mode as ModeType;
  const config = getModeConfig(mode);
  if (!config) {
    res.status(400).json({ error: '无效模式' });
    return;
  }
  const units = getUnitsForMode(mode);
  res.json({
    mode: config.mode,
    label: config.label,
    description: config.description,
    outputTokenBudget: config.outputTokenBudget,
    activatedUnits: units.map(u => ({
      id: u.id,
      title: u.title,
      type: u.type,
      summary: u.interpretation.split('\n')[0],
    })),
  });
});

// GET /api/knowledge/relations — 获取知识关系图
router.get('/relations', (_req: Request, res: Response) => {
  res.json({ relations: knowledgeBase.relations });
});

// GET /api/knowledge/modes — 获取所有模式配置
router.get('/modes', (_req: Request, res: Response) => {
  res.json({ modes: knowledgeBase.modes });
});

export default router;

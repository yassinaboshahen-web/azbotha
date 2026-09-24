import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { insightService } from '../services/insightService';

const router = Router();

// GET /api/insights/weekly-summary
router.get('/weekly-summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const summary = await insightService.getWeeklySummary(req.user!.id, date);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate weekly summary', details: err });
  }
});

// GET /api/insights/summary (alias)
router.get('/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const summary = await insightService.getWeeklySummary(req.user!.id, date);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate weekly summary', details: err });
  }
});

export default router;

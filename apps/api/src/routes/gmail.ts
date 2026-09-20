import { Router, Request, Response } from 'express';
import { requireAuth, AuthPayload } from '../middleware/auth.js';
import {
  createAuthUrl,
  disconnectGmail,
  exchangeCode,
  getGmailStatus,
  isGmailConfigured,
  parseOAuthState,
} from '../lib/gmail.js';

const router = Router();

function frontendUrl(): string {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

router.get('/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user as AuthPayload;
  try {
    const status = await getGmailStatus(user.userId);
    res.json(status);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read Gmail status' });
  }
});

router.get('/auth-url', requireAuth, (_req: Request, res: Response): void => {
  if (!isGmailConfigured()) {
    res.status(500).json({
      error: 'Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to apps/api/.env',
    });
    return;
  }
  const user = (_req as any).user as AuthPayload;
  try {
    res.json({ url: createAuthUrl(user.userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create Google auth URL' });
  }
});

router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const oauthError = req.query.error ? String(req.query.error) : '';
  const dest = frontendUrl();

  if (oauthError) {
    res.redirect(`${dest}/attendance?gmail=denied`);
    return;
  }
  if (!code || !state) {
    res.redirect(`${dest}/attendance?gmail=error`);
    return;
  }

  try {
    const userId = parseOAuthState(state);
    await exchangeCode(userId, code);
    res.redirect(`${dest}/attendance?gmail=connected`);
  } catch (err) {
    console.error(err);
    res.redirect(`${dest}/attendance?gmail=error`);
  }
});

router.post('/disconnect', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user as AuthPayload;
  try {
    await disconnectGmail(user.userId);
    res.json({ connected: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

export default router;

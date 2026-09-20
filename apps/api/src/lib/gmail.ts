import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import {
  deleteGmailTokens,
  getGmailTokens,
  saveGmailTokens,
  type GmailTokenRecord,
} from './gmailTokens.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function oauthClient() {
  return new google.auth.OAuth2(
    requiredEnv('GOOGLE_CLIENT_ID'),
    requiredEnv('GOOGLE_CLIENT_SECRET'),
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback',
  );
}

export function isGmailConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export function createAuthUrl(userId: number): string {
  const client = oauthClient();
  const state = jwt.sign({ userId, purpose: 'gmail' }, process.env.JWT_SECRET || 'change-me-in-production', {
    expiresIn: '15m',
  });
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export function parseOAuthState(state: string): number {
  const payload = jwt.verify(state, process.env.JWT_SECRET || 'change-me-in-production') as {
    userId: number;
    purpose?: string;
  };
  if (payload.purpose !== 'gmail' || !payload.userId) {
    throw new Error('Invalid OAuth state');
  }
  return payload.userId;
}

export async function exchangeCode(userId: number, code: string): Promise<string> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const profile = await oauth2.userinfo.get();
  const email = profile.data.email;
  if (!email) {
    throw new Error('Google account email was not returned');
  }
  if (!tokens.refresh_token) {
    const existing = await getGmailTokens(userId);
    if (!existing?.refreshToken) {
      throw new Error('Google did not return a refresh token. Disconnect the app in Google Account permissions and try again.');
    }
    await saveGmailTokens(userId, {
      ...existing,
      email,
      accessToken: tokens.access_token || existing.accessToken,
      expiryDate: tokens.expiry_date || existing.expiryDate,
    });
    return email;
  }

  await saveGmailTokens(userId, {
    email,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token || undefined,
    expiryDate: tokens.expiry_date || undefined,
  });
  return email;
}

async function authorizedClient(userId: number) {
  const stored = await getGmailTokens(userId);
  if (!stored) {
    throw new Error('Gmail is not connected');
  }
  const client = oauthClient();
  client.setCredentials({
    refresh_token: stored.refreshToken,
    access_token: stored.accessToken,
    expiry_date: stored.expiryDate,
  });
  client.on('tokens', async (tokens) => {
    const next: GmailTokenRecord = {
      ...stored,
      accessToken: tokens.access_token || stored.accessToken,
      expiryDate: tokens.expiry_date || stored.expiryDate,
      refreshToken: tokens.refresh_token || stored.refreshToken,
    };
    await saveGmailTokens(userId, next);
  });
  return { client, stored };
}

export async function getGmailStatus(userId: number): Promise<{ connected: boolean; email: string | null; configured: boolean }> {
  const configured = isGmailConfigured();
  if (!configured) {
    return { connected: false, email: null, configured: false };
  }
  const stored = await getGmailTokens(userId);
  return { connected: Boolean(stored), email: stored?.email ?? null, configured: true };
}

export async function disconnectGmail(userId: number): Promise<void> {
  await deleteGmailTokens(userId);
}

function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

export async function sendGmail(options: {
  userId: number;
  to: string[];
  subject: string;
  body: string;
}): Promise<void> {
  const uniqueTo = [...new Set(options.to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (uniqueTo.length === 0) {
    throw new Error('No recipient email addresses');
  }

  const { client, stored } = await authorizedClient(options.userId);
  const gmail = google.gmail({ version: 'v1', auth: client });

  const mime = [
    `From: ${encodeHeader(stored.email)}`,
    `To: ${uniqueTo.join(', ')}`,
    `Subject: ${encodeHeader(options.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    options.body,
  ].join('\r\n');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: Buffer.from(mime).toString('base64url'),
    },
  });
}

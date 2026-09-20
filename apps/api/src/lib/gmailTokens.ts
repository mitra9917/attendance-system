import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export interface GmailTokenRecord {
  email: string;
  refreshToken: string;
  accessToken?: string;
  expiryDate?: number;
}

interface TokenFile {
  users: Record<string, GmailTokenRecord>;
}

const TOKEN_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../.gmail-tokens.json',
);

async function readStore(): Promise<TokenFile> {
  try {
    const raw = await readFile(TOKEN_PATH, 'utf8');
    const parsed = JSON.parse(raw) as TokenFile;
    return { users: parsed.users ?? {} };
  } catch {
    return { users: {} };
  }
}

async function writeStore(store: TokenFile): Promise<void> {
  await mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await writeFile(TOKEN_PATH, JSON.stringify(store, null, 2), 'utf8');
}

export async function getGmailTokens(userId: number): Promise<GmailTokenRecord | null> {
  const store = await readStore();
  return store.users[String(userId)] ?? null;
}

export async function saveGmailTokens(userId: number, record: GmailTokenRecord): Promise<void> {
  const store = await readStore();
  store.users[String(userId)] = record;
  await writeStore(store);
}

export async function deleteGmailTokens(userId: number): Promise<void> {
  const store = await readStore();
  delete store.users[String(userId)];
  await writeStore(store);
}

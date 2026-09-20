import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Always load apps/api/.env, even when `npm run dev` is started from the repo root.
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'),
});

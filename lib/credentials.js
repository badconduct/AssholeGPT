import { readFile } from 'node:fs/promises';

// Credentials stay on the server. A mounted file takes precedence over an
// environment variable; unauthenticated local providers may use neither.
export async function apiToken(env = process.env) {
  if (env.AI_TOKEN_FILE) {
    try {
      const token = (await readFile(env.AI_TOKEN_FILE, 'utf8')).trim();
      if (!token || /[\r\n]/.test(token)) throw new Error();
      return token;
    } catch {
      throw new Error('Could not read AI_TOKEN_FILE. Check its contents and permissions.');
    }
  }
  if (/[\r\n]/.test(env.AI_TOKEN || '')) throw new Error('Invalid AI_TOKEN.');
  return env.AI_TOKEN || '';
}

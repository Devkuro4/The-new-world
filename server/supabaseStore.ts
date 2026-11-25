import 'dotenv/config';

const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
export const cloudEnabled = Boolean(url && key);
if (Boolean(url) !== Boolean(key)) throw new Error('Configure both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
const endpoint = `${url}/rest/v1/pieck_storage`;
async function request(query: string, method = 'GET', body?: unknown) {
  const response = await fetch(endpoint + query, {
    method, headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Supabase storage ${method} failed (${response.status})`);
  return method === 'GET' ? await response.json() : undefined;
}
export async function readCloud(id: string): Promise<string | null> {
  const rows = await request(`?id=eq.${encodeURIComponent(id)}&select=value`);
  return rows[0]?.value ?? null;
}
export async function writeCloud(id: string, value: string) {
  await request('?on_conflict=id', 'POST', { id, value });
}
export async function deleteCloud(id: string) {
  await request(`?id=eq.${encodeURIComponent(id)}`, 'DELETE');
}
// Serialize snapshots; retain the newest pending snapshot on failure.
let pending: string | undefined;
let running: Promise<void> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
export function queueBotSnapshot(value: string) {
  if (!cloudEnabled) return;
  pending = value;
  if (!running && !retry) void flushBotSnapshot();
}
export function flushBotSnapshot(): Promise<void> {
  if (running) return running;
  if (retry) { clearTimeout(retry); retry = undefined; }
  running = (async () => {
    while (pending !== undefined) {
      const value = pending; pending = undefined;
      try { await writeCloud('bot-state', value); }
      catch (error) {
        pending ??= value;
        console.error('Bot state backup failed:', error);
        retry = setTimeout(() => { retry = undefined; void flushBotSnapshot(); }, 5000);
        break;
      }
    }
  })().finally(() => { running = undefined; });
  return running;
}

import { BufferJSON, initAuthCreds, proto, type AuthenticationState } from '@whiskeysockets/baileys';
import { readCloud, writeCloud, deleteCloud } from './supabaseStore.ts';
let saved = false;
let tail: Promise<unknown> = Promise.resolve();
let generation = 0;
export const hasCloudSession = () => saved;
export async function inspectCloudSession() {
  const raw = await readCloud('wa-auth');
  saved = !!(raw && JSON.parse(raw, BufferJSON.reviver).creds?.registered);
}
export async function clearCloudSession() {
  generation++;
  await tail.catch(() => {});
  await deleteCloud('wa-auth');
  saved = false;
}
export async function useCloudAuthState(): Promise<{state: AuthenticationState; saveCreds: () => Promise<void>}> {
  await tail.catch(() => {});
  const raw = await readCloud('wa-auth');
  const data = raw ? JSON.parse(raw, BufferJSON.reviver) : { creds: initAuthCreds(), keys: {} };
  const current = ++generation;
  saved = !!data.creds.registered;
  const save = async () => {
    if (current !== generation) return;
    const snapshot = JSON.stringify(data, BufferJSON.replacer);
    const task = tail.catch(() => {}).then(async () => {
      if (current !== generation) return;
      for (let attempt = 0; ; attempt++) {
        try { await writeCloud('wa-auth', snapshot); saved = !!data.creds.registered; return; }
        catch (error) { if (attempt >= 3) throw error; await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); }
      }
    });
    tail = task;
    await task;
  };
  const state: AuthenticationState = {
    creds: data.creds,
    keys: {
      get: async (type, ids) => {
        const result: Record<string, any> = {};
        for (const id of ids) {
          let value = data.keys[type]?.[id];
          if (type === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
          if (value != null) result[id] = value;
        }
        return result;
      },
      set: async (updates) => {
        for (const [type, values] of Object.entries(updates)) {
          const bucket = data.keys[type] ??= {};
          for (const [id, value] of Object.entries(values ?? {})) {
            if (value == null) delete bucket[id]; else bucket[id] = value;
          }
        }
        await save();
      },
    },
  };
  return { state, saveCreds: save };
}

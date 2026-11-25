export type AiContext = { source: string; chatMode: string; groupId?: string; messageId?: string; quotedMessageId?: string; quotedSenderId?: string; quotedText?: string };
export type Turn = { role: 'user' | 'assistant'; content: string; timestamp: string };
const anchors = new Map<string, { owner: string; thread: string }>();
const latest = new Map<string, string>();
const pending = new Map<string, Promise<unknown>>();
const scope = (c: AiContext) => JSON.stringify([c.source, c.chatMode, c.groupId || 'unknown']);
const base = (c: AiContext, owner: string) => JSON.stringify([scope(c), owner]);
const anchorKey = (c: AiContext, id: string) => JSON.stringify([scope(c), id]);
export function threadKey(c: AiContext, owner: string): string {
  const b = base(c, owner);
  const quoted = c.quotedMessageId && anchors.get(anchorKey(c, c.quotedMessageId));
  const thread = c.quotedMessageId ? (quoted && quoted.owner === owner ? quoted.thread : c.quotedMessageId) : latest.get(b) || 'default';
  latest.set(b, thread);
  if (latest.size > 5000) latest.delete(latest.keys().next().value!);
  return JSON.stringify([b, thread]);
}
export function linkReply(c: AiContext, owner: string, key: string, replyId: string) {
  const [, thread] = JSON.parse(key) as [string, string];
  for (const id of [c.messageId, replyId]) if (id) anchors.set(anchorKey(c, id), { owner, thread });
  while (anchors.size > 10000) anchors.delete(anchors.keys().next().value!);
}
export function serialize<T>(c: AiContext, owner: string, run: () => Promise<T>): Promise<T> {
  const key = base(c, owner);
  const next = (pending.get(key) || Promise.resolve()).catch(() => {}).then(run);
  pending.set(key, next);
  return next.finally(() => { if (pending.get(key) === next) pending.delete(key); });
}
export function clearThreads(store: Record<string, Turn[]>, owner: string) {
  delete store[owner];
  for (const key of Object.keys(store)) { try { if (JSON.parse(JSON.parse(key)[0])[1] === owner) delete store[key]; } catch {} }
  for (const [key, value] of anchors) if (value.owner === owner) anchors.delete(key);
  for (const key of latest.keys()) if (JSON.parse(key)[1] === owner) latest.delete(key);
}
export function relevantMemories(notes: string[], input: string): string[] {
  const words = (s: string) => s.toLowerCase().replace(/favourite/g, 'favorite').match(/[a-z0-9]{3,}/g) || [];
  const stop = new Set(['the','and','you','your','what','that','this','have','with','about','remember','tell','was','are','for']);
  const query = new Set(words(input).filter(w => !stop.has(w)));
  if (/\b(what do you remember about me|what do you know about me)\b/i.test(input)) return notes.slice(0, 8);
  return notes.map(note => ({note, score: words(note).filter(w => query.has(w)).length})).filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0, 5).map(x => x.note);
}
export function chatPrompt(c: AiContext, name: string, input: string) {
  return JSON.stringify({ currentSpeaker: name, currentMessage: input, quotedMessage: c.quotedText ? { author: c.quotedSenderId || 'unknown', text: c.quotedText.slice(0, 3500) } : undefined });
}

export function userJid(value?: string | null): string | undefined {
  const match = /^(\d+)(?::\d+)?@(s\.whatsapp\.net|lid)$/.exec(value || '');
  return match ? `${match[1]}@${match[2]}` : undefined;
}

type Participant = { id: string; lid?: string | null; phoneNumber?: string | null };

export function identityJids(value?: string | null, alternate?: string | null, participants: Participant[] = []): string[] {
  const id = userJid(value) || userJid(alternate);
  if (!id) return [];
  const kind = id.split('@')[1];
  const candidates = new Set<string>();
  const add = (candidate?: string | null) => {
    const jid = userJid(candidate);
    if (jid && jid.split('@')[1] !== kind) candidates.add(jid);
  };
  add(alternate);
  for (const row of participants) {
    const rowIds = [row.id, row.lid, row.phoneNumber].map(userJid);
    if (rowIds.includes(id)) rowIds.forEach(add);
  }
  return candidates.size === 1 ? [id, ...candidates] : [id];
}

export function accountIds(jids: string[], ownerNumber: string): string[] {
  const phone = jids.find(jid => jid.endsWith('@s.whatsapp.net'))?.split('@')[0];
  const lid = jids.find(jid => jid.endsWith('@lid'))?.split('@')[0];
  if (phone && phone === ownerNumber.replace(/\D/g, '')) return ['owner-kuro'];
  return [...(phone ? [`wa-${phone}`] : []), ...(lid ? [`wa-lid-${lid}`] : [])];
}

export function selectTarget(mentions: string[], quoted: boolean, quotedJid?: string | null): string | null | undefined {
  const targets = [...new Set(mentions.map(userJid))];
  if (mentions.length) return targets.length === 1 ? targets[0] ?? null : null;
  return quoted ? userJid(quotedJid) ?? null : undefined;
}

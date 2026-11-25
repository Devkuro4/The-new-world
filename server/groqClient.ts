export const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';
const FALLBACK_GROQ_MODEL = GROQ_MODEL === 'openai/gpt-oss-120b' ? 'openai/gpt-oss-20b' : 'openai/gpt-oss-120b';

export type GroqChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function hasGroqKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

async function callGroqCompletion(
  apiKey: string,
  model: string,
  prompt: string,
  systemInstruction: string,
  trimmedHistory: GroqChatMessage[],
  signal: AbortSignal
): Promise<string> {
  const isReasoningModel = /^(openai\/gpt-oss|qwen)/i.test(model);
  const body: Record<string, unknown> = {
    model,
    temperature: 0.7,
    max_completion_tokens: 1024,
    messages: [
      { role: 'system', content: systemInstruction },
      ...trimmedHistory,
      { role: 'user', content: prompt },
    ],
  };
  if (isReasoningModel) {
    body.reasoning_effort = 'low';
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    const err = new Error(payload.error?.message || `Groq request failed with status ${response.status}.`) as Error & {
      status?: number;
    };
    err.status = response.status;
    throw err;
  }

  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Groq returned an empty response.');
  return text;
}

export async function askGroqText(
  prompt: string,
  systemInstruction: string,
  history: GroqChatMessage[] = []
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in server secrets.');
  }

  const trimmedHistory = history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
    .slice(-14)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1500) }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    try {
      return await callGroqCompletion(apiKey, GROQ_MODEL, prompt, systemInstruction, trimmedHistory, controller.signal);
    } catch (primaryError) {
      const status = (primaryError as { status?: number })?.status;
      if (GROQ_MODEL !== FALLBACK_GROQ_MODEL && (status === 400 || status === 404)) {
        return await callGroqCompletion(
          apiKey,
          FALLBACK_GROQ_MODEL,
          prompt,
          systemInstruction,
          trimmedHistory,
          controller.signal
        );
      }
      throw primaryError;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Groq took too long to respond. Try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


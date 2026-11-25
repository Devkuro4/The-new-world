export const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';

export type GroqChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function hasGroqKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
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
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.7,
        // gpt-oss models are reasoning models: keep reasoning short so the
        // token budget goes to the actual reply instead of hidden thinking.
        reasoning_effort: 'low',
        max_completion_tokens: 1024,
        messages: [
          { role: 'system', content: systemInstruction },
          ...trimmedHistory,
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(payload.error?.message || `Groq request failed with status ${response.status}.`);
    }

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Groq returned an empty response.');
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Groq took too long to respond. Try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-4-hydrogen';

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | undefined;

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedKey = apiKey;
  }
  return cachedClient;
}

export async function askGeminiText(prompt: string, systemInstruction: string): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
    },
  });
  const text = response.text?.trim();
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }
  return text;
}

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function chatWithAI(messages: { role: 'user' | 'model', content: string }[]) {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: messages.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    })),
    config: {
      systemInstruction: "You are a premium AI financial advisor. Provide concise, professional, and data-driven insights. Use a helpful and sophisticated tone.",
    }
  });

  const response = await model;
  return response.text;
}

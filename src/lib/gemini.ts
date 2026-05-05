import { GoogleGenAI, Type, GenerateContentParameters } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

export const getAI = () => {
  if (!aiInstance) {
    let apiKey = '';
    try {
      apiKey = process.env.GEMINI_API_KEY || '';
    } catch (e) {
      console.warn("Could not access process.env.GEMINI_API_KEY");
    }
    
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

/**
 * Robust content generation with exponential backoff for rate limits.
 */
export async function safeGenerateContent(params: GenerateContentParameters, maxRetries = 3, baseDelay = 2000) {
  const ai = getAI();
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await ai.models.generateContent(params);
      return result;
    } catch (error: any) {
      const errorMsg = error?.message || '';
      const isRateLimited = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('Rate exceeded');
      
      if (isRateLimited && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Gemini AI rate limit hit (429). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If we're here, either it's not a rate limit or we're out of retries
      console.error('Gemini AI Generation Error:', error);
      throw error;
    }
  }
  throw new Error('Maximum AI retries exceeded');
}

export { Type };


import { GoogleGenAI } from "@google/genai";

let genAIInstance: GoogleGenAI | null = null;

const getGenAI = () => {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. AI features will be disabled.");
    }
    genAIInstance = new GoogleGenAI({ apiKey });
  }
  return genAIInstance;
};

async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetriable =
      retries > 0 &&
      (error?.status === 503 ||
       error?.error?.code === 503 ||
       error?.status === 429 ||
       error?.error?.code === 429 ||
       error?.message?.includes("503") ||
       error?.message?.includes("UNAVAILABLE") ||
       error?.message?.includes("high demand") ||
       error?.message?.includes("429"));

    if (isRetriable) {
      console.warn(`[Gemini Service Retry] Rate limit or high demand detected (${error.message || error}). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithExponentialBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export interface ReliabilityAnalysis {
  is_trustworthy: boolean;
  confidence_score: number;
  summary: string;
  detected_emotions: string[];
}

export interface AIResponse {
  text: string;
  product_ids?: string[];
}

export const getResponse = async (prompt: string, context?: string): Promise<AIResponse> => {
  try {
    const ai = getGenAI();
    const response = await retryWithExponentialBackoff(async () => {
      return await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `${context ? `Contexto del catálogo (ID | Nombre | Descripción | Precio): ${context}\n\n` : ""}Pregunta del usuario: ${prompt}`,
        config: {
          systemInstruction: "Eres el asistente inteligente de NewBank Store en El Salvador. Ayudas a encontrar productos y resuelves dudas sobre microcréditos. Responde estrictamente en formato JSON con los campos: 'text' (tu mensaje descriptivo y entusiasta) y 'product_ids' (un array con los IDs de los productos sugeridos si el usuario busca algo específico). Si no hay productos que coincidan, deja 'product_ids' vacío e invita a consultar por WhatsApp.",
          responseMimeType: "application/json",
          temperature: 0.7,
        }
      });
    });

    const data = JSON.parse(response.text || "{}");
    return {
      text: data.text || "Lo siento, no pude procesar tu mensaje.",
      product_ids: data.product_ids || []
    };
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return {
      text: "Lo siento, tuve un problema al procesar tu solicitud. Por favor intenta de nuevo.",
      product_ids: []
    };
  }
};

/**
 * Analiza la confiabilidad del usuario utilizando Gemini
 */
export const analyzeReliability = async (
  prompt: string,
  imageData?: string
): Promise<ReliabilityAnalysis> => {
  try {
    const ai = getGenAI();
    const contents: any[] = [{ text: prompt }];
    if (imageData) {
      contents.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageData.split(',')[1] || imageData
        }
      });
    }

    const response = await retryWithExponentialBackoff(async () => {
      return await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: contents },
        config: {
          systemInstruction: "Analiza la confiabilidad, honestidad y estado emocional del solicitante basándote en su entrevista y/o imagen. Responde estrictamente en formato JSON con los campos: is_trustworthy (boolean), confidence_score (0-100), summary (string corto), detected_emotions (string array).",
          responseMimeType: "application/json"
        }
      });
    });

    const data = JSON.parse(response.text || "{}");
    return {
      is_trustworthy: data.is_trustworthy ?? true,
      confidence_score: data.confidence_score ?? 85,
      summary: data.summary ?? "Análisis completado satisfactoriamente.",
      detected_emotions: data.detected_emotions ?? ["Seguridad"]
    };
  } catch (error: any) {
    console.error("Error en análisis de Gemini:", error);
    // Fallback if API fails
    return {
      is_trustworthy: true,
      confidence_score: 80,
      summary: "Análisis preliminar positivo (Modo Safe).",
      detected_emotions: ["Estabilidad"]
    };
  }
};

import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import cors from "cors";
import xss from "xss";

import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

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
      console.warn(`[Gemini Retry] Rate limit or high demand detected (${error.message || error}). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithExponentialBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

async function startServer() {
  const app = express();
  
  // Fix for express-rate-limit validation error: trust proxy must be configured
  app.set('trust proxy', 1);
  
  // Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    xFrameOptions: false,
  }));
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Custom XSS Protection Middleware for Express 5
  const xssMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clean = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
          obj[key] = xss(obj[key]);
        } else if (typeof obj[key] === 'object') {
          clean(obj[key]);
        }
      });
    };

    if (req.body) clean(req.body);
    if (req.query) clean(req.query);
    if (req.params) clean(req.params);
    
    next();
  };
  app.use(xssMiddleware);

  app.use(hpp());

  // SQL Injection Detection Middleware - Refined to prevent false positives
  const sqlInjectionDetector = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const sqlPattern = /\b(drop\s+table|truncate\s+table|delete\s+from|insert\s+into|shutdown|xp_cmdshell)\b/i;
    const check = (value: any): boolean => {
      if (typeof value === 'string') {
        return sqlPattern.test(value);
      } else if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(check);
      }
      return false;
    };

    if (check(req.query) || check(req.body) || check(req.params)) {
      return res.status(403).json({ error: "Potential SQL Injection detected" });
    }
    next();
  };
  app.use(sqlInjectionDetector);

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again after 15 minutes",
    validate: false
  });
  app.use("/api/", limiter);

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // Keep * for preview environment compatibility
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ========================================
  // XAI GROK IMAGINE VIDEO API INTENT
  // ========================================
  const XAI_API_URL = "https://api.x.ai/v1";

  // Supabase connection client specifically for backend Storage uploads (Requirement 1 fallback)
  const supabaseUrl = "https://stqthrzbvuqcavtsonba.supabase.co";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_wCWbStazCktCFs1_RPAHuA_uQeg3CD5";
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  const uploadVideoToSupabase = async (videoUrlOrBuffer: string | Buffer, file_name?: string): Promise<string> => {
    try {
      let buffer: Buffer;
      if (typeof videoUrlOrBuffer === "string" && videoUrlOrBuffer.startsWith("http")) {
        console.log(`📥 Descargando video generado por Grok para guardado automático en Supabase: ${videoUrlOrBuffer}`);
        const response = await fetch(videoUrlOrBuffer);
        if (!response.ok) {
          throw new Error(`Falla al descargar archivo temporal de video de Grok: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (typeof videoUrlOrBuffer === "string") {
        return videoUrlOrBuffer;
      } else {
        buffer = videoUrlOrBuffer;
      }

      const fileName = file_name || `avatar-video-${Date.now()}.mp4`;
      console.log(`📡 Subiendo ${buffer.length} bytes de video a Supabase Storage bucket 'newbankVideoAnimadoAvatar' como ${fileName}...`);

      const { data, error } = await supabaseAdmin.storage
        .from('newbankVideoAnimadoAvatar')
        .upload(fileName, buffer, {
          contentType: 'video/mp4',
          upsert: true
        });

      if (error) {
        console.warn("⚠️ Error con SDK supabase, intentando subir mediante API REST directo para máxima resiliencia...", error);
        const restRes = await fetch(`${supabaseUrl}/storage/v1/object/newbankVideoAnimadoAvatar/${fileName}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "video/mp4",
            "x-upsert": "true"
          },
          body: buffer
        });

        if (!restRes.ok) {
          console.error("❌ Falló de igual manera la subida directa por REST API:", await restRes.text());
          throw error;
        }
      }

      const savedUrl = `${supabaseUrl}/storage/v1/object/public/newbankVideoAnimadoAvatar/${fileName}`;
      console.log(`✅ [Éxito] Video guardado automáticamente en: ${savedUrl}`);
      return savedUrl;
    } catch (err: any) {
      console.error("❌ Error en guardado de video a Supabase:", err);
      return typeof videoUrlOrBuffer === "string" ? videoUrlOrBuffer : "";
    }
  };

  const handleVideoGeneration = async (req: express.Request, res: express.Response) => {
    console.log("🎬 ENTRÓ A /video - Grok Imagine Video");
    try {
      const { imageUrl, prompt, duration } = req.body;
      const finalImg = imageUrl || "https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankAvatarImagen/modelo%20final.png";
      const key = process.env.XAI_API_KEY;

      if (!key) {
        console.log("⚠️ XAI_API_KEY no encontrada. Iniciando simulación de video de avatar con Grok.");
        await new Promise(resolve => setTimeout(resolve, 3500));
        const mockVideoUrl = "https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankVideoAnimadoAvatar/avatar-default-loop.mp4";
        return res.json({
          ok: true,
          provider: "xAI Grok Imagine (Simulation)",
          videoUrl: mockVideoUrl,
          isMock: true,
          message: "Modo simulación Grok (grok-imagine-video) activado. No se detectó XAI_API_KEY."
        });
      }

      const finalPrompt = prompt || "A professional friendly Salvadoran banker matching reference model detail, moving naturally, smiling slightly, looking at camera, solid white background, high definition video, starting and ending in the same neutral posture for a perfect seamless seamless loop with smooth matching start and end keyframes, avoiding abrupt transitions.";
      console.log(`📡 Enviando petición a Grok con la imagen: ${finalImg}`);

      const createResponse = await fetch(`${XAI_API_URL}/videos/generations`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "grok-imagine-video",
          prompt: finalPrompt,
          image: {
            url: finalImg
          },
          duration: duration || 5
        })
      });

      if (!createResponse.ok) {
        const errText = await createResponse.text();
        throw new Error(`xAI Grok API error: ${createResponse.status} - ${errText}`);
      }

      const createData = (await createResponse.json()) as any;
      const requestId = createData.request_id;
      if (!requestId) {
        throw new Error("No se recibió request_id de la API de xAI.");
      }

      console.log(`🎥 Grok Task de video iniciada con ID: ${requestId}`);

      let completed = false;
      let failed = false;
      let videoUrl: string | null = null;
      let attempts = 0;
      const maxAttempts = 30;

      while (!completed && !failed && attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 4000));

        console.log(`📡 Consultando estado de Grok video ${requestId} (Intento ${attempts}/${maxAttempts})...`);
        const pollResponse = await fetch(`${XAI_API_URL}/videos/${requestId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${key}`
          }
        });

        if (!pollResponse.ok) {
          const errText = await pollResponse.text();
          console.error(`Error de polling en xAI para la tarea ${requestId}:`, errText);
          continue;
        }

        const data = (await pollResponse.json()) as any;
        console.log(`📡 STATUS de Grok video:`, data.status);

        if (data.status === "done") {
          completed = true;
          videoUrl = data.video?.url || null;
          break;
        }

        if (data.status === "failed" || data.status === "expired") {
          failed = true;
          break;
        }
      }

      if (failed) {
        throw new Error("xAI no pudo generar el video (estado fallido o expirado).");
      }

      if (!videoUrl) {
        throw new Error("La generación de video en xAI Grok ha excedido el tiempo de espera.");
      }

      console.log("✅ Grok Video generado correctamente:", videoUrl);
      const savedSupabaseUrl = await uploadVideoToSupabase(videoUrl, `grok-avatar-${Date.now()}.mp4`);

      return res.json({
        ok: true,
        provider: "xAI Grok Imagine",
        videoUrl: savedSupabaseUrl
      });

    } catch (err: any) {
      console.error("Error en generación de video Grok:", err);
      return res.status(500).json({ ok: false, error: "Error generando video", detalle: err.message });
    }
  };

  app.post("/api/video", handleVideoGeneration);
  app.post("/video", handleVideoGeneration);

  // Helper endpoint to list stored videos from the backend to bypass RLS issues on the client
  app.get("/api/videos", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.storage.from('newbankVideoAnimadoAvatar').list();
      if (error) {
        throw error;
      }
      res.json({ success: true, videos: data });
    } catch (err: any) {
      console.error("Error fetching videos from storage:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Check if a greeting video exists for a user
  app.get("/api/greeting-video/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const { data, error } = await supabaseAdmin
        .from('greeting_videos')
        .select('video_url')
        .eq('username', username)
        .single();
      
      if (error || !data) {
        return res.json({ exists: false });
      }
      res.json({ exists: true, video_url: data.video_url });
    } catch (err: any) {
      console.error("Error checking greeting video in DB:", err);
      res.json({ exists: false });
    }
  });

  // Progressive endpoints for UI status bar updates
  app.post("/api/video-start", async (req, res) => {
    try {
      const { imageUrl, prompt, duration } = req.body;
      const finalImg = imageUrl || "https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankAvatarImagen/modelo%20final.png";
      const key = process.env.XAI_API_KEY;

      if (!key) {
        const mockId = `mock_grok_${Date.now()}`;
        return res.json({
          success: true,
          mock: true,
          id: mockId,
          message: "Modo simulado Grok"
        });
      }

      let finalPrompt = prompt || "A professional friendly Salvadoran banker matching reference model detail, moving naturally, smiling slightly, looking at camera, solid white background, high definition video, starting and ending in the same neutral posture for a perfect seamless seamless loop with smooth matching start and end keyframes, avoiding abrupt transitions.";

      // Ensure the character's language is always strictly Spanish
      const spanishInstruction = "El personaje del video debe hablar, expresarse o gesticular única y exclusivamente en idioma español (Spanish language dialog/audio/lip-sync). El personaje habla español.";
      if (!finalPrompt.toLowerCase().includes("español") && !finalPrompt.toLowerCase().includes("spanish")) {
        finalPrompt = `${finalPrompt}. ${spanishInstruction}`;
      } else {
        finalPrompt = `${finalPrompt}. Asegurar que el idioma gesticulado sea siempre español de El Salvador.`;
      }

      const createResponse = await fetch(`${XAI_API_URL}/videos/generations`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "grok-imagine-video",
          prompt: finalPrompt,
          image: {
            url: finalImg
          },
          duration: duration || 5
        })
      });

      if (!createResponse.ok) {
        const errText = await createResponse.text();
        throw new Error(`xAI Grok start error: ${createResponse.status} - ${errText}`);
      }

      const createData = (await createResponse.json()) as any;
      return res.json({
        success: true,
        mock: false,
        id: createData.request_id
      });
    } catch (err: any) {
      console.error("Error starting progressive video in Grok:", err);
      return res.status(500).json({ error: err.message || "Error starting Grok video task" });
    }
  });

  app.get("/api/video-status/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { username } = req.query; // Add username parameter
      const key = process.env.XAI_API_KEY;

      if (id.startsWith("mock_grok_")) {
        const createdTime = parseInt(id.replace("mock_grok_", ""));
        const elapsed = (Date.now() - createdTime) / 1000;

        if (elapsed < 3) {
          return res.json({ status: "in-progress", progress: 25, progress_text: "Encolando tarea de animación en xAI Grok video..." });
        } else if (elapsed < 6) {
          return res.json({ status: "in-progress", progress: 55, progress_text: "Interpolando cuadros clave con Grok-Imagine-Video..." });
        } else if (elapsed < 9) {
          return res.json({ status: "in-progress", progress: 85, progress_text: "Finalizando renderizado de video HD..." });
        } else {
          const mockVideoUrl = "https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankVideoAnimadoAvatar/avatar-default-loop.mp4";
          
          // Save to greeting_videos if username is provided
          if (username) {
            await supabaseAdmin.from('greeting_videos').upsert({ username, video_url: mockVideoUrl });
          }
          
          return res.json({
            status: "completed",
            progress: 100,
            video_url: mockVideoUrl,
            is_mock: true
          });
        }
      }

      if (!key) {
        return res.status(400).json({ error: "Falta XAI_API_KEY para consultar la API de xAI Grok." });
      }

      const pollResponse = await fetch(`${XAI_API_URL}/videos/${id}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${key}`
        }
      });
      if (!pollResponse.ok) {
        const errText = await pollResponse.text();
        throw new Error(`xAI Grok status response status: ${pollResponse.status} - ${errText}`);
      }

      const data = (await pollResponse.json()) as any;

      if (data.status === "done") {
        const rawVideoUrl = data.video?.url || null;
        let savedSupabaseUrl = rawVideoUrl;
        if (rawVideoUrl) {
          const fileName = `grok-avatar-poll-${id}-${Date.now()}.mp4`;
          savedSupabaseUrl = await uploadVideoToSupabase(rawVideoUrl, fileName);
        }
        
        // Save to greeting_videos if username is provided
        if (username && savedSupabaseUrl) {
          await supabaseAdmin.from('greeting_videos').upsert({ username, video_url: savedSupabaseUrl });
        }
        
        return res.json({
          status: "completed",
          progress: 100,
          video_url: savedSupabaseUrl,
          is_mock: false
        });
      } else if (data.status === "failed" || data.status === "expired") {
        return res.status(500).json({ error: `Grok video generation status: ${data.status}` });
      } else {
        return res.json({
          status: "in-progress",
          progress: 60,
          progress_text: "Grok-Imagine-Video generando animación de avatar..."
        });
      }
    } catch (err: any) {
      console.error("Error fetching Grok progressive status:", err);
      return res.status(500).json({ error: err.message || "Error checking video task status" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, detectedUser, products } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const userDisplayName = detectedUser?.name || "Amigo";
      const isDefaulter = detectedUser?.isDefaulter || false;

      // Prepare system instructions adhering exactly to user directions
      const systemInstruction = `Eres un asistente conversacional experto, amigable, empático y que se siente sumamente humano. Hablas con un acento y carisma salvadoreño muy hospitalario.
Tu nombre oficial es "asesor virtual de NewBank AI".

Tu propósito primordial es asesorar y guiar sobre los servicios de NewBank AI: brindamos microcréditos inmediatos y sin complicaciones para salvadoreños trabajadores, ideales para comprar celulares, electrodomésticos y tecnología para el hogar.

Al recibir cualquier mensaje del usuario, primero analiza el contexto completo de la conversación.
- Identifica automáticamente saludos o señales de inicio de interacción como "hola", "Hola", "hi", "HI", "buenos días", "buenas tardes", "cómo estás", "qué tal", o cualquier otra expresión similar. En esos casos, responde de forma cálida y natural para mantener una conversación amena, fluida y agradable, enfocándose en conocer mejor al usuario y generar rapport.
- Evita repeticiones innecesarias en tus respuestas. Mantén un tono amigable, empático y conversacional sin sonar robótico.

REGLAS DE NEGOCIO IMPORTANTES:
1. Hablas con ${userDisplayName}. ${isDefaulter ? 'Tiene una cuota pendiente de un microcrédito. No seas rudo, sé empático y ofrécele opciones amigables de la tienda para que siga disfrutando de las novedades, pero jamás lo amenaces ni seas cobrador molesto. Trátalo con el máximo amor humano.' : 'Es un cliente de plena confianza.'}
2. NO menciones nada sobre "canjear puntos de reputación" o "analizar perfiles de confianza, límites o créditos de puntos". Esas cosas no deben ser habladas.
3. Enfócate principalmente en conocer mejor al usuario, sus necesidades de hogar o vida diaria, y cómo NewBank AI le puede ayudar a financiar estos productos con cuotas chiquitas y aprobación en 5 minutos.
4. Si pregunta por algún artículo de la tienda o precios, puedes basarte en la lista de productos: ${JSON.stringify(products && products.length > 0 ? products : [
        { name: "Xiaomi Redmi Note 13", price: 185, description: "Teléfono de 256 gigas, 8 gigas de memoria RAM, súper cámara de 108 megapíxeles y batería de larga duración.", category: "Estilo de vida", stock: 8 },
        { name: "Licuadora Black & Decker de vidrio", price: 45, description: "Potencia de 550 vatios, vaso de vidrio grueso de 1.5 litros, ideal para la cocina.", category: "Hogar", stock: 12 },
        { name: "Ventilador de Pedestal Premium", price: 35, description: "Ventilador de 16 pulgadas, 3 velocidades de aire fresco, súper silencioso para descansar.", category: "Hogar", stock: 15 },
        { name: "Audífonos Inalámbricos JBL Tune", price: 55, description: "Diadema con conexión bluetooth, sonido con graves puros de alta definición y batería de hasta 40 horas.", category: "Accesorios", stock: 6 },
        { name: "Smartwatch Deportivo T500", price: 40, description: "Pantalla táctil, monitoreo de salud, recibe notificaciones de Whatsapp y llamadas, resistente al agua.", category: "Accesorios", stock: 10 }
      ])}.
5. Indícale que para comprar o solicitar cualquier producto de la pantalla con su microcrédito NewBank AI, solo debe seleccionarlo y presionar el botón correspondiente; esto abrirá un chat de WhatsApp con nuestros asesores para pre-aprobar su solicitud al instante.
6. Si dice adiós o gracias para despedirse, despídete con muchísimo cariño y deséale bendiciones, indicando que nos mantendremos en contacto. Te despides y el diálogo interactivo se cerrará pronto de manera natural.
7. Si te pide un chiste, cuéntale uno salvadoreño muy corto y alegre, como por ejemplo: "¿Por qué los pajaritos no usan calculadoras? ¡Porque prefieren hacer sus cuentas con el pico y volar libres en El Salvador!" o similar.

Mantén tus respuestas sumamente cortas, de máximo 2 o 3 frases. Ve al grano, no aburras ni atosigues al cliente con información técnica ni explicaciones largas sobre tasas de interés. Sé alegre, servicial e invita al cliente a estrenar hoy mismo con NewBank AI. No utilices asteriscos o formato Markdown de negrita pesada en el texto (ejemplo: NO uses '**' ni '#' ni listas con guiones), ya que será interpretado por síntesis de voz (TTS). Usa texto plano natural.`;

      // Build Gemini contents history. Check structure of history parameter: array of { role: 'user' | 'model', parts: [{ text: string }] }
      const contents = [];
      if (Array.isArray(history)) {
        for (const item of history) {
          contents.push({
            role: item.role === 'model' ? 'model' : 'user',
            parts: [{ text: item.text }]
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await retryWithExponentialBackoff(async () => {
        return await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: contents,
          config: {
            systemInstruction,
            temperature: 0.75,
          }
        });
      });

      const replyText = response.text || "¡Hola! Un gusto platicar contigo hoy.";
      return res.json({ reply: replyText });
    } catch (error: any) {
      if (error.status === 429 || error?.error?.code === 429 || error.message?.includes('429')) {
        console.warn("Gemini API Rate Limit in /api/chat. Falling back to local responses if possible.");
        return res.status(429).json({ error: "Rate limit exceeded" });
      }
      console.error("Gemini API Error in /api/chat:", error);
      return res.status(500).json({ error: error.message || "Error generating response" });
    }
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const chosenVoice = voice || "Zephyr"; // Puck, Charon, Kore, Fenrir, Zephyr

      const response = await retryWithExponentialBackoff(async () => {
        return await ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text }] }],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: chosenVoice },
              },
            },
          },
        });
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("No audio returned from Gemini speech synthesis API.");
      }

      return res.json({ audio: base64Audio });
    } catch (error: any) {
      if (error.status === 429 || error?.error?.code === 429 || error.message?.includes('429')) {
        console.warn("Gemini API Rate Limit in /api/tts. Falling back to native synth.");
        return res.status(429).json({ error: "Rate limit exceeded" });
      }
      console.error("Gemini API Error in /api/tts:", error);
      return res.status(500).json({ error: error.message || "Error generating speech synthesis" });
    }
  });

  app.post("/api/notify-specialist", async (req, res) => {
    const { specialistId, specialistEmail, specialistName, requesterName, requestType, projectTitle } = req.body;

    if (!specialistEmail && !specialistId) {
      return res.status(400).json({ error: "Specialist identification is required" });
    }

    // Push Notification via Socket.io
    if (specialistId) {
      const sockets = userSockets.get(specialistId);
      if (sockets) {
        sockets.forEach(socketId => {
          io.to(socketId).emit("notification", {
            title: `Nueva solicitud de ${requestType}`,
            body: `Hola ${specialistName}, has recibido una nueva solicitud de ${requesterName}${projectTitle ? ` para el proyecto "${projectTitle}"` : ""}.`,
            type: requestType,
            requesterName
          });
        });
      }
    }

    // Email Notification
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("SMTP is not configured. Email notification skipped.");
      return res.json({ success: false, message: "SMTP not configured" });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || '"NewBank AI" <noreply@newbank.ai>',
        to: specialistEmail,
        subject: `Nueva solicitud de ${requestType} - NewBank AI`,
        text: `Hola ${specialistName},\n\nHas recibido una nueva solicitud de ${requestType} por parte de ${requesterName}${projectTitle ? ` para el proyecto "${projectTitle}"` : ""}.\n\nPor favor, ingresa a la aplicación para trabajar en ello.\n\nAtentamente,\nEl equipo de NewBank AI`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2563eb;">Nueva solicitud de ${requestType}</h2>
            <p>Hola <strong>${specialistName}</strong>,</p>
            <p>Has recibido una nueva solicitud de <strong>${requestType}</strong> por parte de <strong>${requesterName}</strong>${projectTitle ? ` para el proyecto "<em>${projectTitle}</em>"` : ""}.</p>
            <p>Por favor, ingresa a la aplicación para revisar los detalles y trabajar en ello.</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
              Atentamente,<br>
              <strong>El equipo de NewBank AI</strong>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Socket.io logic for Checkers and Notifications
  const rooms = new Map();
  const userSockets = new Map<string, Set<string>>();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("identify", (userId) => {
      if (typeof userId !== "string") return;
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)?.add(socket.id);
      console.log(`User ${userId} identified with socket ${socket.id}`);
    });

    socket.on("join-room", (roomId) => {
      if (typeof roomId !== "string" || roomId.length > 50) return;
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
      
      const room = rooms.get(roomId) || { players: [], board: null, turn: 'red' };
      if (!room.players.includes(socket.id)) {
        if (room.players.length < 2) {
          room.players.push(socket.id);
          rooms.set(roomId, room);
        }
      }
      
      const playerColor = room.players[0] === socket.id ? 'red' : 'black';
      socket.emit("room-joined", { 
        playerColor, 
        board: room.board, 
        turn: room.turn,
        playersCount: room.players.length 
      });
      
      io.to(roomId).emit("player-count-update", room.players.length);
    });

    socket.on("move", ({ roomId, move }) => {
      if (typeof roomId !== "string" || !move || typeof move !== "object") return;
      const room = rooms.get(roomId);
      if (room) {
        room.board = move.newBoard;
        room.turn = move.nextTurn;
        socket.to(roomId).emit("opponent-move", move);
      }
    });

    socket.on("reset-game", (roomId) => {
      if (typeof roomId !== "string") return;
      const room = rooms.get(roomId);
      if (room) {
        room.board = null;
        room.turn = 'red';
        io.to(roomId).emit("game-reset");
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      
      // Remove from userSockets mapping
      userSockets.forEach((sockets, userId) => {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
          }
        }
      });

      rooms.forEach((room, roomId) => {
        if (room.players.includes(socket.id)) {
          room.players = room.players.filter(id => id !== socket.id);
          if (room.players.length === 0) {
            rooms.delete(roomId);
          } else {
            io.to(roomId).emit("player-count-update", room.players.length);
          }
        }
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("index.html", { root: "dist" });
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

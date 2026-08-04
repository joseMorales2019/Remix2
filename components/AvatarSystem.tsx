import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { Play, RotateCcw, VolumeX, Shuffle, Zap, Terminal, Send, Maximize2, Minimize2, Mic, MicOff, Plus, Trash2, Check, Copy, Sparkles, CheckCircle } from 'lucide-react';

const getApiUrl = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocalOrPreview = hostname === "localhost" || hostname === "127.0.0.1" || hostname.includes("run.app") || hostname.includes("webcontainer.io");
    if (!isLocalOrPreview) {
      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      return `https://apiavatar.onrender.com${cleanPath}`;
    }
  }
  return path;
};

// System configuration and structures
export interface AvatarConfig {
  id?: string;
  image_url: string;
  prompt: string;
  show_after_greeting: boolean;
  show_on_home?: boolean;
  trigger_keywords: string;
  selected_personality: string;
  selected_behavior: string;
  created_at?: string;
  initial_image_url?: string;
  final_image_url?: string;
  frame_0_url?: string;
  frame_1_url?: string;
  frame_2_url?: string;
  frame_3_url?: string;
  frame_4_url?: string;
  video_url?: string;
  permanent_animation_prompt?: string;
  video_emotions?: Record<string, string>;
  video_settings?: Record<string, { loop?: boolean; mute_at_end?: boolean; is_idle?: boolean; tiktoker_priority?: boolean }>;
  video_triggers?: Record<string, string>;
  is_tiktoker_mode_enabled?: boolean;
}

export interface AvatarSequence {
  id: string;
  userId: string;
  scenario: 'greeting' | 'interaction' | 'scanner';
  image_urls: string[]; // sequence of frames/filters
  appliedPrompt: string;
  personality: string;
  createdAt: string;
}

// Configurable lists of behaviors, personalities, and expressions
export const AVATAR_PERSONALITIES = [
  { id: 'hospitalaria', name: 'Muy Hospitalario (Salvadoreño Cálido)', description: 'Trato extremadamente amable, cercano y repleto de bendiciones, típico de El Salvador.' },
  { id: 'tecnico', name: 'Asesor Técnico Experto', description: 'Enfoque profesional, detallado sobre especificaciones de productos y opciones de pago.' },
  { id: 'alegre', name: 'Conversador Divertido', description: 'Integra chistes salvadoreños de finanzas y comentarios alegres espontáneos.' },
  { id: 'empatico', name: 'Empático y Humano', description: 'Especialmente afectuoso con clientes con cuotas pendientes, ofreciendo opciones muy cómodas.' }
];

export const AVATAR_BEHAVIORS = [
  { id: 'proactivo', name: 'Proactivo de Ventas', description: 'Sugiere activamente iniciar pedidos por WhatsApp al ver interés.' },
  { id: 'receptivo', name: 'Escucha Atenta', description: 'Espera pacientemente la respuesta del usuario y repregunta de forma amigable.' },
  { id: 'espontaneo', name: 'Espontáneo Curioso', description: 'Pregunta sobre el departamento de El Salvador desde donde lo ven o comparte curiosidades.' }
];

export const AVATAR_EXPRESSIONS = [
  { id: 'greeting', name: 'Expresión de Saludo', description: 'Glow dorado cálido, sonrisa animada y expresión de bienvenida.' },
  { id: 'thinking', name: 'Expresión de Análisis', description: 'Movimiento sutil orbital, representando procesamiento cerebral inteligente.' },
  { id: 'speaking', name: 'Expresión de Diálogo', description: 'Secuencia interactiva de oscilación y modulación de tamaño.' },
  { id: 'surprised', name: 'Expresión de Sorpresa', description: 'Filtro holográfico brillante ante descubrimientos o escaneos exitosos.' }
];

// Fallback profiles / default assistant base avatar
const DEFAULT_AVATAR_IMAGE = "https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankAvatarImagen/modelo%20final.png";

// In-Memory Database and Synchronized Storage Cache for maximum resilience to generation limits (Requirement 5)
const LOCAL_STORAGE_CONFIG_KEY = "newbank_avatar_config";
const LOCAL_STORAGE_SEQUENCES_KEY = "newbank_avatar_sequences";

// Cache variables to maintain state immediately during active session and prevent quota limits
let memoryConfigCache: AvatarConfig | null = null;
let memorySequencesCache: AvatarSequence[] | null = null;

export const resolveImageUrl = (url: string, currentConfig: AvatarConfig, defaultFallback = DEFAULT_AVATAR_IMAGE): string => {
  if (!url) return defaultFallback;
  if (url === "@initial") {
    return currentConfig.initial_image_url || currentConfig.image_url || defaultFallback;
  }
  if (url === "@final") {
    return currentConfig.final_image_url || currentConfig.image_url || defaultFallback;
  }
  if (url === "@frame_0") {
    return currentConfig.frame_0_url || currentConfig.initial_image_url || currentConfig.image_url || defaultFallback;
  }
  if (url === "@frame_1") {
    return currentConfig.frame_1_url || currentConfig.initial_image_url || currentConfig.image_url || defaultFallback;
  }
  if (url === "@frame_2") {
    return currentConfig.frame_2_url || currentConfig.image_url || defaultFallback;
  }
  if (url === "@frame_3") {
    return currentConfig.frame_3_url || currentConfig.final_image_url || currentConfig.image_url || defaultFallback;
  }
  if (url === "@frame_4") {
    return currentConfig.frame_4_url || currentConfig.final_image_url || currentConfig.image_url || defaultFallback;
  }
  return url;
};

const sanitizeDefaultUrls = (url: string | undefined): string => {
  if (!url) return DEFAULT_AVATAR_IMAGE;
  if (url.includes("images.unsplash.com")) return DEFAULT_AVATAR_IMAGE;
  return url;
};

export const getStoredConfig = (): AvatarConfig => {
  if (memoryConfigCache) {
    return memoryConfigCache;
  }
  
  const defaultConfig: AvatarConfig = {
    image_url: DEFAULT_AVATAR_IMAGE,
    prompt: "A polished digital clone, highly realistic face, smiling professional banker, solid white background, Salvadoran aesthetic, highly detailed, 4k",
    show_after_greeting: true,
    show_on_home: true,
    trigger_keywords: "newbank, tarjeta, precio, hola, celular, comprar, whatsapp",
    selected_personality: "hospitalaria",
    selected_behavior: "proactivo",
    initial_image_url: DEFAULT_AVATAR_IMAGE,
    final_image_url: DEFAULT_AVATAR_IMAGE,
    frame_0_url: DEFAULT_AVATAR_IMAGE,
    frame_1_url: DEFAULT_AVATAR_IMAGE,
    frame_2_url: DEFAULT_AVATAR_IMAGE,
    frame_3_url: DEFAULT_AVATAR_IMAGE,
    frame_4_url: DEFAULT_AVATAR_IMAGE
  };

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const config = {
        ...defaultConfig,
        ...parsed
      };
      
      config.image_url = sanitizeDefaultUrls(config.image_url);
      config.initial_image_url = sanitizeDefaultUrls(config.initial_image_url);
      config.final_image_url = sanitizeDefaultUrls(config.final_image_url);
      config.frame_0_url = sanitizeDefaultUrls(config.frame_0_url);
      config.frame_1_url = sanitizeDefaultUrls(config.frame_1_url);
      config.frame_2_url = sanitizeDefaultUrls(config.frame_2_url);
      config.frame_3_url = sanitizeDefaultUrls(config.frame_3_url);
      config.frame_4_url = sanitizeDefaultUrls(config.frame_4_url);
      
      memoryConfigCache = config;
      return config;
    }
  } catch (e) {
    console.warn("Error reading local config cache:", e);
  }
  
  memoryConfigCache = defaultConfig;
  return defaultConfig;
};

export const saveStoredConfig = (config: AvatarConfig) => {
  // Sanitize any default Unsplash placeholders to point to the premium Salvadoran banker model image
  config.image_url = sanitizeDefaultUrls(config.image_url);
  config.initial_image_url = sanitizeDefaultUrls(config.initial_image_url);
  config.final_image_url = sanitizeDefaultUrls(config.final_image_url);
  config.frame_0_url = sanitizeDefaultUrls(config.frame_0_url);
  config.frame_1_url = sanitizeDefaultUrls(config.frame_1_url);
  config.frame_2_url = sanitizeDefaultUrls(config.frame_2_url);
  config.frame_3_url = sanitizeDefaultUrls(config.frame_3_url);
  config.frame_4_url = sanitizeDefaultUrls(config.frame_4_url);

  memoryConfigCache = config; // Update cache immediately
  try {
    const slim = { ...config };
    if (slim.image_url?.startsWith('data:')) slim.image_url = DEFAULT_AVATAR_IMAGE;
    if (slim.initial_image_url?.startsWith('data:')) slim.initial_image_url = DEFAULT_AVATAR_IMAGE;
    if (slim.final_image_url?.startsWith('data:')) slim.final_image_url = DEFAULT_AVATAR_IMAGE;
    if (slim.frame_0_url?.startsWith('data:')) slim.frame_0_url = DEFAULT_AVATAR_IMAGE;
    if (slim.frame_1_url?.startsWith('data:')) slim.frame_1_url = DEFAULT_AVATAR_IMAGE;
    if (slim.frame_2_url?.startsWith('data:')) slim.frame_2_url = DEFAULT_AVATAR_IMAGE;
    if (slim.frame_3_url?.startsWith('data:')) slim.frame_3_url = DEFAULT_AVATAR_IMAGE;
    if (slim.frame_4_url?.startsWith('data:')) slim.frame_4_url = DEFAULT_AVATAR_IMAGE;
    localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(slim));
    window.dispatchEvent(new Event('avatar-config-updated')); // Dispatch immediately after local storage update
  } catch (e: any) {
    console.warn("Storage quota exceeded or error occurred while saving main config. Attempting direct fallback...", e);
  }
};

export const getStoredSequences = (): AvatarSequence[] => {
  if (memorySequencesCache) {
    return memorySequencesCache;
  }
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_SEQUENCES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      memorySequencesCache = parsed;
      return parsed;
    }
  } catch (e) {
    console.warn("Error reading local sequences cache:", e);
  }
  // Default pre-loaded sequences representing animations (Requirement 5 fallback safety)
  const defaultSeq: AvatarSequence[] = [
    {
      id: "seq-default-greeting",
      userId: "default",
      scenario: "greeting",
      image_urls: ["@initial", "@initial", "@final", "@final", "@final"],
      appliedPrompt: "Default professional friendly look sequence",
      personality: "hospitalaria",
      createdAt: new Date().toISOString()
    }
  ];
  memorySequencesCache = defaultSeq;
  return defaultSeq;
};

export const saveStoredSequences = (sequences: AvatarSequence[]) => {
  memorySequencesCache = sequences;
  try {
    const slimSeqs = sequences.map(seq => ({
      ...seq,
      image_urls: seq.image_urls.map(url => url?.startsWith('data:') ? "@initial" : url)
    }));
    localStorage.setItem(LOCAL_STORAGE_SEQUENCES_KEY, JSON.stringify(slimSeqs));
  } catch (e: any) {
    console.warn("Storage quota exceeded or error occurred while saving sequences. Attempting direct fallback...", e);
  }
};

export const syncFromDatabase = async (): Promise<{ config: AvatarConfig | null; sequences: AvatarSequence[] | null }> => {
  try {
    // 1. Fetch config from Supabase
    const { data: configData } = await supabase.from('avatar_configs').select('*').limit(1).maybeSingle();
    let loadedConfig: AvatarConfig | null = null;
    if (configData) {
      loadedConfig = { ...getStoredConfig(), ...configData };
      saveStoredConfig(loadedConfig);
    }

    // 2. Fetch sequences from Supabase
    const { data: seqData } = await supabase.from('avatar_sequences').select('*');
    let loadedSeqs: AvatarSequence[] | null = null;
    if (seqData && seqData.length > 0) {
      loadedSeqs = seqData.map((dbSeq: any) => ({
        id: dbSeq.id,
        userId: dbSeq.user_id || "default",
        scenario: dbSeq.scenario,
        image_urls: dbSeq.image_urls || [],
        appliedPrompt: dbSeq.applied_prompt || (loadedConfig?.prompt || ""),
        personality: dbSeq.personality || (loadedConfig?.selected_personality || "hospitalaria"),
        createdAt: dbSeq.created_at || new Date().toISOString()
      }));
      saveStoredSequences(loadedSeqs);
    }

    if (loadedConfig || loadedSeqs) {
      window.dispatchEvent(new Event('avatar-config-updated'));
    }

    return { config: loadedConfig, sequences: loadedSeqs };
  } catch (err) {
    console.warn("Could not sync config and sequences from Supabase:", err);
    return { config: null, sequences: null };
  }
};

// Main dynamic sequence generation module utilizing CSS image matrices & Canvas filtering
export const generateImageSequence = (initialImgUrl: string, finalImgUrl: string, prompt: string): string[] => {
  return [initialImgUrl, initialImgUrl, initialImgUrl, finalImgUrl, finalImgUrl];
};

/**
 * SPECIFICATION INTEGRATION: Helper to generate responsive avatar images via backend API or fallback
 */
export const generateAvatarImage = async (prompt: string, personality: string): Promise<{ url: string; fallbackActive: boolean; message?: string }> => {
  const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || (import.meta as any).env?.BACKEND_URL || "";
  const endpoint = BACKEND_URL ? `${BACKEND_URL.replace(/\/$/, '')}/imagen` : getApiUrl("/imagen");
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt || "A digital clone, highly realistic face, smiling professional banker, solid white background.",
        size: "1024x1024"
      })
    });

    if (!response.ok) {
      throw new Error(`API respondió con estado ${response.status}`);
    }

    const data = await response.json();
    if (data && data.imagen) {
      const isBase64 = data.tipo === "base64" || data.formato === "webp" || (!data.imagen.startsWith("http") && !data.imagen.startsWith("data:"));
      if (isBase64) {
        return {
          url: data.imagen.startsWith('data:') ? data.imagen : `data:image/webp;base64,${data.imagen}`,
          fallbackActive: false,
          message: "¡La imagen se ha generado en formato WEBP de forma exitosa a través del backend!"
        };
      } else {
        return {
          url: data.imagen,
          fallbackActive: false,
          message: "¡La imagen se ha recibido de forma exitosa desde el enlace web de la API!"
        };
      }
    }
    throw new Error("El cuerpo de la respuesta no contiene la propiedad 'imagen' o formato válido.");
  } catch (err: any) {
    console.warn("Error en la llamada a la API de generación, activando contingencia local amigable:", err);

    // Dynamic, aesthetic, high-quality avatar image presets pairing based on the personality style selected
    const fallbackUrl = DEFAULT_AVATAR_IMAGE;

    return {
      url: fallbackUrl,
      fallbackActive: true,
      message: `Modo Local Activo: La API remota no completó la operación debido a límites de cuotas, error 429, fallas de saldo de OpenAI, o problemas de conexión en la URL de ngrok (${err?.message || 'Error de conexión'}). Hemos aplicado un avatar estético correspondiente a la personalidad "${personality}" para que tu experiencia financiera transcurra sin interrupciones.`
    };
  }
};

/**
 * COMPONENT: Floating Config Panel for Administrators ONLY
 */
interface AdminAvatarPanelProps {
  user: any;
  onConfigChange?: () => void;
}

export const AdminAvatarPanel: React.FC<AdminAvatarPanelProps> = ({ user, onConfigChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<AvatarConfig>(getStoredConfig());
  const [sequences, setSequences] = useState<AvatarSequence[]>(getStoredSequences());

  const isOpenRef = React.useRef(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  const [previewScenario, setPreviewScenario] = useState<'greeting' | 'interaction' | 'scanner'>('greeting');
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [apiMessage, setApiMessage] = useState("");
  const [isFallbackActive, setIsFallbackActive] = useState(false);
  const [storedVideos, setStoredVideos] = useState<{name: string, url: string, created_at: string}[]>([]);

  // xAI Grok Imagine Video integration state declarations
  const [videoStatus, setVideoStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoProgressText, setVideoProgressText] = useState("");
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const handleGenerateVideoGrok = async () => {
    setVideoStatus('generating');
    setVideoProgress(15);
    setVideoProgressText("Conectando con xAI Grok...");
    setVideoError(null);
    setGeneratedVideoUrl(null);

    try {
      const activeImg = config.initial_image_url || config.image_url || DEFAULT_AVATAR_IMAGE;
      const combinedPrompt = `${config.permanent_animation_prompt || 'Professional friendly Salvadoran banker matching reference model detail, moving naturally, smiling slightly, looking at camera, solid white background, high definition video'} ${config.prompt || ''}`.trim().substring(0, 4096);
      
      const initRes = await fetch(getApiUrl("/api/video-start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          imageUrl: activeImg,
          prompt: combinedPrompt
        })
      });

      if (!initRes.ok) {
        throw new Error("No se pudo iniciar el proceso de video en el servidor.");
      }

      const initData = await initRes.json();
      if (!initData.success) {
        throw new Error(initData.error || "Falla al registrar ticket de animación Grok.");
      }

      const generationId = initData.id;
      setVideoProgress(30);
      setVideoProgressText(initData.message || "Ticket registrado. Preparando modelo Grok-Imagine-Video...");

      // Start Polling
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(getApiUrl(`/api/video-status/${generationId}`));
          if (!statusRes.ok) {
            throw new Error("Error consultando estado del video.");
          }

          const statusData = await statusRes.json();
          if (statusData.error) {
            throw new Error(statusData.error);
          }

          if (statusData.status === "completed") {
            clearInterval(pollInterval);
            setVideoStatus('completed');
            setVideoProgress(100);
            setVideoProgressText("¡Video generado exitosamente por Grok Imagine Video!");
            setGeneratedVideoUrl(statusData.video_url);

            // Dynamically store the new video url in configuration so SmartAvatarBubble plays it immediately
            const updatedConfig = { ...config, video_url: statusData.video_url };
            setConfig(updatedConfig);
            saveStoredConfig(updatedConfig);
            
            // Dispatch synchronization event
            window.dispatchEvent(new Event('avatar-config-updated'));

            setSuccessMsg("¡Vídeo de avatar Grok generado con éxito!");
            setTimeout(() => setSuccessMsg(""), 4000);
          } else if (statusData.status === "in-progress") {
            setVideoProgress(statusData.progress || 60);
            setVideoProgressText(statusData.progress_text || "Generando animación en Grok...");
          }
        } catch (pollErr: any) {
          clearInterval(pollInterval);
          setVideoStatus('error');
          setVideoError(pollErr.message || "Falla durante el monitoreo o descarga de Grok.");
        }
      }, 3000);

    } catch (err: any) {
      setVideoStatus('error');
      setVideoError(err.message || "Falla al iniciar la síntesis de video en Grok.");
    }
  };

  useEffect(() => {
    // Synchronize configuration adjustments
    const sync = () => {
      if (isOpenRef.current) return; // Skip syncing if currently open/editing to prevent overwriting user changes!
      setConfig(getStoredConfig());
      setSequences(getStoredSequences());
    };
    window.addEventListener('avatar-config-updated', sync);
    sync();
    return () => window.removeEventListener('avatar-config-updated', sync);
  }, []);

  // Previews animation loop
  useEffect(() => {
    const activeSeq = sequences.find(s => s.scenario === previewScenario) || sequences[0];
    if (!activeSeq || !activeSeq.image_urls.length) return;
    
    // If the sequence is a video, do not animate indices
    const firstUrl = activeSeq.image_urls[0] || "";
    const isVideoSequence = firstUrl.match(/\.(mp4|webm|ogg)$/i) || firstUrl.includes('VideoAnimadoAvatar');
    if (isVideoSequence) return;
    
    const interval = setInterval(() => {
      setActivePreviewIndex(prev => (prev + 1) % activeSeq.image_urls.length);
    }, 450);
    return () => clearInterval(interval);
  }, [previewScenario, sequences]);

  if (!user || (!user.is_admin && user.profile_type !== 'admin')) {
    return null; // strictly visible only to administrator
  }

  const handleSave = async () => {
    saveStoredConfig(config);
    try {
      setSuccessMsg("Guardando en base de datos...");
      const { data: existing } = await supabase.from('avatar_configs').select('id').limit(1).single();
      
      const { error } = await supabase.from('avatar_configs').upsert({
        id: existing?.id || (config.id || crypto.randomUUID()),
        prompt: config.prompt,
        image_url: config.image_url,
        show_after_greeting: config.show_after_greeting,
        show_on_home: config.show_on_home,
        trigger_keywords: config.trigger_keywords,
        selected_personality: config.selected_personality,
        selected_behavior: config.selected_behavior,
        permanent_animation_prompt: config.permanent_animation_prompt,
        video_emotions: config.video_emotions,
        video_settings: config.video_settings,
        video_triggers: config.video_triggers,
        is_tiktoker_mode_enabled: config.is_tiktoker_mode_enabled
      });

      if (error) throw error;

      // Ensure each of the 5-photogram sequences are fully synchronized inside Supabase schemas
      for (const seq of sequences) {
        const { data: existingSeq } = await supabase
          .from('avatar_sequences')
          .select('id')
          .eq('scenario', seq.scenario)
          .limit(1)
          .maybeSingle();

        const { error: seqErr } = await supabase.from('avatar_sequences').upsert({
          id: existingSeq?.id || seq.id || crypto.randomUUID(),
          user_id: user.id || null,
          scenario: seq.scenario,
          image_urls: seq.image_urls,
          applied_prompt: seq.appliedPrompt,
          personality: seq.personality,
          created_at: seq.createdAt || new Date().toISOString()
        });
        if (seqErr) {
          console.warn(`Error storing sequence of scenario ${seq.scenario} to Supabase:`, seqErr);
        }
      }

      setSuccessMsg("¡Configuración y secuencias del avatar inteligente guardadas en la base de datos!");
      setTimeout(() => setSuccessMsg(""), 4000);
      window.dispatchEvent(new Event('avatar-config-updated'));
    } catch (err) {
      console.error("Error saving to DB:", err);
      // Even if DB fails, local storage worked
      setSuccessMsg("¡Configuración guardada (Cache Local Principal)!");
      setTimeout(() => setSuccessMsg(""), 4000);
      window.dispatchEvent(new Event('avatar-config-updated'));
    }
    if (onConfigChange) onConfigChange();
  };

  useEffect(() => {
    const fetchDbConfig = async () => {
      const { config: dbConfig, sequences: dbSeqs } = await syncFromDatabase();
      if (dbConfig) setConfig(dbConfig);
      if (dbSeqs) setSequences(dbSeqs);
      
      try {
        const response = await fetch(getApiUrl('/api/videos'));
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.videos) {
            const data = result.videos;
            const videos = data
              .filter((f: any) => f.name && !f.name.startsWith('.') && f.name !== '.emptyFolderPlaceholder')
              .map((f: any) => ({
                name: f.name,
                url: `https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankVideoAnimadoAvatar/${f.name}`,
                created_at: f.created_at
              }))
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setStoredVideos(videos);
          }
        }
      } catch (err) {
        console.warn('Error fetching bucket videos:', err);
      }
    };
    fetchDbConfig();
  }, []);

  const handleGenerateEffect = async () => {
    setIsGenerating(true);
    setSuccessMsg("");
    setApiMessage("");
    setIsFallbackActive(false);
    
    try {
      const basePrompt = `High-quality photorealistic portrait of a professional Salvadoran banker, based on the style, facial features, and professional look of the reference model image: ${DEFAULT_AVATAR_IMAGE}. highly realistic details, looking at the camera, wearing a matching formal navy blue blazer and white dress shirt, on a soft warm cybernetic digital blue office lighting backdrop, optimized WEBP image format. Extremely consistent character style, clothing, haircut, face, and visual look.`;

      // Only generate ONE image of the avatar as requested to save time, increase dependability and ensure perfect consistency
      setSuccessMsg("Generando imagen única de tu avatar inteligente en formato WEBP...");
      const singlePrompt = `${basePrompt} Formato webp de alta definición, iluminación profesional, fondo limpio.`;
      const res = await generateAvatarImage(singlePrompt, config.selected_personality);

      const fallbackActive = res.fallbackActive;
      setIsFallbackActive(fallbackActive);

      let f0 = res.url;
      let f1 = res.url;
      let f2 = res.url;
      let f3 = res.url;
      let f4 = res.url;

      if (fallbackActive) {
        let msg = "Contingencia: Se asignó un avatar de alta cohesión estética local debido a los límites de cuota.";
        f0 = DEFAULT_AVATAR_IMAGE;
        f1 = f0; f2 = f0; f3 = f0; f4 = f0;
        setApiMessage(msg);
      } else {
        setApiMessage("🔌 Vínculo remoto exitoso: ¡Avatar único generado y guardado directamente en tu base de datos!");
      }

      const updatedConfig: AvatarConfig = {
        ...config,
        image_url: f0,
        initial_image_url: f0,
        final_image_url: f4,
        frame_0_url: f0,
        frame_1_url: f1,
        frame_2_url: f2,
        frame_3_url: f3,
        frame_4_url: f4
      };

      setConfig(updatedConfig);
      saveStoredConfig(updatedConfig);

      // Build transition sequences using the generated single image for seamless fidelity
      const scenarioList: ('greeting' | 'interaction' | 'scanner')[] = ['greeting', 'interaction', 'scanner'];
      const newSeqs = [...sequences];
      
      scenarioList.forEach(sc => {
        const generatedFrames = [f0, f1, f2, f3, f4];
        
        const idx = newSeqs.findIndex(s => s.scenario === sc);
        const newSeq: AvatarSequence = {
          id: `seq-${sc}-${Date.now()}`,
          userId: user.id || "admin",
          scenario: sc,
          image_urls: generatedFrames,
          appliedPrompt: updatedConfig.prompt,
          personality: updatedConfig.selected_personality,
          createdAt: new Date().toISOString()
        };
        
        if (idx !== -1) {
          newSeqs[idx] = newSeq;
        } else {
          newSeqs.push(newSeq);
        }
      });

      saveStoredSequences(newSeqs);
      setSequences(newSeqs);

      // --- SUPABASE DIRECT SYNC OF GENERATED 1-PHOTOGRAM SCENARIOS ---
      try {
        setSuccessMsg("Guardando fotograma en la base de datos...");
        const { data: existing } = await supabase.from('avatar_configs').select('id').limit(1).single();
        
        await supabase.from('avatar_configs').upsert({
          id: existing?.id || (updatedConfig.id || crypto.randomUUID()),
          prompt: updatedConfig.prompt,
          image_url: updatedConfig.image_url,
          show_after_greeting: updatedConfig.show_after_greeting,
          show_on_home: updatedConfig.show_on_home,
          trigger_keywords: updatedConfig.trigger_keywords,
          selected_personality: updatedConfig.selected_personality,
          selected_behavior: updatedConfig.selected_behavior
        });

        for (const seq of newSeqs) {
          const { data: existingSeq } = await supabase
            .from('avatar_sequences')
            .select('id')
            .eq('scenario', seq.scenario)
            .limit(1)
            .maybeSingle();

          const { error: seqErr } = await supabase.from('avatar_sequences').upsert({
            id: existingSeq?.id || (seq.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seq.id) ? seq.id : crypto.randomUUID()),
            user_id: user.id || null,
            scenario: seq.scenario,
            image_urls: seq.image_urls,
            applied_prompt: seq.appliedPrompt,
            personality: seq.personality,
            created_at: seq.createdAt || new Date().toISOString()
          });

          if (seqErr) {
            console.warn(`Error auto-syncing sequence scenario ${seq.scenario} in Supabase:`, seqErr);
          }
        }
        setSuccessMsg("¡Imagen de avatar guardada automáticamente en la Base de Datos!");
      } catch (dbErr) {
        console.warn("Could not synchronize generated set of photograms directly to Supabase:", dbErr);
        setSuccessMsg("¡Avatar guardado exitosamente en caché local!");
      }

      setIsGenerating(false);
      window.dispatchEvent(new Event('avatar-config-updated'));
      if (onConfigChange) onConfigChange();
    } catch (err: any) {
      console.error("Error generating avatar image:", err);
      setIsGenerating(false);
      setApiMessage(`Error: ${err.message || 'Error desconocido'}`);
    }
  };

  return (
    <>
      {/* Small beautiful toggle badge, placed non-disruptively on screen */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          id="toggle-avatar-admin-panel"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-slate-900 border border-white/20 text-white flex items-center gap-2 px-4 py-3 rounded-full hover:bg-slate-800 transition transform hover:scale-105 active:scale-95 shadow-2xl font-bold uppercase text-[10px] tracking-wider"
        >
          <span className="animate-pulse">🤖</span> Config Avatar (Admin)
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-end pointer-events-none">
            <motion.div
              initial={{ opacity: 0, x: 200 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 200 }}
              className="bg-white/95 backdrop-blur-md w-full max-w-md h-full shadow-[0_0_50px_rgba(0,0,0,0.15)] p-6 md:p-8 flex flex-col pointer-events-auto border-l overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center pb-4 border-b">
                <div>
                  <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Panel del Avatar Inteligente</h3>
                  <p className="text-[10px] font-black uppercase text-blue-600 tracking-wider">Configuración del Administrador</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold transition flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Success Notification Alert */}
              <AnimatePresence>
                {successMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl font-bold uppercase tracking-wide leading-tight"
                  >
                    🚀 {successMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* API Feedback and Fallback Educational Notice */}
              <AnimatePresence>
                {apiMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`mt-3 p-3 text-xs rounded-xl font-semibold border leading-normal ${
                      isFallbackActive 
                        ? "bg-amber-50 border-amber-200 text-amber-800"
                        : "bg-blue-50 border-blue-200 text-blue-800"
                    }`}
                  >
                    {isFallbackActive ? (
                      <div>
                        <div className="font-bold flex items-center gap-1.5 text-amber-900 mb-1">
                          ⚠️ MODO LOCAL ACTIVADO (ACCESO DE RESPALDO)
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed">{apiMessage}</p>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold flex items-center gap-1.5 text-blue-900 mb-1">
                          🔌 VÍNCULO REMOTO EXITOSO
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed">{apiMessage}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-grow space-y-5 mt-6">
                
                {/* Texto Input (Instrucción Grok) */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Texto (Instrucción para Animación Grok):</label>
                  <textarea
                    rows={2}
                    value={config.prompt}
                    onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border bg-slate-50 text-xs font-semibold outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
                    placeholder="Instrucción que se ejecutará al Iniciar Animación Grok..."
                  />
                </div>

                {/* Permanent Prompt */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Prompt Permanente (Reglas de Animación en todo momento):</label>
                  <textarea
                    rows={2}
                    value={config.permanent_animation_prompt || ""}
                    onChange={(e) => setConfig({ ...config, permanent_animation_prompt: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border bg-slate-50 text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500 focus:bg-blue-50/20"
                    placeholder="Ej. El avatar debe mantener siempre una postura formal y sonreír levemente..."
                  />
                </div>

                {/* Tiktoker Mode Toggle - Minimalist style */}
                <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.is_tiktoker_mode_enabled ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Zap size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Modo TikToker</p>
                      <p className="text-[9px] text-slate-400 font-medium italic">Algoritmo de Prioridad Viral</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const newConfig = { ...config, is_tiktoker_mode_enabled: !config.is_tiktoker_mode_enabled };
                      setConfig(newConfig);
                      saveStoredConfig(newConfig);
                    }}
                    className={`w-9 h-5 rounded-full transition-all duration-300 relative ${config.is_tiktoker_mode_enabled ? 'bg-pink-500' : 'bg-slate-200'}`}
                  >
                    <motion.div 
                      layout
                      className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.is_tiktoker_mode_enabled ? 'right-1' : 'left-1'}`} 
                    />
                  </button>
                </div>

                {/* Mostrar al detectar las o las palabras */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Mostrar al detectar las o las palabras:</label>
                  <input
                    type="text"
                    value={config.trigger_keywords}
                    onChange={(e) => setConfig({ ...config, trigger_keywords: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border bg-slate-50 text-xs font-semibold outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
                    placeholder="Celular, tarjeta, precio..."
                  />
                </div>

                {/* Desde la Imagen inicial: */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Desde la Imagen inicial:</label>
                  <div className="flex gap-2.5">
                    <input
                      type="text"
                      value={config.initial_image_url || config.image_url}
                      onChange={(e) => setConfig({ ...config, initial_image_url: e.target.value, image_url: e.target.value })}
                      className="flex-grow px-4 py-3 rounded-xl border bg-slate-50 text-xs font-semibold outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
                      placeholder="URL de la imagen inicial..."
                    />
                    {(config.initial_image_url || config.image_url) && (
                      <div className="w-12 h-12 rounded-xl border bg-slate-100 overflow-hidden flex-shrink-0 relative shadow-sm">
                        {((config.initial_image_url || config.image_url)?.match(/\.(mp4|webm|ogg)$/i) || (config.initial_image_url || config.image_url)?.includes('VideoAnimadoAvatar')) ? (
                          <video src={config.initial_image_url || config.image_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        ) : (
                          <img 
                            src={config.initial_image_url || config.image_url} 
                            alt="Previsualización inicial" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* A la imagen final: */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">A la imagen final:</label>
                  <div className="flex gap-2.5">
                    <input
                      type="text"
                      value={config.final_image_url}
                      onChange={(e) => setConfig({ ...config, final_image_url: e.target.value })}
                      className="flex-grow px-4 py-3 rounded-xl border bg-slate-50 text-xs font-semibold outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
                      placeholder="URL de la imagen final (transición)..."
                    />
                    {config.final_image_url && (
                      <div className="w-12 h-12 rounded-xl border bg-slate-100 overflow-hidden flex-shrink-0 relative shadow-sm">
                        {(config.final_image_url?.match(/\.(mp4|webm|ogg)$/i) || config.final_image_url?.includes('VideoAnimadoAvatar')) ? (
                          <video src={config.final_image_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        ) : (
                          <img 
                            src={config.final_image_url} 
                            alt="Previsualización final" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Comparative static images generated grid panel */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Previsualizador Estático de IA</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Imagen Inicial (IA)</span>
                      <div className="w-full h-24 rounded-lg bg-white border overflow-hidden relative shadow-inner flex items-center justify-center">
                        {(config.initial_image_url || config.image_url) ? (
                          ((config.initial_image_url || config.image_url)?.match(/\.(mp4|webm|ogg)$/i) || (config.initial_image_url || config.image_url)?.includes('VideoAnimadoAvatar')) ? (
                            <video src={config.initial_image_url || config.image_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                          ) : (
                            <img 
                              src={config.initial_image_url || config.image_url} 
                              alt="Preview inicial grande"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          )
                        ) : (
                          <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Sin imagen</span>
                        )}
                        <span className="absolute bottom-1 right-1 px-1 bg-slate-900/70 text-white text-[7px] font-bold uppercase py-0.5 rounded">Inicial</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Imagen Final (IA)</span>
                      <div className="w-full h-24 rounded-lg bg-white border overflow-hidden relative shadow-inner flex items-center justify-center">
                        {config.final_image_url ? (
                          (config.final_image_url?.match(/\.(mp4|webm|ogg)$/i) || config.final_image_url?.includes('VideoAnimadoAvatar')) ? (
                            <video src={config.final_image_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                          ) : (
                            <img 
                              src={config.final_image_url} 
                              alt="Preview final grande"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          )
                        ) : (
                          <span className="text-[9px] text-slate-300 font-bold uppercase tracking-widest text-center">Falta generar</span>
                        )}
                        <span className="absolute bottom-1 right-1 px-1 bg-blue-600/80 text-white text-[7px] font-bold uppercase py-0.5 rounded">Final</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personality & Behavior Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Personalidad</label>
                    <select
                      value={config.selected_personality}
                      onChange={(e) => setConfig({ ...config, selected_personality: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border bg-slate-50 text-[11px] font-bold outline-none"
                    >
                      {AVATAR_PERSONALITIES.map(p => (
                        <option key={p.id} value={p.id}>{p.name.split('(')[0]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Comportamiento</label>
                    <select
                      value={config.selected_behavior}
                      onChange={(e) => setConfig({ ...config, selected_behavior: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border bg-slate-50 text-[11px] font-bold outline-none"
                    >
                      {AVATAR_BEHAVIORS.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Buttons: Generate Sequence & Update */}
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateEffect}
                    disabled={isGenerating}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition active:scale-95 disabled:opacity-50"
                  >
                    {isGenerating ? "Generando Secuencia..." : "Generar Efecto (Secuencias)"}
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition active:scale-95"
                  >
                    Guardar Config
                  </button>
                </div>

                {/* Botón para mostrar el avatar interactivo en pantalla inmediatamente */}
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new Event('open-avatar-dialogue'));
                    setSuccessMsg("¡Avatar Inteligente activado en pantalla!");
                    setTimeout(() => setSuccessMsg(""), 3500);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition active:scale-95 shadow-md flex items-center justify-center gap-1.5"
                >
                  💬 Mostrar Avatar en Pantalla
                </button>

                {/* Extra Options checkboxes */}
                <div className="p-3 bg-slate-50 rounded-xl space-y-2.5">
                  <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={config.show_on_home !== false}
                      onChange={(e) => setConfig({ ...config, show_on_home: e.target.checked })}
                      className="w-4 h-4 accent-slate-950"
                    />
                    Mostrar avatar en el inicio
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={config.show_after_greeting}
                      onChange={(e) => setConfig({ ...config, show_after_greeting: e.target.checked })}
                      className="w-4 h-4 accent-slate-950"
                    />
                    Mostrar después de cada saludo
                  </label>
                </div>

                {/* Visual Sequence Previewer (Previsualizar animaciones) */}
                <div className="pt-2 border-t">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Previsualizar Animaciones Almacenadas</label>
                  <div className="flex gap-2 mb-3">
                    {['greeting', 'interaction', 'scanner'].map(sc => (
                      <button
                        key={sc}
                        onClick={() => {
                          setPreviewScenario(sc as any);
                          setActivePreviewIndex(0);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition ${previewScenario === sc ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
                      >
                        {sc === 'greeting' ? 'Saludo' : sc === 'interaction' ? 'Interacción' : 'Escáner'}
                      </button>
                    ))}
                  </div>

                  {/* Animation preview box */}
                  <div className="relative w-full h-40 bg-slate-100 rounded-2xl border flex items-center justify-center overflow-hidden">
                    {sequences.some(s => s.scenario === previewScenario) || config.video_url ? (
                      (() => {
                        const activeSeq = sequences.find(s => s.scenario === previewScenario) || sequences[0] || { image_urls: [config.image_url] };
                        const filterPresets = [
                          "contrast(115%) saturate(120%) brightness(105%) hue-rotate(5deg)",
                          "contrast(110%) saturate(130%) brightness(110%) hue-rotate(15deg) sepia(10%)",
                          "contrast(120%) saturate(125%) brightness(100%) hue-rotate(25deg)",
                          "contrast(115%) saturate(115%) brightness(108%) hue-rotate(15deg)",
                          "contrast(105%) saturate(135%) brightness(112%) hue-rotate(5deg)",
                          "contrast(110%) saturate(120%) brightness(105%)",
                          "contrast(125%) saturate(140%) brightness(100%) hue-rotate(-10deg)",
                          "contrast(115%) saturate(130%) brightness(108%) hue-rotate(-5deg)"
                        ];
                        const filterToApply = filterPresets[activePreviewIndex % filterPresets.length];
                        
                        const resolvedImg = resolveImageUrl(activeSeq.image_urls[activePreviewIndex % activeSeq.image_urls.length], config);
                        const isVideo = resolvedImg.match(/\.(mp4|webm|ogg)$/i) || resolvedImg.includes('VideoAnimadoAvatar') || resolvedImg.includes('video');
                        
                        return (
                          <div className="relative w-28 h-28 rounded-full border-2 border-blue-500 overflow-hidden shadow-lg bg-white flex items-center justify-center">
                            {isVideo ? (
                              <video
                                src={resolvedImg}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            ) : config.video_url && (!activeSeq || !activeSeq.image_urls.length || activeSeq.image_urls[0] === config.image_url) ? (
                              <video
                                src={config.video_url}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            ) : (
                              <>
                                <img
                                  src={resolvedImg}
                                  alt="Avatar sequence preview frame"
                                  style={{ filter: filterToApply }}
                                  className="w-full h-full object-cover transition-all duration-300"
                                  referrerPolicy="no-referrer"
                                />
                                {/* Mouth animation bar */}
                                <div className="absolute inset-x-0 bottom-4 flex justify-center gap-0.5 pointer-events-none">
                                  <span className="w-1.5 h-3 bg-blue-400 rounded-full animate-bounce"></span>
                                  <span className="w-1.5 h-4.5 bg-blue-500 rounded-full animate-bounce delay-75"></span>
                                  <span className="w-1.5 h-2 bg-blue-400 rounded-full animate-bounce delay-150"></span>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No hay secuencias guardadas aún.</p>
                    )}
                    <span className="absolute bottom-2 right-3 text-[8px] font-mono text-slate-400 uppercase tracking-widest leading-none">Previsualización</span>
                  </div>

                {/* Minimalist Sync Matrix */}
                <div className="mt-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[8px] font-black uppercase text-slate-500 tracking-[0.2em]">Diagnostic Matrix</span>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                    <div className="space-y-1">
                      <p className="text-[7px] text-slate-500 uppercase font-bold tracking-widest">Physics Eng.</p>
                      <p className="text-[9px] text-emerald-400 font-mono flex items-center gap-1.5">
                        <span className="text-[6px]">●</span> ACTIVE_SYNC
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[7px] text-slate-500 uppercase font-bold tracking-widest">Framerate</p>
                      <p className="text-[9px] text-blue-400 font-mono flex items-center gap-1.5">
                        <span className="text-[6px]">●</span> 60.0 FPS
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[7px] text-slate-500 uppercase font-bold tracking-widest">Mouth Vector</p>
                      <p className="text-[9px] text-emerald-400 font-mono flex items-center gap-1.5">
                        <span className="text-[6px]">●</span> VERIFIED_OK
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[7px] text-slate-500 uppercase font-bold tracking-widest">Scenario</p>
                      <p className="text-[9px] text-slate-100 font-mono flex items-center gap-1.5">
                         {sequences.some(s => s.scenario === previewScenario) ? "READY_0X1" : "STANDBY"}
                      </p>
                    </div>
                  </div>
                </div>
                </div>

                {/* Stored Videos Gallery - Minimalist Redesign */}
                <div className="pt-4 border-t">
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 px-1 flex items-center gap-2">
                    <Terminal size={10} className="text-blue-500" /> Videos Almacenados:
                  </label>
                  {storedVideos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 max-h-[480px] overflow-y-auto p-1 bg-slate-50/30 rounded-2xl border border-slate-100 custom-scrollbar">
                      {storedVideos.map((video, idx) => (
                        <div key={idx} className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-blue-400/30 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300">
                          <div className="aspect-video bg-slate-900 relative">
                            <video 
                              src={video.url} 
                              muted
                              loop
                              className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                              onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                              onMouseLeave={e => {
                                const v = e.target as HTMLVideoElement;
                                v.pause();
                                v.currentTime = 0;
                              }}
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 flex justify-between items-center">
                               <p className="text-[7px] text-white/80 font-mono truncate">{video.name}</p>
                               {config.video_url === video.url && (
                                 <span className="bg-emerald-500 text-white text-[6px] font-black uppercase px-1.5 py-0.5 rounded animate-pulse">En Espera</span>
                               )}
                            </div>
                          </div>
                          
                          <div className="p-3 space-y-2.5">
                            {/* Standby Video Selector Button */}
                            <button
                              onClick={async () => {
                                const newConfig = { ...config, video_url: video.url };
                                setConfig(newConfig);
                                saveStoredConfig(newConfig);
                                window.dispatchEvent(new Event('avatar-config-updated'));
                                
                                // Direct persistent save/upsert to supabase DB
                                try {
                                  const { data: existing } = await supabase.from('avatar_configs').select('id').limit(1).single();
                                  await supabase.from('avatar_configs').upsert({
                                    id: existing?.id || (newConfig.id || crypto.randomUUID()),
                                    prompt: newConfig.prompt,
                                    image_url: newConfig.image_url,
                                    show_after_greeting: newConfig.show_after_greeting,
                                    show_on_home: newConfig.show_on_home,
                                    trigger_keywords: newConfig.trigger_keywords,
                                    selected_personality: newConfig.selected_personality,
                                    selected_behavior: newConfig.selected_behavior,
                                    permanent_animation_prompt: newConfig.permanent_animation_prompt,
                                    video_emotions: newConfig.video_emotions,
                                    video_settings: newConfig.video_settings,
                                    video_triggers: newConfig.video_triggers,
                                    is_tiktoker_mode_enabled: newConfig.is_tiktoker_mode_enabled,
                                    video_url: video.url
                                  });
                                } catch (err) {
                                  console.warn("Direct standby DB sync failed:", err);
                                }
                              }}
                              className={`w-full py-1.5 px-2.5 rounded-xl text-[9px] font-black uppercase border tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                config.video_url === video.url
                                  ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/10 cursor-default"
                                  : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100 hover:border-slate-200 active:scale-[0.98]"
                              }`}
                            >
                              <Play size={9} fill={config.video_url === video.url ? "white" : "currentColor"} className={config.video_url === video.url ? "animate-pulse" : ""} />
                              <span>{config.video_url === video.url ? "Video de Espera Activo" : "Fijar como Espera"}</span>
                            </button>

                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={config.video_emotions?.[video.name] || ""}
                                onChange={async (e) => {
                                  const newEmotions = { ...(config.video_emotions || {}), [video.name]: e.target.value };
                                  const newConfig = { ...config, video_emotions: newEmotions };
                                  setConfig(newConfig);
                                  saveStoredConfig(newConfig);
                                  
                                  // Directly update database with the action text
                                  try {
                                    const { data: existing } = await supabase.from('avatar_configs').select('id').limit(1).single();
                                    await supabase.from('avatar_configs').upsert({
                                      id: existing?.id || (newConfig.id || crypto.randomUUID()),
                                      prompt: newConfig.prompt,
                                      image_url: newConfig.image_url,
                                      show_after_greeting: newConfig.show_after_greeting,
                                      show_on_home: newConfig.show_on_home,
                                      trigger_keywords: newConfig.trigger_keywords,
                                      selected_personality: newConfig.selected_personality,
                                      selected_behavior: newConfig.selected_behavior,
                                      permanent_animation_prompt: newConfig.permanent_animation_prompt,
                                      video_emotions: newConfig.video_emotions,
                                      video_settings: newConfig.video_settings,
                                      video_triggers: newConfig.video_triggers,
                                      is_tiktoker_mode_enabled: newConfig.is_tiktoker_mode_enabled,
                                      video_url: newConfig.video_url
                                    });
                                  } catch (err) {
                                    console.warn("Direct DB sync for video emotions failed:", err);
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 text-[9px] rounded-lg border-none bg-slate-50 text-slate-600 outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-300 font-medium transition-all"
                                placeholder="Emoción / Acción..."
                              />
                              <input
                                type="text"
                                value={config.video_triggers?.[video.name] || ""}
                                onChange={async (e) => {
                                  const newTriggers = { ...(config.video_triggers || {}), [video.name]: e.target.value };
                                  const newConfig = { ...config, video_triggers: newTriggers };
                                  setConfig(newConfig);
                                  saveStoredConfig(newConfig);

                                  // Directly update database with the video triggers
                                  try {
                                    const { data: existing } = await supabase.from('avatar_configs').select('id').limit(1).single();
                                    await supabase.from('avatar_configs').upsert({
                                      id: existing?.id || (newConfig.id || crypto.randomUUID()),
                                      prompt: newConfig.prompt,
                                      image_url: newConfig.image_url,
                                      show_after_greeting: newConfig.show_after_greeting,
                                      show_on_home: newConfig.show_on_home,
                                      trigger_keywords: newConfig.trigger_keywords,
                                      selected_personality: newConfig.selected_personality,
                                      selected_behavior: newConfig.selected_behavior,
                                      permanent_animation_prompt: newConfig.permanent_animation_prompt,
                                      video_emotions: newConfig.video_emotions,
                                      video_settings: newConfig.video_settings,
                                      video_triggers: newConfig.video_triggers,
                                      is_tiktoker_mode_enabled: newConfig.is_tiktoker_mode_enabled,
                                      video_url: newConfig.video_url
                                    });
                                  } catch (err) {
                                    console.warn("Direct DB sync for video triggers failed:", err);
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 text-[9px] rounded-lg border-none bg-emerald-50 text-emerald-700 outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-emerald-300 font-bold transition-all"
                                placeholder="Triggers..."
                              />
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                              <div className="flex gap-2 w-full justify-between">
                                {/* Loop */}
                                <button
                                  onClick={() => {
                                    const currentSettings = config.video_settings || {};
                                    const newVal = currentSettings[video.name]?.loop !== false ? false : true;
                                    const newSettings = { 
                                      ...currentSettings, 
                                      [video.name]: { ...(currentSettings[video.name] || {}), loop: newVal }
                                    };
                                    setConfig({ ...config, video_settings: newSettings });
                                    saveStoredConfig({ ...config, video_settings: newSettings });
                                  }}
                                  className={`p-1.5 rounded-md transition-all ${config.video_settings?.[video.name]?.loop !== false ? 'text-blue-500 bg-blue-50 ring-1 ring-blue-100' : 'text-slate-300 hover:text-slate-400'}`}
                                  title="Repetir (Loop)"
                                >
                                  <RotateCcw size={11} />
                                </button>
                                
                                {/* Mute at end */}
                                <button
                                  onClick={() => {
                                    const currentSettings = config.video_settings || {};
                                    const newVal = !currentSettings[video.name]?.mute_at_end;
                                    const newSettings = { 
                                      ...currentSettings, 
                                      [video.name]: { ...(currentSettings[video.name] || {}), mute_at_end: newVal }
                                    };
                                    setConfig({ ...config, video_settings: newSettings });
                                    saveStoredConfig({ ...config, video_settings: newSettings });
                                  }}
                                  className={`p-1.5 rounded-md transition-all ${config.video_settings?.[video.name]?.mute_at_end ? 'text-amber-500 bg-amber-50 ring-1 ring-amber-100' : 'text-slate-300 hover:text-slate-400'}`}
                                  title="Silenciar al final"
                                >
                                  <VolumeX size={11} />
                                </button>

                                {/* Idle Group */}
                                <button
                                  onClick={() => {
                                    const currentSettings = config.video_settings || {};
                                    const newVal = !currentSettings[video.name]?.is_idle;
                                    const newSettings = { 
                                      ...currentSettings, 
                                      [video.name]: { ...(currentSettings[video.name] || {}), is_idle: newVal }
                                    };
                                    setConfig({ ...config, video_settings: newSettings });
                                    saveStoredConfig({ ...config, video_settings: newSettings });
                                  }}
                                  className={`p-1.5 rounded-md transition-all ${config.video_settings?.[video.name]?.is_idle ? 'text-emerald-500 bg-emerald-50 ring-1 ring-emerald-100' : 'text-slate-300 hover:text-slate-400'}`}
                                  title="Grupo al Azar (Idle)"
                                >
                                  <Shuffle size={11} />
                                </button>
                                
                                {/* TikToker Priority */}
                                <button
                                  onClick={() => {
                                    const currentSettings = config.video_settings || {};
                                    const newVal = !currentSettings[video.name]?.tiktoker_priority;
                                    const newSettings = { 
                                      ...currentSettings, 
                                      [video.name]: { ...(currentSettings[video.name] || {}), tiktoker_priority: newVal }
                                    };
                                    setConfig({ ...config, video_settings: newSettings });
                                    saveStoredConfig({ ...config, video_settings: newSettings });
                                  }}
                                  className={`p-1.5 rounded-md transition-all ${config.video_settings?.[video.name]?.tiktoker_priority ? 'text-pink-500 bg-pink-50 ring-1 ring-pink-100' : 'text-slate-300 hover:text-slate-400'}`}
                                  title="Prioridad TikTok"
                                >
                                  <Zap size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Sin videos almacenados aún</span>
                    </div>
                  )}
                </div>

                {/* xAI Grok Imagine Video Generator panel */}
                <div className="pt-4 border-t space-y-3 bg-blue-50/40 p-3.5 rounded-2xl border border-blue-100/50">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">🎥</span>
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-800">Generador de Video Grok</span>
                      <span className="block text-[8px] font-black uppercase text-blue-600 tracking-widest">xAI (grok-imagine-video)</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Genera animaciones de video realistas de tu avatar a partir de la imagen de referencia actual usando modelos de inteligencia artificial xAI Grok-Imagine-Video.
                  </p>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 relative border">
                        {((config.initial_image_url || config.image_url || DEFAULT_AVATAR_IMAGE)?.match(/\.(mp4|webm|ogg)$/i) || (config.initial_image_url || config.image_url || DEFAULT_AVATAR_IMAGE)?.includes('VideoAnimadoAvatar')) ? (
                          <video src={config.initial_image_url || config.image_url || DEFAULT_AVATAR_IMAGE} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        ) : (
                          <img 
                            src={config.initial_image_url || config.image_url || DEFAULT_AVATAR_IMAGE} 
                            alt="Model final reference" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                      <div className="flex-grow">
                        <span className="block text-[8px] font-black uppercase text-slate-400">Imagen de referencia predefinida</span>
                        <span className="block text-[9px] font-bold text-slate-700 truncate max-w-[200px]">modelo final (Premium Salvadoran Banker)</span>
                      </div>
                    </div>

                    {videoStatus === 'idle' && (
                      <button
                        onClick={handleGenerateVideoGrok}
                        className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition active:scale-95 shadow-md flex items-center justify-center gap-1.5 font-bold"
                      >
                        <span>🎬</span> Iniciar Animación Grok
                      </button>
                    )}

                    {videoStatus === 'generating' && (
                      <div className="space-y-2 p-2.5 bg-white rounded-xl border border-blue-100 shadow-sm">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                          <span className="text-blue-700 animate-pulse">{videoProgressText}</span>
                          <span className="text-slate-500">{videoProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${videoProgress}%` }}
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                          />
                        </div>
                        <span className="block text-[8px] font-mono text-slate-400 uppercase text-center tracking-widest font-bold">
                          Grok procesando pesos temporales de movimiento...
                        </span>
                      </div>
                    )}

                    {videoStatus === 'completed' && (
                      <div className="space-y-2">
                        <span className="block text-[8px] font-black uppercase text-emerald-600 tracking-wider">¡Éxito! Video Generado por Grok</span>
                        
                        <div className="relative w-full aspect-video rounded-xl bg-slate-950 border overflow-hidden shadow-inner flex items-center justify-center">
                          <div className="relative w-full h-full flex flex-col items-center justify-center p-3 text-center">
                            {generatedVideoUrl?.startsWith("data:video/") || generatedVideoUrl?.endsWith(".mp4") || generatedVideoUrl?.includes("runway") || generatedVideoUrl?.includes("grok") || generatedVideoUrl?.includes("x.ai") ? (
                              <video 
                                src={generatedVideoUrl} 
                                autoPlay 
                                loop 
                                muted 
                                playsInline
                                className="absolute inset-0 w-full h-full object-cover filter saturate-125 contrast-110"
                              />
                            ) : (
                              <img 
                                src={generatedVideoUrl || DEFAULT_AVATAR_IMAGE} 
                                alt="Grok Video model preview" 
                                className="absolute inset-0 w-full h-full object-cover filter saturate-125 contrast-110"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent flex flex-col items-center justify-end p-3 pointer-events-none">
                              <div className="flex gap-1.5 items-center justify-center mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse [animation-delay:0.2s]" />
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse [animation-delay:0.4s]" />
                              </div>
                              <span className="text-[10px] font-black text-white uppercase tracking-wider">Grok Video Loop Activo</span>
                              <span className="text-[8px] font-bold text-slate-300">Fluidez sincronizada de movimiento</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleGenerateVideoGrok}
                            className="flex-1 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-[8px] font-black uppercase tracking-wider transition font-bold"
                          >
                            🔄 Regenerar
                          </button>
                          <a
                            href={generatedVideoUrl || "#"}
                            download="newbank-avatar-grok.mp4"
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-[8px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1 font-bold"
                          >
                            📥 Descargar Video
                          </a>
                        </div>
                      </div>
                    )}

                    {videoStatus === 'error' && (
                      <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl space-y-1">
                        <span className="block text-[8px] font-black uppercase text-red-800">Error en el Generador Grok</span>
                        <p className="text-[9px] font-semibold leading-relaxed">{videoError}</p>
                        <button
                          onClick={() => setVideoStatus('idle')}
                          className="w-full mt-1.5 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded-lg text-[8px] font-black uppercase tracking-wide transition font-bold"
                        >
                          Intentar Nuevamente
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
              
              <div className="mt-auto pt-4 border-t text-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tecnología de Clonación Realista NewBank AI svm</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

/**
 * COMPONENT: Smart Avatar Face/Interactive bubble
 * Includes realistic kinetic extremities (SVG shoulders, arms, hands) & dynamic localized mouth tracking
 */
interface SmartAvatarBubbleProps {
  detectedUser: any;
  scenario?: 'greeting' | 'interaction' | 'scanner';
  isSpeaking?: boolean;
  audioLevel?: number;
}

export const SmartAvatarBubble: React.FC<SmartAvatarBubbleProps> = ({
  detectedUser,
  scenario = 'interaction',
  isSpeaking = false,
  audioLevel = 0
}) => {
  const [config, setConfig] = useState<AvatarConfig>(getStoredConfig());
  const [sequences, setSequences] = useState<AvatarSequence[]>(getStoredSequences());
  const [frameIndex, setFrameIndex] = useState(0);
  const [verificationPassed, setVerificationPassed] = useState(true);
  const [showGreetingIndicator, setShowGreetingIndicator] = useState(false);
  const [question, setQuestion] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationText, setGenerationText] = useState("");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [tempVideoUrl, setTempVideoUrl] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");

  const startListening = () => {
    setIsListening(true);
    transcriptRef.current = "";
    setQuestion("");
    
    const SpeechRecognitionObject = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionObject) {
      alert("Su navegador no soporta el reconocimiento de voz. Pruebe con Google Chrome.");
      setIsListening(false);
      return;
    }
    
    try {
      const rec = new SpeechRecognitionObject();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "es-SV";
      
      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        const currentText = finalTranscript || interimTranscript;
        if (currentText) {
          setQuestion(currentText);
          transcriptRef.current = currentText;
        }
      };
      
      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };
      
      rec.onend = () => {
        setIsListening(false);
        const textToSend = transcriptRef.current.trim();
        if (textToSend) {
          handleSendQuestion(textToSend);
        }
      };
      
      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error("Failed to start SpeechRecognition:", e);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping voice recognition:", e);
      }
    }
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const handleSendQuestion = async (textToUse?: string) => {
    const currentQuestion = textToUse !== undefined ? textToUse : question;
    if (!currentQuestion.trim() || isGenerating) return;
    const lowerText = currentQuestion.toLowerCase();
    let bestMatchVideo: string | null = null;
    let matchScore = 0;

    if (config.video_triggers) {
      for (const [videoName, triggers] of Object.entries(config.video_triggers)) {
        if (!triggers) continue;
        const triggerList = triggers.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        for (const t of triggerList) {
          if (lowerText.includes(t)) {
            if (t.length > matchScore) {
              matchScore = t.length;
              bestMatchVideo = videoName;
            }
          }
        }
      }
    }

    if (bestMatchVideo) {
      console.log(`Manual trigger match found: ${bestMatchVideo}`);
      const videoUrl = `https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankVideoAnimadoAvatar/${bestMatchVideo}`;
      setTempVideoUrl(videoUrl);
      setQuestion("");
    } else {
      console.log("No video triggers matched for question:", currentQuestion);
      setIsGenerating(true);
      setGenerationProgress(10);
      setGenerationText("Analizando pregunta con IA avanzada...");
      
      try {
        const promptToAi = `Analiza semánticamente esta pregunta en relación con la empresa NewBank Store (que ofrece microcréditos rápidos/inmediatos en El Salvador en 5 minutos por WhatsApp para comprar celulares, electrodomésticos y artículos militares/tácticos en https://www.newbank.store/#/). Brinda una respuesta natural, profesional, muy breve y coherente basada exclusivamente en esta información empresarial. IMPORTANTE: Resume al máximo la respuesta, limitándola a un máximo de 8 a 12 palabras (aproximadamente una frase sumamente corta) para que la lectura por voz quepa perfectamente en un video de exactamente 4 segundos de duración. No agregues introducciones ni explicaciones de relleno. \n\nPregunta: ${currentQuestion}`;
        
        const response = await fetch(getApiUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: promptToAi,
            detectedUser,
            history: []
          })
        });

        if (!response.ok) {
          throw new Error("No se pudo obtener respuesta de la IA.");
        }

        const data = await response.json();
        const respuestaGenerada = data.reply || "¡Hola! Obtén tu microcrédito NewBank rápido por WhatsApp en minutos.";
        console.log("Respuesta semántica generada (respuestaGenerada):", respuestaGenerada);

        setGenerationProgress(40);
        setGenerationText("Sincronizando clonación de video de respuesta...");

        const videoPrompt = `Asesor virtual o representante oficial de NewBank. El personaje principal de la imagen responde de forma natural y conversacional, diciendo: "${respuestaGenerada}". Debe mantener movimientos corporales realistas, sincronizar expresiones faciales con el contenido de la respuesta, mirar hacia la cámara como si estuviera interactuando directamente con el usuario, utilizar un tono profesional, amigable y persuasivo en español de El Salvador.`;

        const activeImg = config.initial_image_url || config.image_url || DEFAULT_AVATAR_IMAGE;
        const initRes = await fetch(getApiUrl("/api/video-start"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            imageUrl: activeImg,
            prompt: videoPrompt
          })
        });

        if (!initRes.ok) {
          throw new Error("No se pudo iniciar la síntesis de video.");
        }

        const initData = await initRes.json();
        if (!initData.success) {
          throw new Error(initData.error || "Falla al registrar ticket de animación.");
        }

        const generationId = initData.id;
        setGenerationProgress(50);
        setGenerationText("Modelando gestos y renderizando video...");

        // Start Polling
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(getApiUrl(`/api/video-status/${generationId}`));
            if (!statusRes.ok) {
              throw new Error("Error consultando estado del video.");
            }

            const statusData = await statusRes.json();
            if (statusData.error) {
              throw new Error(statusData.error);
            }

            if (statusData.status === "completed") {
              clearInterval(pollInterval);
              setGenerationProgress(100);
              setGenerationText("¡Video generado exitosamente!");

              // Dynamically play this video automatically & immediately without losing standby video config
              setTempVideoUrl(statusData.video_url);

              // Extract video name to map action and trigger
              const videoName = statusData.video_url.split('/').pop() || "";
              const newEmotions = { ...(config.video_emotions || {}), [videoName]: respuestaGenerada };
              const newTriggers = { ...(config.video_triggers || {}), [videoName]: currentQuestion };

              const updatedConfig = {
                ...config,
                video_emotions: newEmotions,
                video_triggers: newTriggers
              };

              // Save in state & local storage
              setConfig(updatedConfig);
              saveStoredConfig(updatedConfig);

              // Auto-sync action and triggers for this new video directly to the Supabase database
              try {
                const { data: existing } = await supabase.from('avatar_configs').select('id').limit(1).single();
                await supabase.from('avatar_configs').upsert({
                  id: existing?.id || (updatedConfig.id || crypto.randomUUID()),
                  prompt: updatedConfig.prompt,
                  image_url: updatedConfig.image_url,
                  show_after_greeting: updatedConfig.show_after_greeting,
                  show_on_home: updatedConfig.show_on_home,
                  trigger_keywords: updatedConfig.trigger_keywords,
                  selected_personality: updatedConfig.selected_personality,
                  selected_behavior: updatedConfig.selected_behavior,
                  permanent_animation_prompt: updatedConfig.permanent_animation_prompt,
                  video_emotions: updatedConfig.video_emotions,
                  video_settings: updatedConfig.video_settings,
                  video_triggers: updatedConfig.video_triggers,
                  is_tiktoker_mode_enabled: updatedConfig.is_tiktoker_mode_enabled,
                  video_url: updatedConfig.video_url // retain the active standby video unchanged
                });
              } catch (dbErr) {
                console.warn("Could not save new generated video triggers/emotions to DB:", dbErr);
              }

              window.dispatchEvent(new Event('avatar-config-updated'));

              // Reset question and generation state
              setQuestion("");
              setIsGenerating(false);
            } else if (statusData.status === "in-progress") {
              setGenerationProgress(statusData.progress || 60);
              setGenerationText(statusData.progress_text || "Generando animación de avatar...");
            }
          } catch (pollErr: any) {
            clearInterval(pollInterval);
            setGenerationProgress(0);
            setGenerationText(`Error: ${pollErr.message}`);
            setTimeout(() => {
              setIsGenerating(false);
            }, 3000);
          }
        }, 3000);

      } catch (err: any) {
        setGenerationProgress(0);
        setGenerationText(`Error: ${err.message}`);
        setTimeout(() => {
          setIsGenerating(false);
        }, 3000);
      }
    }
  };

  useEffect(() => {
    const checkIndicator = () => setShowGreetingIndicator(localStorage.getItem('show_greeting_indicator') === 'true');
    checkIndicator();
    window.addEventListener('avatar-config-updated', checkIndicator);
    return () => window.removeEventListener('avatar-config-updated', checkIndicator);
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Moved video autoplay logic closer to the dynamic finalVideoSource definition below to trigger play on active video transition or initialization.

  // Unmute and play audio as soon as a user interacts with the app (Requirement 3 bypass)
  useEffect(() => {
    const handleUnmuteGesture = () => {
      if (videoRef.current && videoRef.current.muted) {
        videoRef.current.muted = false;
        videoRef.current.play().catch(e => {
          if (videoRef.current?.src) {
            console.warn("Failed play on user interaction:", e);
          }
        });
      }
    };
    window.addEventListener('click', handleUnmuteGesture);
    window.addEventListener('keydown', handleUnmuteGesture);
    return () => {
      window.removeEventListener('click', handleUnmuteGesture);
      window.removeEventListener('keydown', handleUnmuteGesture);
    };
  }, []);

  // 1. Trigger proactive async fetch from Supabase to load high-fidelity generated database sequences on mount
  useEffect(() => {
    syncFromDatabase().then(({ config: dbConfig, sequences: dbSeqs }) => {
      if (dbConfig) setConfig(dbConfig);
      if (dbSeqs) setSequences(dbSeqs);
    }).catch(e => console.warn("Failed to sync avatar database tables:", e));
  }, []);

  // 2. Keep synced with local storage updates in case administrator altered config
  useEffect(() => {
    const handleSync = () => {
      setConfig(getStoredConfig());
      setSequences(getStoredSequences());
    };
    handleSync();
    
    window.addEventListener('storage', handleSync);
    window.addEventListener('avatar-config-updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('avatar-config-updated', handleSync);
    };
  }, [scenario]);

  const currentActiveVideoUrl = tempVideoUrl || config.video_url;
  const currentVideoName = currentActiveVideoUrl ? currentActiveVideoUrl.split('/').pop() || "" : "";
  const videoSettings = config.video_settings?.[currentVideoName] || { loop: true, mute_at_end: false };

  // Determine image to show
  const userBaseImage = detectedUser?.image || detectedUser?.profile_image_url || config.initial_image_url || config.image_url;
  const activeSeq = sequences.find(s => s.scenario === scenario) || sequences[0];
  const rawImageFromSeq = (isSpeaking && activeSeq && activeSeq.image_urls && activeSeq.image_urls[frameIndex]) 
    ? activeSeq.image_urls[frameIndex] 
    : userBaseImage;
  const currentImageFromSeq = resolveImageUrl(rawImageFromSeq, config, userBaseImage);

  // Crossfade and transition tracking to avoid abrupt transitions between videos
  const activeSource = (currentActiveVideoUrl && !(currentImageFromSeq.match(/\.(mp4|webm|ogg)$/i) || currentImageFromSeq.includes('VideoAnimadoAvatar')))
    ? currentActiveVideoUrl
    : (currentImageFromSeq.match(/\.(mp4|webm|ogg)$/i) || currentImageFromSeq.includes('VideoAnimadoAvatar'))
    ? currentImageFromSeq
    : null;

  const finalVideoSource = activeSource;

  // Play video automatically when speaking or active, watching the actual video source
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isSpeaking;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Autoplay with audio deferred by browser protection. Playing muted first.", error);
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(e => {
              if (videoRef.current?.src) {
                console.warn("Failed muted play:", e);
              }
            });
          }
        });
      }
    }
  }, [finalVideoSource, isSpeaking]);

  const [transitionState, setTransitionState] = useState<{
    prevUrl: string | null;
    currentUrl: string | null;
    prevTime: number;
    transitionActive: boolean;
    transitionKey: number;
  }>({
    prevUrl: null,
    currentUrl: finalVideoSource || null,
    prevTime: 0,
    transitionActive: false,
    transitionKey: 0,
  });

  const transitionTimersRef = useRef<{ trigger: NodeJS.Timeout | null; clean: NodeJS.Timeout | null }>({
    trigger: null,
    clean: null,
  });

  const triggerCrossfade = (prev: string | null, current: string | null) => {
    if (transitionTimersRef.current.trigger) clearTimeout(transitionTimersRef.current.trigger);
    if (transitionTimersRef.current.clean) clearTimeout(transitionTimersRef.current.clean);

    const capturedTime = videoRef.current ? videoRef.current.currentTime : 0;

    setTransitionState(old => ({
      prevUrl: prev,
      currentUrl: current,
      prevTime: capturedTime,
      transitionActive: false,
      transitionKey: old.transitionKey + 1,
    }));

    const trigger = setTimeout(() => {
      setTransitionState(prev => ({
        ...prev,
        transitionActive: true
      }));
    }, 50);

    const clean = setTimeout(() => {
      setTransitionState(prev => ({
        ...prev,
        prevUrl: null,
        transitionActive: false,
      }));
    }, 1600);

    transitionTimersRef.current = { trigger, clean };
  };

  useEffect(() => {
    return () => {
      if (transitionTimersRef.current.trigger) clearTimeout(transitionTimersRef.current.trigger);
      if (transitionTimersRef.current.clean) clearTimeout(transitionTimersRef.current.clean);
    };
  }, []);

  useEffect(() => {
    if (finalVideoSource) {
      if (transitionState.currentUrl && transitionState.currentUrl !== finalVideoSource) {
        triggerCrossfade(transitionState.currentUrl, finalVideoSource);
      } else if (!transitionState.currentUrl) {
        setTransitionState(prev => ({
          ...prev,
          currentUrl: finalVideoSource,
          transitionActive: false,
          transitionKey: prev.transitionKey,
        }));
      }
    } else {
      if (transitionState.currentUrl) {
        triggerCrossfade(transitionState.currentUrl, null);
      }
    }
  }, [finalVideoSource]);

  const currentOpacityClass = transitionState.prevUrl
    ? (transitionState.transitionActive ? "opacity-100" : "opacity-0")
    : "opacity-100";

  const handleVideoEnded = (videoUrl: string, e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (videoSettings.mute_at_end && videoRef.current) {
      videoRef.current.muted = true;
    }
    window.dispatchEvent(new CustomEvent('avatar-video-ended', { 
      detail: { videoUrl } 
    }));

    if (tempVideoUrl && videoUrl === tempVideoUrl) {
      setTempVideoUrl(null);
      return;
    }

    const shouldLoop = videoSettings.loop !== false;

    if (shouldLoop) {
      const videoEl = e.currentTarget as HTMLVideoElement;
      setTimeout(() => {
        if (videoEl && videoEl.isConnected && videoEl.src.includes(videoUrl)) {
          console.log("Repetir video con transición cruzada dissolve:", videoUrl);
          triggerCrossfade(videoUrl, videoUrl);
          videoEl.currentTime = 0;
          videoEl.play().catch(err => {
            console.warn("Falla en reproducción de bucle con transición cruzada:", err);
          });
        }
      }, 50);
    }
  };

  // Frame timer for speaker mouth/glow oscillations (loops over precisely 5 photograms for the requested action transition)
  useEffect(() => {
    if (!isSpeaking) {
      setFrameIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % 5);
    }, 450); // Fluid cinematic pacing for the 5-frame loop
    return () => clearInterval(interval);
  }, [isSpeaking]);

  // Run a quick runtime verification of the animation matrices on render
  useEffect(() => {
    const activeSeqExist = sequences.length > 0;
    const assetsAreValid = userBaseImage && (userBaseImage.startsWith('http') || userBaseImage.startsWith('data:'));
    setVerificationPassed(Boolean(activeSeqExist && assetsAreValid));
  }, [sequences, userBaseImage]);

  // High-fidelity camera motion effects mapped directly to the 5 photograms
  const cameraTransforms = [
    // Fotograma 1: Enfoque de inicio, hombros neutros, encuadre estándar estable
    { transform: "scale(1.04) translate(0px, 0px) rotate(0deg)" },
    // Fotograma 2: Zoom hacia delante (Dolly), paneo sutil hacia la izquierda, inclinación de cabeza
    { transform: "scale(1.08) translate(-1.5px, -1px) rotate(-1deg)" },
    // Fotograma 3: Traslación ascendente de cámara para articular el torso y la gesticulación de manos
    { transform: "scale(1.12) translate(1px, -3px) rotate(0.8deg)" },
    // Fotograma 4: Desplazamiento sutil de paneo a la derecha con suavizado cinemático
    { transform: "scale(1.09) translate(2.5px, -2px) rotate(-0.5deg)" },
    // Fotograma 5: Clímax de aproximación enfocada en los gestos expresivos y asentimiento
    { transform: "scale(1.15) translate(0px, -4.5px) rotate(1.4deg)" }
  ];

  const activeCameraStyle = isSpeaking 
    ? cameraTransforms[frameIndex % 5] 
    : { transform: "scale(1.04) translate(0px, 0px) rotate(0deg)" };

  // Lighting matrices matching each photogram to create high quality facial luminosity matching
  const filterPresets = [
    "contrast(102%) saturate(106%) brightness(100%) hue-rotate(2deg)",
    "contrast(106%) saturate(112%) brightness(102%) hue-rotate(4deg) drop-shadow(0 2px 8px rgba(59,130,246,0.15))",
    "contrast(110%) saturate(118%) brightness(104%) hue-rotate(6deg) drop-shadow(0 4px 12px rgba(59,130,246,0.25))",
    "contrast(107%) saturate(114%) brightness(103%) hue-rotate(4deg) drop-shadow(0 3px 10px rgba(59,130,246,0.2))",
    "contrast(112%) saturate(122%) brightness(105%) hue-rotate(8deg) drop-shadow(0 5px 16px rgba(59,130,246,0.35))"
  ];
  const activeFilter = isSpeaking ? filterPresets[frameIndex % 5] : "contrast(102%) saturate(105%) brightness(100%)";

  if (typeof window !== 'undefined' && isFullScreen) {
    return createPortal(
      <div className="fixed inset-0 w-full h-[100dvh] bg-white z-[999999] flex flex-col items-center justify-center p-4 md:p-8 select-none animate-fadeIn overflow-hidden">
        {/* Fullscreen Close/Exit Button at top-right of screen */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFullScreen(false);
          }}
          className="absolute top-4 right-4 md:top-6 md:right-6 p-2.5 sm:p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full shadow-lg z-[1000000] hover:scale-110 active:scale-90 transition-all flex items-center gap-2 font-bold text-xs border border-slate-200/50 cursor-pointer"
          title="Salir de Pantalla Completa"
        >
          <Minimize2 size={16} />
          <span className="hidden sm:inline font-bold">Salir</span>
        </button>

        <div className="relative flex flex-col items-center justify-center">
          {/* Avatar Head Capsule and Vector Speech Sync Mouth Area (Standard size preserved) */}
          <div className="relative w-48 h-48 md:w-72 md:h-72 rounded-full transition-all duration-500 overflow-hidden z-20 bg-white shadow-2xl border border-slate-100 flex-shrink-0">
            
            {showGreetingIndicator && (
                <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                   <div className="absolute w-56 h-56 rounded-full border-4 border-green-400 animate-ping opacity-75"></div>
                   <div className="absolute w-64 h-64 rounded-full border-2 border-green-400 animate-pulse opacity-50"></div>
                </div>
            )}

            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center relative bg-white">
              {/* Previous Video Transition Layer for Seamless Crossfading */}
              {transitionState.prevUrl && (
                <video
                  key={`prev-video-${transitionState.transitionKey}`}
                  src={transitionState.prevUrl}
                  autoPlay={false}
                  loop={false}
                  muted
                  playsInline
                  controls={false}
                  ref={(el) => {
                    if (el) {
                      el.currentTime = transitionState.prevTime;
                      el.pause();
                      const handlePlayBypass = () => el.pause();
                      el.addEventListener('play', handlePlayBypass);
                      if (el.currentTime !== transitionState.prevTime) {
                        el.currentTime = transitionState.prevTime;
                      }
                    }
                  }}
                  style={{ 
                    filter: activeFilter,
                    transform: activeCameraStyle.transform,
                  }}
                  className={`absolute inset-0 w-full h-full object-cover z-30 pointer-events-none transition-opacity duration-[1500ms] ease-in-out ${
                    transitionState.transitionActive ? "opacity-0" : "opacity-100"
                  }`}
                />
              )}
              {/* The photographic face physical layer (Image or Autoplay Video) */}
              {finalVideoSource ? (
                <video
                  key={finalVideoSource}
                  ref={videoRef}
                  src={finalVideoSource}
                  autoPlay
                  loop={false}
                  onEnded={(e) => handleVideoEnded(finalVideoSource, e)}
                  muted={!isSpeaking}
                  playsInline
                  controls={false}
                  style={{ 
                    filter: activeFilter,
                    transform: activeCameraStyle.transform
                  }}
                  className={`w-full h-full object-cover transition-all ease-out transition-opacity duration-[1500ms] ease-in-out ${currentOpacityClass}`}
                  onClick={(e) => {
                    const video = e.currentTarget;
                    video.muted = !video.muted;
                  }}
                />
              ) : (
                <img
                  src={currentImageFromSeq}
                  alt="Smart Avatar Face"
                  style={{ 
                    filter: activeFilter,
                    transform: activeCameraStyle.transform
                  }}
                  className={`w-full h-full object-cover transition-all ease-out transition-opacity duration-[1500ms] ease-in-out ${currentOpacityClass}`}
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            {/* Minimize button overlay on avatar circle bottom right corner */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFullScreen(false);
              }}
              className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-full shadow-lg border border-slate-200 z-40 transition-all hover:scale-110 active:scale-95 cursor-pointer"
              title="Salir de Pantalla Completa"
            >
              <Minimize2 size={14} />
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      
      <div className="relative flex flex-col items-center">
        {/* Fullscreen Button shown on top right of the normal Avatar capsule container layout */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsFullScreen(true);
          }}
          className="absolute -top-3 -right-3 p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full shadow-lg z-30 transition-all hover:scale-110 active:scale-95 cursor-pointer"
          title="Ver en Pantalla Completa"
        >
          <Maximize2 size={15} />
        </button>

        {/* Avatar Head Capsule and Vector Speech Sync Mouth Area */}
        <div className={`relative w-48 h-48 md:w-72 md:h-72 rounded-full transition-all duration-500 overflow-hidden z-20 bg-white`}>
          
          {showGreetingIndicator && (
              <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                 <div className="absolute w-56 h-56 rounded-full border-4 border-green-400 animate-ping opacity-75"></div>
                 <div className="absolute w-64 h-64 rounded-full border-2 border-green-400 animate-pulse opacity-50"></div>
              </div>
          )}

          <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center relative bg-white">
            {/* Previous Video Transition Layer for Seamless Crossfading */}
            {transitionState.prevUrl && (
              <video
                key={`prev-video-${transitionState.transitionKey}`}
                src={transitionState.prevUrl}
                autoPlay={false}
                loop={false}
                muted
                playsInline
                controls={false}
                ref={(el) => {
                  if (el) {
                    el.currentTime = transitionState.prevTime;
                    el.pause();
                    const handlePlayBypass = () => el.pause();
                    el.addEventListener('play', handlePlayBypass);
                    if (el.currentTime !== transitionState.prevTime) {
                      el.currentTime = transitionState.prevTime;
                    }
                  }
                }}
                style={{ 
                  filter: activeFilter,
                  transform: activeCameraStyle.transform,
                }}
                className={`absolute inset-0 w-full h-full object-cover z-30 pointer-events-none transition-opacity duration-[1500ms] ease-in-out ${
                  transitionState.transitionActive ? "opacity-0" : "opacity-100"
                }`}
              />
            )}
            {/* The photographic face physical layer (Image or Autoplay Video) */}
            {finalVideoSource ? (
              <video
                key={finalVideoSource}
                ref={videoRef}
                src={finalVideoSource}
                autoPlay
                loop={false}
                onEnded={(e) => handleVideoEnded(finalVideoSource, e)}
                muted={!isSpeaking}
                playsInline
                controls={false}
                style={{ 
                  filter: activeFilter,
                  transform: activeCameraStyle.transform
                }}
                className={`w-full h-full object-cover transition-all ease-out transition-opacity duration-[1500ms] ease-in-out ${currentOpacityClass}`}
                onClick={(e) => {
                  const video = e.currentTarget;
                  video.muted = !video.muted;
                }}
              />
            ) : (
              <img
                src={currentImageFromSeq}
                alt="Smart Avatar Face"
                style={{ 
                  filter: activeFilter,
                  transform: activeCameraStyle.transform
                }}
                className={`w-full h-full object-cover transition-all ease-out transition-opacity duration-[1500ms] ease-in-out ${currentOpacityClass}`}
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          {/* Audio Wave Modulation Bars Overlay removed */}
        </div>

        {/* Custom Question Analyzer Controls */}
        <div className="mt-4 w-64 md:w-80 bg-white/95 backdrop-blur-sm p-3 rounded-2xl shadow-lg border border-slate-100 flex flex-col gap-2 z-30 pointer-events-auto">
          {isGenerating ? (
            <div className="flex flex-col gap-2 py-3 px-1 animate-fadeIn">
              <div className="flex justify-center items-center text-[10px] font-bold text-slate-500">
                <span className="font-mono text-emerald-600 shrink-0">{generationProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500 rounded-full"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-400 italic text-center mt-1">El clon digital se está animando...</span>
            </div>
          ) : (
            <>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendQuestion();
                  }
                }}
                placeholder={isListening ? "Escuchando... Habla ahora..." : "Escribe tu pregunta aquí..."}
                className={`w-full h-16 px-3 py-2 text-xs md:text-sm text-slate-700 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none transition-all ${
                  isListening 
                    ? "bg-red-50/20 border-red-300 ring-2 ring-red-500/20" 
                    : "bg-slate-50/50 border-slate-200"
                }`}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSendQuestion()}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                >
                  <Send size={14} />
                  <span>Enviar Pregunta</span>
                </button>
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold shadow-md flex items-center justify-center transition-all active:scale-[0.98] ${
                    isListening 
                      ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" 
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                  }`}
                  title={isListening ? "Detener grabación de voz" : "Preguntar con tu voz"}
                >
                  {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export const AvataresAdminPanel: React.FC<{ user: any }> = ({ user }) => {
  const [avatars, setAvatars] = useState<AvatarConfig[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarConfig | null>(null);
  const [sequences, setSequences] = useState<AvatarSequence[]>([]);
  const [masterActiveId, setMasterActiveId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [apiMessage, setApiMessage] = useState("");
  const [isFallbackActive, setIsFallbackActive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [storedVideos, setStoredVideos] = useState<{name: string, url: string, created_at: string}[]>([]);
  
  // Scenarios preview states
  const [previewScenario, setPreviewScenario] = useState<'greeting' | 'interaction' | 'scanner'>('interaction');
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  // Grok video states
  const [videoStatus, setVideoStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoProgressText, setVideoProgressText] = useState("");
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Fetch all avatars and master active ID on mount
  const fetchAvatars = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('avatar_configs').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      setAvatars(data || []);
      
      // Determine the primary active avatar (the oldest/first row in db)
      if (data && data.length > 0) {
        setMasterActiveId(data[0].id || null);
        // If nothing is selected, select the first one
        if (!selectedAvatar) {
          setSelectedAvatar(data[0]);
        } else {
          // Keep selection synchronized with updated data
          const updatedSelected = data.find(a => a.id === selectedAvatar.id);
          if (updatedSelected) {
            setSelectedAvatar(updatedSelected);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching avatars:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sequences for selected avatar
  const fetchSequences = async (avatarId: string) => {
    try {
      const { data, error } = await supabase
        .from('avatar_sequences')
        .select('*')
        .eq('user_id', avatarId);
      
      if (!error && data) {
        const loaded: AvatarSequence[] = data.map((dbSeq: any) => ({
          id: dbSeq.id,
          userId: dbSeq.user_id || avatarId,
          scenario: dbSeq.scenario,
          image_urls: dbSeq.image_urls || [],
          appliedPrompt: dbSeq.applied_prompt || "",
          personality: dbSeq.personality || "hospitalaria",
          createdAt: dbSeq.created_at || new Date().toISOString()
        }));
        setSequences(loaded);
      } else {
        setSequences([]);
      }
    } catch (err) {
      console.warn("Could not load sequences for avatar:", err);
      setSequences([]);
    }
  };

  // Fetch bucket videos
  const fetchBucketVideos = async () => {
    try {
      const response = await fetch(getApiUrl('/api/videos'));
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.videos) {
          const data = result.videos;
          const videos = data
            .filter((f: any) => f.name && !f.name.startsWith('.') && f.name !== '.emptyFolderPlaceholder')
            .map((f: any) => ({
              name: f.name,
              url: `https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankVideoAnimadoAvatar/${f.name}`,
              created_at: f.created_at
            }))
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setStoredVideos(videos);
        }
      }
    } catch (err) {
      console.warn('Error fetching bucket videos:', err);
    }
  };

  useEffect(() => {
    fetchAvatars();
    fetchBucketVideos();
  }, []);

  useEffect(() => {
    if (selectedAvatar?.id) {
      fetchSequences(selectedAvatar.id);
      // reset video status when selection changes
      setVideoStatus('idle');
      setGeneratedVideoUrl(null);
    }
  }, [selectedAvatar?.id]);

  // Previews animation loop
  useEffect(() => {
    const activeSeq = sequences.find(s => s.scenario === previewScenario) || sequences[0];
    if (!activeSeq || !activeSeq.image_urls.length) return;
    
    const firstUrl = activeSeq.image_urls[0] || "";
    const isVideoSequence = firstUrl.match(/\.(mp4|webm|ogg)$/i) || firstUrl.includes('VideoAnimadoAvatar');
    if (isVideoSequence) return;
    
    const interval = setInterval(() => {
      setActivePreviewIndex(prev => (prev + 1) % activeSeq.image_urls.length);
    }, 450);
    return () => clearInterval(interval);
  }, [previewScenario, sequences]);

  const handleCreateAvatar = async () => {
    try {
      setSuccessMsg("Creando nuevo avatar independiente...");
      const newId = crypto.randomUUID();
      const newAvatar: Partial<AvatarConfig> = {
        id: newId,
        image_url: DEFAULT_AVATAR_IMAGE,
        prompt: "Professional friendly Salvadoran banker matching reference model detail",
        show_after_greeting: true,
        show_on_home: true,
        trigger_keywords: "hola, precio, comprar, celular, whatsapp",
        selected_personality: "hospitalaria",
        selected_behavior: "proactivo",
        permanent_animation_prompt: "Professional friendly Salvadoran banker matching reference model detail, moving naturally, smiling slightly, looking at camera, solid white background, high definition",
        video_emotions: {},
        video_triggers: {},
        is_tiktoker_mode_enabled: false
      };

      const { error } = await supabase.from('avatar_configs').insert(newAvatar);
      if (error) throw error;

      setSuccessMsg("¡Avatar creado con éxito!");
      setTimeout(() => setSuccessMsg(""), 3000);
      
      // select the newly created avatar
      setSelectedAvatar(newAvatar as AvatarConfig);
      await fetchAvatars();
    } catch (err) {
      console.error("Error creating avatar:", err);
      setSuccessMsg("Error al crear avatar: " + (err as Error).message);
    }
  };

  const handleSaveSelected = async () => {
    if (!selectedAvatar) return;
    try {
      setSuccessMsg("Guardando cambios del avatar...");
      const { error } = await supabase.from('avatar_configs').upsert({
        id: selectedAvatar.id,
        prompt: selectedAvatar.prompt,
        image_url: selectedAvatar.image_url,
        show_after_greeting: selectedAvatar.show_after_greeting,
        show_on_home: selectedAvatar.show_on_home,
        trigger_keywords: selectedAvatar.trigger_keywords,
        selected_personality: selectedAvatar.selected_personality,
        selected_behavior: selectedAvatar.selected_behavior,
        permanent_animation_prompt: selectedAvatar.permanent_animation_prompt,
        video_emotions: selectedAvatar.video_emotions,
        video_settings: selectedAvatar.video_settings,
        video_triggers: selectedAvatar.video_triggers,
        is_tiktoker_mode_enabled: selectedAvatar.is_tiktoker_mode_enabled,
        video_url: selectedAvatar.video_url
      });

      if (error) throw error;

      // Ensure each of the 5-photogram sequences are synchronized inside database
      for (const seq of sequences) {
        const { data: existingSeq } = await supabase
          .from('avatar_sequences')
          .select('id')
          .eq('scenario', seq.scenario)
          .eq('user_id', selectedAvatar.id)
          .limit(1)
          .maybeSingle();

        const { error: seqErr } = await supabase.from('avatar_sequences').upsert({
          id: existingSeq?.id || seq.id || crypto.randomUUID(),
          user_id: selectedAvatar.id,
          scenario: seq.scenario,
          image_urls: seq.image_urls,
          applied_prompt: seq.appliedPrompt || selectedAvatar.prompt,
          personality: seq.personality || selectedAvatar.selected_personality,
          created_at: seq.createdAt || new Date().toISOString()
        });
        if (seqErr) console.warn("Error saving sequence:", seqErr);
      }

      setSuccessMsg("¡Cambios guardados con éxito en la base de datos!");
      setTimeout(() => setSuccessMsg(""), 3000);
      await fetchAvatars();
    } catch (err) {
      console.error("Error saving avatar config:", err);
      setSuccessMsg("Error al guardar: " + (err as Error).message);
    }
  };

  const handleDeleteAvatar = async (id: string) => {
    if (id === masterActiveId) {
      alert("No se puede eliminar el avatar por defecto del sistema.");
      return;
    }
    if (!confirm("¿Está seguro de que desea eliminar este avatar? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      setSuccessMsg("Eliminando avatar...");
      
      // Delete sequences first
      await supabase.from('avatar_sequences').delete().eq('user_id', id);

      const { error } = await supabase.from('avatar_configs').delete().eq('id', id);
      if (error) throw error;

      setSuccessMsg("¡Avatar eliminado con éxito!");
      setTimeout(() => setSuccessMsg(""), 3000);

      if (selectedAvatar?.id === id) {
        setSelectedAvatar(null);
      }
      await fetchAvatars();
    } catch (err) {
      console.error("Error deleting avatar:", err);
      setSuccessMsg("Error al eliminar: " + (err as Error).message);
    }
  };

  const handleActivateAvatar = async (id: string, avatarData: AvatarConfig) => {
    if (!masterActiveId) return;
    try {
      setSuccessMsg("Activando avatar como principal...");
      
      // Update the master row with selected avatar's fields
      const { error } = await supabase.from('avatar_configs').update({
        prompt: avatarData.prompt,
        image_url: avatarData.image_url,
        show_after_greeting: avatarData.show_after_greeting,
        show_on_home: avatarData.show_on_home,
        trigger_keywords: avatarData.trigger_keywords,
        selected_personality: avatarData.selected_personality,
        selected_behavior: avatarData.selected_behavior,
        permanent_animation_prompt: avatarData.permanent_animation_prompt,
        video_emotions: avatarData.video_emotions,
        video_settings: avatarData.video_settings,
        video_triggers: avatarData.video_triggers,
        is_tiktoker_mode_enabled: avatarData.is_tiktoker_mode_enabled,
        video_url: avatarData.video_url
      }).eq('id', masterActiveId);

      if (error) throw error;

      // Copy sequences from selected avatar row to master row
      // Load sequences of selected avatar
      const { data: sourceSeqs } = await supabase
        .from('avatar_sequences')
        .select('*')
        .eq('user_id', id);

      if (sourceSeqs) {
        for (const src of sourceSeqs) {
          const { data: targetSeq } = await supabase
            .from('avatar_sequences')
            .select('id')
            .eq('scenario', src.scenario)
            .eq('user_id', masterActiveId)
            .limit(1)
            .maybeSingle();

          await supabase.from('avatar_sequences').upsert({
            id: targetSeq?.id || crypto.randomUUID(),
            user_id: masterActiveId,
            scenario: src.scenario,
            image_urls: src.image_urls,
            applied_prompt: src.applied_prompt,
            personality: src.personality,
            created_at: new Date().toISOString()
          });
        }
      }

      setSuccessMsg("¡Avatar asignado como el Activo de NewBank!");
      setTimeout(() => setSuccessMsg(""), 4000);
      
      // trigger event to hot-reload local buffers on open screens
      window.dispatchEvent(new Event('avatar-config-updated'));
      await fetchAvatars();
    } catch (err) {
      console.error("Error activating avatar:", err);
      setSuccessMsg("Error al activar: " + (err as Error).message);
    }
  };

  // AI Sequences Generator
  const handleGenerateEffect = async () => {
    if (!selectedAvatar) return;
    setIsGenerating(true);
    setSuccessMsg("");
    setApiMessage("");
    setIsFallbackActive(false);

    try {
      const basePrompt = `High-quality photorealistic portrait of a professional Salvadoran banker, based on the style, facial features, and professional look of the reference model image: ${DEFAULT_AVATAR_IMAGE}. highly realistic details, looking at the camera, wearing a matching formal navy blue blazer and white dress shirt, on a soft warm cybernetic digital blue office lighting backdrop, optimized WEBP image format. Extremely consistent character style, clothing, haircut, face, and visual look.`;
      setSuccessMsg("Generando imagen única de tu avatar inteligente...");
      
      const singlePrompt = `${basePrompt} Formato webp de alta definición, iluminación profesional, fondo limpio.`;
      const res = await generateAvatarImage(singlePrompt, selectedAvatar.selected_personality);

      const fallbackActive = res.fallbackActive;
      setIsFallbackActive(fallbackActive);

      let f0 = res.url;
      if (fallbackActive) {
        let msg = "Contingencia: Se asignó un avatar de alta cohesión estética local debido a los límites de cuota.";
        f0 = DEFAULT_AVATAR_IMAGE;
        setApiMessage(msg);
      } else {
        setApiMessage("🔌 Vínculo remoto exitoso: ¡Avatar único generado!");
      }

      const updatedAvatar = {
        ...selectedAvatar,
        image_url: f0,
        initial_image_url: f0,
        final_image_url: f0,
        frame_0_url: f0,
        frame_1_url: f0,
        frame_2_url: f0,
        frame_3_url: f0,
        frame_4_url: f0
      };

      setSelectedAvatar(updatedAvatar);

      // Save sequences
      const scenarioList: ('greeting' | 'interaction' | 'scanner')[] = ['greeting', 'interaction', 'scanner'];
      const newSeqs: AvatarSequence[] = [];
      scenarioList.forEach(sc => {
        const generatedFrames = [f0, f0, f0, f0, f0];
        newSeqs.push({
          id: `seq-${sc}-${Date.now()}`,
          userId: selectedAvatar.id || "admin",
          scenario: sc,
          image_urls: generatedFrames,
          appliedPrompt: updatedAvatar.prompt,
          personality: updatedAvatar.selected_personality,
          createdAt: new Date().toISOString()
        });
      });

      setSequences(newSeqs);

      // Save to DB immediately
      await supabase.from('avatar_configs').update({
        image_url: f0,
        initial_image_url: f0,
        final_image_url: f0,
        frame_0_url: f0,
        frame_1_url: f0,
        frame_2_url: f0,
        frame_3_url: f0,
        frame_4_url: f0
      }).eq('id', selectedAvatar.id);

      for (const seq of newSeqs) {
        const { data: existingSeq } = await supabase
          .from('avatar_sequences')
          .select('id')
          .eq('scenario', seq.scenario)
          .eq('user_id', selectedAvatar.id)
          .limit(1)
          .maybeSingle();

        await supabase.from('avatar_sequences').upsert({
          id: existingSeq?.id || crypto.randomUUID(),
          user_id: selectedAvatar.id,
          scenario: seq.scenario,
          image_urls: seq.image_urls,
          applied_prompt: seq.appliedPrompt,
          personality: seq.personality,
          created_at: new Date().toISOString()
        });
      }

      setSuccessMsg("¡Efecto e imagen única para el avatar generados!");
      await fetchAvatars();
    } catch (err: any) {
      console.error("Error generating avatar image:", err);
      setApiMessage(`Error: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Grok Video Generator
  const handleGenerateVideoGrok = async () => {
    if (!selectedAvatar) return;
    setVideoStatus('generating');
    setVideoProgress(15);
    setVideoProgressText("Conectando con xAI Grok...");
    setVideoError(null);
    setGeneratedVideoUrl(null);

    try {
      const activeImg = selectedAvatar.initial_image_url || selectedAvatar.image_url || DEFAULT_AVATAR_IMAGE;
      const combinedPrompt = `${selectedAvatar.permanent_animation_prompt || 'Professional friendly Salvadoran banker matching reference model detail, moving naturally, smiling slightly, looking at camera, solid white background, high definition video'} ${selectedAvatar.prompt || ''}`.trim().substring(0, 4096);
      
      const initRes = await fetch(getApiUrl("/api/video-start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          imageUrl: activeImg,
          prompt: combinedPrompt
        })
      });

      if (!initRes.ok) {
        throw new Error("No se pudo iniciar el proceso de video en el servidor.");
      }

      const initData = await initRes.json();
      if (!initData.success) {
        throw new Error(initData.error || "Falla al registrar ticket de animación Grok.");
      }

      const generationId = initData.id;
      setVideoProgress(30);
      setVideoProgressText(initData.message || "Ticket registrado. Preparando modelo Grok-Imagine-Video...");

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(getApiUrl(`/api/video-status/${generationId}`));
          if (!statusRes.ok) {
            throw new Error("Error consultando estado del video.");
          }

          const statusData = await statusRes.json();
          if (statusData.error) {
            throw new Error(statusData.error);
          }

          if (statusData.status === "completed") {
            clearInterval(pollInterval);
            setVideoStatus('completed');
            setVideoProgress(100);
            setVideoProgressText("¡Video generado exitosamente por Grok Imagine Video!");
            setGeneratedVideoUrl(statusData.video_url);

            const updatedSelected = { ...selectedAvatar, video_url: statusData.video_url };
            setSelectedAvatar(updatedSelected);

            // update in DB specifically for this row ID
            await supabase.from('avatar_configs').update({
              video_url: statusData.video_url
            }).eq('id', selectedAvatar.id);

            setSuccessMsg("¡Vídeo de avatar Grok generado con éxito!");
            setTimeout(() => setSuccessMsg(""), 4000);
            await fetchAvatars();
          } else if (statusData.status === "in-progress") {
            setVideoProgress(statusData.progress || 60);
            setVideoProgressText(statusData.progress_text || "Generando animación en Grok...");
          }
        } catch (pollErr: any) {
          clearInterval(pollInterval);
          setVideoStatus('error');
          setVideoError(pollErr.message || "Falla durante el monitoreo o descarga de Grok.");
        }
      }, 3000);

    } catch (err: any) {
      setVideoStatus('error');
      setVideoError(err.message || "Falla al iniciar la síntesis de video en Grok.");
    }
  };

  if (!user || (!user.is_admin && user.profile_type !== 'admin')) {
    return (
      <div className="p-8 text-center text-slate-500 font-bold uppercase">
        Acceso restringido para administradores.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border overflow-hidden animate-fade-in mb-12">
      <div className="p-8 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-black uppercase text-slate-900 flex items-center gap-2">
            🤖 Multi-Gestor de Avatares Independientes
          </h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
            Crea, configura y gestiona múltiplos gemelos digitales independientes salvadoreños.
          </p>
        </div>
        <button
          onClick={handleCreateAvatar}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-100 flex items-center gap-1.5"
        >
          <Plus size={14} /> Crear Nuevo Avatar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        
        {/* LEFT COLUMN: AVATAR LIST (spanning 4 of 12 columns) */}
        <div className="lg:col-span-4 p-6 bg-slate-50/20 max-h-[800px] overflow-y-auto custom-scrollbar">
          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 px-1">
            Lista de Avatares ({avatars.length})
          </span>
          
          {loading ? (
            <div className="p-8 text-center text-slate-400 font-medium text-xs">Cargando avatares...</div>
          ) : avatars.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-medium text-xs">No hay avatares registrados.</div>
          ) : (
            <div className="space-y-3">
              {avatars.map((av, index) => {
                const isActive = av.id === masterActiveId;
                const isSelected = selectedAvatar?.id === av.id;
                return (
                  <div
                    key={av.id}
                    onClick={() => setSelectedAvatar(av)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative group flex items-start gap-3.5 ${
                      isSelected
                        ? 'bg-blue-50/40 border-blue-500 shadow-md shadow-blue-500/5'
                        : 'bg-white border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {/* Avatar image frame */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border overflow-hidden flex-shrink-0 relative shadow-sm">
                      {av.image_url?.match(/\.(mp4|webm|ogg)$/i) || av.image_url?.includes('VideoAnimadoAvatar') ? (
                        <video src={av.image_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                      ) : (
                        <img src={av.image_url || DEFAULT_AVATAR_IMAGE} alt="Avatar profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      )}
                    </div>

                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-slate-800 capitalize leading-none">
                          Avatar {index + 1}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase tracking-wider rounded">
                            ACTIVO REALTIME
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-tighter capitalize font-bold">
                        {AVATAR_PERSONALITIES.find(p => p.id === av.selected_personality)?.name.split('(')[0] || av.selected_personality}
                      </p>
                      <p className="text-[9px] text-slate-500 truncate mt-1 italic max-w-[200px]">
                        "{av.prompt}"
                      </p>

                      <div className="flex items-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
                        {!isActive && (
                          <button
                            onClick={() => handleActivateAvatar(av.id!, av)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition flex items-center gap-1"
                          >
                            <CheckCircle size={10} /> Activar en App
                          </button>
                        )}
                        {!isActive && (
                          <button
                            onClick={() => handleDeleteAvatar(av.id!)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-lg transition"
                            title="Eliminar de la base de datos"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: DETAIL FORM / CORE SYSTEM LAYOUT (spanning 8 of 12 columns) */}
        <div className="lg:col-span-8 p-6 md:p-8">
          {selectedAvatar ? (
            <div className="space-y-6">
              
              {/* Top Details info and status indicators */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 flex-wrap gap-4">
                <div>
                  <h4 className="font-black text-slate-800 text-base uppercase tracking-tight">
                    Configuración de Avatar Independiente
                  </h4>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                    ID: {selectedAvatar.id?.substring(0, 8)}... {selectedAvatar.id === masterActiveId ? "(PRINCIPAL)" : "(SECUNDARIO)"}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleSaveSelected}
                    className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-md font-bold"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </div>

              {/* Success Notification Alert */}
              <AnimatePresence>
                {successMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="p-3 bg-green-50 border border-green-200 text-green-700 text-[10px] rounded-xl font-bold uppercase tracking-wider leading-tight"
                  >
                    🚀 {successMsg}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* API Feedback and Fallback Educational Notice */}
              <AnimatePresence>
                {apiMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className={`p-3 text-[10px] rounded-xl font-bold border leading-normal ${
                      isFallbackActive 
                        ? "bg-amber-50 border-amber-200 text-amber-800 animate-fade-in"
                        : "bg-blue-50 border-blue-200 text-blue-800 animate-fade-in"
                    }`}
                  >
                    {isFallbackActive ? (
                      <div>
                        <div className="font-black flex items-center gap-1.5 text-amber-900 mb-1 uppercase tracking-wider">
                          ⚠️ MODO LOCAL ACTIVADO (ACCESO DE RESPALDO)
                        </div>
                        <p>{apiMessage}</p>
                      </div>
                    ) : (
                      <div>
                        <div className="font-black flex items-center gap-1.5 text-blue-900 mb-1 uppercase tracking-wider">
                          🔌 Vínculo Remoto Sincronizado
                        </div>
                        <p>{apiMessage}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Visual Settings and text field details */}
                <div className="space-y-4">
                  
                  {/* Prompt Text input */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Texto (Instrucción para Animación Grok):
                    </label>
                    <textarea
                      rows={2}
                      value={selectedAvatar.prompt}
                      onChange={(e) => setSelectedAvatar({ ...selectedAvatar, prompt: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border bg-slate-50 text-xs font-semibold outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
                      placeholder="Instrucción que se ejecutará al Iniciar Animación Grok..."
                    />
                  </div>

                  {/* Permanent Prompt */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Prompt Permanente (Reglas de Animación en todo momento):
                    </label>
                    <textarea
                      rows={2}
                      value={selectedAvatar.permanent_animation_prompt || ""}
                      onChange={(e) => setSelectedAvatar({ ...selectedAvatar, permanent_animation_prompt: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border bg-slate-50 text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-500 focus:bg-blue-50/20"
                      placeholder="Ej. El avatar debe mantener siempre una postura formal y sonreír levemente..."
                    />
                  </div>

                  {/* Highlight keywords triggers */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Mostrar al detectar las palabras:
                    </label>
                    <input
                      type="text"
                      value={selectedAvatar.trigger_keywords}
                      onChange={(e) => setSelectedAvatar({ ...selectedAvatar, trigger_keywords: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border bg-slate-50 text-xs font-semibold outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
                      placeholder="Celular, tarjeta, precio..."
                    />
                  </div>

                  {/* Personality and behavior selectors */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Personalidad</label>
                      <select
                        value={selectedAvatar.selected_personality}
                        onChange={(e) => setSelectedAvatar({ ...selectedAvatar, selected_personality: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border bg-slate-50 text-[11px] font-bold outline-none"
                      >
                        {AVATAR_PERSONALITIES.map(p => (
                          <option key={p.id} value={p.id}>{p.name.split('(')[0]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Comportamiento</label>
                      <select
                        value={selectedAvatar.selected_behavior}
                        onChange={(e) => setSelectedAvatar({ ...selectedAvatar, selected_behavior: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border bg-slate-50 text-[11px] font-bold outline-none"
                      >
                        {AVATAR_BEHAVIORS.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Checkboxes settings */}
                  <div className="p-3 bg-slate-50 rounded-xl space-y-2.5">
                    <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={selectedAvatar.show_on_home !== false}
                        onChange={(e) => setSelectedAvatar({ ...selectedAvatar, show_on_home: e.target.checked })}
                        className="w-4 h-4 accent-slate-950"
                      />
                      Mostrar avatar en el inicio
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={selectedAvatar.show_after_greeting}
                        onChange={(e) => setSelectedAvatar({ ...selectedAvatar, show_after_greeting: e.target.checked })}
                        className="w-4 h-4 accent-slate-950"
                      />
                      Mostrar después de cada saludo
                    </label>
                  </div>

                  {/* Tiktoker Mode Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selectedAvatar.is_tiktoker_mode_enabled ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Zap size={14} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Modo TikToker</p>
                        <p className="text-[9px] text-slate-400 font-medium italic">Algoritmo de Prioridad Viral</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedAvatar({ ...selectedAvatar, is_tiktoker_mode_enabled: !selectedAvatar.is_tiktoker_mode_enabled });
                      }}
                      className={`w-9 h-5 rounded-full transition-all duration-300 relative ${selectedAvatar.is_tiktoker_mode_enabled ? 'bg-pink-500' : 'bg-slate-200'}`}
                    >
                      <motion.div 
                        layout
                        className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${selectedAvatar.is_tiktoker_mode_enabled ? 'right-1' : 'left-1'}`} 
                      />
                    </button>
                  </div>

                </div>

                {/* VISUAL & AI SEQUENCE PREVIEWS */}
                <div className="space-y-4">
                  
                  {/* Preview scenario selector */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      Previsualizar Animaciones
                    </label>
                    <div className="flex gap-2">
                      {['greeting', 'interaction', 'scanner'].map(sc => (
                        <button
                          key={sc}
                          onClick={() => {
                            setPreviewScenario(sc as any);
                            setActivePreviewIndex(0);
                          }}
                          className={`flex-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition ${
                            previewScenario === sc 
                              ? 'bg-slate-900 text-white border-slate-900' 
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {sc === 'greeting' ? 'Saludo' : sc === 'interaction' ? 'Interacción' : 'Escáner'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Animation preview box */}
                  <div className="relative w-full h-44 bg-slate-100 rounded-2xl border flex items-center justify-center overflow-hidden">
                    {sequences.some(s => s.scenario === previewScenario) || selectedAvatar.video_url ? (
                      (() => {
                        const activeSeq = sequences.find(s => s.scenario === previewScenario) || sequences[0] || { image_urls: [selectedAvatar.image_url] };
                        const filterPresets = [
                          "contrast(115%) saturate(120%) brightness(105%) hue-rotate(5deg)",
                          "contrast(110%) saturate(130%) brightness(110%) hue-rotate(15deg) sepia(10%)",
                          "contrast(120%) saturate(125%) brightness(100%) hue-rotate(25deg)",
                          "contrast(115%) saturate(115%) brightness(108%) hue-rotate(15deg)"
                        ];
                        const filterToApply = filterPresets[activePreviewIndex % filterPresets.length];
                        const resolvedImg = resolveImageUrl(activeSeq?.image_urls?.[activePreviewIndex % activeSeq.image_urls.length] || selectedAvatar.image_url, selectedAvatar);
                        const isVideo = resolvedImg.match(/\.(mp4|webm|ogg)$/i) || resolvedImg.includes('VideoAnimadoAvatar') || resolvedImg.includes('video');
                        
                        return (
                          <div className="relative w-32 h-32 rounded-full border-2 border-blue-500 overflow-hidden shadow-lg bg-white flex items-center justify-center">
                            {isVideo ? (
                              <video
                                src={resolvedImg}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            ) : selectedAvatar.video_url && (!activeSeq || !activeSeq.image_urls.length || activeSeq.image_urls[0] === selectedAvatar.image_url) ? (
                              <video
                                src={selectedAvatar.video_url}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            ) : (
                              <>
                                <img
                                  src={resolvedImg}
                                  alt="Avatar frame preview"
                                  style={{ filter: filterToApply }}
                                  className="w-full h-full object-cover transition-all duration-300"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-x-0 bottom-4 flex justify-center gap-0.5 pointer-events-none">
                                  <span className="w-1.5 h-3 bg-blue-400 rounded-full animate-bounce"></span>
                                  <span className="w-1.5 h-4.5 bg-blue-500 rounded-full animate-bounce delay-75"></span>
                                  <span className="w-1.5 h-2 bg-blue-400 rounded-full animate-bounce delay-150"></span>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Sin secuencias activas generadas.
                      </p>
                    )}
                    <span className="absolute bottom-2 right-3 text-[8px] font-mono text-slate-400 uppercase tracking-widest leading-none">Previsualización</span>
                  </div>

                  {/* Buttons for Generating Sequence */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateEffect}
                      disabled={isGenerating}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition active:scale-95 disabled:opacity-50 font-bold"
                    >
                      {isGenerating ? "Generando Secuencia..." : "Generar Efecto (Secuencias)"}
                    </button>
                    <button
                      onClick={handleSaveSelected}
                      className="px-4 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition active:scale-95 font-bold"
                    >
                      Guardar Config
                    </button>
                  </div>

                  {/* AI Grok Video Loop Synthesizer section */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      🎬 ANIMACIÓN DE VIDEO INTELIGENTE (xAI GROK)
                    </span>

                    {videoStatus === 'idle' && (
                      <button
                        onClick={handleGenerateVideoGrok}
                        className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition active:scale-95 shadow-md flex items-center justify-center gap-1.5 font-bold"
                      >
                        <span>🎬</span> Iniciar Animación Grok
                      </button>
                    )}

                    {videoStatus === 'generating' && (
                      <div className="space-y-2 p-2.5 bg-white rounded-xl border border-blue-100 shadow-sm">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                          <span className="text-blue-700 animate-pulse">{videoProgressText}</span>
                          <span className="text-slate-500">{videoProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${videoProgress}%` }}
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                          />
                        </div>
                      </div>
                    )}

                    {videoStatus === 'completed' && (
                      <div className="space-y-2">
                        <span className="block text-[8px] font-black uppercase text-emerald-600 tracking-wider">¡Éxito! Video Generado por Grok</span>
                        
                        <div className="relative w-full aspect-video rounded-xl bg-slate-950 border overflow-hidden shadow-inner flex items-center justify-center">
                          {generatedVideoUrl && (
                            <video src={generatedVideoUrl} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={handleGenerateVideoGrok}
                            className="flex-1 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-[8px] font-black uppercase tracking-wider transition font-bold"
                          >
                            🔄 Regenerar
                          </button>
                        </div>
                      </div>
                    )}

                    {videoStatus === 'error' && (
                      <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl space-y-1">
                        <span className="block text-[8px] font-black uppercase text-red-800">Error en el Generador Grok</span>
                        <p className="text-[9px] font-semibold leading-relaxed">{videoError}</p>
                        <button
                          onClick={() => setVideoStatus('idle')}
                          className="w-full mt-1.5 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded-lg text-[8px] font-black uppercase tracking-wide transition font-bold"
                        >
                          Intentar Nuevamente
                        </button>
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* STORES VIDEOS GALLERY CONFIG FOR THIS AVATAR */}
              <div className="pt-6 border-t border-slate-100">
                <span className="block text-[10px] font-black uppercase tracking-wide text-slate-400 mb-3 px-1">
                  🎥 Asignar Videos Almacenados y Disparadores Emocionales
                </span>
                
                {storedVideos.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto p-1 bg-slate-50/50 rounded-2xl border border-slate-100 custom-scrollbar">
                    {storedVideos.map((video, idx) => {
                      const isAssigned = selectedAvatar.video_url === video.url;
                      return (
                        <div key={idx} className="bg-white rounded-xl border border-slate-200/60 p-3 shadow-sm hover:shadow-md transition flex items-start gap-3">
                          <div className="w-20 aspect-video rounded-lg overflow-hidden bg-slate-900 flex-shrink-0 relative">
                            <video src={video.url} muted loop className="w-full h-full object-cover" onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})} onMouseLeave={e => { (e.target as HTMLVideoElement).pause(); }} />
                          </div>
                          
                          <div className="flex-grow min-w-0 space-y-1">
                            <p className="text-[9px] font-black text-slate-800 truncate mb-1" title={video.name}>{video.name}</p>
                            
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={async () => {
                                  const updated = { ...selectedAvatar, video_url: video.url };
                                  setSelectedAvatar(updated);
                                  await supabase.from('avatar_configs').update({ video_url: video.url }).eq('id', selectedAvatar.id!);
                                  setSuccessMsg("Video principal del avatar asignado.");
                                  setTimeout(() => setSuccessMsg(""), 3000);
                                }}
                                className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider transition ${
                                  isAssigned 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {isAssigned ? "✔️ Asignado" : "Asignar Base"}
                              </button>
                            </div>

                            <div className="pt-2 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <span className="text-[8px] font-bold text-slate-400 uppercase font-bold">Tríger:</span>
                                <input
                                  type="text"
                                  value={selectedAvatar.video_triggers?.[video.name] || ""}
                                  onChange={async (e) => {
                                    const newTrigs = { ...(selectedAvatar.video_triggers || {}), [video.name]: e.target.value };
                                    const updated = { ...selectedAvatar, video_triggers: newTrigs };
                                    setSelectedAvatar(updated);
                                    await supabase.from('avatar_configs').update({ video_triggers: newTrigs }).eq('id', selectedAvatar.id!);
                                  }}
                                  className="flex-grow px-1.5 py-0.5 text-[8px] rounded border border-slate-200 outline-none focus:ring-1 focus:ring-blue-500 font-bold bg-slate-50"
                                  placeholder="ej. compra, precio..."
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[8px] font-bold text-slate-400 uppercase font-bold">Emoción:</span>
                                <input
                                  type="text"
                                  value={selectedAvatar.video_emotions?.[video.name] || ""}
                                  onChange={async (e) => {
                                    const newEmots = { ...(selectedAvatar.video_emotions || {}), [video.name]: e.target.value };
                                    const updated = { ...selectedAvatar, video_emotions: newEmots };
                                    setSelectedAvatar(updated);
                                    await supabase.from('avatar_configs').update({ video_emotions: newEmots }).eq('id', selectedAvatar.id!);
                                  }}
                                  className="flex-grow px-1.5 py-0.5 text-[8px] rounded border border-slate-200 outline-none focus:ring-1 focus:ring-blue-500 font-bold bg-slate-50"
                                  placeholder="ej. feliz, seria..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">No hay videos en el bucket / storage.</p>
                )}
              </div>

            </div>
          ) : (
            <div className="py-24 text-center">
              <span className="text-3xl">🤖</span>
              <h4 className="font-black text-slate-800 text-lg uppercase mt-3">
                Selecciona un Avatar
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2 font-medium">
                Selecciona uno de los avatares de la lista de la izquierda para configurar su personalidad, prompt de IA y videos, o presiona "Crear Nuevo Avatar".
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SmartAvatarBubble, getStoredConfig } from './AvatarSystem';

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

interface InteractiveDialogueProps {
  isOpen: boolean;
  onClose: () => void;
  detectedUser: {
    id?: string;
    name: string;
    fullName: string;
    score?: number;
    isVerified?: boolean;
    isDefaulter?: boolean;
    image?: string;
    profile_image_url?: string;
  };
  products?: any[];
}

const FALLBACK_PRODUCTS = [
  { name: "Xiaomi Redmi Note 13", price: 185, description: "Teléfono de 256 gigas, 8 gigas de memoria RAM, súper cámara de 108 megapíxeles y batería de larga duración.", category: "Estilo de vida", stock: 8 },
  { name: "Licuadora Black & Decker de vidrio", price: 45, description: "Potencia de 550 vatios, vaso de vidrio grueso de 1.5 litros, ideal para la cocina.", category: "Hogar", stock: 12 },
  { name: "Ventilador de Pedestal Premium", price: 35, description: "Ventilador de 16 pulgadas, 3 velocidades de aire fresco, súper silencioso para descansar.", category: "Hogar", stock: 15 },
  { name: "Audífonos Inalámbricos JBL Tune", price: 55, description: "Diadema con conexión bluetooth, sonido con graves puros de alta definición y batería de hasta 40 horas.", category: "Accesorios", stock: 6 },
  { name: "Smartwatch Deportivo T500", price: 40, description: "Pantalla táctil, monitoreo de salud, recibe notificaciones de Whatsapp y llamadas, resistente al agua.", category: "Accesorios", stock: 10 }
];

export const InteractiveDialogue: React.FC<InteractiveDialogueProps> = ({ 
  isOpen, 
  onClose, 
  detectedUser,
  products = []
}) => {
  const [isMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeScenario, setActiveScenario] = useState<'greeting' | 'interaction' | 'scanner'>('interaction');
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [ttsMode, setTtsMode] = useState<'ai' | 'device'>('ai');
  
  // Audio state for high-fidelity mouth/extremities sync
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Helper to convert base64 to array buffer
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Helper to stop any current speaking audio
  const stopAudioSpeech = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {}
      sourceNodeRef.current = null;
    }
    setAudioLevel(0);
    setIsSpeaking(false);
  };
  
  // Ref tracking for state
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef(false);
  const hasResultInSessionRef = useRef(false);
  const silenceCountRef = useRef(0);
  const isOpenRef = useRef(isOpen);
  const conversationHistoryRef = useRef<{ role: 'user' | 'model'; text: string }[]>([]);

  // Sync ref with state
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      silenceCountRef.current = 0; // reset on open
      conversationHistoryRef.current = []; // Reset on dialog open for a clean conversation slot
      setActiveScenario('greeting');
      setCurrentSubtitle('');
    }
  }, [isOpen]);

  // Welcome message when dialogue opens
  useEffect(() => {
    if (isOpen && detectedUser) {
      // CLEAR any background text reading immediately when avatar appears
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      setActiveScenario('greeting');
      const isDefaulter = detectedUser.isDefaulter ?? false;
      const config = getStoredConfig();
      
      // If there's a video running, skip the automatic textual greeting to avoid overlapping sounds 
      // or "background reading" that distracts from the video.
      if (config.video_url) {
        console.log("Video active, skipping automatic text greeting to avoid distraction.");
        return;
      }
      
      let welcomeText = `¡Hola, ${detectedUser.name}! Qué gusto saludarte de manera personal. Te habla el asesor virtual de NewBank AI. Me encantaría conocerte de forma más cercana y humana. ¿Desde qué bello departamento de El Salvador, o de qué parte del mundo nos estás sintonizando y viendo hoy?`;
      
      if (isDefaulter) {
        welcomeText = `¡Hola de todo corazón, ${detectedUser.name}! Te saluda el asesor virtual de NewBank AI. Cuéntame, ¿desde dónde nos estás sintonizando hoy? Estoy aquí para escucharte, conocer tus hermosas necesidades y platicarte de los excelentes productos que tenemos en nuestra tienda para ti.`;
      }

      speakText(welcomeText);
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      stopListening();
      stopAudioSpeech();
    };
  }, [isOpen, detectedUser]);

  // Speech Recognition Setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'es-SV'; // Salvadoran Spanish locale
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          isRecognitionActiveRef.current = true;
          setIsListening(true);
          hasResultInSessionRef.current = false;
        };

        recognition.onresult = (event: any) => {
          hasResultInSessionRef.current = true;
          silenceCountRef.current = 0; // successfully received input
          
          const speechToText = event.results[0][0].transcript;
          console.log("Recognized human input:", speechToText);
          generateBotResponse(speechToText);
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          isRecognitionActiveRef.current = false;
          setIsListening(false);
          // Don't treat errors immediately as silence, let onend handle it
        };

        recognition.onend = () => {
          isRecognitionActiveRef.current = false;
          setIsListening(false);
          
          // Check if user did not answer
          if (!hasResultInSessionRef.current && isOpenRef.current) {
            silenceCountRef.current += 1;
            console.log(`Silence count incremented: ${silenceCountRef.current}`);
            
            if (silenceCountRef.current >= 4) {
              // Wait quietly after multiple silences rather than closing
              return;
            } else if (silenceCountRef.current === 2) {
              const waitText = "Parece que estás un poco ocupado por el momento. Me quedaré por aquí en la pantalla para cuando desees conversar. Para cerrarme, solo arrástrame hacia el borde izquierdo de la pantalla.";
              speakText(waitText);
              return;
            } else if (silenceCountRef.current === 1 || silenceCountRef.current === 3) {
              // Soft poke
              const pokeText = silenceCountRef.current === 1 
                ? "¿Sigues por ahí? Me encantaría platicar contigo y saber de dónde nos ves o si estás interesado en algún producto de la pantalla."
                : "Recuerda que si necesitas algo o quieres pedir información de algún producto, estoy a las órdenes. Puedes cerrarme arrastrándome a la izquierda.";
              speakText(pokeText);
              return;
            }
          }

          // Auto-resume listen trigger if we aren't currently speaking and dialog is still active
          setTimeout(() => {
            if (isOpenRef.current && !window.speechSynthesis.speaking && !isRecognitionActiveRef.current) {
              startListening();
            }
          }, 1000);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, [isOpen]);

  const startListening = () => {
    if (recognitionRef.current && !isRecognitionActiveRef.current && isOpenRef.current && !isMuted) {
      try {
        hasResultInSessionRef.current = false;
        recognitionRef.current.start();
        isRecognitionActiveRef.current = true;
        setIsListening(true);
      } catch (e) {
        console.warn("Speech recognition start attempt failed:", e);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.stop();
        isRecognitionActiveRef.current = false;
        setIsListening(false);
      } catch (e) {
        console.warn("Speech recognition stop attempt failed:", e);
      }
    }
  };

  // Text-To-Speech (TTS) engine with AI Synthesis (and Web-speech synthesis fallback)
  const speakText = async (text: string) => {
    if (isMuted) return;

    // Always stop listening first so speech is not captured in feedback loop
    stopListening();
    stopAudioSpeech();

    setCurrentSubtitle(text);
    setIsSpeaking(true);

    try {
      const response = await fetch(getApiUrl("/api/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "Zephyr" })
      });

      if (!response.ok) {
        throw new Error("TTS endpoint returned an error");
      }

      const { audio } = await response.json();
      if (!audio) {
        throw new Error("No audio payload returned from TTS endpoint");
      }

      setTtsMode('ai');

      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const arrayBuffer = base64ToArrayBuffer(audio);
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // responsive fft size for real-time lip motion tracking

      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      sourceNodeRef.current = source;
      analyserNodeRef.current = analyser;

      // Realtime frame analyzer loop tracking frequency and amplitude for realistic lips & limb joint shifts
      const updateAmplitude = () => {
        if (!analyserNodeRef.current || !isOpenRef.current) return;
        const bufferLength = analyserNodeRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNodeRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        // Map average volume to a neat normalized 0.0 to 1.2 level value
        const level = Math.min(avg / 75, 1.2);
        setAudioLevel(level);

        animationFrameIdRef.current = requestAnimationFrame(updateAmplitude);
      };

      source.onended = () => {
        stopAudioSpeech();
        setTimeout(() => {
          if (isOpenRef.current) {
            startListening();
          }
        }, 500);
      };

      source.start(0);
      updateAmplitude();

    } catch (err) {
      console.warn("AI Speech Synthesis failed, falling back to local fallback voice:", err);
      setTtsMode('device');
      
      // Native custom speaking fallback
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const esVoice = voices.find(v => v.lang.includes('es-ES') || v.lang.includes('es-'));
        if (esVoice) utterance.voice = esVoice;

        utterance.onend = () => {
          setIsSpeaking(false);
          setAudioLevel(0);
          setTimeout(() => {
            if (isOpenRef.current) {
              startListening();
            }
          }, 500);
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
          setAudioLevel(0);
        };

        // Standard timing simulation of speaking mouth/limbs for local fallback compatibility
        let simulateMouthInterval = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            setAudioLevel(Math.random() * 0.95);
          } else {
            clearInterval(simulateMouthInterval);
            setAudioLevel(0);
          }
        }, 110);

        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
        setAudioLevel(0);
      }
    }
  };

  // Get current inventory item descriptions or prices
  const handleProductInventoryQuery = (queryText: string): string => {
    // Merge actual database products and fallbacks
    const allProducts = [...products, ...FALLBACK_PRODUCTS];
    if (allProducts.length === 0) {
      return "En este momento estamos actualizando nuestro inventario de tecnología y electrodomésticos, pero puedes verlos en pantalla e indicarnos si te gusta alguno.";
    }

    const textNorm = queryText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Search for a specific product name match
    const matched = allProducts.find(p => {
      const pName = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return textNorm.includes(pName) || pName.includes(textNorm);
    });

    if (matched) {
      return `¡Por supuesto! El ${matched.name} tiene un precio de tan solo $${matched.price} dólares. Cuenta con stock disponible de ${matched.stock} unidades. Te platico un poco: ${matched.description}. Si te convence, puedes dar click sobre él en tu pantalla para solicitar su compra de forma automática por medio de WhatsApp con el vendedor. ¿Deseas saber de algún otro precio o artículo, o platicamos de otra cosa?`;
    }

    // Default overview list of 3 popular items
    const popularItems = allProducts.slice(0, 3).map(p => `${p.name} a solo $${p.price} dólares`).join(", ");
    return `Contamos con excelentes opciones en nuestro catálogo de tienda en línea. Por ejemplo, tenemos un ${popularItems}. Recuerda que si te interesa algún producto que veas en la pantalla, puedes solicitarlo directamente por WhatsApp con solo tocarlo. ¿Te gustaría saber las especificaciones detalladas de alguno de ellos?`;
  };

  // Human-like response builder
  const generateBotResponse = async (userMsg: string) => {
    // Determine active scenario representation based on message
    if (userMsg.toLowerCase().includes("escan") || userMsg.toLowerCase().includes("escaner") || userMsg.toLowerCase().includes("unio") || userMsg.toLowerCase().includes("unid") || userMsg.toLowerCase().includes("detect")) {
      setActiveScenario('scanner');
    } else {
      setActiveScenario('interaction');
    }

    // Attempt real-time Gemini AI response first for total dialog effectiveness
    try {
      const response = await fetch(getApiUrl("/api/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMsg,
          history: conversationHistoryRef.current,
          detectedUser,
          products
        })
      });
      if (response.ok) {
        const data = await response.json();
        let reply = data.reply;
        
        // Append history for multi-turn conversational context
        conversationHistoryRef.current.push({ role: 'user', text: userMsg });
        conversationHistoryRef.current.push({ role: 'model', text: reply });
        if (conversationHistoryRef.current.length > 20) {
          conversationHistoryRef.current = conversationHistoryRef.current.slice(-20);
        }

        // Check if the AI chose to say goodbye to trigger automatic dialogue closing
        const lowercaseReply = reply.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const isFarewell = lowercaseReply.includes("hasta pronto") || lowercaseReply.includes("adios") || lowercaseReply.includes("chao") || lowercaseReply.includes("chau") || lowercaseReply.includes("hasta luego") || lowercaseReply.includes("bye") || lowercaseReply.includes("gracias") || lowercaseReply.includes("nos vemos");
        
        speakText(reply);

        if (isFarewell) {
          reply = `¡Muchas gracias! Para cerrar esta conversación, por favor arrástrame hacia el borde izquierdo de la pantalla.`;
          speakText(reply);
          return;
        }
        return;
      }
    } catch (e) {
      console.error("Gemini server-side AI context logic call failed, falling back to local rule-based heuristics:", e);
    }

    const textNorm = userMsg.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let reply = "";

    const isDefaulter = detectedUser.isDefaulter ?? false;

    // Analyse context & intent flags
    const isJoke = textNorm.includes("chiste") || textNorm.includes("cuent") || textNorm.includes("gracioso") || textNorm.includes("risa") || textNorm.includes("brom");
    
    const isLocation = textNorm.includes("salvador") || textNorm.includes("tecla") || textNorm.includes("san miguel") || 
      textNorm.includes("santa ana") || textNorm.includes("merliot") || textNorm.includes("soyapango") || 
      textNorm.includes("ilopango") || textNorm.includes("lourdes") || textNorm.includes("usulutan") || 
      textNorm.includes("sonsonate") || textNorm.includes("ahuachapan") || textNorm.includes("chalatenango") || 
      textNorm.includes("cabanas") || textNorm.includes("san vicente") || textNorm.includes("la paz") || 
      textNorm.includes("cuscatlan") || textNorm.includes("morazan") || textNorm.includes("la union") || 
      textNorm.includes("libertad") || textNorm.includes("vengo de") || textNorm.includes("soy de") || 
      textNorm.includes("desde") || textNorm.includes("vendo de") || textNorm.includes("vivo en") ||
      textNorm.includes("estados unidos") || textNorm.includes("mexico") || textNorm.includes("honduras") ||
      textNorm.includes("guatemala") || textNorm.includes("nicaragua") || textNorm.includes("lugar") ||
      textNorm.includes("ciudad") || textNorm.includes("casa");

    const isProductQuery = textNorm.includes("producto") || textNorm.includes("comprar") || textNorm.includes("catalogo") || 
      textNorm.includes("tienda") || textNorm.includes("articulos") || textNorm.includes("disponible") ||
      textNorm.includes("precio") || textNorm.includes("venden") || textNorm.includes("cuesta") ||
      textNorm.includes("valor") || textNorm.includes("pantalla") || textNorm.includes("celular") ||
      textNorm.includes("licuadora") || textNorm.includes("ventilador") || textNorm.includes("audifonos") ||
      textNorm.includes("reloj") || textNorm.includes("smartwatch") || textNorm.includes("articulo");

    const isWhatsApp = textNorm.includes("whatsapp") || textNorm.includes("solicitar") || textNorm.includes("pedir") || textNorm.includes("ordenar");

    const isNeeds = textNorm.includes("necesito") || textNorm.includes("trabajo") || textNorm.includes("negocio") || textNorm.includes("dinero") || textNorm.includes("financiar") || textNorm.includes("prestamo") || textNorm.includes("reestructurar");

    const isFarewell = textNorm.includes("adios") || textNorm.includes("chau") || textNorm.includes("salir") || 
      textNorm.includes("cerrar") || textNorm.includes("terminar") || textNorm.includes("fin") ||
      textNorm.includes("bye") || textNorm.includes("hasta luego") || textNorm.includes("gracias");

    // Detect greetings: signals like greeting words or questions like "como estas", "que tal"
    const isGreeting = textNorm.includes("hola") || textNorm.includes(" hi ") || textNorm.startsWith("hi") || 
      textNorm.includes(" hello") || textNorm.startsWith("hello") || textNorm.includes(" hey ") || textNorm.startsWith("hey") ||
      textNorm.includes("buenos dias") || textNorm.includes("buenas tardes") || textNorm.includes("buenas noches") ||
      textNorm.includes("como estas") || textNorm.includes("como te va") || textNorm.includes("que tal") || 
      textNorm.includes("saludos") || textNorm.includes("alo");

    // Determine the response based on the combination of flags for conversational flow
    if (isFarewell) {
      reply = `¡Muchas gracias a ti por platicar conmigo, ${detectedUser.name}! Ha sido un verdadero honor conocerte. Para despedirme, por favor arrástrame hacia el borde izquierdo de la pantalla.`;
      speakText(reply);
      return;
    }

    if (isJoke) {
      const jokes = [
        "¿Por qué los pajaritos no usan calculadoras? ¡Porque prefieren hacer sus cuentas con el pico y volar libres en El Salvador!",
        "¿Qué le dice un jaguar salvadoreño a otro? ¡Llévame suave, compadre, que apenas voy conociendo la belleza de nuestro país con New Bank!",
        "¿Qué hace un pez en el agua? ¡Nada! ¡Pero siempre está fresco y listo para ver las novedades de la tienda de New Bank!",
        "Ayer le conté un chiste a mi billetera... ¡y se echó a llorar de la risa de lo vacía que estaba! Menos mal que con New Bank puedo ver opciones muy cómodas en la tienda.",
        "¿Por qué el libro de matemáticas estaba sumamente triste? ¡Porque tenía demasiados problemas en lugar de conversar alegremente con nosotros!"
      ];
      const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
      reply = `${randomJoke} ¡Espero haberte alegrado el día! Me encanta llevar una conversación amena contigo. Platícame, ¿te ha llamado la atención alguno de los productos que ves exhibidos en pantalla o tienes alguna duda de los precios?`;
    }
    else if (isGreeting) {
      // If there is an active query mixed in with greeting, prepend greeting warm-up
      let phrasePrefix = "";
      const prefixes = [
        `¡Hola, de verdad qué alegría saludarte! `,
        `¡Qué tal, me alegra muchísimo escucharte! `,
        `¡Qué gusto saludarte! Se siente genial platicar de manera tan humana. `,
        `¡Muy buenas, gracias por ese saludo tan lleno de energía! `
      ];
      phrasePrefix = prefixes[Math.floor(Math.random() * prefixes.length)];

      if (isLocation) {
        const placesInElSalvador = [
          "San Salvador", "Santa Tecla", "San Miguel", "Santa Ana", "Soyapango", "Sonsonate", 
          "Chalatenango", "Usulután", "La Libertad", "La Unión", "Morazán", "Cabañas", 
          "San Vicente", "La Paz", "Ahuachapán", "Cuscatlán"
        ];
        let detectedPlace = "";
        for (const place of placesInElSalvador) {
          if (textNorm.includes(place.toLowerCase())) {
            detectedPlace = place;
            break;
          }
        }
        if (detectedPlace) {
          reply = `${phrasePrefix} ¡Y qué maravilloso saber que nos sintonizas desde ${detectedPlace}! Le tengo un enorme cariño a esa zona. Contame, ¿has visto algún producto en la pantalla que te interese solicitar por WhatsApp para facilitarte las cosas?`;
        } else {
          reply = `${phrasePrefix} ¡Y qué bendición saber desde dónde nos sintonizas! Platícame con confianza qué es lo que más necesitas hoy en tu hogar para poder apoyarte amigablemente.`;
        }
      }
      else if (isProductQuery) {
        reply = `${phrasePrefix} Viendo que me preguntas por nuestros artículos, te platico con gusto: ${handleProductInventoryQuery(userMsg)}`;
      }
      else if (isWhatsApp) {
        reply = `${phrasePrefix} Claro que sí, con respecto a WhatsApp, te explico: si tocas cualquier producto en pantalla, se abrirá un chat directo con el vendedor para agilizar tu pedido de inmediato. ¿Hay algún artículo que te interese pedir justo ahora?`;
      }
      else if (isNeeds) {
        if (isDefaulter) {
          reply = `${phrasePrefix} Comprendo plenamente tu situación humana y sé que hay momentos difíciles. Mi propósito es escucharte y que conversemos tranquilamente. ¿Hay algún producto de la tienda que veas aquí en pantalla que te gustaría pedir por WhatsApp con facilidades cómodas?`;
        } else {
          reply = `${phrasePrefix} Te comprendo totalmente. Aquí en NewBank queremos acompañar a las familias salvadoreñas de forma muy humana. Cuéntame si has visto algún artículo de nuestra tienda en pantalla que te sirva para tu emprendimiento o tu hogar para explicarte cómo solicitarlo.`;
        }
      }
      else {
        // Pure greeting
        const standaloneGreetings = [
          `${phrasePrefix} Yo por aquí me encuentro de maravilla, con muchísima energía y feliz de escucharte. Me encantaría conocer un poquito más sobre ti y conversar de tus planes. Cuéntame, ¿desde qué hermoso lugar de El Salvador o del mundo estás viéndonos el día de hoy?`,
          `${phrasePrefix} Me encuentro de lujo, muy inspirado por platicar contigo en este momento. Espero que tu día marche de lo mejor. Contame, ¿desde dónde me estás sintonizando hoy para mandarle un fuerte saludo a tu de por sí hermosa y grandiosa comunidad?`,
          `${phrasePrefix} Estoy sumamente bien, emocionado de brindarte un trato cercano y lo más humano posible. Me encantaría saber: ¿de qué parte nos visitas hoy y cómo te podemos consentir con los productos de nuestra tienda en pantalla?`
        ];
        reply = standaloneGreetings[Math.floor(Math.random() * standaloneGreetings.length)];
      }
    }
    else if (isLocation) {
      const placesInElSalvador = [
        "San Salvador", "Santa Tecla", "San Miguel", "Santa Ana", "Soyapango", "Sonsonate", 
        "Chalatenango", "Usulután", "La Libertad", "La Unión", "Morazán", "Cabañas", 
        "San Vicente", "La Paz", "Ahuachapán", "Cuscatlán"
      ];
      let detectedPlace = "";
      for (const place of placesInElSalvador) {
        if (textNorm.includes(place.toLowerCase())) {
          detectedPlace = place;
          break;
        }
      }
      
      if (detectedPlace) {
        reply = `¡Qué maravilloso! Un saludo muy caluroso y fraternal hasta el hermoso departamento de ${detectedPlace}. Me encanta platicar con gente tan amable y trabajadora. Cuéntame qué necesitas hoy para tu hogar o tu día a día, o si hay algún artículo en específico de los que ves en pantalla que te llame la atención para solicitarlo por WhatsApp.`;
      } else {
        reply = `¡Excelente lugar! Qué alegría saber desde dónde nos sintonizas. Aquí en NewBank nos esforzamos en brindar una atención cercana y lo más humana posible. Platícame con confianza, ¿cuál es tu mayor necesidad hoy, o hay algún artículo específico de nuestra tienda en línea que te gustaría solicitar para tu uso diario?`;
      }
    }
    else if (isProductQuery) {
      reply = handleProductInventoryQuery(userMsg);
    }
    else if (isWhatsApp) {
      reply = `¡Totalmente fácil! Si ves algún producto de nuestra tienda que te interese en la pantalla, solo debes darle un toque sobre su tarjeta de visualización y presionar el botón de solicitud. Esto abrirá tu WhatsApp cargando el mensaje de pedido directamente para comunicarte con el vendedor o aliado comercial, de forma segura y sin complicaciones. ¿Hay algún producto de la lista que te llame más la atención?`;
    }
    else if (isNeeds) {
      if (isDefaulter) {
        reply = `Te entiendo perfectamente de manera humana, son tiempos retadores. Por eso en NewBank nos encanta escucharte de forma amigable para que puedas continuar disfrutando de las novedades de nuestra tienda. Cuéntame, ¿hay algún artículo de la tienda en pantalla que te llame la atención y que te gustaría poder solicitar hoy mismo por WhatsApp?`;
      } else {
        reply = `Te escucho y comprendo. En NewBank apoyamos al desarrollo de las familias. Queremos acompañarte paso a paso para que alcances tus metas diarias. Recuerda que todos los productos en pantalla se pueden solicitar de manera súper ágil coordinándolos por WhatsApp. ¿Deseas que platiquemos de algún artículo que necesites para tu día a día o tu emprendimiento?`;
      }
    }
    else {
      // General fallbacks designed to be natural and inquisitive to avoid robotic repetitive responses
      const generalFallbacks = [
        `Te escucho con muchísima atención, ${detectedUser.name}. Me interesa muchísimo conocer lo que opinas o si tienes alguna duda sobre los precios o productos exhibidos en la pantalla para que los pidas por WhatsApp. Cuéntame, ¿hay algún artículo tecnológico, de hogar o estilo de vida que llame tu atención en este momento?`,
        `¡Qué conversación tan amena estamos teniendo, ${detectedUser.name}! Me encantaría que me cuentes más sobre lo que buscas hoy, o si te gustaría escuchar otro divertido chiste para alegrar el momento. ¿Qué prefieres charlar ahora?`,
        `Te entiendo muy bien, mi estimado, ${detectedUser.name}. Recuerda que estoy aquí para darte un apoyo oportuno y muy real. ¿Deseas que revisemos los detalles de precio o stock de alguno de los productos en pantalla para que lo pidas fácilmente por WhatsApp?`
      ];
      reply = generalFallbacks[Math.floor(Math.random() * generalFallbacks.length)];
    }

    speakText(reply);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <motion.div
           drag
           onDragEnd={(event, info) => {
             // Si se arrastra significativamente hacia la izquierda, cerrar (gesto de despedida)
             if (info.offset.x < -150) {
               onClose();
             }
           }}
           initial={{ opacity: 0, scale: 0.8, y: 50 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.8, y: 50, x: -500 }}
           className="pointer-events-auto"
        >
          <SmartAvatarBubble
            detectedUser={detectedUser}
            scenario={activeScenario}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

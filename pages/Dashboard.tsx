import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import html2canvas from 'html2canvas';
import { CameraTextScanner } from '../components/CameraTextScanner';
import { InteractiveDialogue } from '../components/InteractiveDialogue';
import { AdminAvatarPanel, getStoredConfig, saveStoredConfig, SmartAvatarBubble } from '../components/AvatarSystem';

const extractWompiUrl = (input: string) => {
  if (!input) return '';
  // Si es el código del widget de Wompi, extraemos la URL
  if (input.includes('data-url-pago="')) {
    const match = input.match(/data-url-pago="([^"]+)"/);
    return match ? match[1] : input;
  }
  return input;
};

const ProductCarousel = ({ images, name }: { images: string[], name: string }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const validImages = images?.filter(Boolean) || [];

  useEffect(() => {
    if (validImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % validImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [validImages.length]);

  return (
    <div className="relative w-full h-full">
      <img 
        src={validImages[currentIndex] || 'https://picsum.photos/seed/product/800/800'} 
        alt={name}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        referrerPolicy="no-referrer"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = 'https://picsum.photos/seed/product/800/800';
        }}
      />
      {validImages.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {validImages.map((_, i) => (
            <div 
              key={i} 
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white w-3' : 'bg-white/50'}`}
            ></div>
          ))}
        </div>
      )}
    </div>
  );
};

interface Node {
  id: string;
  name: string;
  fullName: string;
  image: string | null;
  score: number;
  isDefaulter: boolean;
  isVerified: boolean;
  x: number;
  y: number;
}

interface Comment {
  id: string;
  author_name: string;
  content: string;
  reply_content: string | null;
  created_at: string;
}

const ProductBanner = ({ products }: { products: any[] }) => {
  const productImages = (products || [])
    .filter(p => p && (p.image_url || (p.image_urls && p.image_urls[0])))
    .map(p => p.image_url || p.image_urls[0]);
  
  // Si no hay productos, usamos imágenes de muestra para que el usuario siempre vea el banner
  const images = productImages.length > 0 ? productImages : [
    'https://picsum.photos/seed/tactical1/800/800',
    'https://picsum.photos/seed/tactical2/800/800',
    'https://picsum.photos/seed/tactical3/800/800',
    'https://picsum.photos/seed/tactical4/800/800',
    'https://picsum.photos/seed/tactical5/800/800'
  ];

  // Creamos una lista larga para el efecto de scroll infinito suave
  const displayImages = [...images, ...images, ...images, ...images, ...images];

  return (
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center z-0 overflow-hidden pointer-events-none select-none h-[400px]">
      <motion.div 
        animate={{ x: [0, -1500] }}
        transition={{ 
          duration: 35, 
          repeat: Infinity, 
          ease: "linear" 
        }}
        className="flex gap-4 sm:gap-8 px-10 items-center h-full"
      >
        {displayImages.map((src, i) => (
          <div 
            key={i} 
            className="w-44 h-60 sm:w-64 sm:h-80 bg-white rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.08)] flex-shrink-0 overflow-hidden border border-slate-200/50 backdrop-blur-md relative transform scale-90 sm:scale-100"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-50/20 to-transparent" />
            <img 
              src={src} 
              alt="" 
              className="w-full h-full object-cover opacity-95 mix-blend-multiply"
              referrerPolicy="no-referrer"
            />
            {/* Soft highlight over the image */}
            <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-[3rem]" />
          </div>
        ))}
      </motion.div>
      
      {/* Máscara de desvanecimiento más intensa para integrar con el fondo neutro */}
      <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-slate-50 via-slate-50/80 to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-slate-50 via-slate-50/80 to-transparent z-10" />
    </div>
  );
};

const Dashboard: React.FC<{ user: any }> = ({ user }) => {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [isPosting, setIsPosting] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todo');
  const [showLoginBanner, setShowLoginBanner] = useState(false);
  const [showHelpBanner, setShowHelpBanner] = useState(false);
  const [showSectionInfo, setShowSectionInfo] = useState(true);
  const [isAdminButtonHidden, setIsAdminButtonHidden] = useState(false);
  const [showWompi, setShowWompi] = useState(() => {
    const saved = localStorage.getItem('newbank_show_wompi');
    return saved === null ? true : saved === 'true';
  });
  const [showTextScanner, setShowTextScanner] = useState(false);
  const [detectedName, setDetectedName] = useState<string | undefined>(undefined);
  const [activeDialogueUser, setActiveDialogueUser] = useState<any>(null);
  const lastTriggerTimeRef = useRef<number>(Date.now());
  const [lastScannedText, setLastScannedText] = useState("");
  const [showGreetingIndicator, setShowGreetingIndicator] = useState(false);
  const [avatarConfig, setAvatarConfig] = useState(getStoredConfig());
  const avatarControls = useAnimation();
  const [isAvatarCollapsed, setIsAvatarCollapsed] = useState(false);

  useEffect(() => {
    const handleSync = () => setAvatarConfig(getStoredConfig());
    window.addEventListener('avatar-config-updated', handleSync);
    return () => window.removeEventListener('avatar-config-updated', handleSync);
  }, []);

  const generateGreetingVideo = async (name: string) => {
    console.log("generateGreetingVideo called for:", name);
    
    // Check if greeting exists in DB (skip for 9999 to force regeneration)
    if (name !== "9999") {
      try {
        const resCheck = await fetch(`/api/greeting-video/${encodeURIComponent(name)}`);
        const dataCheck = await resCheck.json();
        console.log("Greeting check in DB result:", dataCheck);
        if (dataCheck.exists) {
          const url = dataCheck.video_url;
          const config = getStoredConfig();
          const newConfig = { ...config, video_url: url };
          saveStoredConfig(newConfig);
          window.dispatchEvent(new Event('avatar-config-updated'));
          return;
        }
      } catch (e) {
        console.error("Error checking greeting video:", e);
      }
    }

    setShowGreetingIndicator(true); // Signal to AvatarSystem to show indicator
    localStorage.setItem('show_greeting_indicator', 'true');
    window.dispatchEvent(new Event('avatar-config-updated')); // Sync indicator state

    // Call the API endpoint directly
    console.log("Calling /api/video-start for:", name);
    const res = await fetch("/api/video-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        prompt: `Friendly greeting video for ${name} speaking in Spanish ("Hola ${name}, bienvenido a NewBank"), smiling, waving at camera, warm, professional, high definition.`
      })
    });
    const data = await res.json();
    console.log("API response from /api/video-start:", data);
    
    if (data.success) {
      const poll = async () => {
        console.log("Polling /api/video-status for id:", data.id);
        const sRes = await fetch(`/api/video-status/${data.id}?username=${encodeURIComponent(name)}`);
        const sData = await sRes.json();
        console.log("Poll status:", sData.status);
        if (sData.status === "completed") {
          const url = sData.video_url;
          setShowGreetingIndicator(false);
          localStorage.setItem('show_greeting_indicator', 'false');

          const config = getStoredConfig();
          const newConfig = { ...config, video_url: url };
          saveStoredConfig(newConfig);
          window.dispatchEvent(new Event('avatar-config-updated'));
        } else {
          setTimeout(poll, 3000);
        }
      };
      poll();
    } else {
      console.error("Failed to start video generation");
      setShowGreetingIndicator(false);
      localStorage.setItem('show_greeting_indicator', 'false');
    }
  };

  const handleUserDetected = (name: string) => {
    const matchedNode = nodes.find(node => {
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const scannedNorm = normalize(name);
      const nodeFullNorm = normalize(node.fullName);
      const nodeFirstNorm = normalize(node.name);
      return scannedNorm.includes(nodeFirstNorm) || nodeFullNorm.includes(scannedNorm) || scannedNorm.includes(nodeFullNorm);
    });

    if (matchedNode) {
      setActiveDialogueUser({
        id: matchedNode.id,
        name: matchedNode.name,
        fullName: matchedNode.fullName,
        score: matchedNode.score,
        isVerified: matchedNode.isVerified,
        isDefaulter: matchedNode.isDefaulter,
        image: matchedNode.image
      });
    } else {
      setActiveDialogueUser({
        name: name.trim().split(' ')[0],
        fullName: name,
        score: 150,
        isVerified: false,
        isDefaulter: false
      });
    }
    setDetectedName(undefined);
  };

  const generateEffectVideo = async (instructions: string) => {
    console.log("generateEffectVideo called for:", instructions);
    // Check if effect already exists in cache
    const existingEffects = JSON.parse(localStorage.getItem('effect_videos') || '{}');
    if (existingEffects[instructions]) {
      const url = existingEffects[instructions];
      const config = getStoredConfig();
      const newConfig = { ...config, video_url: url };
      saveStoredConfig(newConfig);
      window.dispatchEvent(new Event('avatar-config-updated'));
      return;
    }

    setShowGreetingIndicator(true);
    localStorage.setItem('show_greeting_indicator', 'true');
    window.dispatchEvent(new Event('avatar-config-updated'));

    const finalPrompt = `${instructions}. El personaje del video debe hablar, expresarse o gesticular únicamente en idioma español (Spanish).`;
    const res = await fetch("/api/video-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: finalPrompt })
    });
    const data = await res.json();
    
    if (data.success) {
      const poll = async () => {
        const sRes = await fetch(`/api/video-status/${data.id}?username=${encodeURIComponent("effect_" + instructions)}`);
        const sData = await sRes.json();
        if (sData.status === "completed") {
          const url = sData.video_url;
          setShowGreetingIndicator(false);
          localStorage.setItem('show_greeting_indicator', 'false');
          
          const newEffects = { ...existingEffects, [instructions]: url };
          localStorage.setItem('effect_videos', JSON.stringify(newEffects));

          const config = getStoredConfig();
          const newConfig = { ...config, video_url: url };
          saveStoredConfig(newConfig);
          window.dispatchEvent(new Event('avatar-config-updated'));
        } else {
          setTimeout(poll, 3000);
        }
      };
      poll();
    } else {
      setShowGreetingIndicator(false);
      localStorage.setItem('show_greeting_indicator', 'false');
    }
  };

  // Helper function to start an idle cycle
  const startIdleCycle = () => {
    const config = getStoredConfig();
    const idleVideos = config.is_tiktoker_mode_enabled
      ? Object.entries(config.video_settings || {})
      : Object.entries(config.video_settings || {})
          .filter(([_, settings]) => settings.is_idle === true);

    if (idleVideos.length > 0) {
      if (localStorage.getItem('show_greeting_indicator') === 'true') return;
      const currentVideoName = config.video_url?.split('/').pop() || "";
      
      // Try to pick a different video to prevent stalling if possible
      let eligibleVideos = idleVideos;
      if (idleVideos.length > 1) {
        eligibleVideos = idleVideos.filter(([name]) => name !== currentVideoName);
      }

      let selectedIdle = "";
      if (config.is_tiktoker_mode_enabled) {
        const pool: string[] = [];
        eligibleVideos.forEach(([name, settings]) => {
          const weight = settings.tiktoker_priority ? 5 : 1;
          for (let i = 0; i < weight; i++) pool.push(name);
        });
        selectedIdle = pool[Math.floor(Math.random() * pool.length)] || idleVideos[0][0]; // Fallback to first if pool empty
      } else {
        const idleNames = eligibleVideos.map(([name]) => name);
        selectedIdle = idleNames[Math.floor(Math.random() * idleNames.length)] || idleVideos[0][0]; // Fallback to first
      }

      console.log(`Starting idle cycle (${config.is_tiktoker_mode_enabled ? 'TikToker' : 'Normal'}): ${selectedIdle}`);
      const videoUrl = `https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankVideoAnimadoAvatar/${selectedIdle}`;
      
      // Force update by including timestamp or just forcing a config change
      const newConfig = { ...config, video_url: videoUrl };
      saveStoredConfig(newConfig);
      window.dispatchEvent(new Event('avatar-config-updated'));
      lastTriggerTimeRef.current = Date.now();
    }
  };

  // Handle sequential playback of idle videos or fallback for continuous interaction
  useEffect(() => {
    const handleVideoEnded = (e: any) => {
      // Always try to start idle cycle after a video ends, ensuring continuity
      startIdleCycle();
    };

    window.addEventListener('avatar-video-ended', handleVideoEnded);
    return () => window.removeEventListener('avatar-video-ended', handleVideoEnded);
  }, []);

  // Background idle check to start cycle if nothing happens for 15s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastTriggerTimeRef.current > 15000) {
        startIdleCycle();
        lastTriggerTimeRef.current = now;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('newbank_show_wompi');
      setShowWompi(saved === null ? true : saved === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const handleOpenDialogue = () => {
      setActiveDialogueUser({
        name: user?.full_name?.split(' ')[0] || 'Cliente',
        fullName: user?.full_name || 'Cliente Conectado Activo',
        score: user?.reliability_score || 100,
        isVerified: true,
        isDefaulter: false
      });
      startIdleCycle();
    };
    window.addEventListener('open-avatar-dialogue', handleOpenDialogue);
    return () => window.removeEventListener('open-avatar-dialogue', handleOpenDialogue);
  }, [user]);

  // Animation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [animatedIndices, setAnimatedIndices] = useState<number[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && products.length > 0) {
      const pickRandom = () => {
        const currentProducts = products.filter(product => {
          const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.description.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesCategory = categoryFilter === 'Todo' || product.category === categoryFilter;
          return matchesSearch && matchesCategory && product.stock > 0;
        });

        if (currentProducts.length === 0) {
          setAnimatedIndices([]);
          return;
        }

        const indices: number[] = [];
        const pool = Array.from({ length: currentProducts.length }, (_, i) => i);
        for (let i = 0; i < 4 && pool.length > 0; i++) {
          const randIndex = Math.floor(Math.random() * pool.length);
          indices.push(pool[randIndex]);
          pool.splice(randIndex, 1);
        }
        setAnimatedIndices(indices);
      };
      
      pickRandom();
      interval = setInterval(pickRandom, 3000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, products, searchQuery]);


  const handleDownloadAnimation = async () => {
    try {
      const displayMediaOptions = {
        video: { displaySurface: "browser" },
        audio: false
      };
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      
      setIsPlaying(false);
      setTimeout(() => setIsPlaying(true), 100);

      let mimeType = 'video/webm;codecs=vp9';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
          mimeType = 'video/mp4;codecs=avc1';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
      const chunks = [];
      
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `animacion-productos.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        setIsPlaying(false);
      };

      recorder.start();
      
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
          stream.getTracks().forEach(t => t.stop());
        }
      }, 9500);
      
    } catch (err: any) {
      console.log("Grabación cancelada o no soportada:", err);
      if (err?.message?.includes('permissions policy') || err?.name === 'NotAllowedError') {
        alert("¡Hola! Por seguridad del navegador en esta vista previa, la grabación de pantalla no está permitida directamente aquí.\n\n👉 Por favor haz clic en el botón 'Open in new tab' (Abrir en nueva pestaña) en la esquina superior derecha de esta pantalla y vuelve a intentarlo allí. ¡Funcionará sin problemas!");
      }
    }
  };

  useEffect(() => {
    if (!user) {
      const timer = setTimeout(() => setShowLoginBanner(true), 1000);
      const hideTimer = setTimeout(() => setShowLoginBanner(false), 6000);
      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => setShowHelpBanner(true), 2000);
    const hideTimer = setTimeout(() => setShowHelpBanner(false), 7000);
    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowSectionInfo(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const triggerBanner = () => {
    if (!user) {
      setShowLoginBanner(true);
      setTimeout(() => setShowLoginBanner(false), 5000);
    }
  };

  const triggerHelpBanner = () => {
    setShowHelpBanner(true);
    setTimeout(() => setShowHelpBanner(false), 5000);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'Todo' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleWhatsAppShare = async (product: any, qty: number) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const message = encodeURIComponent(`Hola, me interesa el producto: ${product.name} (Cantidad: ${qty})`);
    const waNumber = product.whatsapp_number || '50370914941';
    const whatsappUrl = `https://wa.me/${waNumber}?text=${message}`;

    if (isMobile) {
      window.open(whatsappUrl, '_blank');
      return;
    }

    try {
      const element = document.getElementById(`product-card-${product.id}`);
      if (element) {
        const canvas = await html2canvas(element, { useCORS: true, scale: 2 });
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              alert('¡Captura del producto copiada! Pégala en el chat de WhatsApp para enviarla.');
            } catch (err) {
              console.error('Error al copiar al portapapeles:', err);
            }
            const message = encodeURIComponent(`Hola, me interesa el producto: ${product.name} (Cantidad: ${qty})`);
            const waNumber = product.whatsapp_number || '50370914941';
            window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
          }
        }, 'image/png');
      }
    } catch (error) {
      console.error('Error capturando la imagen:', error);
      const message = encodeURIComponent(`Hola, me interesa el producto: ${product.name} (Cantidad: ${qty})`);
      const waNumber = product.whatsapp_number || '50370914941';
      window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
    }
  };

  useEffect(() => {
    const fetchTrustNetwork = async () => {
      setLoadingMap(true);
      try {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, profile_image_url, is_hidden, reliability_score, is_verified');
        const { data: loans } = await supabase.from('loans').select('user_id, status');

        if (profiles) {
          const visibleProfiles = profiles.filter(p => !p.is_hidden);
          const defaulterIds = new Set(loans?.filter(l => l.status === 'DEFAULTED').map(l => l.user_id) || []);

          const newNodes: Node[] = visibleProfiles.map((p, i) => {
            const angle = (i / visibleProfiles.length) * 2 * Math.PI;
            const radius = 200; // Fixed radius for stability
            return {
              id: p.id,
              name: p.full_name.split(' ')[0],
              fullName: p.full_name,
              image: p.profile_image_url,
              score: p.reliability_score || 0,
              isDefaulter: defaulterIds.has(p.id),
              isVerified: p.is_verified || false,
              x: 400 + radius * Math.cos(angle),
              y: 300 + radius * Math.sin(angle)
            };
          });

          setNodes(newNodes);
        }
      } catch (err) { console.error(err); }
      finally { setLoadingMap(false); }
    };

    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const { data } = await supabase
          .from('products')
          .select('*, creator:profiles!products_creator_id_fkey(free_shipping_departments)')
          .eq('is_visible', true)
          .order('created_at', { ascending: false });
        if (data) {
          setProducts(data);
          checkPromo(data);
        }
      } catch (err) { console.error(err); }
      finally { setLoadingProducts(false); }
    };

    fetchTrustNetwork(); 
    fetchComments();
    fetchProducts();
  }, []);

  // Inyectar schema de productos al DOM para SEO dinámico
  useEffect(() => {
    if (products.length > 0) {
      let script = document.getElementById('seo-dynamic-products-home') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = 'seo-dynamic-products-home';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      
      const schema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": products.map((p, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "item": {
            "@type": "Product",
            "url": `https://www.newbank.store/#/store?search=${encodeURIComponent(p.name)}`,
            "name": p.name,
            "image": p.image_url,
            "description": p.description || p.name,
            "offers": {
              "@type": "Offer",
              "priceCurrency": "USD",
              "price": p.price || 0,
              "availability": p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              "areaServed": "SV",
              "seller": {
                "@type": "Organization",
                "name": "NewBank Store"
              }
            }
          }
        }))
      };
      script.textContent = JSON.stringify(schema);
    }
  }, [products]);

  const fetchComments = async () => {
    const { data } = await supabase.from('dashboard_comments').select('*').order('created_at', { ascending: false });
    if (data) setComments(data);
  };

  const handleGiftPoints = async (targetId: string, type: 'up' | 'down') => {
    if (!user) return alert("Inicia sesión para regalar puntos de confianza");
    if (user.id === targetId) return alert("No puedes votar por ti mismo");

    try {
      // 1. Verificar ahorros activos del usuario actual
      const { data: savings } = await supabase
        .from('savings')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .gt('amount', 0)
        .order('amount', { ascending: false });

      if (!savings || savings.length === 0 || savings[0].amount < 1) {
        alert("Necesitas al menos $1 en tus ahorros activos para regalar puntos de confianza.");
        return;
      }

      const sourceSaving = savings[0];
      const pointsToMove = 1; // 1 punto equivale a $1 de ahorro
      const effect = type === 'up' ? pointsToMove : -pointsToMove;

      // 2. Descontar $1 de los ahorros del donante
      const { error: saveErr } = await supabase
        .from('savings')
        .update({ amount: sourceSaving.amount - pointsToMove })
        .eq('id', sourceSaving.id);

      if (saveErr) throw saveErr;

      // 3. Obtener score actual del receptor y actualizarlo
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('reliability_score')
        .eq('id', targetId)
        .single();

      const newScore = Math.max(0, Math.min(300, (targetProfile?.reliability_score || 0) + effect));
      
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ reliability_score: newScore })
        .eq('id', targetId);

      if (profileErr) throw profileErr;

      // 4. Actualizar estado local para feedback inmediato
      setNodes(prev => prev.map(n => n.id === targetId ? { ...n, score: newScore } : n));
      
    } catch (err) {
      console.error("Error regalando puntos:", err);
      alert("Hubo un error al procesar el regalo de puntos.");
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newComment.trim()) return;
    setIsPosting(true);
    try {
      const { error } = await supabase.from('dashboard_comments').insert({
        author_name: user ? user.full_name : visitorName,
        content: newComment
      });
      if (error) throw error;
      setNewComment(''); if (!user) setVisitorName(''); fetchComments();
    } catch (err) { console.error(err); }
    finally { setIsPosting(false); }
  };

  const isNodeVisible = (nodeId: string) => {
    return true;
  };

  const [hoveredProduct, setHoveredProduct] = useState<any>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});
  const [animatedPrices, setAnimatedPrices] = useState<Record<string, number>>({});
  const [showPromoMessage, setShowPromoMessage] = useState(false);
  const [lightningTarget, setLightningTarget] = useState<string | null>(null);
  const [featuredPromoProduct, setFeaturedPromoProduct] = useState<any>(null);

  const checkPromo = (allProducts: any[]) => {
    const hasSeen = localStorage.getItem('hasSeenPromo_v2');
    if (hasSeen || allProducts.length < 5) return;

    const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5);
    
    const initialAnimated: Record<string, number> = {};
    selected.forEach(p => {
      initialAnimated[p.id] = p.price + 1;
    });
    setAnimatedPrices(initialAnimated);

    setTimeout(() => {
      setShowPromoMessage(true);
      setTimeout(() => {
        setShowPromoMessage(false);
        startPriceReduction(selected);
        localStorage.setItem('hasSeenPromo_v2', 'true');
      }, 3000);
    }, 1500);
  };

  const startPriceReduction = async (selectedProducts: any[]) => {
    for (const product of selectedProducts) {
      setFeaturedPromoProduct(product);
      setLightningTarget(product.id);
      await new Promise(r => setTimeout(r, 600));
      
      let current = product.price + 1;
      const target = product.price;
      
      const interval = setInterval(() => {
        current = Math.max(target, current - 0.01);
        setAnimatedPrices(prev => ({
          ...prev,
          [product.id]: current
        }));
        
        if (current <= target) {
          clearInterval(interval);
        }
      }, 10);
      
      await new Promise(r => setTimeout(r, 1500));
      setLightningTarget(null);
      setFeaturedPromoProduct(null);
      await new Promise(r => setTimeout(r, 400));
    }
  };

  const handleMouseEnter = (product: any) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredProduct(product);
      setPurchaseQuantity(1);
    }, 300); // Pequeño delay para evitar disparos accidentales
  };

  const handlePurchase = async (product: any, quantity: number) => {
    if (!user) {
      alert("¡Hola! Para poder comprar, solo necesitas crear una cuenta o iniciar sesión.");
      return;
    }

    try {
      // Buscar si el usuario tiene un pedido general abierto (donde algún producto aún no confirma el pago recibido)
      const { data: openOrders } = await supabase
        .from('product_orders')
        .select('general_order_id')
        .eq('user_id', user.id)
        .is('tracking_payment_received_at', null)
        .not('general_order_id', 'is', null)
        .limit(1);

      let generalOrderId;
      if (openOrders && openOrders.length > 0) {
        generalOrderId = openOrders[0].general_order_id;
      } else {
        generalOrderId = crypto.randomUUID();
      }

      const totalPrice = product.price * quantity;
      const { error: orderError } = await supabase.from('product_orders').insert({
        user_id: user.id,
        product_id: product.id,
        quantity: quantity,
        total_price: totalPrice,
        status: 'PAID',
        general_order_id: generalOrderId
      });
      if (orderError) throw orderError;

      const cleanUrl = extractWompiUrl(product.wompi_link);
      const finalUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}quantity=${quantity}&cantidad=${quantity}`;
      window.open(finalUrl, 'WompiPayment', 'width=600,height=800');
      setHoveredProduct(null);
    } catch (err) {
      console.error("Error al procesar la compra:", err);
      alert("Hubo un error al procesar tu orden.");
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredProduct(null);
    setIsDescExpanded(false);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHoveredProduct(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <>
      <InteractiveDialogue 
        isOpen={activeDialogueUser !== null} 
        onClose={() => setActiveDialogueUser(null)} 
        detectedUser={activeDialogueUser || { name: '', fullName: '' }} 
        products={products}
      />

      <AdminAvatarPanel user={user} />

      {(avatarConfig?.show_on_home !== false || user?.is_admin || user?.profile_type === 'admin') && (
        <motion.div
           drag
           dragMomentum={false}
           animate={avatarControls}
           onDragEnd={async (event, info) => {
             const { point } = info;
             // Si el mouse/dedo se suelta cerca del borde derecho
             if (point.x > window.innerWidth - 150) {
               setIsAvatarCollapsed(true);
               // Asumiendo que el offset inicial es 0 (ubicado right-4 y bottom-4).
               // Lo movemos a la derecha para ocultarlo parcialmente.
               await avatarControls.start({ x: window.innerWidth > 768 ? 240 : 180, transition: { type: 'spring', bounce: 0.2, duration: 0.6 } });
             } else {
               setIsAvatarCollapsed(false);
             }
           }}
           className="fixed bottom-4 right-4 z-[9999] pointer-events-auto cursor-grab active:cursor-grabbing flex flex-col items-center justify-center overflow-visible"
        >
          {isAvatarCollapsed && (
            <div 
              className="absolute -left-12 top-1/2 -translate-y-1/2 bg-white/90 p-3 rounded-l-xl shadow-xl cursor-pointer border border-slate-200"
              onClick={() => {
                setIsAvatarCollapsed(false);
                avatarControls.start({ x: 0, y: 0, transition: { type: 'spring', bounce: 0.2, duration: 0.6 } });
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="m15 18-6-6 6-6"/></svg>
            </div>
          )}
          <div className={`transition-opacity duration-300 ${isAvatarCollapsed ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <SmartAvatarBubble 
              detectedUser={user || { name: 'Visitante', fullName: 'Visitante Invitado' }} 
              scenario="greeting" 
            />
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showTextScanner && (
          <CameraTextScanner 
            onClose={() => setShowTextScanner(false)} 
            isHidden={activeDialogueUser !== null}
            onTextFound={(text) => {
              const config = getStoredConfig();
              const now = Date.now();
              let triggerMatched = false;

              if (config.video_triggers) {
                const lowerText = text.toLowerCase();
                for (const [videoName, triggers] of Object.entries(config.video_triggers)) {
                  if (!triggers) continue;
                  const triggerList = triggers.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
                  const matchedTrigger = triggerList.find(t => lowerText.includes(t));
                  if (matchedTrigger) {
                    console.log(`Video trigger found: ${matchedTrigger} -> ${videoName}`);
                    const videoUrl = `https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newbankVideoAnimadoAvatar/${videoName}`;
                    
                    // Only update if it's a different video or it's been a while
                    if (config.video_url !== videoUrl) {
                      const newConfig = { ...config, video_url: videoUrl };
                      saveStoredConfig(newConfig);
                      window.dispatchEvent(new Event('avatar-config-updated'));
                    }
                    
                    lastTriggerTimeRef.current = now;
                    triggerMatched = true;
                    break; 
                  }
                }
              }
            }}
            onNameDetected={(name, isJoining) => {
              console.log("Scanner onNameDetected triggered:", { name, isJoining });
              const isAssistantSpeaking = typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking;
              const canTrigger = (activeDialogueUser === null || name === "9999") && !isAssistantSpeaking;
              
              if (canTrigger) {
                console.log("Proceeding with detection for:", name);
                // Filtramos para saludar únicamente a perfiles verificados (color verde)
                // O si el texto indica que se ha unido ("automáticamente")
                const matchedNode = nodes.find(node => {
                  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                  
                  const scannedNorm = normalize(name);
                  const nodeFullNorm = normalize(node.fullName);
                  const nodeFirstNorm = normalize(node.name);
                  
                  const nameMatches = scannedNorm.includes(nodeFirstNorm) || 
                                     nodeFullNorm.includes(scannedNorm) ||
                                     scannedNorm.includes(nodeFullNorm);

                  return nameMatches && (node.isVerified || isJoining);
                });

                // Verificación de cache para economía de recursos
                const greetedUsers = JSON.parse(localStorage.getItem('greeted_users') || '[]');
                
                const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const normalizedName = normalize(name);
                
                let detectedNameOnly = name;
                // Detectar variaciones como "se ha unido", "se ha undo", etc.
                if (/se ha (unid[aoe]|undo)/i.test(normalizedName) || /se ha unido/i.test(normalizedName)) {
                  detectedNameOnly = name.replace(/se ha (unid[aoe]|undo|unido)/i, '').trim();
                }
                
                console.log(`Detected: "${name}", processing as: "${detectedNameOnly}" (normalized: "${normalizedName}")`);
                if (greetedUsers.includes(detectedNameOnly) && detectedNameOnly !== "9999") {
                  console.log(`User ${detectedNameOnly} already greeted, skipping.`);
                  return;
                }

                if (matchedNode) {
                  console.log("Matched database node:", matchedNode.fullName);
                  setDetectedName(matchedNode.fullName); // Usamos el nombre exacto de la base de datos
                  handleUserDetected(matchedNode.fullName);
                  localStorage.setItem('greeted_users', JSON.stringify([...greetedUsers.slice(-50), detectedNameOnly]));
                  generateGreetingVideo(matchedNode.fullName); // <--- Added to ensure videos for DB nodes too
                } else if (name && (isJoining || /se ha (unido|undo)/i.test(name))) {
                  console.log("Triggering greeting for joining user:", detectedNameOnly);
                  // Si no hay nodo pero detectamos "se ha unido" o el formato "nombre se ha unido", saludamos igual con el nombre detectado
                  setDetectedName(detectedNameOnly); 
                  handleUserDetected(detectedNameOnly);
                  localStorage.setItem('greeted_users', JSON.stringify([...greetedUsers.slice(-50), detectedNameOnly]));
                  generateGreetingVideo(detectedNameOnly);
                } else if (/efecto:(.+)/i.test(name)) {
                  console.log("Triggering effect for:", name);
                  // Si detectamos efecto, saludamos igual con las instrucciones
                  const instructions = name.match(/efecto:(.+)/i)[1].trim();
                  setDetectedName("Efecto"); 
                  localStorage.setItem('greeted_users', JSON.stringify([...greetedUsers.slice(-50), "effect_" + instructions]));
                  generateEffectVideo(instructions);
                } else if (/corazon/i.test(name)) {
                  console.log("Triggering heart effect");
                  // Si detectamos corazon, crear efecto corazones
                  const heartInstructions = "hearts flying upwards animation, 3d, vibrant, tiktok live style";
                  setDetectedName("Corazon");
                  generateEffectVideo(heartInstructions);
                } else if (/9999/i.test(name)) {
                  console.log("Triggering 9999 override generation");
                  // Si detectamos 9999, crear saludo
                  setDetectedName("9999");
                  handleUserDetected("9999");
                  generateGreetingVideo("9999");
                } else {
                  console.log("No specific trigger matched for:", name);
                }
              } else {
                console.log("Detection blocked by state:", { hasActiveDialogue: activeDialogueUser !== null, isAssistantSpeaking });
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {featuredPromoProduct && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, rotateY: 90 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotateY: -90 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
          >
            <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border-4 border-yellow-400 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-white to-yellow-400 animate-pulse"></div>
              <div className="aspect-square rounded-2xl overflow-hidden mb-6 shadow-inner bg-slate-50">
                <img 
                  src={featuredPromoProduct.image_urls?.[0] || 'https://picsum.photos/seed/product/800/800'} 
                  alt={featuredPromoProduct.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = 'https://picsum.photos/seed/product/800/800';
                  }}
                />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase italic mb-2 text-center">{featuredPromoProduct.name}</h3>
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 line-through text-xl font-bold">
                    ${(featuredPromoProduct.price + 1).toFixed(2)}
                  </span>
                  <span className="text-3xl font-black text-green-600 animate-bounce">
                    ${(animatedPrices[featuredPromoProduct.id] || featuredPromoProduct.price + 1).toFixed(2)}
                  </span>
                </div>
                <div className="bg-green-100 text-green-700 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                  ¡Precio Mejorado!
                </div>
              </div>
              {lightningTarget === featuredPromoProduct.id && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0, 1, 0], scale: [1, 2, 1, 2, 1] }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 pointer-events-none flex items-center justify-center text-8xl text-yellow-400/40"
                >
                  ⚡
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {showPromoMessage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5, y: -50 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-8 rounded-[3rem] shadow-[0_0_50px_rgba(245,158,11,0.5)] border-4 border-white text-center transform -rotate-3">
              <motion.h2 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="text-4xl sm:text-6xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg"
              >
                ¡Felicidades!
              </motion.h2>
              <p className="text-xl sm:text-2xl font-black text-yellow-100 uppercase tracking-widest mt-2">
                Has ganado $5.00 dólares en descuentos
              </p>
              <div className="mt-4 flex justify-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <motion.span 
                    key={i}
                    animate={{ y: [0, -20, 0], rotate: [0, 360] }}
                    transition={{ delay: i * 0.1, repeat: Infinity, duration: 1 }}
                    className="text-3xl"
                  >
                    💰
                  </motion.span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!user && showLoginBanner && (
          <motion.div 
            initial={{ y: -150 }}
            animate={{ y: 64 }}
            exit={{ y: -150 }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            className="fixed top-0 left-0 w-full z-30 bg-gradient-to-r from-blue-600 to-indigo-700 p-4 sm:p-6 shadow-2xl border-b border-white/20 flex flex-col md:flex-row items-center justify-center gap-4 text-center md:text-left"
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
            <div className="relative z-10">
              <h3 className="text-xs sm:text-sm font-bold text-white mb-0.5">
                ¡Hola! Para poder comprar o guardar productos en tu lista de deseos, solo necesitas crear una cuenta o iniciar sesión como INVITADO
              </h3>
              <p className="text-blue-100 text-[8px] font-black uppercase tracking-widest opacity-80">
                Haz clic aquí y en segundos estarás listo:
              </p>
            </div>
            <Link 
              to="/register?type=invitado" 
              className="relative z-10 whitespace-nowrap bg-white text-blue-600 px-5 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-xl hover:bg-blue-50 transition-all transform active:scale-95"
            >
              Crear cuenta o iniciar sesión
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger invisible en la esquina inferior del menú (top-16) */}
      {!user && (
        <div 
          onClick={triggerBanner}
          className="fixed top-12 left-0 w-16 h-8 z-[45] cursor-pointer pointer-events-auto"
          title="Ayuda de inicio de sesión"
        >
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-24 pb-32">


        <div className="relative text-center mb-16 py-12">
          {/* Banner de productos dinámico de fondo */}
          <ProductBanner products={products} />
          
          <div className="relative z-20 bg-transparent invisible">
            <h1 className="text-4xl sm:text-7xl font-black text-slate-900/90 uppercase italic tracking-tighter leading-none mb-4 drop-shadow-md mix-blend-multiply">
              NewBank. Store<br />
              <span className="text-blue-600/90">El Salvador</span>
            </h1>
            <p className="sr-only">
              Artículos Tácticos, Militares y Microcréditos Rápidos
            </p>
            <div className="flex justify-center opacity-80">
               <div className="h-1.5 w-24 bg-blue-600 rounded-full shadow-sm"></div>
            </div>
          </div>
        </div>
        
        {/* Ventana Emergente Detallada (Quick View) */}
      {hoveredProduct && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in sm:pointer-events-auto"
          onClick={handleMouseLeave}
        >
          <div 
            className="bg-white rounded-[2.5rem] max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col md:flex-row overflow-hidden border border-white/20 pointer-events-auto animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:w-1/2 aspect-square bg-slate-50 relative">
              <ProductCarousel images={hoveredProduct.image_urls} name={hoveredProduct.name} />
              <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full font-black text-xs shadow-xl">
                ${(animatedPrices[hoveredProduct.id] || hoveredProduct.price)?.toFixed(2)}
              </div>
            </div>
            <div className="md:w-1/2 p-6 sm:p-8 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">{hoveredProduct.name}</h2>
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">Detalles del Producto</span>
                </div>
                <button onClick={handleMouseLeave} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="mb-4 overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ height: isDescExpanded ? '200px' : '80px' }}
                  className="overflow-y-auto pr-2 elegant-scrollbar transition-all duration-300"
                >
                  <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">
                    {hoveredProduct.description}
                  </p>
                </motion.div>
                {hoveredProduct.description?.length > 100 && (
                  <button 
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className="text-blue-600 font-black text-[8px] uppercase tracking-widest mt-2 hover:underline flex items-center gap-1"
                  >
                    {isDescExpanded ? (
                      <><span>▲</span> Ver menos (scroll activo)</>
                    ) : (
                      <><span>▼</span> Ver más detalles</>
                    )}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 mb-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="block text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Estado</span>
                  <span className={`text-xs font-bold ${hoveredProduct.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {hoveredProduct.stock > 0 ? 'Disponible' : 'Agotado'}
                  </span>
                </div>
              </div>

              <div className="mt-auto space-y-2">
                {hoveredProduct.stock > 0 ? (
                  <>
                    {hoveredProduct.wompi_link?.toLowerCase() === 'n/a' ? (
                      <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 animate-pulse">
                        <p className="text-[9px] font-black text-orange-700 uppercase tracking-widest text-center">
                          actualmente solo disponible para solicitar por WhatsApp
                        </p>
                      </div>
                    ) : showWompi && (
                      <button 
                        onClick={() => handlePurchase(hoveredProduct, purchaseQuantity)}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                      >
                        <span>🛒</span> Comprar Ahora
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        const message = encodeURIComponent(`Hola, me interesa el producto: ${hoveredProduct.name} (Cantidad: ${purchaseQuantity})`);
                        const waNumber = hoveredProduct.whatsapp_number || '50370914941';
                        window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
                      }}
                      className="w-full py-3 bg-green-500 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-lg shadow-green-100 hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="text-sm">💬</span> Solicitar por WhatsApp
                    </button>
                  </>
                ) : (
                  <button 
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-lg flex items-center justify-center gap-2"
                  >
                    <span>⭐</span> Lista de Deseos
                  </button>
                )}
                <p className="text-[8px] text-slate-400 text-center font-bold uppercase tracking-widest">Pago seguro vía Wompi</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* El banner anterior ha sido movido a un estado animado arriba */}
      
      {/* SECCIÓN DE PRODUCTOS PROPIOS - AHORA AL PRINCIPIO */}
      <div className="mb-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <AnimatePresence>
            {showSectionInfo && (
              <motion.h2 
                initial={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
                transition={{ duration: 0.5 }}
                className="hidden text-2xl sm:text-3xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2"
              >
                🛒 Artículos Tácticos y Militares
              </motion.h2>
            )}
          </AnimatePresence>
          
          {/* Buscador Interactivo y Boton de Animacion */}
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 w-full">
              <div className="relative w-full md:w-72 group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input 
                  type="text"
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border-2 border-slate-100 rounded-2xl py-2.5 pl-11 pr-4 text-xs font-bold text-slate-700 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Play/Pause Button */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? "Detener animación" : "Reproducir animación"}
                className={`p-2.5 rounded-2xl border-2 transition-all shadow-sm flex items-center justify-center flex-shrink-0 group ${
                  isPlaying 
                    ? 'bg-blue-50 border-blue-500/50 text-blue-600' 
                    : 'bg-white border-slate-100 text-slate-400 hover:text-blue-500 hover:border-blue-500/30'
                }`}
                title={isPlaying ? "Detener animación" : "Reproducir animación de productos"}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Text Scanner Button */}
              <button
                onClick={() => setShowTextScanner(true)}
                aria-label="Escanear texto con IA"
                className="p-2.5 rounded-2xl border-2 transition-all shadow-sm flex items-center justify-center flex-shrink-0 group bg-white border-slate-100 text-slate-400 hover:text-indigo-500 hover:border-indigo-500/30"
                title="Escanear texto con Cámara e IA"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>

              {/* Download Button */}
              <button
                onClick={handleDownloadAnimation}
                aria-label="Descargar animación MP4"
                className="p-2.5 rounded-2xl border-2 transition-all shadow-sm hidden sm:flex items-center justify-center flex-shrink-0 group bg-white border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-500/30"
                title="Descargar animación (MP4)"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-4 w-full">
              {['Todo', 'Estilo de vida', 'Hogar', 'Juguetes', 'Accesorios'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`text-[8px] font-black uppercase tracking-widest transition-all relative ${
                    categoryFilter === cat 
                      ? 'text-slate-900 after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-blue-600' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <Link 
                to="/register?type=aliado"
                className="text-[8px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors ml-auto lg:ml-4 flex items-center gap-1"
              >
                <span>🤝</span> Vende con nosotros en El Salvador
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 relative">
            <AnimatePresence>
              {showHelpBanner && (
                <motion.div 
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100 shadow-lg z-10"
                >
                  <p className="text-[10px] sm:text-xs font-bold text-blue-800 leading-tight">
                    Si tienes problemas para pagar en linea puedes escribirme a mi WhatsApp para brindarte asistencia.
                  </p>
                  <button 
                    onClick={() => window.open('https://wa.me/50370914941?text=Hola,%20necesito%20asistencia%20con%20mi%20pago%20en%20linea.', '_blank')}
                    className="whitespace-nowrap px-3 py-1.5 bg-green-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                  >
                    Clic aqui para ayuda
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {!showHelpBanner && (
              <div 
                onClick={triggerHelpBanner}
                className="absolute top-0 right-0 w-12 h-12 cursor-pointer z-20"
                title="Ayuda de pago"
              >
              </div>
            )}
            
            <AnimatePresence>
              {showSectionInfo && (
                <motion.p 
                  initial={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.5 }}
                  className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest italic"
                >
                  Los productos se entregan personalmente en menos de 15 días, ademas contamos con facilidades de pago.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
        {loadingProducts ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            <AnimatePresence mode="popLayout">
              {(isPlaying ? animatedIndices.map(i => filteredProducts[i]).filter(Boolean) : filteredProducts).map((product, index) => (
                <motion.div 
                  layout
                  initial={isPlaying ? { opacity: 0, scale: 0.95 } : false}
                  animate={isPlaying ? { opacity: 1, scale: 1 } : false}
                  exit={isPlaying ? { opacity: 0, scale: 0.95 } : undefined}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  key={isPlaying ? `anim-${product.id}-${index}` : product.id} 
                  id={`product-card-${product.id}`}
                  className={`bg-white rounded-2xl shadow-sm hover:shadow-xl overflow-hidden border border-slate-100 flex flex-col group transition-all duration-500 z-0 hover:z-10 ${isPlaying && index === 3 ? 'lg:hidden' : ''}`}
                >
                  {/* Carrusel de Imágenes Simple */}
                <div className="relative aspect-[4/5] sm:aspect-square bg-slate-50 overflow-hidden">
                  <ProductCarousel images={product.image_urls} name={product.name} />
                  {product.stock === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="bg-red-600 text-white px-3 py-1 rounded-full font-bold uppercase text-[8px] tracking-widest shadow-lg">Agotado</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-md px-2 py-0.5 rounded-full shadow-sm border border-slate-200/50 z-10">
                    <span className="text-slate-900 font-bold text-[10px] sm:text-sm">
                      ${(animatedPrices[product.id] || product.price)?.toFixed(2)}
                    </span>
                    {lightningTarget === product.id && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 1], y: [-20, 0] }}
                        transition={{ duration: 0.4 }}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 text-yellow-400 text-3xl z-20"
                      >
                        ⚡
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="p-3 sm:p-4 flex flex-col flex-grow bg-white">
                  <h3 
                    onClick={() => setHoveredProduct(product)}
                    className="text-[11px] sm:text-lg font-bold text-slate-800 uppercase tracking-tight mb-0.5 line-clamp-1 cursor-pointer hover:text-blue-600 transition-colors"
                  >
                    {product.name}
                  </h3>
                  <p className="text-[9px] sm:text-xs text-slate-400 font-medium mb-1 line-clamp-1">{product.description}</p>
                  
                  {/* Información de Envío Gratis */}
                  {product.creator?.free_shipping_departments && product.creator.free_shipping_departments.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[8px] sm:text-[9px] font-black text-green-600 uppercase tracking-widest leading-tight">
                        🚚 Envío gratis en {product.creator.free_shipping_departments.join(', ')}
                      </p>
                    </div>
                  )}

                  <div className="mt-auto pt-2 border-t border-slate-50">
                    <div className="flex items-center justify-between mb-2">
                    </div>

                    {product.stock > 0 ? (
                      <div className={`flex ${(!showWompi || product.wompi_link?.toLowerCase() === 'n/a') ? 'justify-center' : 'gap-2'}`}>
                        {showWompi && product.wompi_link?.toLowerCase() !== 'n/a' && (
                          <button 
                            onClick={() => {
                              if (!user) {
                                navigate('/register?type=invitado');
                                return;
                              }
                              handlePurchase(product, cardQuantities[product.id] || 1);
                            }}
                            className="flex-1 py-2 bg-slate-900 text-white rounded-full font-bold uppercase text-[9px] tracking-widest hover:bg-blue-600 transition-all transform active:scale-95 shadow-sm"
                          >
                            Comprar
                          </button>
                        )}
                        <button 
                          onClick={() => handleWhatsAppShare(product, cardQuantities[product.id] || 1)}
                          className={`${(!showWompi || product.wompi_link?.toLowerCase() === 'n/a') ? 'w-full py-2.5 px-6' : 'w-8 h-8 sm:w-9 sm:h-9'} flex-shrink-0 flex items-center justify-center bg-green-500 text-white rounded-full hover:bg-green-600 transition-all transform active:scale-95 shadow-sm`}
                          title="Consultar por WhatsApp"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          {(!showWompi || product.wompi_link?.toLowerCase() === 'n/a') && (
                            <span className="ml-2 text-[10px] font-black uppercase tracking-widest">Consultar por WhatsApp</span>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            if (!user) {
                              navigate('/register?type=invitado');
                              return;
                            }
                            // handleAddToWishlist logic would go here if it existed in Dashboard
                          }}
                          className="flex-1 py-2 bg-slate-900 text-white rounded-full font-bold uppercase text-[9px] tracking-widest hover:bg-black transition-all transform active:scale-95 shadow-sm"
                        >
                          Deseos
                        </button>
                        <button 
                          onClick={() => handleWhatsAppShare(product, 1)}
                          className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center bg-green-500 text-white rounded-full hover:bg-green-600 transition-all transform active:scale-95 shadow-sm"
                          title="Consultar por WhatsApp"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        )}
        {!loadingProducts && filteredProducts.length === 0 && (
          <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-black uppercase text-xs tracking-widest italic">
              {searchQuery ? `No se encontraron productos para "${searchQuery}"` : "No hay productos disponibles en este momento"}
            </p>
          </div>
        )}
      </div>



      <div className="mt-24 max-w-4xl mx-auto">
        <h2 className="text-3xl font-black text-center mb-12 uppercase tracking-tighter">dinos que productos te gustaria encontrar en nuestra tienda.</h2>
        <form onSubmit={handlePostComment} className="bg-white p-8 rounded-[2rem] shadow-xl border mb-12 flex flex-col gap-4">
          {!user && <input type="text" placeholder="Tu Nombre" className="px-5 py-4 rounded-xl border outline-none font-bold" value={visitorName} onChange={e => setVisitorName(e.target.value)} />}
          <textarea className="px-5 py-4 rounded-2xl border outline-none min-h-[120px]" placeholder="¿Cómo ha sido tu experiencia con NewBank AI?" value={newComment} onChange={e => setNewComment(e.target.value)} />
          <button type="submit" disabled={isPosting} className="bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs">{isPosting ? 'Enviando...' : 'Publicar Testimonio'}</button>
        </form>
        <div className="space-y-8">
          {comments.map(c => (
            <div key={c.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="font-black uppercase text-sm">{c.author_name}</div>
                <div className="text-[9px] font-black opacity-30 uppercase">{new Date(c.created_at).toLocaleDateString()}</div>
              </div>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">{c.content}</p>
            </div>
          ))}
        </div>
      </div>




      <WelcomeOverlay />
    </div>
    </>
  );
};

const WelcomeOverlay: React.FC = () => {
  const [step, setStep] = useState(0); 
  const [visible, setVisible] = useState(false);
  const [diamondFrame, setDiamondFrame] = useState(0);
  const [count, setCount] = useState(0);
  const [interestRate, setInterestRate] = useState(25);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isFirstPayment = params.get('first_payment') === 'true';
    const hasShown = localStorage.getItem('primerPagoBienvenidaShown');

    if (isFirstPayment && !hasShown) {
      setVisible(true);
      localStorage.setItem('primerPagoBienvenidaShown', 'true');
      runSequence();
    }
  }, []);

  // Diamond Loop Animation
  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    const interval = setInterval(() => {
      frame = (frame + 1) % 62;
      setDiamondFrame(frame);
    }, 50);
    return () => clearInterval(interval);
  }, [visible]);

  const runSequence = async () => {
    // Step 1: 100 Diamonds
    setStep(1);
    animateCount(0, 100, 2000);
    await new Promise(r => setTimeout(r, 5000));

    // Step 2: 200 Diamonds
    setStep(2);
    animateCount(100, 200, 2000);
    await new Promise(r => setTimeout(r, 5000));

    // Step 3: 300 Diamonds
    setStep(3);
    animateCount(200, 300, 2000);
    await new Promise(r => setTimeout(r, 5000));

    // Step 4: Surprise Gift
    setStep(4);
    // Animate interest rate drop
    setTimeout(() => {
      const rateInterval = setInterval(() => {
        setInterestRate(prev => {
          if (prev <= 15) {
            clearInterval(rateInterval);
            return 15;
          }
          return prev - 1;
        });
      }, 100);
    }, 1000);
    
    await new Promise(r => setTimeout(r, 6000));

    // Step 5: Button
    setStep(5);
    
    // Auto-click after delay
    setTimeout(() => {
      handleCloseAndRedirect();
    }, 3000);
  };

  const animateCount = (start: number, end: number, duration: number) => {
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quart
      const ease = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(start + (end - start) * ease));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  };

  const handleCloseAndRedirect = () => {
    setVisible(false);
    const links = Array.from(document.querySelectorAll('a'));
    const registerLink = links.find(el => el.textContent?.includes('Registrarme'));
    if (registerLink) {
      (registerLink as HTMLElement).click();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/95 backdrop-blur-2xl flex items-center justify-center overflow-hidden text-white font-sans pointer-events-auto">
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        @keyframes shine { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(0,255,255,0.5); } 50% { box-shadow: 0 0 50px rgba(0,255,255,0.8); } }
        @keyframes slide-down { from { opacity: 0; transform: translateY(-50px) scale(0.8); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes burst { 0% { transform: scale(0); opacity: 0; } 50% { opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
        @keyframes marquee {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-marquee { animation: marquee 40s linear infinite; }
        .animate-slide-down { animation: slide-down 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .text-shine { background: linear-gradient(to right, #fff 20%, #ffd700 40%, #ffd700 60%, #fff 80%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shine 3s linear infinite; }
        .card-glow { box-shadow: 0 0 60px rgba(0,255,255,0.2); border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); }
        .diamond-burst { position: absolute; width: 10px; height: 10px; background: cyan; border-radius: 50%; animation: burst 1s linear forwards; }
      `}</style>

      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-400/10 rounded-full blur-[80px] animate-ping" style={{ animationDuration: '4s' }}></div>
        
        {/* Flying Particles */}
        {[...Array(30)].map((_, i) => (
          <div key={i} className="absolute w-1 h-1 bg-white rounded-full opacity-70" style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animation: `float ${2 + Math.random() * 4}s infinite`,
            animationDelay: `${Math.random() * 2}s`,
            boxShadow: '0 0 10px white'
          }} />
        ))}
      </div>

      <div className="relative z-10 max-w-4xl w-full p-4 text-center flex flex-col items-center justify-center h-full">
        
        {/* STEP 1: 100 Diamonds */}
        {step === 1 && (
          <div className="animate-slide-down flex flex-col items-center w-full">
            <h1 className="text-lg sm:text-2xl md:text-7xl font-black uppercase tracking-tighter mb-3 sm:mb-5 text-shine drop-shadow-2xl px-1 leading-tight">
              ¡Bienvenido! <br/> <span className="text-base sm:text-xl md:text-5xl text-white block mt-1">Gracias por tu primer pago 🎉</span>
            </h1>
            <p className="text-[10px] sm:text-base md:text-3xl font-bold text-cyan-300 mb-3 sm:mb-6 uppercase tracking-widest animate-pulse">Hemos desbloqueado para ti</p>
            
            <div className="relative mb-4 sm:mb-8">
               <div className="absolute inset-0 bg-cyan-500 blur-[30px] sm:blur-[50px] opacity-40 animate-pulse"></div>
               <img 
                 src={`https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newBankVideoDiamanteAnimado/videoDiamante_${diamondFrame.toString().padStart(3, '0')}-removebg-preview.png`} 
                 className="w-24 h-24 sm:w-36 sm:h-36 md:w-64 md:h-64 object-contain relative z-10 drop-shadow-[0_0_30px_rgba(0,255,255,0.8)]"
                 alt="Diamond"
               />
            </div>

            <div className="card-glow rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-8 md:p-12 w-full max-w-[90%] sm:max-w-lg transform transition-all hover:scale-105 border-t-4 border-cyan-400 mx-auto">
              <div className="text-2xl sm:text-4xl md:text-9xl font-black text-white mb-1 sm:mb-3 drop-shadow-[0_0_20px_rgba(0,255,255,1)] flex justify-center items-center gap-0.5 sm:gap-2">
                {count} <span className="text-sm sm:text-lg">💎</span>
              </div>
              <div className="text-sm sm:text-lg md:text-5xl font-black text-cyan-300 uppercase mb-0.5 sm:mb-2">Préstamo de $25</div>
              <div className="text-[8px] sm:text-[10px] md:text-2xl font-bold text-slate-300 uppercase tracking-widest bg-white/10 py-0.5 px-1 sm:py-1 sm:px-3 rounded-full inline-block">Tasa de Interés: 25%</div>
            </div>
          </div>
        )}

        {/* STEP 2: 200 Diamonds */}
        {step === 2 && (
          <div className="animate-slide-down flex flex-col items-center w-full">
            <h1 className="text-lg sm:text-2xl md:text-6xl font-black uppercase tracking-tighter mb-3 sm:mb-5 text-white drop-shadow-xl px-1 leading-tight">Pero eso no es todo...</h1>
            <p className="text-[10px] sm:text-base md:text-3xl font-bold text-purple-300 mb-3 sm:mb-6 uppercase tracking-widest">Desbloqueamos para ti</p>
            
            <div className="relative mb-4 sm:mb-8">
               <div className="absolute inset-0 bg-purple-500 blur-[40px] sm:blur-[60px] opacity-50 animate-pulse"></div>
               <img 
                 src={`https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newBankVideoDiamanteAnimado/videoDiamante_${diamondFrame.toString().padStart(3, '0')}-removebg-preview.png`} 
                 className="w-32 h-32 sm:w-44 sm:h-44 md:w-72 md:h-72 object-contain relative z-10 drop-shadow-[0_0_40px_rgba(168,85,247,0.8)]"
                 alt="Diamond"
               />
            </div>

            <div className="card-glow rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-8 md:p-12 w-full max-w-[90%] sm:max-w-lg transform transition-all hover:scale-105 border-t-4 border-purple-400 mx-auto">
              <div className="text-2xl sm:text-4xl md:text-9xl font-black text-white mb-1 sm:mb-3 drop-shadow-[0_0_20px_rgba(168,85,247,1)] flex justify-center items-center gap-0.5 sm:gap-2">
                {count} <span className="text-sm sm:text-lg">💎</span>
              </div>
              <div className="text-sm sm:text-lg md:text-5xl font-black text-purple-300 uppercase mb-0.5 sm:mb-2">Préstamo de $50</div>
              <div className="text-[8px] sm:text-[10px] md:text-2xl font-bold text-slate-300 uppercase tracking-widest bg-white/10 py-0.5 px-1 sm:py-1 sm:px-3 rounded-full inline-block">Tasa de Interés: 25%</div>
            </div>
          </div>
        )}

        {/* STEP 3: 300 Diamonds */}
        {step === 3 && (
          <div className="animate-slide-down flex flex-col items-center w-full">
            <h1 className="text-lg sm:text-2xl md:text-7xl font-black uppercase tracking-tighter mb-3 sm:mb-5 text-shine drop-shadow-2xl px-1 leading-tight">¡Andas de suerte!</h1>
            <p className="text-[10px] sm:text-base md:text-3xl font-bold text-yellow-300 mb-3 sm:mb-6 uppercase tracking-widest animate-bounce">Se ha desbloqueado para ti</p>
            
            <div className="relative mb-4 sm:mb-8">
               <div className="absolute inset-0 bg-yellow-500 blur-[50px] sm:blur-[70px] opacity-60 animate-pulse"></div>
               <img 
                 src={`https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newBankVideoDiamanteAnimado/videoDiamante_${diamondFrame.toString().padStart(3, '0')}-removebg-preview.png`} 
                 className="w-40 h-40 sm:w-52 sm:h-52 md:w-80 md:h-80 object-contain relative z-10 drop-shadow-[0_0_50px_rgba(255,215,0,0.9)]"
                 alt="Diamond"
               />
            </div>

            <div className="card-glow rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-8 md:p-12 w-full max-w-[90%] sm:max-w-lg transform transition-all hover:scale-105 border-t-4 border-yellow-400 shadow-[0_0_100px_rgba(255,215,0,0.3)] mx-auto">
              <div className="text-2xl sm:text-4xl md:text-9xl font-black text-white mb-1 sm:mb-3 drop-shadow-[0_0_30px_rgba(255,215,0,1)] flex justify-center items-center gap-0.5 sm:gap-2">
                {count} <span className="text-sm sm:text-lg">💎</span>
              </div>
              <div className="text-sm sm:text-lg md:text-5xl font-black text-yellow-300 uppercase mb-0.5 sm:mb-2">Préstamo de $75</div>
              <div className="text-[8px] sm:text-[10px] md:text-2xl font-bold text-slate-300 uppercase tracking-widest bg-white/10 py-0.5 px-1 sm:py-1 sm:px-3 rounded-full inline-block">Tasa de Interés: 25%</div>
            </div>
          </div>
        )}

        {/* STEP 4 & 5: FINAL SURPRISE */}
        {(step === 4 || step === 5) && (
          <div className="animate-slide-down flex flex-col items-center justify-center h-full w-full px-4">
            <div className="text-6xl sm:text-9xl mb-4 sm:mb-8 animate-bounce drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]">🎁</div>
            <h1 className="text-lg sm:text-2xl md:text-7xl font-black uppercase tracking-tighter mb-3 sm:mb-6 text-shine leading-tight">
              ¡Espera! <br/> <span className="block mt-1">Hay un regalo más</span>
            </h1>
            
            <div className="bg-gradient-to-br from-yellow-900/80 to-orange-900/80 rounded-[1.5rem] sm:rounded-[3rem] p-5 sm:p-10 md:p-16 border-4 border-yellow-400 shadow-[0_0_150px_rgba(255,215,0,0.4)] backdrop-blur-xl max-w-[95%] sm:max-w-3xl relative overflow-hidden mx-auto">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
              
              <p className="text-sm sm:text-lg md:text-4xl font-black text-white mb-2 sm:mb-5 uppercase leading-tight relative z-10">
                Te regalamos <span className="text-yellow-300 text-shine block sm:inline mt-0.5 sm:mt-0">disminución de intereses</span> en tus próximos préstamos
              </p>
              
              <div className="flex items-center justify-center gap-1.5 sm:gap-3 mb-2 sm:mb-5 relative z-10">
                 <div className="text-base sm:text-xl font-bold text-slate-400 line-through decoration-red-500 decoration-4">25%</div>
                 <div className="text-xl sm:text-3xl font-black text-green-400 animate-pulse">→</div>
                 <div className="text-3xl sm:text-5xl font-black text-yellow-300 drop-shadow-[0_0_20px_rgba(255,215,0,1)]">{interestRate}%</div>
              </div>

              <p className="text-[9px] sm:text-sm md:text-2xl font-bold text-slate-200 uppercase tracking-widest relative z-10 bg-black/30 py-1 px-2 sm:py-1.5 sm:px-4 rounded-full inline-block">
                ¡Aprovecha esta ventaja exclusiva ahora!
              </p>
            </div>

            {step === 5 && (
              <button 
                onClick={handleCloseAndRedirect}
                className="mt-4 sm:mt-8 bg-white text-slate-900 px-4 py-2 sm:px-8 sm:py-3 rounded-full text-[9px] sm:text-base font-black uppercase tracking-widest hover:scale-110 hover:bg-cyan-50 transition-all shadow-[0_0_60px_rgba(255,255,255,0.6)] animate-pulse cursor-pointer relative z-50 w-full sm:w-auto max-w-[200px] sm:max-w-none mx-auto"
              >
                ¡Entendido! Continuar
              </button>
            )}
          </div>
        )}

      </div>
      <style>{`
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .animate-scale-up { animation: scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

export default Dashboard;
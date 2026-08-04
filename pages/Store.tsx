import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import html2canvas from 'html2canvas';

import { useLocation } from 'react-router-dom';

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
    <div className="relative w-full h-full select-none">
      <img 
        src={validImages[currentIndex] || 'https://picsum.photos/seed/product/800/800'} 
        alt={name}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 pointer-events-none"
        referrerPolicy="no-referrer"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
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

const WompiWidget = React.memo(({ urlPago }: { urlPago: string }) => {
  const handlePay = () => {
    const cleanUrl = extractWompiUrl(urlPago);
    // Centering logic for popup window
    const width = 600;
    const height = 800;
    
    // Calculate position relative to the screen
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    const paymentWindow = window.open(
      cleanUrl,
      'WompiPayment',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );

    if (!paymentWindow) {
      alert("Por favor, permite las ventanas emergentes en tu navegador para continuar con el pago.");
    }
  };

  return (
    <div className="w-full flex justify-center py-2">
      <button 
        onClick={handlePay}
        className="bg-[#592c82] hover:bg-[#4a246d] text-white font-black py-3 px-8 rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 uppercase tracking-tight text-[10px] sm:text-xs"
      >
        <span className="text-base sm:text-xl">💳</span> Recargar
      </button>
    </div>
  );
});

const Store: React.FC<{ user: any }> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(user);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [diamondFrame, setDiamondFrame] = useState(0);
  const [feedbackFrame, setFeedbackFrame] = useState(1);
  const location = useLocation();

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('newbank_show_wompi');
      setShowWompi(saved === null ? true : saved === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search');
    if (q) {
      const decodedQ = decodeURIComponent(q);
      setSearchQuery(decodedQ);
      document.title = `${decodedQ} | NewBank Store El Salvador`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', `Resultados para ${decodedQ} en NewBank Store. Encuentra artículos tácticos, militares y tecnología avanzada en El Salvador.`);
      }
    } else {
      document.title = "Tienda | NewBank Store El Salvador";
    }
  }, [location.search]);
  
  // New states for diamond burst effect
  const [showBurst, setShowBurst] = useState(false);
  const [burstFrame, setBurstFrame] = useState(0);
  const [displayDiamonds, setDisplayDiamonds] = useState(0);
  const displayDiamondsRef = React.useRef(0);
  const [products, setProducts] = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [hoveredProduct, setHoveredProduct] = useState<any>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todo');
  const [showWompi, setShowWompi] = useState(() => {
    const saved = localStorage.getItem('newbank_show_wompi');
    return saved === null ? true : saved === 'true';
  });
  const [showLoginBanner, setShowLoginBanner] = useState(false);
  const [showHelpBanner, setShowHelpBanner] = useState(false);
  const [showSectionInfo, setShowSectionInfo] = useState(true);

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
      // Solo mostramos alerta en caso de fallar por políticas (típico dentro del modo preview/iframe)
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
            window.open(whatsappUrl, '_blank');
          }
        }, 'image/png');
      } else {
        window.open(whatsappUrl, '_blank');
      }
    } catch (error) {
      console.error('Error capturando la imagen:', error);
      window.open(whatsappUrl, '_blank');
    }
  };

  const handleMouseEnter = (product: any) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredProduct(product);
      setPurchaseQuantity(1);
    }, 300);
  };

  const handlePurchase = async (product: any, quantity: number) => {
    // Check if link is n/a
    if (product.wompi_link === 'n/a') {
      handleWhatsAppShare(product, quantity);
      return;
    }

    if (!user) {
      alert("Ingresa tus credenciales de invitado o si no tiene una cuenta peritele registrarse como invitado");
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

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('*, creator:profiles!products_creator_id_fkey(free_shipping_departments)')
        .eq('is_visible', true)
        .order('created_at', { ascending: false });
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);

  // Inyectar schema de productos al DOM para SEO dinámico (Merchant Listings)
  useEffect(() => {
    if (products.length > 0) {
      let script = document.getElementById('seo-dynamic-products') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = 'seo-dynamic-products';
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

  useEffect(() => {
    const fetchWishlist = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('product_wishlist')
        .select('*, product:products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setWishlist(data);
    };
    fetchWishlist();
  }, [user]);

  const handleRemoveFromWishlist = async (wishlistId: string) => {
    try {
      const { error } = await supabase
        .from('product_wishlist')
        .delete()
        .eq('id', wishlistId);
      
      if (error) throw error;
      setWishlist(prev => prev.filter(item => item.id !== wishlistId));
      setNotification({ msg: "Eliminado de tu lista de deseos.", type: 'success' });
    } catch (err) {
      console.error(err);
      setNotification({ msg: "Error al eliminar de la lista.", type: 'error' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleAddToWishlist = async (productId: string) => {
    if (!user) return;
    
    const note = prompt("Especifica detalles adicionales (color, tamaño, etc.) para coordinar con el proveedor:");
    if (note === null) return; // User cancelled

    setLoading(true);
    try {
      const { error } = await supabase
        .from('product_wishlist')
        .insert([{
          user_id: user.id,
          product_id: productId,
          status: 'PENDING',
          notes: note
        }]);
      
      if (error) throw error;
      
      // Refresh wishlist
      const { data: updatedWishlist } = await supabase
        .from('product_wishlist')
        .select('*, product:products(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (updatedWishlist) setWishlist(updatedWishlist);

      setNotification({ msg: "Agregado a tu lista de deseos. Te notificaremos cuando esté disponible.", type: 'success' });
    } catch (err) {
      console.error(err);
      setNotification({ msg: "Error al agregar a la lista de deseos.", type: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  useEffect(() => {
    if (profile?.store_diamonds !== undefined) {
      // Only sync if not currently animating a burst to avoid jumping
      if (!showBurst) {
        setDisplayDiamonds(profile.store_diamonds);
      }
    }
  }, [profile?.store_diamonds, showBurst]);

  useEffect(() => {
    displayDiamondsRef.current = displayDiamonds;
  }, [displayDiamonds]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data);
    };
    fetchProfile();

    // Suscripción en tiempo real para cambios en el perfil del usuario (Diamantes, Verificación, etc.)
    const profileChannel = supabase
      .channel(`profile_realtime_store_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          // Cambio detectado en perfil (Realtime)
          setProfile(payload.new);
        }
      )
      .subscribe();

    // Listener para recibir la notificación de Wompi vía postMessage (Feedback visual inmediato)
    const handleWompiMessage = async (event: MessageEvent) => {
      if (event.origin !== "https://pagos.wompi.sv") return;

      const data = event.data;
      const diamondId = "0c791599-d163-4cde-b410-1865c1d7e04b";
      const diamond20Id = "bcc4870c-7acc-40f6-ac40-b27b782e64a5";
      const diamond4Id = "1e253dc2-8de0-4277-b55d-a8570a31177a";
      const feedbackId = "48d3c8cf-dbfa-4af3-8f09-5d4baa4473a9";
      
      if (data && (data.IdIntentoPago === diamondId || data.IdIntentoPago === diamond20Id || data.IdIntentoPago === diamond4Id || data.IdIntentoPago === feedbackId)) {
        if (data.ResultadoTransaccion === "ExitosaAprobada") {
          // Trigger Burst Animation
          setShowBurst(true);
          let itemType = 'Feedback';
          if (data.IdIntentoPago === diamondId || data.IdIntentoPago === diamond20Id || data.IdIntentoPago === diamond4Id) itemType = 'Diamantes';
          
          setNotification({ msg: `¡Transacción Exitosa! ${itemType} acreditados. ID: ${data.IdTransaccion}`, type: 'success' });
          
          if (data.IdIntentoPago === diamondId || data.IdIntentoPago === diamond20Id || data.IdIntentoPago === diamond4Id) {
            // Animate Counter for diamonds
            let amount = 100;
            if (data.IdIntentoPago === diamond20Id) amount = 20;
            if (data.IdIntentoPago === diamond4Id) amount = 4;

            const startValue = displayDiamondsRef.current;
            const endValue = startValue + amount;
            const duration = 3000;
            const startTime = performance.now();

            const animateCounter = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const ease = 1 - Math.pow(1 - progress, 4);
              const current = Math.floor(startValue + (endValue - startValue) * ease);
              setDisplayDiamonds(current);

              if (progress < 1) {
                requestAnimationFrame(animateCounter);
              } else {
                setTimeout(() => setShowBurst(false), 1000);
              }
            };
            requestAnimationFrame(animateCounter);
          } else {
            // Just hide burst after a while for feedback
            setTimeout(() => setShowBurst(false), 3000);
          }

        } else if (data.ResultadoTransaccion === "Rechazada" || data.ResultadoTransaccion === "Denegada" || data.ResultadoTransaccion === "Error") {
          const customMsg = data.Mensaje?.toLowerCase().includes("tarjeta") || data.Mensaje?.toLowerCase().includes("invalid")
            ? "Transacción Denegada: El número de la tarjeta es inválido."
            : "La transacción ha sido denegada o ha ocurrido un error.";
            
          setNotification({ msg: customMsg, type: 'error' });
          setTimeout(() => setNotification(null), 5000);
        }
      }
    };

    window.addEventListener('message', handleWompiMessage);

    return () => {
      window.removeEventListener('message', handleWompiMessage);
      supabase.removeChannel(profileChannel);
    };
  }, [user.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDiamondFrame(prev => (prev >= 61 ? 0 : prev + 1));
    }, 40);
    const feedbackTimer = setInterval(() => {
      setFeedbackFrame(prev => (prev >= 48 ? 1 : prev + 1));
    }, 40);
    return () => {
      clearInterval(timer);
      clearInterval(feedbackTimer);
    };
  }, []);

  // Faster animation for burst
  useEffect(() => {
    let timer: any;
    if (showBurst) {
      timer = setInterval(() => {
        setBurstFrame(prev => (prev >= 61 ? 0 : prev + 1));
      }, 20);
    }
    return () => clearInterval(timer);
  }, [showBurst]);

  const handleManualReport = async (item: string, amount: number) => {
    const voucher = prompt(`Introduce el ID de transacción de Wompi para tu compra de ${item}:`);
    if (!voucher) return;

    setLoading(true);
    try {
      let updates: any = {};
      if (item === 'DIAMOND') updates.store_diamonds = (profile.store_diamonds || 0) + 100;
      if (item === 'VERIFICATION') {
        updates.is_verified = true;
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        updates.verified_until = nextYear.toISOString();
      }
      if (item === 'PROJECT_VERIFICATION') {
        updates.project_trust_insignia_count = (profile.project_trust_insignia_count || 0) + 1;
      }
      if (item === 'INVESTOR_VERIFICATION') {
        updates.is_verified = true;
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        updates.verified_until = nextYear.toISOString();
      }
      if (item === 'PREFERENTIAL_LOCATION') {
        updates.pref_location_count = (profile.pref_location_count || 0) + 1;
      }
      if (item === 'VISION') updates.project_vision_units = (profile.project_vision_units || 0) + 1;
      if (item === 'FEEDBACK') {
        updates.feedback_count = (profile.feedback_count || 0) + 1;
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;
      
      alert(`¡Compra de ${item} exitosa!`);
    } catch (err) {
      console.error(err);
      alert("Error al procesar la compra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="max-w-6xl mx-auto px-2 py-6"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
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

      {notification && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md p-4 rounded-2xl shadow-2xl border animate-bounce-short ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{notification.type === 'success' ? '✅' : '❌'}</span>
            <p className="text-xs font-black uppercase tracking-tight">{notification.msg}</p>
          </div>
        </div>
      )}

      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 mb-3 italic">
          Catálogo <span className="text-blue-600">NewBank Store</span>
        </h1>
        <p className="sr-only">
          Los mejores Artículos Tácticos y Microcréditos en El Salvador
        </p>
        <div className="flex flex-wrap justify-center gap-2 bg-white p-2 rounded-2xl shadow-md inline-flex border border-slate-100 text-sm">
          <div className="flex items-center gap-1 px-2 relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 bg-blue-400/20 blur-sm animate-pulse"></div>
            <img 
              src={`https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newBankVideoDiamanteAnimado/videoDiamante_${diamondFrame.toString().padStart(3, '0')}-removebg-preview.png`} 
              alt="Diamond" 
              className="w-5 h-5 object-contain relative z-10"
            />
            <span className="font-black text-slate-700 relative z-10">{displayDiamonds}</span>
          </div>
          <div className="flex items-center gap-1 border-l border-r px-2">
            <span className="text-lg animate-pulse">🛡️</span>
            <span className="font-black text-slate-700">{profile.project_trust_insignia_count || 0}</span>
          </div>
          <div className="flex items-center gap-1 border-r px-2">
            <span className="text-lg animate-bounce">📍</span>
            <span className="font-black text-slate-700">{profile.pref_location_count || 0}</span>
          </div>
          <div className="flex items-center gap-1 border-r px-2 relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 bg-yellow-400/20 blur-sm animate-pulse"></div>
            <img 
              src={`https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newBankVideoFeedbackAnimado/final_video_feedback_${feedbackFrame.toString().padStart(3, '0')}-removebg-preview.png`} 
              alt="Feedback" 
              className="w-5 h-5 object-contain relative z-10"
            />
            <span className="font-black text-slate-700 relative z-10">{profile.feedback_count || 0}</span>
          </div>
          <div className="flex items-center gap-1 px-2">
            <span className="text-lg animate-spin-slow">🔍</span>
            <span className="font-black text-slate-700">{profile.project_vision_units || 0}</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-8 flex flex-col md:flex-row justify-around items-center gap-4 animate-fade-in shadow-inner">
        <div className="text-center md:text-left">
          <div className="text-base font-black text-blue-600 uppercase italic">Escala</div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tu capacidad crece con tus diamantes</p>
        </div>
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
          {[
            { diamonds: 100, loan: 25 },
            { diamonds: 200, loan: 50 },
            { diamonds: 300, loan: 75 }
          ].map((tier, idx) => (
            <div key={idx} className="bg-white p-2 rounded-xl shadow-md border-2 border-white hover:border-blue-400 transition-all group flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-600 blur-[20px] opacity-30 group-hover:opacity-60 transition-opacity animate-pulse"></div>
              <div className="absolute inset-0 bg-cyan-400 blur-[10px] opacity-20 animate-pulse delay-75"></div>
              
              <div className="relative mb-1 z-10">
                <img 
                  src={`https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newBankVideoDiamanteAnimado/videoDiamante_${diamondFrame.toString().padStart(3, '0')}-removebg-preview.png`} 
                  alt="Diamond" 
                  className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                />
              </div>
              
              <span className="text-lg font-black text-slate-900 block mb-0.5 relative z-10">{tier.diamonds}</span>
              <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest block mb-0.5 relative z-10">De ${tier.loan}</span>
              <span className="text-[7px] font-bold text-slate-400 uppercase relative z-10">Tasa de Interés: 20%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* DIAMANTE 4 */}
        <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-white hover:border-blue-400 transition-all group flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-blue-600 blur-[30px] opacity-40 group-hover:opacity-80 transition-opacity animate-pulse"></div>
            <div className="absolute inset-0 bg-cyan-400 blur-[15px] opacity-20 animate-pulse delay-75"></div>
            <img 
              src={`https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newBankVideoDiamanteAnimado/videoDiamante_${diamondFrame.toString().padStart(3, '0')}-removebg-preview.png`} 
              alt="Diamond Animated" 
              className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(59,130,246,1)]"
            />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900 mb-1">Diamante</h3>
          <p className="text-[9px] font-bold text-slate-500 mb-3 leading-tight flex-grow">
            Obtén <span className="text-blue-600 font-black">4 diamantes</span> para usar en la plataforma.
          </p>
          <div className="text-xl font-black text-blue-600 mb-3">$1.00</div>
          {showWompi && <WompiWidget urlPago="https://pagos.wompi.sv/IntentoPago/Redirect?id=1e253dc2-8de0-4277-b55d-a8570a31177a&esWidget=1" />}
        </div>

        {/* DIAMANTE 20 */}
        <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-white hover:border-blue-400 transition-all group flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-blue-600 blur-[30px] opacity-40 group-hover:opacity-80 transition-opacity animate-pulse"></div>
            <div className="absolute inset-0 bg-cyan-400 blur-[15px] opacity-20 animate-pulse delay-75"></div>
            <img 
              src={`https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newBankVideoDiamanteAnimado/videoDiamante_${diamondFrame.toString().padStart(3, '0')}-removebg-preview.png`} 
              alt="Diamond Animated" 
              className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(59,130,246,1)]"
            />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900 mb-1">Diamante</h3>
          <p className="text-[9px] font-bold text-slate-500 mb-3 leading-tight flex-grow">
            Obtén <span className="text-blue-600 font-black">20 diamantes</span> para usar en la plataforma.
          </p>
          <div className="text-xl font-black text-blue-600 mb-3">$5.00</div>
          {showWompi && <WompiWidget urlPago="https://pagos.wompi.sv/IntentoPago/Redirect?id=bcc4870c-7acc-40f6-ac40-b27b782e64a5&esWidget=1" />}
        </div>

        {/* DIAMANTE */}
        <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-white hover:border-blue-400 transition-all group flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-blue-600 blur-[30px] opacity-40 group-hover:opacity-80 transition-opacity animate-pulse"></div>
            <div className="absolute inset-0 bg-cyan-400 blur-[15px] opacity-20 animate-pulse delay-75"></div>
            <img 
              src={`https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newBankVideoDiamanteAnimado/videoDiamante_${diamondFrame.toString().padStart(3, '0')}-removebg-preview.png`} 
              alt="Diamond Animated" 
              className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(59,130,246,1)]"
            />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900 mb-1">Diamante</h3>
          <p className="text-[9px] font-bold text-slate-500 mb-3 leading-tight flex-grow">
            Obtén <span className="text-blue-600 font-black">100 diamantes</span> por 25 dólares. 
            Habilita la opción de realizar un <span className="text-slate-900 font-black">de 25 dólares</span> con una tasa de interés del 20%.
          </p>
          <div className="text-xl font-black text-blue-600 mb-3">$25.00</div>
          {showWompi && <WompiWidget urlPago="https://pagos.wompi.sv/IntentoPago/Redirect?id=0c791599-d163-4cde-b410-1865c1d7e04b&esWidget=1" />}
        </div>

        {/* INSIGNIA DE PROYECTO */}
        <div 
          className="bg-white p-4 rounded-2xl shadow-lg border-2 border-white hover:border-green-400 transition-all group flex flex-col items-center text-center blur-[2px] cursor-pointer"
          onClick={() => alert("participa para desbloquear nuevas promociones")}
        >
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-green-400 blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <img src="https://cdn-icons-png.flaticon.com/512/7641/7641727.png" alt="Verified" className="w-16 h-16 object-contain animate-pulse relative z-10" style={{ animationDuration: '1.5s' }} />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900 mb-1">Insignia de Confianza en proyecto</h3>
          <p className="text-[9px] font-bold text-slate-500 mb-3 leading-tight flex-grow">Adquiere unidades de validación para destacar tus proyectos con sello de confianza.</p>
          <div className="text-xl font-black text-green-600 mb-2">$25.00</div>
          <button className="w-full py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition">Comprar Unidad</button>
        </div>

        {/* UBICACION PREFERENCIAL */}
        <div 
          className="bg-white p-4 rounded-2xl shadow-lg border-2 border-white hover:border-purple-400 transition-all group flex flex-col items-center text-center blur-[2px] cursor-pointer"
          onClick={() => alert("participa para desbloquear nuevas promociones")}
        >
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-purple-400 blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <img src="https://cdn-icons-png.flaticon.com/512/1865/1865269.png" alt="Location" className="w-16 h-16 object-contain animate-bounce relative z-10" style={{ animationDuration: '3s' }} />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900 mb-1">ubicacion preferencial</h3>
          <p className="text-[9px] font-bold text-slate-500 mb-3 leading-tight flex-grow">Obtén el derecho a posicionar un proyecto en los primeros lugares de la galería.</p>
          <div className="text-xl font-black text-purple-600 mb-2">$50.00</div>
          <button className="w-full py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition">Adquirir Unidad</button>
        </div>

        {/* FEEDBACK IA */}
        <div 
          className="bg-white p-4 rounded-2xl shadow-lg border-2 border-white hover:border-yellow-400 transition-all group flex flex-col items-center text-center"
        >
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-yellow-400 blur-[30px] opacity-40 group-hover:opacity-80 transition-opacity animate-pulse"></div>
            <img 
              src={`https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newBankVideoFeedbackAnimado/final_video_feedback_${feedbackFrame.toString().padStart(3, '0')}-removebg-preview.png`} 
              alt="Feedback Animated" 
              className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(234,179,8,1)]" 
            />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900 mb-1">Comprar Feedback</h3>
          <p className="text-[9px] font-bold text-slate-500 mb-3 leading-tight flex-grow">
            Adquiere análisis detallados de IA para mejorar la viabilidad de tus proyectos. <br/>
            <span className="text-yellow-600 font-black">Se agregarán 100 puntos para Feedback.</span>
          </p>
          <div className="text-xl font-black text-yellow-600 mb-3">$10.00</div>
          {showWompi && <WompiWidget urlPago="https://pagos.wompi.sv/IntentoPago/Redirect?id=48d3c8cf-dbfa-4af3-8f09-5d4baa4473a9&esWidget=1" />}
        </div>

        {/* PODER DE VISION */}
        <div 
          className="bg-white p-4 rounded-2xl shadow-lg border-2 border-white hover:border-indigo-400 transition-all group flex flex-col items-center text-center blur-[2px] cursor-pointer"
          onClick={() => alert("participa para desbloquear nuevas promociones")}
        >
          <div className="relative mb-3">
            <div className="absolute inset-0 bg-indigo-400 blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <img src="https://cdn-icons-png.flaticon.com/512/1000/1000946.png" alt="Vision" className="w-16 h-16 object-contain relative z-10 animate-spin-slow" />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900 mb-1">Poder de Visión</h3>
          <p className="text-[9px] font-bold text-slate-500 mb-3 leading-tight flex-grow">Desbloquea detalles de proyectos privados.</p>
          <div className="text-xl font-black text-indigo-600 mb-2">$5.00</div>
          <button className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition">Desbloquear Visión</button>
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
                ${hoveredProduct.price?.toFixed(2)}
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
                    onClick={() => handleAddToWishlist(hoveredProduct.id)}
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

      {/* SECCIÓN DE PRODUCTOS PROPIOS */}
      <div className="mt-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <AnimatePresence>
            {showSectionInfo && (
              <motion.h2 
                initial={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
                transition={{ duration: 0.5 }}
                className="hidden text-2xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2"
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
              <div className="flex flex-wrap gap-4">
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
              </div>
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
                  <span className="text-slate-900 font-bold text-[10px] sm:text-sm">${product.price?.toFixed(2)}</span>
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
                            onClick={() => handlePurchase(product, cardQuantities[product.id] || 1)}
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
                        onClick={() => handleAddToWishlist(product.id)}
                        disabled={loading}
                        className="flex-1 py-2 bg-slate-900 text-white rounded-full font-bold uppercase text-[9px] tracking-widest hover:bg-black transition-all transform active:scale-95 shadow-sm disabled:opacity-50"
                      >
                        {loading ? '...' : 'Deseos'}
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
        {products.length === 0 && (
          <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-black uppercase text-xs tracking-widest italic">No hay productos disponibles en este momento</p>
          </div>
        )}
        <style dangerouslySetInnerHTML={{ __html: storeStyles }} />
      </div>
    </div>
  );
};

const storeStyles = `
  img {
    pointer-events: none;
    user-select: none;
    -webkit-user-drag: none;
    user-drag: none;
  }
  @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .animate-spin-slow { animation: spin-slow 10s linear infinite; }
  .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes bounce-short { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -10px); } }
  .animate-bounce-short { animation: bounce-short 1s ease-in-out infinite; }
  @keyframes float-up {
    0% { transform: translateY(100vh) scale(0.5); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translateY(-10vh) scale(1.5); opacity: 0; }
  }
  .animate-float-up { animation: float-up 2s linear forwards; }
  @keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  .animate-scale-up { animation: scaleUp 0.3s ease-out forwards; }
`;

export default Store;

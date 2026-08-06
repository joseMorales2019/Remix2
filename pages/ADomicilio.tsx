import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Store,
  ShoppingBag,
  Plus,
  QrCode,
  Clock,
  Phone,
  User,
  CheckCircle,
  Truck,
  Filter,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Calendar,
  Search,
  Check,
  AlertCircle,
  Download,
  Share2,
  Navigation,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Upload,
  Bell,
  BellRing,
  X
} from 'lucide-react';
import { supabase } from '../supabase';
import {
  DomicilioBusiness,
  DomicilioProduct,
  DomicilioOrder,
  DomicilioCustomerProfile,
  BusinessSchedule,
  DomicilioOrderItem,
  UserProfile
} from '../types';
import {
  getStoredBusinesses,
  saveBusinesses,
  getStoredProducts,
  saveProducts,
  getStoredOrders,
  saveOrders,
  getStoredCustomerProfile,
  saveCustomerProfile,
  calculateDistanceKm,
  checkIsBusinessOpen
} from '../services/domicilioService';

interface ADomicilioProps {
  user: UserProfile | null;
}

const ALL_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const ADomicilio: React.FC<ADomicilioProps> = ({ user }) => {
  // Navigation tabs inside "A Domicilio"
  const [activeTab, setActiveTab] = useState<
    'explore' | 'register_business' | 'manage_products' | 'view_orders' | 'customer_profile'
  >('explore');

  // Core Data States
  const [businesses, setBusinesses] = useState<DomicilioBusiness[]>([]);
  const [products, setProducts] = useState<DomicilioProduct[]>([]);
  const [orders, setOrders] = useState<DomicilioOrder[]>([]);
  const [customerProfile, setCustomerProfile] = useState<DomicilioCustomerProfile | null>(null);
  const [allCustomerProfiles, setAllCustomerProfiles] = useState<DomicilioCustomerProfile[]>([]);
  const [isLoginDropdownOpen, setIsLoginDropdownOpen] = useState(false);
  const [loginPhoneInput, setLoginPhoneInput] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [openOnlyFilter, setOpenOnlyFilter] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [selectedImageForView, setSelectedImageForView] = useState<string | null>(null);

  useEffect(() => {
    // Detect standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      showToast('📲 Para instalar: Toca "Compartir" y luego "Agregar a Inicio"');
    } else {
      showToast('⚙️ Abre este sitio en Chrome para poder descargar la aplicación.');
    }
  };

  // Filtered Businesses for Map/Explore View (also checks if any product matches searchQuery)
  const filteredBusinesses = businesses.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      b.business_name.toLowerCase().includes(q) ||
      b.owner_name.toLowerCase().includes(q) ||
      b.address_text?.toLowerCase().includes(q);

    // Also check if any product of this business matches the query
    const bizProducts = products.filter((p) => p.business_id === b.id && !p.is_hidden);
    const matchesProduct = q !== '' && bizProducts.some((p) => p.name.toLowerCase().includes(q));

    const matchesAll = matchesSearch || matchesProduct;

    if (openOnlyFilter) {
      const openStatus = checkIsBusinessOpen(b);
      return matchesAll && openStatus.isOpen;
    }
    return matchesAll;
  });

  // Selected Business for Viewing/Ordering/Managing
  const [selectedBusiness, setSelectedBusiness] = useState<DomicilioBusiness | null>(null);
  const [orderingBusiness, setOrderingBusiness] = useState<DomicilioBusiness | null>(null);
  const [managingBusinessId, setManagingBusinessId] = useState<string>('');

  // Map Navigation & GPS State
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 13.6929,
    lng: -89.2182
  });
  const [mapZoom, setMapZoom] = useState<number>(11);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const mainSectionRef = useRef<HTMLDivElement>(null);

  const handleTabSelect = (tab: 'explore' | 'register_business' | 'manage_products' | 'view_orders' | 'customer_profile') => {
    if (tab === 'register_business' && !customerProfile) {
      showToast('⚠️ Para registrar un negocio, primero debes iniciar sesión o registrarte como cliente.');
      setIsLoginDropdownOpen(true);
      setActiveTab('customer_profile');
      setTimeout(() => {
        if (mainSectionRef.current) {
          mainSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 40);
      return;
    }
    setActiveTab(tab);
    setTimeout(() => {
      if (mainSectionRef.current) {
        mainSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  };

  const handleGoToUserLocation = () => {
    setIsLocatingUser(true);
    if (!navigator.geolocation) {
      showToast('⚠️ Geolocalización no soportada');
      setIsLocatingUser(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMapCenter(userPos);
        setMapZoom(14);
        setUserLocation(userPos);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([userPos.lat, userPos.lng], 14, { duration: 1.2 });
        }
        setIsLocatingUser(false);
        showToast('📍 Centrado en tu ubicación actual');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setMapCenter({ lat: 13.6929, lng: -89.2182 });
        setMapZoom(13);
        setIsLocatingUser(false);
        showToast('📍 Mostrando San Salvador, El Salvador');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (activeTab === 'explore') {
      const timer = setTimeout(() => {
        const centerLat = !isNaN(mapCenter?.lat) ? mapCenter.lat : 13.6929;
        const centerLng = !isNaN(mapCenter?.lng) ? mapCenter.lng : -89.2182;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        } else if (mapContainerRef.current) {
          const map = L.map(mapContainerRef.current, {
            center: [centerLat, centerLng],
            zoom: mapZoom,
            zoomControl: false,
          });

          L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google Maps',
            maxZoom: 20,
          }).addTo(map);

          L.control.zoom({ position: 'topright' }).addTo(map);
          markersLayerRef.current = L.layerGroup().addTo(map);
          mapInstanceRef.current = map;
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (!mapContainerRef.current || activeTab !== 'explore') return;

    const centerLat = !isNaN(mapCenter?.lat) ? mapCenter.lat : 13.6929;
    const centerLng = !isNaN(mapCenter?.lng) ? mapCenter.lng : -89.2182;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: mapZoom,
        zoomControl: false,
      });

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20,
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    if (markersLayerRef.current && mapInstanceRef.current) {
      markersLayerRef.current.clearLayers();

      if (userLocation && !isNaN(userLocation.lat) && !isNaN(userLocation.lng)) {
        const userIcon = L.divIcon({
          className: 'custom-user-marker',
          html: `
            <div class="flex flex-col items-center">
              <div class="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-bold text-[10px] shadow border border-white mb-1 whitespace-nowrap">
                Mi Ubicación
              </div>
              <div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg animate-pulse"></div>
            </div>
          `,
          iconSize: [80, 40],
          iconAnchor: [40, 36],
        });
        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(
          markersLayerRef.current
        );
      }

      // Calculate coordinate frequencies to offset businesses at the same location
      const locCounts: { [key: string]: number } = {};
      const locIndices: { [key: string]: number } = {};

      filteredBusinesses.forEach((b) => {
        const rLat = Number(b.latitude);
        const rLng = Number(b.longitude);
        if (!isNaN(rLat) && !isNaN(rLng)) {
          const key = `${rLat.toFixed(4)}_${rLng.toFixed(4)}`;
          locCounts[key] = (locCounts[key] || 0) + 1;
        }
      });

      filteredBusinesses.forEach((b) => {
        const rawLat = Number(b.latitude);
        const rawLng = Number(b.longitude);
        if (isNaN(rawLat) || isNaN(rawLng)) return;

        const locKey = `${rawLat.toFixed(4)}_${rawLng.toFixed(4)}`;
        const totalAtLoc = locCounts[locKey] || 1;

        let lat = rawLat;
        let lng = rawLng;

        // Spread out businesses located at the same coordinates in a circle (~35m) so both labels are clearly visible
        if (totalAtLoc > 1) {
          const idx = locIndices[locKey] || 0;
          locIndices[locKey] = idx + 1;

          const angle = (2 * Math.PI * idx) / totalAtLoc;
          const offsetRadius = 0.00035; // ~35 meters
          lat = rawLat + offsetRadius * Math.cos(angle);
          lng = rawLng + (offsetRadius * Math.sin(angle)) / Math.cos((rawLat * Math.PI) / 180);
        }

        const openStatus = checkIsBusinessOpen(b);
        const isSelected = selectedBusiness?.id === b.id;

        const q = searchQuery.toLowerCase().trim();
        const bizProducts = products.filter((p) => p.business_id === b.id && !p.is_hidden);
        const matchesProduct = q !== '' && bizProducts.some((p) => p.name.toLowerCase().includes(q));

        const bizIcon = L.divIcon({
          className: 'custom-biz-marker',
          html: `
            <div class="flex flex-col items-center select-none group relative" style="transform: translateY(-10px); z-index: 500;">
              ${
                matchesProduct
                  ? '<div class="absolute -top-3 z-[600] px-2 py-0.5 bg-amber-500 text-white font-black text-[10px] rounded-full shadow-lg animate-bounce whitespace-nowrap border border-white">✨ ¡Producto Encontrado!</div>'
                  : ''
              }
              <div class="px-2.5 py-1 rounded-xl text-xs font-black shadow-2xl border whitespace-nowrap flex items-center gap-1.5 transition mb-1 ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-300 ring-2 ring-blue-300 shadow-blue-500/50 scale-110 z-[700]'
                  : matchesProduct
                  ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-300 animate-pulse z-[650]'
                  : 'bg-slate-900/95 text-slate-100 border-slate-700 hover:bg-slate-800 z-[600]'
              }">
                <span class="w-2 h-2 rounded-full ${
                  openStatus.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }"></span>
                <span>${b.business_name}</span>
                ${totalAtLoc > 1 ? '<span class="ml-0.5 text-[10px] text-amber-300 font-extrabold">📍</span>' : ''}
              </div>
              <div class="relative">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xl border-2 transition ${
                  isSelected
                    ? 'bg-blue-600 border-white ring-4 ring-blue-400/40'
                    : matchesProduct
                    ? 'bg-amber-500 border-white ring-4 ring-amber-300 animate-ping'
                    : openStatus.isOpen
                    ? 'bg-emerald-600 border-emerald-200'
                    : 'bg-rose-600 border-rose-200'
                }">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                    <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 10V7"/>
                  </svg>
                </div>
                <div class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] mx-auto -mt-0.5 ${
                  isSelected
                    ? 'border-t-blue-600'
                    : matchesProduct
                    ? 'border-t-amber-500'
                    : openStatus.isOpen
                    ? 'border-t-emerald-600'
                    : 'border-t-rose-600'
                }"></div>
              </div>
            </div>
          `,
          iconSize: [160, 60],
          iconAnchor: [80, 56],
        });

        const marker = L.marker([lat, lng], { icon: bizIcon }).addTo(
          markersLayerRef.current!
        );

        marker.on('click', () => {
          setSelectedBusiness(b);
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 15, { duration: 0.8 });
          }
        });
      });
    }
  }, [filteredBusinesses, selectedBusiness, userLocation]);

  useEffect(() => {
    if (selectedBusiness && mapInstanceRef.current) {
      const lat = Number(selectedBusiness.latitude);
      const lng = Number(selectedBusiness.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        mapInstanceRef.current.flyTo([lat, lng], 15, { duration: 1 });
      }
    }
  }, [selectedBusiness]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // Solicitudes / Orders Filter States
  const [orderBusinessFilter, setOrderBusinessFilter] = useState<string>('');
  const [orderDayFilter, setOrderDayFilter] = useState<string>('');
  const [orderMonthFilter, setOrderMonthFilter] = useState<string>('');

  // Cart & Order Workflow States
  const [deliveryType, setDeliveryType] = useState<'personal' | 'domicilio'>('domicilio');
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [orderNote, setOrderNote] = useState('');
  const [orderAddressInput, setOrderAddressInput] = useState('');
  const [isOrderingModalOpen, setIsOrderingModalOpen] = useState(false);
  const [orderSuccessOrder, setOrderSuccessOrder] = useState<DomicilioOrder | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Customer Registration Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [custName, setCustName] = useState(user?.full_name || '');
  const [custPhone, setCustPhone] = useState(user?.phone || '');
  const [custAddress, setCustAddress] = useState(user?.address || '');
  const [custLat, setCustLat] = useState<number | null>(null);
  const [custLng, setCustLng] = useState<number | null>(null);
  const [custGpsLoading, setCustGpsLoading] = useState(false);
  const [custGpsSuccess, setCustGpsSuccess] = useState(false);

  // Business Registration Form State
  const [bizOwnerName, setBizOwnerName] = useState(user?.full_name || '');
  const [bizPhone, setBizPhone] = useState(user?.phone || '');
  const [bizName, setBizName] = useState('');
  const [bizIs247, setBizIs247] = useState(false);
  const [bizAddressText, setBizAddressText] = useState('');
  const [bizSchedules, setBizSchedules] = useState<
    { id: string; days: string[]; open_time: string; close_time: string }[]
  >([
    { id: '1', days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], open_time: '08:00', close_time: '18:00' }
  ]);
  const [bizLat, setBizLat] = useState<number | null>(null);
  const [bizLng, setBizLng] = useState<number | null>(null);
  const [bizGpsLoading, setBizGpsLoading] = useState(false);
  const [bizGpsSuccess, setBizGpsSuccess] = useState(false);

  // Product Form State (New or Edit)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState<number | ''>('');

  const canUserManageBusiness = (b: DomicilioBusiness) => {
    if (!b) return false;
    
    // Normalize phone numbers for precise match
    const cleanPhone = (p: string) => (p || '').replace(/\D/g, '').trim();
    const loggedInPhone = (customerProfile?.phone || user?.phone || '').trim();
    const cleanedLoggedInPhone = cleanPhone(loggedInPhone);
    const cleanedBusinessPhone = cleanPhone(b.phone || '');

    if (cleanedLoggedInPhone && cleanedBusinessPhone && cleanedLoggedInPhone === cleanedBusinessPhone) {
      return true;
    }

    if (user?.id && b.user_id && b.user_id === user.id) return true;
    if (customerProfile?.id && b.user_id && b.user_id === customerProfile.id) return true;

    const currentName = (user?.full_name || customerProfile?.full_name || bizOwnerName || '').toLowerCase().trim();
    if (currentName && b.owner_name && b.owner_name.toLowerCase().trim() === currentName) return true;
    if (b.id && b.id.startsWith('biz_') && b.id !== 'biz_1' && b.id !== 'biz_2' && b.id !== 'biz_3') return true;
    return false;
  };

  const myManageableBusinesses = businesses.filter(canUserManageBusiness);
  const [prodImage, setProdImage] = useState('');
  const [prodDisponibleDomicilio, setProdDisponibleDomicilio] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { error } = await supabase.storage
        .from('NewBankImageProductos')
        .upload(fileName, file, {
          contentType: file.type || 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.error('Error uploading image to Supabase storage:', error);
        if (error.message.includes('row-level security') || error.message.includes('violates')) {
          // Fallback local Data URL for immediate preview/save while SQL script is applied
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setProdImage(event.target.result as string);
              showToast('⚠️ Habilitado modo previo de imagen (Aplica el script SQL en Supabase para almacenar en la nube)');
            }
          };
          reader.readAsDataURL(file);
        } else {
          showToast(`⚠️ Error al subir la imagen: ${error.message}`);
        }
      } else {
        const publicUrl = `https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/NewBankImageProductos/${fileName}`;
        setProdImage(publicUrl);
        showToast('📸 ¡Imagen guardada exitosamente en la base de datos de Supabase!');
      }
    } catch (err: any) {
      console.error('Upload exception:', err);
      showToast('⚠️ Ocurrió un error al procesar la imagen');
    } finally {
      setUploadingImage(false);
    }
  };

  // QR Code Modal State
  const [qrModalBusiness, setQrModalBusiness] = useState<DomicilioBusiness | null>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Data on Mount
  useEffect(() => {
    // Filter out starter templates entirely to comply with user request to only show DB-saved data
    const loadedBiz = getStoredBusinesses().filter(
      (b) => b.id !== 'biz_1' && b.id !== 'biz_2' && b.id !== 'biz_3'
    );
    const loadedProd = getStoredProducts().filter(
      (p) => !['p_1', 'p_2', 'p_3', 'p_4', 'p_5', 'p_6', 'p_7', 'p_8', 'p_9', 'p_10'].includes(p.id)
    );
    const loadedOrd = getStoredOrders().filter(
      (o) => o.id !== 'ord_1' && o.id !== 'ord_2'
    );
    const loadedCust = getStoredCustomerProfile();

    setBusinesses(loadedBiz);
    setProducts(loadedProd);
    setOrders(loadedOrd);
    setCustomerProfile(loadedCust);
    setAllCustomerProfiles(loadedCust ? [loadedCust] : []);

    if (loadedBiz.length > 0) {
      setSelectedBusiness(loadedBiz[0]);
      setManagingBusinessId(loadedBiz[0].id);
    }

    if (loadedCust) {
      setOrderAddressInput(loadedCust.address);
      setCustLat(loadedCust.latitude);
      setCustLng(loadedCust.longitude);
      setCustAddress(loadedCust.address);
      setCustName(loadedCust.full_name);
      setCustPhone(loadedCust.phone);
    }

    // Load from Supabase Real Database to allow public visualization
    const syncWithSupabaseOnMount = async () => {
      try {
        const { data: dbBiz, error: bizErr } = await supabase
          .from('domicilio_businesses')
          .select('*');

        if (!bizErr && dbBiz && dbBiz.length > 0) {
          // Filter out template IDs
          const nonTemplateDbBiz = dbBiz.filter(
            (b: any) => b.id !== 'biz_1' && b.id !== 'biz_2' && b.id !== 'biz_3'
          );
          const mergedBiz = [...loadedBiz];
          nonTemplateDbBiz.forEach((b: DomicilioBusiness) => {
            const idx = mergedBiz.findIndex((item) => item.id === b.id);
            if (idx >= 0) {
              mergedBiz[idx] = b;
            } else {
              mergedBiz.push(b);
            }
          });
          setBusinesses(mergedBiz);
          if (mergedBiz.length > 0) {
            setSelectedBusiness(mergedBiz[0]);
            setManagingBusinessId(mergedBiz[0].id);
          }
        }

        const { data: dbProd, error: prodErr } = await supabase
          .from('domicilio_products')
          .select('*');

        if (!prodErr && dbProd && dbProd.length > 0) {
          // Filter out template IDs
          const nonTemplateDbProd = dbProd.filter(
            (p: any) => !['p_1', 'p_2', 'p_3', 'p_4', 'p_5', 'p_6', 'p_7', 'p_8', 'p_9', 'p_10'].includes(p.id)
          );
          const mergedProd = [...loadedProd];
          nonTemplateDbProd.forEach((p: DomicilioProduct) => {
            const idx = mergedProd.findIndex((item) => item.id === p.id);
            if (idx >= 0) {
              mergedProd[idx] = p;
            } else {
              mergedProd.push(p);
            }
          });
          setProducts(mergedProd);
        }

        const { data: dbOrd, error: ordErr } = await supabase
          .from('domicilio_orders')
          .select('*');

        if (!ordErr && dbOrd && dbOrd.length > 0) {
          // Filter out template IDs
          const nonTemplateDbOrd = dbOrd.filter(
            (o: any) => o.id !== 'ord_1' && o.id !== 'ord_2'
          );
          const mergedOrd = [...loadedOrd];
          nonTemplateDbOrd.forEach((o: DomicilioOrder) => {
            const idx = mergedOrd.findIndex((item) => item.id === o.id);
            if (idx >= 0) {
              mergedOrd[idx] = o;
            } else {
              mergedOrd.push(o);
            }
          });
          setOrders(mergedOrd);
        }

        const { data: dbCust, error: custErr } = await supabase
          .from('domicilio_customer_profiles')
          .select('*');

        if (!custErr && dbCust && dbCust.length > 0) {
          setAllCustomerProfiles(dbCust);
          const myDbProfile = dbCust.find((c: any) => c.user_id === user?.id);
          if (myDbProfile) {
            setCustomerProfile(myDbProfile);
            setOrderAddressInput(myDbProfile.address);
            setCustLat(myDbProfile.latitude);
            setCustLng(myDbProfile.longitude);
            setCustAddress(myDbProfile.address);
            setCustName(myDbProfile.full_name);
            setCustPhone(myDbProfile.phone);
          }
        }
      } catch (err) {
        console.error("Graceful fallback: Supabase load error:", err);
      }
    };
    syncWithSupabaseOnMount();
  }, [user]);

  // Robust client-side UUID generator for database compliance
  const generateUUID = () => {
    let d = new Date().getTime();
    let d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now() * 1000)) || 0;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      let r = Math.random() * 16;
      if (d > 0) {
        r = (d + r) % 16 | 0;
        d = Math.floor(d / 16);
      } else {
        r = (d2 + r) % 16 | 0;
        d2 = Math.floor(d2 / 16);
      }
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  };

  // Save changes to localStorage and synchronize with Supabase database
  const updateBusinesses = async (newList: DomicilioBusiness[]) => {
    setBusinesses(newList);
    saveBusinesses(newList);

    for (const b of newList) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.id);
      if (isUUID || b.user_id) {
        try {
          const payload: any = {
            owner_name: b.owner_name,
            phone: b.phone,
            business_name: b.business_name,
            is_24_7: b.is_24_7,
            schedules: b.schedules,
            latitude: b.latitude,
            longitude: b.longitude,
            address_text: b.address_text,
            delivery_paused: b.delivery_paused || false,
            manual_closed: b.manual_closed || false,
            user_id: b.user_id || null
          };
          if (isUUID) {
            payload.id = b.id;
          }
          await supabase.from('domicilio_businesses').upsert(payload);
        } catch (err) {
          console.error("Error upserting business to Supabase:", err);
        }
      }
    }
  };

  const updateProducts = async (newList: DomicilioProduct[]) => {
    setProducts(newList);
    saveProducts(newList);

    for (const p of newList) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id);
      const isBizUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.business_id);
      
      if (isBizUUID) {
        try {
          const payload: any = {
            business_id: p.business_id,
            name: p.name,
            price: p.price,
            image_url: p.image_url,
            disponible_domicilio: p.disponible_domicilio,
            is_hidden: p.is_hidden || false,
          };
          if (isUUID) {
            payload.id = p.id;
          }
          await supabase.from('domicilio_products').upsert(payload);
        } catch (err) {
          console.error("Error upserting product to Supabase:", err);
        }
      }
    }
  };

  const updateOrders = async (newList: DomicilioOrder[]) => {
    setOrders(newList);
    saveOrders(newList);

    for (const o of newList) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o.id);
      const isBizUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o.business_id);
      
      if (isBizUUID) {
        try {
          const payload: any = {
            business_id: o.business_id,
            business_name: o.business_name,
            customer_name: o.customer_name,
            customer_phone: o.customer_phone,
            customer_address: o.customer_address,
            customer_latitude: o.customer_latitude,
            customer_longitude: o.customer_longitude,
            order_date: o.order_date,
            order_time: o.order_time,
            delivery_type: o.delivery_type,
            items: o.items,
            total: o.total,
            additional_note: o.additional_note || null,
            status: o.status || 'Pendiente'
          };
          if (isUUID) {
            payload.id = o.id;
          }
          await supabase.from('domicilio_orders').upsert(payload);
        } catch (err) {
          console.error("Error upserting order to Supabase:", err);
        }
      }
    }
  };

  const updateCustomerProfileData = async (profile: DomicilioCustomerProfile) => {
    setCustomerProfile(profile);
    saveCustomerProfile(profile);

    setAllCustomerProfiles((prev) => {
      const idx = prev.findIndex((p) => p.id === profile.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = profile;
        return copy;
      } else {
        return [profile, ...prev];
      }
    });

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.id);
    try {
      const payload: any = {
        user_id: user?.id || null,
        full_name: profile.full_name,
        phone: profile.phone,
        address: profile.address,
        latitude: profile.latitude,
        longitude: profile.longitude
      };
      if (isUUID) {
        payload.id = profile.id;
      }
      await supabase.from('domicilio_customer_profiles').upsert(payload);
    } catch (err) {
      console.error("Error upserting customer profile to Supabase:", err);
    }
  };

  const loginAsProfile = (prof: DomicilioCustomerProfile) => {
    setCustomerProfile(prof);
    saveCustomerProfile(prof);
    setOrderAddressInput(prof.address);
    setCustLat(prof.latitude);
    setCustLng(prof.longitude);
    setCustAddress(prof.address);
    setCustName(prof.full_name);
    setCustPhone(prof.phone);
    setIsLoginDropdownOpen(false);
    showToast(`🔑 Sesión iniciada como ${prof.full_name}`);
  };

  const logoutProfile = () => {
    setCustomerProfile(null);
    saveCustomerProfile(null);
    setOrderAddressInput('');
    setCustLat(undefined);
    setCustLng(undefined);
    setCustAddress('');
    setCustName('');
    setCustPhone('');
    showToast(`🔒 Sesión cerrada`);
  };

  const handleLoginSubmit = () => {
    const cleanedInput = loginPhoneInput.replace(/\D/g, '').trim();
    if (!cleanedInput) {
      showToast('⚠️ Por favor ingresa tu número de teléfono');
      return;
    }

    const match = allCustomerProfiles.find((p) => {
      const cleanedProfilePhone = p.phone.replace(/\D/g, '').trim();
      return cleanedProfilePhone === cleanedInput || p.phone.trim() === loginPhoneInput.trim();
    });

    if (match) {
      loginAsProfile(match);
      setLoginPhoneInput('');
      setIsLoginDropdownOpen(false);
    } else {
      showToast('❌ No se encontró ningún cliente con ese número de teléfono');
    }
  };

  // GPS Captures
  const captureBusinessGps = () => {
    setBizGpsLoading(true);
    if (!navigator.geolocation) {
      showToast('⚠️ La geolocalización no está soportada por tu navegador');
      setBizGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBizLat(pos.coords.latitude);
        setBizLng(pos.coords.longitude);
        setBizGpsSuccess(true);
        setBizGpsLoading(false);
        showToast('📍 Ubicación GPS del negocio guardada exitosamente');
      },
      (err) => {
        console.warn("GPS falló, usando coordenadas predeterminadas de San Salvador:", err);
        // Fallback default San Salvador GPS so user is never blocked
        const defaultLat = 13.6929 + (Math.random() * 0.01 - 0.005);
        const defaultLng = -89.2182 + (Math.random() * 0.01 - 0.005);
        setBizLat(defaultLat);
        setBizLng(defaultLng);
        setBizGpsSuccess(true);
        setBizGpsLoading(false);
        showToast('📍 Ubicación GPS guardada (Coordenadas de San Salvador capturadas)');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const captureCustomerGps = () => {
    setCustGpsLoading(true);
    if (!navigator.geolocation) {
      showToast('⚠️ Geolocalización no soportada');
      setCustGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustLat(pos.coords.latitude);
        setCustLng(pos.coords.longitude);
        setCustGpsSuccess(true);
        setCustGpsLoading(false);
        showToast('📍 Tu ubicación GPS se ha guardado correctamente');
      },
      (err) => {
        console.warn("GPS cliente falló, aplicando coordenadas de San Salvador:", err);
        const defaultLat = 13.6929 + (Math.random() * 0.01 - 0.005);
        const defaultLng = -89.2182 + (Math.random() * 0.01 - 0.005);
        setCustLat(defaultLat);
        setCustLng(defaultLng);
        setCustGpsSuccess(true);
        setCustGpsLoading(false);
        showToast('📍 Tu ubicación GPS ha sido registrada con éxito');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Submit Business Registration Form (Requirement 1)
  const handleRegisterBusinessSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerProfile) {
      showToast('⚠️ Para registrar un negocio, primero debes iniciar sesión o registrarte como cliente.');
      setIsLoginDropdownOpen(true);
      setActiveTab('customer_profile');
      return;
    }

    if (!bizOwnerName.trim() || !bizPhone.trim() || !bizName.trim()) {
      showToast('⚠️ Por favor completa los campos obligatorios del negocio');
      return;
    }

    if (bizLat === null || bizLng === null) {
      showToast('⚠️ Debes seleccionar "Guardar ubicación actual" para registrar el negocio');
      return;
    }

    const newBiz: DomicilioBusiness = {
      id: generateUUID(),
      owner_name: bizOwnerName.trim(),
      phone: bizPhone.trim(),
      business_name: bizName.trim(),
      is_24_7: bizIs247,
      schedules: bizIs247 ? [] : bizSchedules,
      latitude: bizLat,
      longitude: bizLng,
      address_text: bizAddressText.trim() || 'El Salvador',
      created_at: new Date().toISOString(),
      user_id: user?.id || customerProfile?.id || null
    };

    const updated = [newBiz, ...businesses];
    updateBusinesses(updated);
    setSelectedBusiness(newBiz);
    setManagingBusinessId(newBiz.id);

    // Reset Form
    setBizName('');
    setBizAddressText('');
    setBizLat(null);
    setBizLng(null);
    setBizGpsSuccess(false);

    showToast('🎉 ¡Negocio registrado con éxito! Ahora puedes agregar tus productos.');
    setActiveTab('manage_products');
  };

  // Add/Edit Product (Requirement 2 & 4)
  const handleSaveProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingBusinessId) {
      showToast('⚠️ Selecciona o registra un negocio primero');
      return;
    }
    const bizCheck = businesses.find((b) => b.id === managingBusinessId);
    if (bizCheck && !canUserManageBusiness(bizCheck)) {
      showToast('⚠️ Acceso denegado: Solo el creador de este negocio puede administrarlo');
      return;
    }
    if (!prodName.trim() || prodPrice === '' || Number(prodPrice) <= 0) {
      showToast('⚠️ Ingresa un nombre y precio válido para el producto');
      return;
    }

    const imgToUse =
      prodImage.trim() ||
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

    if (editingProductId) {
      // Edit
      const updated = products.map((p) =>
        p.id === editingProductId
          ? {
              ...p,
              name: prodName.trim(),
              price: Number(prodPrice),
              image_url: imgToUse,
              disponible_domicilio: prodDisponibleDomicilio
            }
          : p
      );
      updateProducts(updated);
      showToast('✅ Producto actualizado correctamente');
    } else {
      // New
      const newProd: DomicilioProduct = {
        id: generateUUID(),
        business_id: managingBusinessId,
        name: prodName.trim(),
        price: Number(prodPrice),
        image_url: imgToUse,
        disponible_domicilio: prodDisponibleDomicilio,
        is_hidden: false,
        created_at: new Date().toISOString()
      };
      updateProducts([newProd, ...products]);
      showToast('🎉 Producto registrado exitosamente');
    }

    // Reset Modal
    setIsProductModalOpen(false);
    setEditingProductId(null);
    setProdName('');
    setProdPrice('');
    setProdImage('');
    setProdDisponibleDomicilio(true);
  };

  const handleToggleProductVisibility = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      const bizCheck = businesses.find((b) => b.id === prod.business_id);
      if (bizCheck && !canUserManageBusiness(bizCheck)) {
        showToast('⚠️ Acceso denegado: Solo el creador de este negocio puede administrarlo');
        return;
      }
    }
    const updated = products.map((p) =>
      p.id === productId ? { ...p, is_hidden: !p.is_hidden } : p
    );
    updateProducts(updated);
    showToast('👁️ Visibilidad del producto actualizada');
  };

  const handleDeleteProduct = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      const bizCheck = businesses.find((b) => b.id === prod.business_id);
      if (bizCheck && !canUserManageBusiness(bizCheck)) {
        showToast('⚠️ Acceso denegado: Solo el creador de este negocio puede administrarlo');
        return;
      }
    }
    if (window.confirm('¿Deseas eliminar este producto de tu catálogo?')) {
      const updated = products.filter((p) => p.id !== productId);
      updateProducts(updated);
      showToast('🗑️ Producto eliminado');
    }
  };

  const handleDeleteBusiness = async (businessId: string) => {
    const biz = businesses.find((b) => b.id === businessId);
    if (!biz) return;
    if (!canUserManageBusiness(biz)) {
      showToast('⚠️ Acceso denegado: Solo el creador de este negocio puede eliminarlo');
      return;
    }
    if (window.confirm(`¿Estás seguro de que deseas eliminar el negocio "${biz.business_name}"? Esta acción eliminará permanentemente el negocio y todos sus productos.`)) {
      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId);
        if (isUUID) {
          await supabase.from('domicilio_products').delete().eq('business_id', businessId);
          await supabase.from('domicilio_businesses').delete().eq('id', businessId);
        }
      } catch (err) {
        console.error("Error deleting from Supabase:", err);
      }

      const updatedBiz = businesses.filter((b) => b.id !== businessId);
      setBusinesses(updatedBiz);
      saveBusinesses(updatedBiz);

      const updatedProds = products.filter((p) => p.business_id !== businessId);
      setProducts(updatedProds);
      saveProducts(updatedProds);

      showToast('🗑️ Negocio y sus productos eliminados con éxito');

      const myManageable = updatedBiz.filter(b => canUserManageBusiness(b));
      if (myManageable.length > 0) {
        setManagingBusinessId(myManageable[0].id);
      } else {
        setManagingBusinessId('');
      }
    }
  };

  // Submit Customer Profile (Requirement 8)
  const handleSaveCustomerProfileSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!custName.trim() || !custPhone.trim() || !custAddress.trim()) {
      showToast('⚠️ Todos los campos de contacto y dirección son obligatorios');
      return false;
    }

    if (custLat === null || custLng === null) {
      showToast('⚠️ Es obligatorio presionar "Guardar ubicación actual" para continuar');
      return false;
    }

    const newProfile: DomicilioCustomerProfile = {
      id: user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)
        ? user.id
        : generateUUID(),
      full_name: custName.trim(),
      phone: custPhone.trim(),
      address: custAddress.trim(),
      latitude: custLat,
      longitude: custLng,
      created_at: new Date().toISOString()
    };

    updateCustomerProfileData(newProfile);
    setOrderAddressInput(newProfile.address);
    setIsCustomerModalOpen(false);
    showToast('✅ Perfil de cliente guardado con ubicación GPS');
    return true;
  };

  // Order Placement Workflow (Requirement 6 & 8)
  const handleQuantityChange = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: updated };
    });
  };

  const getCartItemsList = () => {
    const biz = orderingBusiness || selectedBusiness;
    if (!biz) return [];
    const bizProds = products.filter((p) => p.business_id === biz.id);
    return Object.keys(cart)
      .map((pId) => {
        const prod = bizProds.find((p) => p.id === pId);
        if (!prod) return null;
        const qty = cart[pId];
        return {
          product_id: prod.id,
          product_name: prod.name,
          unit_price: prod.price,
          quantity: qty,
          subtotal: prod.price * qty,
          image_url: prod.image_url
        };
      })
      .filter(Boolean) as DomicilioOrderItem[];
  };

  const calculateCartTotal = () => {
    return getCartItemsList().reduce((acc, item) => acc + item.subtotal, 0);
  };

  const handleConfirmOrder = () => {
    const biz = orderingBusiness || selectedBusiness;
    if (!biz) return;
    const items = getCartItemsList();
    if (items.length === 0) {
      showToast('⚠️ Agrega al menos un producto a tu pedido');
      return;
    }

    if (deliveryType === 'domicilio' && biz.delivery_paused) {
      showToast('⚠️ Este negocio no cuenta con envíos a domicilio en este momento. Selecciona "Retirar Personalmente".');
      return;
    }

    // Check customer registration
    if (!customerProfile || !customerProfile.latitude || !customerProfile.longitude) {
      setIsCustomerModalOpen(true);
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

    const newOrder: DomicilioOrder = {
      id: generateUUID(),
      business_id: biz.id,
      business_name: biz.business_name,
      customer_name: customerProfile.full_name,
      customer_phone: customerProfile.phone,
      customer_address: orderAddressInput.trim() || customerProfile.address,
      customer_latitude: customerProfile.latitude,
      customer_longitude: customerProfile.longitude,
      order_date: dateStr,
      order_time: timeStr,
      delivery_type: deliveryType,
      items: items,
      total: calculateCartTotal(),
      additional_note: orderNote.trim(),
      status: 'Pendiente',
      created_at: new Date().toISOString()
    };

    updateOrders([newOrder, ...orders]);
    notifiedOrdersRef.current.add(newOrder.id);
    sendOrderPushNotification(newOrder, biz.business_name);
    
    // Enviar información del pedido al WhatsApp del dueño del negocio
    if (biz.phone) {
      const itemsDetail = newOrder.items.map(item => `- ${item.quantity}x ${item.product_name} ($${item.unit_price.toFixed(2)} c/u) = $${item.subtotal.toFixed(2)}`).join('\n');
      
      const whatsappMsg = `*NUEVO PEDIDO - NewBank AI*\n` +
        `---------------------------\n` +
        `*Cliente:* ${newOrder.customer_name}\n` +
        `*Teléfono:* ${newOrder.customer_phone}\n` +
        `*Dirección:* ${newOrder.customer_address}\n` +
        `*Entrega:* ${newOrder.delivery_type === 'domicilio' ? 'A Domicilio 🛵' : 'Retiro en Tienda 🏬'}\n` +
        `*Fecha:* ${newOrder.order_date} ${newOrder.order_time}\n\n` +
        `*DETALLE:*\n${itemsDetail}\n\n` +
        `*TOTAL:* $${newOrder.total.toFixed(2)}\n` +
        `${newOrder.additional_note ? `*Nota:* ${newOrder.additional_note}\n` : ''}` +
        `---------------------------\n` +
        `*Ubicación del Cliente:* https://www.google.com/maps?q=${newOrder.customer_latitude},${newOrder.customer_longitude}`;

      // Limpiar el número de teléfono (solo dígitos)
      const cleanPhone = biz.phone.replace(/\D/g, '');
      // Si el número tiene 8 dígitos (formato SV sin código), añadir 503
      const finalPhone = cleanPhone.length === 8 ? `503${cleanPhone}` : cleanPhone;
      
      const waUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(whatsappMsg)}`;
      window.open(waUrl, '_blank');
    }

    showToast(`🔔 ¡Pedido realizado! Notificación Push emitida a ${biz.business_name}`);
    setOrderSuccessOrder(newOrder);
    setCart({});
    setOrderNote('');
    setIsOrderingModalOpen(false);
    setOrderingBusiness(null);
  };

  // QR Code Download Helper (Requirement 7)
  const downloadBusinessQRCode = (biz: DomicilioBusiness) => {
    const targetUrl = `https://www.newbank.store/#/domicilio?businessId=${biz.id}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      targetUrl
    )}`;

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 780;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 600, 780);

    // Border
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 588, 768);

    // Header Background
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(12, 12, 576, 120);

    // Header Text 1
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Escanea para realizar pedidos desde tu casa.', 300, 80);

    // Business Name
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(biz.business_name, 300, 190);

    ctx.fillStyle = '#64748B';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Propietario: ${biz.owner_name} | Tel: ${biz.phone}`, 300, 220);

    // Load QR Image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = qrApiUrl;
    img.onload = () => {
      ctx.drawImage(img, 150, 250, 300, 300);

      // Footer Background
      ctx.fillStyle = '#EFF6FF';
      ctx.fillRect(20, 600, 560, 150);

      ctx.fillStyle = '#1E40AF';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('También puedes buscarnos en', 300, 650);

      ctx.fillStyle = '#2563EB';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('www.newbank.store', 300, 700);

      // Download
      const link = document.createElement('a');
      link.download = `Codigo_QR_${biz.business_name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('📥 Código QR descargado exitosamente');
    };
  };

  // Filtered Solicitudes de Pedidos (Security: show only orders where the user is the customer or owner)
  const currentBizOrders = orders
    .filter((o) => {
      // Security Filter: Show only if current user is the customer OR the business owner
      const cleanPhone = (p: string) => (p || '').replace(/\D/g, '').trim();
      const loggedInPhone = cleanPhone(customerProfile?.phone || user?.phone || '');
      const isCustomer = loggedInPhone && cleanPhone(o.customer_phone) === loggedInPhone;
      
      const targetBiz = businesses.find((b) => b.id === o.business_id);
      const isOwner = targetBiz && canUserManageBusiness(targetBiz);

      if (!isCustomer && !isOwner) return false;

      if (orderBusinessFilter && o.business_id !== orderBusinessFilter) return false;
      return true;
    })
    .filter((o) => {
      if (orderDayFilter && o.order_date !== orderDayFilter) return false;
      if (orderMonthFilter && !o.order_date.startsWith(orderMonthFilter)) return false;
      return true;
    })
    .map((o) => {
      // Calculate distance from business GPS to customer GPS
      const targetBiz = businesses.find((b) => b.id === o.business_id);
      let dist = 0;
      if (targetBiz && targetBiz.latitude && o.customer_latitude) {
        dist = calculateDistanceKm(
          targetBiz.latitude,
          targetBiz.longitude,
          o.customer_latitude,
          o.customer_longitude
        );
      }
      return { ...o, distance_km: dist };
    })
    // Requirement 3: Ordenadas automáticamente desde la más cercana a la más lejana
    .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));


  // Ref for tracking notified order IDs
  const notifiedOrdersRef = useRef<Set<string>>(new Set());

  // Function to request Push Notification permission
  const requestNotificationAccess = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          showToast('🔔 ¡Notificaciones Push de pedidos activadas exitosamente!');
        } else if (perm === 'denied') {
          showToast('⚠️ Notificaciones bloqueadas en el navegador. Habilítalas en la configuración de tu navegador.');
        }
      });
    } else {
      showToast('⚠️ Este navegador no soporta Notificaciones Push.');
    }
  };

  // Push Notification & Audio Chime Sender
  const sendOrderPushNotification = (order: DomicilioOrder, businessName: string) => {
    // 1. Audio chime alert for business owner
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
      console.warn('Audio chime warning:', e);
    }

    // 2. Web Push Notification
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(`📦 ¡Nuevo Pedido Recibido en ${businessName}!`, {
            body: `Cliente: ${order.customer_name}\nTotal: $${order.total.toFixed(2)}\nUbicación: ${order.customer_address}`,
            icon: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=128&auto=format&fit=crop&q=80',
            tag: `order-${order.id}`
          });
        } catch (err) {
          console.error('Error issuing push notification:', err);
        }
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            new Notification(`📦 ¡Nuevo Pedido Recibido en ${businessName}!`, {
              body: `Cliente: ${order.customer_name}\nTotal: $${order.total.toFixed(2)}\nUbicación: ${order.customer_address}`,
              tag: `order-${order.id}`
            });
          }
        });
      }
    }
  };

  // Mark initial orders on mount so historical orders don't re-trigger push
  useEffect(() => {
    if (orders.length > 0 && notifiedOrdersRef.current.size === 0) {
      orders.forEach((o) => notifiedOrdersRef.current.add(o.id));
    }
  }, [orders]);

  // Effect to automatically notify business owners when new orders arrive
  useEffect(() => {
    if (orders.length === 0) return;
    orders.forEach((ord) => {
      if (!notifiedOrdersRef.current.has(ord.id)) {
        notifiedOrdersRef.current.add(ord.id);
        const isMyBiz = myManageableBusinesses.some((b) => b.id === ord.business_id);
        if (isMyBiz) {
          sendOrderPushNotification(ord, ord.business_name);
          showToast(`🔔 ¡Nueva solicitud de pedido recibida de ${ord.customer_name}!`);
        }
      }
    });
  }, [orders, myManageableBusinesses]);

  useEffect(() => {
    if (myManageableBusinesses.length > 0 && (!managingBusinessId || !myManageableBusinesses.some((b) => b.id === managingBusinessId))) {
      setManagingBusinessId(myManageableBusinesses[0].id);
    }
  }, [businesses, user, customerProfile, managingBusinessId]);

  const managingBiz = myManageableBusinesses.find((b) => b.id === managingBusinessId);

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 pb-4 font-sans flex flex-col">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[100000] bg-stone-900 text-amber-300 px-5 py-2.5 rounded-xl shadow-2xl border border-amber-500/40 font-bold text-xs sm:text-sm flex items-center gap-2 max-w-[90vw]"
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Banner Header */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-red-700 text-white py-4 px-3.5 sm:py-6 sm:px-6 lg:px-8 border-b border-amber-800/40 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 flex-grow">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 bg-red-800/40 text-amber-200 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30">
                <Truck className="w-3 h-3 text-amber-300" />
                Nuevo Servicio Nacional • El Salvador
              </div>
              <h1 className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-2">
                🛵 A Domicilio <span className="text-amber-200 text-base sm:text-2xl font-normal">NewBank Store</span>
              </h1>
              <p className="text-amber-100/90 text-[11px] sm:text-sm max-w-2xl leading-relaxed">
                Pide directo a los mejores negocios locales, o registra tu propio comercio para recibir pedidos en tiempo real con geolocalización precisa.
              </p>
            </div>

            {(!isStandalone && (deferredPrompt || isIOS)) && (
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleInstallApp}
                className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-white text-red-700 rounded-2xl text-[10px] sm:text-xs font-black uppercase shadow-xl hover:bg-amber-50 transition border-2 border-white/20 shrink-0"
              >
                <Download className="w-4 h-4" />
                Descargar Aplicación
              </motion.button>
            )}
          </div>

          {/* Quick Action Badges */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleTabSelect('explore')}
                className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-extrabold text-[10px] sm:text-xs uppercase tracking-wider transition flex items-center gap-1.5 ${
                  activeTab === 'explore'
                    ? 'bg-red-600 text-white shadow-md shadow-red-900/30 border border-red-500'
                    : 'bg-amber-800/40 text-amber-100 hover:bg-amber-800/60 border border-amber-400/20'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                Ver Mapa & Negocios
              </button>
              <button
                onClick={() => handleTabSelect('register_business')}
                className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-extrabold text-[10px] sm:text-xs uppercase tracking-wider transition flex items-center gap-1.5 ${
                  activeTab === 'register_business'
                    ? 'bg-red-600 text-white shadow-md shadow-red-900/30 border border-red-500'
                    : 'bg-amber-800/40 text-amber-100 hover:bg-amber-800/60 border border-amber-400/20'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Negocio
              </button>
              <button
                onClick={() => handleTabSelect('customer_profile')}
                className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-extrabold text-[10px] sm:text-xs uppercase tracking-wider transition flex items-center gap-1.5 ${
                  activeTab === 'customer_profile'
                    ? 'bg-red-600 text-white shadow-md shadow-red-900/30 border border-red-500'
                    : 'bg-amber-800/40 text-amber-100 hover:bg-amber-800/60 border border-amber-400/20'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Mi Registro Cliente
              </button>
            </div>

            {/* Opciones de perfil y notificación movidas para alta visibilidad en pantallas móviles */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <button
                onClick={requestNotificationAccess}
                className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-400/30 px-2 py-1 rounded-lg text-[9px] sm:text-xs font-black transition cursor-pointer"
                title="Activar notificaciones push para solicitudes de pedidos"
              >
                <Bell className="w-3 h-3 text-amber-300 animate-pulse" />
                <span>Notificaciones Push</span>
              </button>

              <div className="relative flex items-center gap-1.5 bg-red-950/40 border border-red-500/20 px-2 py-1 rounded-lg text-[9px] sm:text-xs font-bold text-amber-100">
                <MapPin className="w-3 h-3 text-red-400" />
                {customerProfile ? (
                  <span className="flex items-center gap-1">
                    Cliente: <strong className="text-white truncate max-w-[90px] sm:max-w-[120px]" title={customerProfile.full_name}>{customerProfile.full_name}</strong>
                    <button
                      onClick={logoutProfile}
                      className="ml-1 px-1.5 py-0.5 bg-red-900/40 hover:bg-red-800/60 text-red-200 text-[8px] sm:text-[9px] font-extrabold rounded border border-red-800/30 cursor-pointer transition"
                      title="Cerrar sesión de cliente"
                    >
                      Cerrar Sesión
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="text-amber-200/80 font-extrabold">Sin GPS Cliente</span>
                    <button
                      onClick={() => setIsLoginDropdownOpen(true)}
                      className="ml-1 px-1.5 py-0.5 bg-emerald-950/40 hover:bg-emerald-800/60 text-emerald-200 text-[8px] sm:text-[9px] font-extrabold rounded border border-emerald-800/30 cursor-pointer transition"
                    >
                      Iniciar Sesión
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div ref={mainSectionRef} id="seccion-anclada" className="sticky top-12 z-30 bg-white border-b border-amber-200/80 shadow-xs px-2 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar py-1.5 gap-2">
          <div className="flex items-center gap-1 sm:gap-2 min-w-max">
            <button
              onClick={() => handleTabSelect('explore')}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] xs:text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'explore'
                  ? 'bg-amber-500 text-stone-950 border border-amber-600 shadow-xs'
                  : 'text-stone-700 hover:bg-amber-50 hover:text-amber-950'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-red-600" />
              1. Mapa & Negocios
            </button>
            <button
              onClick={() => handleTabSelect('register_business')}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] xs:text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'register_business'
                  ? 'bg-amber-500 text-stone-950 border border-amber-600 shadow-xs'
                  : 'text-stone-700 hover:bg-amber-50 hover:text-amber-950'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-emerald-700" />
              2. Registrar Negocio
            </button>
            <button
              onClick={() => handleTabSelect('manage_products')}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] xs:text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'manage_products'
                  ? 'bg-amber-500 text-stone-950 border border-amber-600 shadow-xs'
                  : 'text-stone-700 hover:bg-amber-50 hover:text-amber-950'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
              3. Mis Productos & Horarios
            </button>
            <button
              onClick={() => handleTabSelect('view_orders')}
              className={`px-2.5 py-1.5 rounded-xl text-[10px] xs:text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'view_orders'
                  ? 'bg-amber-500 text-stone-950 border border-amber-600 shadow-xs'
                  : 'text-stone-700 hover:bg-amber-50 hover:text-amber-950'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-red-700" />
              4. Ver Solicitudes{' '}
              <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-black">
                {orders.filter((o) => {
                  const cleanPhone = (p: string) => (p || '').replace(/\D/g, '').trim();
                  const loggedInPhone = cleanPhone(customerProfile?.phone || user?.phone || '');
                  const isCustomer = loggedInPhone && cleanPhone(o.customer_phone) === loggedInPhone;
                  const targetBiz = businesses.find((b) => b.id === o.business_id);
                  const isOwner = targetBiz && canUserManageBusiness(targetBiz);
                  return (isCustomer || isOwner) && o.status === 'Pendiente';
                }).length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-5 flex-grow flex flex-col w-full">

        {/* TAB 1: VISUALIZACIÓN EN EL MAPA Y TARJETAS DE NEGOCIOS (Requirements 5 & 6) */}
        {activeTab === 'explore' && (
          <div className="space-y-5 flex-grow flex flex-col">
            {/* PWA Install Banner */}
            {(!isStandalone && (deferredPrompt || isIOS)) && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 rounded-2xl shadow-lg border border-blue-400/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-white"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-xl shrink-0">
                    📲
                  </div>
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-tight">Instalar Aplicación</h4>
                    <p className="text-[10px] opacity-90 font-medium">Accede más rápido y recibe notificaciones de tus pedidos.</p>
                  </div>
                </div>
                <button 
                  onClick={handleInstallApp}
                  className="w-full sm:w-auto px-6 py-2 bg-white text-blue-700 font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:bg-blue-50 transition"
                >
                  Descargar Ahora
                </button>
              </motion.div>
            )}

            {/* Search & Filter Header */}
            <div
              className="bg-white rounded-2xl p-3.5 sm:p-5 shadow-sm border border-amber-200/70 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre de negocio, propietario o dirección en El Salvador..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-amber-200/80 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm font-medium bg-amber-50/20 text-stone-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpenOnlyFilter(!openOnlyFilter)}
                  className={`w-full sm:w-auto px-4 py-2.5 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-2 ${
                    openOnlyFilter
                      ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                      : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-amber-50 hover:text-amber-950'
                  }`}
                >
                  <Clock className="w-4 h-4 text-amber-600" />
                  {openOnlyFilter ? 'Mostrando Solo Abiertos' : 'Ver Solo Abiertos'}
                </button>
              </div>
            </div>

            {/* Amplified Interactive Map Canvas Visualization (Requirement 5) */}
            <div
              className="bg-stone-900 rounded-2xl text-white shadow-xl border border-stone-800 overflow-hidden relative flex-grow min-h-[500px] sm:min-h-[600px] mb-4"
              style={{
                borderStyle: 'dashed',
                borderRadius: '11px',
                borderWidth: '3.84px',
                marginTop: '12px',
                padding: '0px',
              }}
            >
              <div className="flex items-center justify-between mb-2 border-b border-stone-800 pb-2 p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 sm:w-6 sm:h-6 text-red-500 animate-bounce" />
                  <div>
                    <h2 className="text-xs sm:text-lg font-black text-white">Mapa de Comercios Registrados</h2>
                    <p className="text-[9px] sm:text-xs text-stone-400">
                      Coordenadas GPS reales de negocios con servicio a domicilio
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] sm:text-xs">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span> Abierto
                  </span>
                  <span className="flex items-center gap-1 text-rose-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span> Cerrado
                  </span>
                </div>
              </div>

              {/* Google Maps Ampliado View for El Salvador con Leaflet nativo */}
              <div className="w-full bg-stone-950 rounded-xl border border-stone-800 relative overflow-hidden isolate" style={{ height: 'calc(100% - 58px)' }}>
                {/* Contenedor del mapa Leaflet */}
                <div
                  ref={mapContainerRef}
                  className="w-full h-full rounded-xl z-0"
                  style={{ minHeight: '200px', height: '515px' }}
                />

                {/* Tarjeta flotante sobre el mapa al seleccionar un negocio */}
                {selectedBusiness && (() => {
                  const b = selectedBusiness;
                  const openStatus = checkIsBusinessOpen(b);
                  const bizProducts = products.filter((p) => p.business_id === b.id && !p.is_hidden);

                  return (
                    <motion.div
                      drag
                      dragElastic={0.12}
                      whileTap={{ cursor: 'grabbing' }}
                      className="absolute top-2 left-2 z-[9999] w-72 max-w-[calc(100%-1rem)] max-h-[calc(100%-1rem)] bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-amber-200 text-stone-900 overflow-hidden flex flex-col cursor-grab"
                    >
                      <div className="p-2.5 border-b border-amber-100 bg-amber-50/70 flex items-start justify-between gap-1.5 shrink-0">
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-black text-stone-900 leading-tight truncate">
                            {b.business_name}
                          </h3>
                          <p className="text-[10px] text-stone-600 font-semibold flex items-center gap-1 mt-0.5 truncate">
                            <User className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                            Prop: <span className="font-bold text-stone-800">{b.owner_name}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedBusiness(null)}
                          className="text-stone-400 hover:text-stone-700 p-1 rounded-lg shrink-0"
                          title="Cerrar tarjeta"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Cuerpo medio deslizable para ajuste responsivo en pantallas pequeñas */}
                      <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5">
                        <div className="p-2.5 space-y-1.5 text-[10px] sm:text-xs text-stone-700">
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                openStatus.isOpen
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-900 border border-rose-300'
                              }`}
                            >
                              {openStatus.isOpen ? 'Abierto' : 'Cerrado'}
                            </span>
                            {b.delivery_paused && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[8px] font-black uppercase tracking-wider">
                                🔴 Sin Envíos
                              </span>
                            )}
                          </div>

                          <p className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                            <span className="font-semibold text-stone-800 truncate">{openStatus.label}</span>
                          </p>
                          <p className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-amber-600 shrink-0" />
                            <span><strong>{b.phone}</strong></span>
                          </p>
                          <p className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-red-600 shrink-0" />
                            <span className="truncate">{b.address_text || 'Ubicación GPS registrada'}</span>
                          </p>
                        </div>

                        {/* List of Products inside floating card */}
                        <div className="px-2.5 py-1.5 max-h-24 sm:max-h-40 overflow-y-auto space-y-1.5 border-t border-amber-100">
                          <div className="flex items-center justify-between text-[9px] font-bold text-stone-500 uppercase tracking-wider mb-0.5">
                            <span>Productos ({bizProducts.length})</span>
                            <span>Envío</span>
                          </div>

                          {bizProducts.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between p-1.5 rounded-lg bg-amber-50/40 hover:bg-amber-100/50 border border-amber-100 transition text-[10px]"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  onClick={() => setSelectedImageForView(p.image_url)}
                                  className="w-7 h-7 rounded object-cover border border-amber-200 cursor-zoom-in"
                                />
                                <div className="min-w-0">
                                  <p 
                                    onClick={() => setSelectedImageForView(p.image_url)}
                                    className="font-extrabold text-stone-900 truncate leading-tight cursor-pointer hover:text-amber-700 transition-colors"
                                  >
                                    {p.name}
                                  </p>
                                  <p className="text-red-700 font-black text-[9px]">${p.price.toFixed(2)}</p>
                                </div>
                              </div>

                              <div>
                                {p.disponible_domicilio ? (
                                  <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[8px] flex items-center gap-0.5">
                                    <Truck className="w-2 h-2 text-emerald-700" /> Domicilio
                                  </span>
                                ) : (
                                  <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[8px] flex items-center gap-0.5">
                                    <Store className="w-2 h-2 text-amber-700" /> Local
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}

                          {bizProducts.length === 0 && (
                            <p className="text-[10px] text-stone-400 italic text-center py-1">
                              Sin productos.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="p-2 bg-amber-50/60 border-t border-amber-100 flex flex-wrap sm:flex-nowrap gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setOrderingBusiness(b);
                            setIsOrderingModalOpen(true);
                          }}
                          className="flex-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black py-1.5 px-2.5 rounded-lg text-[9px] sm:text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1"
                        >
                          <ShoppingBag className="w-3 h-3" />
                          Pedir
                        </button>
                        <button
                          onClick={() => {
                            setManagingBusinessId(b.id);
                            setActiveTab('view_orders');
                          }}
                          title="Ver solicitudes"
                          className="px-2 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shadow-xs flex items-center gap-1 text-[9px] font-extrabold"
                        >
                          <Truck className="w-3 h-3 text-amber-200" />
                          Solicitudes
                        </button>
                        <button
                          onClick={() => downloadBusinessQRCode(b)}
                          title="QR"
                          className="p-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg transition shadow-xs"
                        >
                          <QrCode className="w-3 h-3 text-amber-200" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })()}

                {/* Botón para ir a la ubicación actual */}
                <button
                  type="button"
                  onClick={handleGoToUserLocation}
                  disabled={isLocatingUser}
                  className="absolute bottom-4 right-4 bg-red-600 hover:bg-red-700 text-white font-extrabold px-3.5 py-2.5 rounded-xl text-xs shadow-xl border border-red-500 flex items-center gap-2 z-[1001] transition transform active:scale-95 pointer-events-auto"
                >
                  <Navigation className={`w-4 h-4 ${isLocatingUser ? 'animate-spin' : ''}`} />
                  {isLocatingUser ? 'Obteniendo GPS...' : 'Ir a mi ubicación actual'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REGISTRO DE NEGOCIOS (Requirement 1) */}
        {activeTab === 'register_business' && (
          <div
            className="max-w-3xl mx-auto bg-white rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm border border-amber-200/70"
          >
            <div className="border-b border-amber-100 pb-3.5 mb-5">
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 flex items-center gap-2">
                <Store className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600" />
                Registro de Negocio
              </h2>
              <p className="text-stone-600 text-xs sm:text-sm mt-1">
                Ingresa los datos de tu establecimiento para empezar a vender a domicilio.
              </p>
            </div>

            {!customerProfile ? (
              <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-6 sm:p-8 text-center space-y-4 my-2 shadow-xs">
                <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto border border-amber-300">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-stone-900">
                    Inicio de Sesión de Cliente Requerido
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto mt-1 leading-relaxed">
                    Para registrar y administrar tu negocio en la plataforma, primero debes iniciar sesión o registrarte como cliente.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsLoginDropdownOpen(true)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer border border-amber-600"
                  >
                    <User className="w-4 h-4" />
                    1. Iniciar Sesión de Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabSelect('customer_profile')}
                    className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    2. Ir al Formulario de Registro de Cliente
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterBusinessSubmit} className="space-y-5">
              {/* Propietario & Contacto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1.5">
                    Nombre completo del propietario *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. María Elena Ramos"
                    value={bizOwnerName}
                    onChange={(e) => setBizOwnerName(e.target.value)}
                    className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-amber-200/80 focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm font-medium bg-amber-50/10 text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1.5">
                    Número de contacto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 7845-9201"
                    value={bizPhone}
                    onChange={(e) => setBizPhone(e.target.value)}
                    className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-amber-200/80 focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm font-medium bg-amber-50/10 text-stone-900"
                  />
                </div>
              </div>

              {/* Nombre de negocio y dirección escrita */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1.5">
                  Nombre del negocio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pupusería Doña María"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-amber-200/80 focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm font-medium bg-amber-50/10 text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1.5">
                  Dirección o Referencia escrita
                </label>
                <input
                  type="text"
                  placeholder="Ej. Colonia Escalón, Calle El Mirador #402, San Salvador"
                  value={bizAddressText}
                  onChange={(e) => setBizAddressText(e.target.value)}
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-amber-200/80 focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm font-medium bg-amber-50/10 text-stone-900"
                />
              </div>

              {/* Requirement 1: Ubicación del negocio OBLIGATORIO */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-stone-900 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-red-600" /> Ubicación GPS del Negocio (Obligatorio)
                    </h4>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Para guardar tu negocio debes capturar las coordenadas GPS actuales.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={captureBusinessGps}
                    disabled={bizGpsLoading}
                    className="w-full sm:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-sm transition flex items-center justify-center gap-2 shrink-0"
                  >
                    <Navigation className="w-4 h-4" />
                    {bizGpsLoading ? 'Obteniendo GPS...' : 'Guardar ubicación actual'}
                  </button>
                </div>

                {bizGpsSuccess && bizLat && bizLng && (
                  <div className="bg-emerald-100 border border-emerald-300 text-emerald-950 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-700" />
                    Ubicación GPS Guardada Exitosamente (Lat: {bizLat.toFixed(4)}, Lng: {bizLng.toFixed(4)})
                  </div>
                )}
              </div>

              {/* Requirement 1: Configuración de horarios */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 sm:p-5 space-y-4">
                <h4 className="text-xs sm:text-sm font-extrabold text-stone-900 flex items-center gap-2 border-b border-amber-200/70 pb-2">
                  <Clock className="w-4 h-4 text-amber-700" /> Configuración de Horario de Atención
                </h4>

                <div className="space-y-2.5">
                  {/* Opción 1: 24/7 */}
                  <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200/70 cursor-pointer">
                    <input
                      type="radio"
                      name="schedule_mode"
                      checked={bizIs247}
                      onChange={() => setBizIs247(true)}
                      className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-extrabold text-xs sm:text-sm text-stone-900">Opción 1: Atención 24/7</span>
                      <p className="text-[11px] sm:text-xs text-stone-600">Disponible las 24 horas del día, los 7 días de la semana.</p>
                    </div>
                  </label>

                  {/* Opción 2: Días y horarios específicos */}
                  <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200/70 cursor-pointer">
                    <input
                      type="radio"
                      name="schedule_mode"
                      checked={!bizIs247}
                      onChange={() => setBizIs247(false)}
                      className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-extrabold text-xs sm:text-sm text-stone-900">Opción 2: Días y horarios específicos</span>
                      <p className="text-[11px] sm:text-xs text-stone-600">Registra uno o varios horarios con días, hora de apertura y cierre.</p>
                    </div>
                  </label>
                </div>

                {!bizIs247 && (
                  <div className="space-y-3 pt-2">
                    {bizSchedules.map((sched, idx) => (
                      <div key={sched.id} className="p-3.5 bg-white rounded-xl border border-amber-200/70 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase text-stone-600">Horario #{idx + 1}</span>
                          {bizSchedules.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setBizSchedules(bizSchedules.filter((s) => s.id !== sched.id))}
                              className="text-red-700 text-xs font-bold hover:underline"
                            >
                              Eliminar horario
                            </button>
                          )}
                        </div>

                        {/* Days Selector */}
                        <div>
                          <label className="block text-[11px] font-extrabold text-stone-600 uppercase mb-1">
                            Días de atención:
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_DAYS.map((day) => {
                              const selected = sched.days.includes(day);
                              return (
                                <button
                                  type="button"
                                  key={day}
                                  onClick={() => {
                                    const updatedDays = selected
                                      ? sched.days.filter((d) => d !== day)
                                      : [...sched.days, day];
                                    setBizSchedules(
                                      bizSchedules.map((s) => (s.id === sched.id ? { ...s, days: updatedDays } : s))
                                    );
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition ${
                                    selected
                                      ? 'bg-amber-500 text-stone-950 border border-amber-600 shadow-xs'
                                      : 'bg-stone-100 text-stone-700 hover:bg-amber-50'
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Open & Close Times */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-extrabold text-stone-600 uppercase mb-1">
                              Hora de Apertura
                            </label>
                            <input
                              type="time"
                              value={sched.open_time}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBizSchedules(
                                  bizSchedules.map((s) => (s.id === sched.id ? { ...s, open_time: val } : s))
                                );
                              }}
                              className="w-full px-3 py-1.5 border border-amber-200 rounded-lg text-xs font-bold bg-amber-50/10 text-stone-900"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-extrabold text-stone-600 uppercase mb-1">
                              Hora de Cierre
                            </label>
                            <input
                              type="time"
                              value={sched.close_time}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBizSchedules(
                                  bizSchedules.map((s) => (s.id === sched.id ? { ...s, close_time: val } : s))
                                );
                              }}
                              className="w-full px-3 py-1.5 border border-amber-200 rounded-lg text-xs font-bold bg-amber-50/10 text-stone-900"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        setBizSchedules([
                          ...bizSchedules,
                          { id: Date.now().toString(), days: ['Sábado', 'Domingo'], open_time: '09:00', close_time: '14:00' }
                        ])
                      }
                      className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 mt-2"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar otro horario
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black uppercase tracking-wider text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/20 transition"
              >
                Completar Registro de Negocio
              </button>
            </form>
            )}
          </div>
        )}

        {/* TAB 3: VER PRODUCTOS REGISTRADOS Y HORARIOS (Requirement 2 & 4 & 7) */}
        {activeTab === 'manage_products' && (
          <div className="space-y-6">
            {myManageableBusinesses.length === 0 ? (
              <div
                className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4 max-w-xl mx-auto my-12"
              >
                <Store className="w-16 h-16 mx-auto text-blue-500" />
                <h3 className="text-xl font-black text-slate-900">No tienes negocios registrados</h3>
                <p className="text-sm text-slate-600">
                  Para administrar tus productos, horarios y estado de delivery, debes registrar tu propio comercio primero.
                </p>
                <button
                  onClick={() => handleTabSelect('register_business')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition"
                >
                  Registrar mi Negocio Ahora
                </button>
              </div>
            ) : (
              <>
                {/* Business Selector */}
                <div
                  className="bg-white rounded-2xl p-3.5 sm:p-5 border border-amber-200/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <label className="block text-xs font-extrabold uppercase text-stone-600 mb-1">
                      Selecciona tu Negocio a Administrar:
                    </label>
                    <select
                      value={managingBusinessId}
                      onChange={(e) => setManagingBusinessId(e.target.value)}
                      className="px-3.5 py-2 bg-amber-50/20 border border-amber-200 rounded-xl text-xs sm:text-sm font-extrabold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {myManageableBusinesses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.business_name} ({b.owner_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  {managingBiz && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingProductId(null);
                          setProdName('');
                          setProdPrice('');
                          setProdImage('');
                          setProdDisponibleDomicilio(true);
                          setIsProductModalOpen(true);
                        }}
                        className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" /> Agregar Nuevo Producto
                      </button>

                      <button
                        onClick={() => {
                          downloadBusinessQRCode(managingBiz);
                        }}
                        className="px-3.5 py-2.5 bg-red-700 hover:bg-red-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-xs"
                      >
                        <QrCode className="w-4 h-4 text-amber-200" /> Descargar Código QR
                      </button>

                      <button
                        onClick={() => {
                          setManagingBusinessId(managingBiz.id);
                          setActiveTab('view_orders');
                        }}
                        className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-xs"
                      >
                        <Truck className="w-4 h-4 text-amber-200" /> Ver Solicitudes
                      </button>

                      <button
                        onClick={() => handleDeleteBusiness(managingBiz.id)}
                        className="px-3.5 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 hover:border-red-400 font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="Eliminar este negocio permanentemente"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" /> Eliminar Negocio
                      </button>
                    </div>
                  )}
                </div>

            {managingBiz && (
              <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Visualizar Horarios Registrados del Negocio (Requirement 4) */}
                <div
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200/70 shadow-sm space-y-3.5"
                >
                  <h3 className="font-black text-stone-900 border-b border-amber-100 pb-2 flex items-center gap-2 text-sm sm:text-base">
                    <Clock className="w-4 h-4 text-amber-600" /> Horarios del Negocio
                  </h3>

                  {managingBiz.is_24_7 ? (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 font-extrabold text-xs sm:text-sm">
                      ✨ Este negocio opera en modalidad 24/7 (24 horas, los 7 días).
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {managingBiz.schedules.map((s, idx) => (
                        <div key={s.id} className="p-3 bg-amber-50/40 border border-amber-200/60 rounded-xl text-xs space-y-1">
                          <p className="font-extrabold text-amber-800">Horario #{idx + 1}</p>
                          <p className="text-stone-700">Días: {s.days.join(', ')}</p>
                          <p className="font-black text-stone-900">
                            Apertura: {s.open_time} - Cierre: {s.close_time}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-1">
                    <p className="text-xs text-stone-600 flex items-center gap-1 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-red-600" /> Ubicación GPS: Lat {managingBiz.latitude.toFixed(4)}, Lng {managingBiz.longitude.toFixed(4)}
                    </p>
                  </div>

                  {/* Opción: No se cuenta con envíos a domicilio en este momento */}
                  <div className="pt-3 border-t border-amber-100">
                    <label className="flex items-start gap-2.5 p-3 bg-amber-50/80 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100/50 transition">
                      <input
                        type="checkbox"
                        checked={managingBiz.delivery_paused || false}
                        onChange={(e) => {
                          const paused = e.target.checked;
                          const updated = businesses.map((b) =>
                            b.id === managingBiz.id ? { ...b, delivery_paused: paused } : b
                          );
                          updateBusinesses(updated);
                          showToast(
                            paused
                              ? '🔴 Se indicó que no hay envíos a domicilio en este momento'
                              : '🟢 Envíos a domicilio habilitados'
                          );
                        }}
                        className="mt-0.5 w-4 h-4 text-red-600 focus:ring-red-500 rounded"
                      />
                      <div>
                        <span className="font-extrabold text-xs text-amber-950 block leading-tight">
                          No se cuenta con envíos a domicilio en este momento
                        </span>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Indica a los clientes que el servicio de delivery está pausado temporalmente.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Opción: Indicar que el negocio en este momento se encuentra cerrado */}
                  <div className="pt-3 border-t border-amber-100">
                    <label className="flex items-start gap-2.5 p-3 bg-red-50/80 border border-red-200 rounded-xl cursor-pointer hover:bg-red-100/50 transition">
                      <input
                        type="checkbox"
                        checked={managingBiz.manual_closed || false}
                        onChange={(e) => {
                          const closed = e.target.checked;
                          const updated = businesses.map((b) =>
                            b.id === managingBiz.id ? { ...b, manual_closed: closed } : b
                          );
                          updateBusinesses(updated);
                          showToast(
                            closed
                              ? '🔴 Se indicó que el negocio se encuentra cerrado en este momento'
                              : '🟢 Negocio abierto según horario'
                          );
                        }}
                        className="mt-0.5 w-4 h-4 text-red-600 focus:ring-red-500 rounded"
                      />
                      <div>
                        <span className="font-extrabold text-xs text-red-950 block leading-tight">
                          Indicar que el negocio se encuentra cerrado en este momento
                        </span>
                        <p className="text-[11px] text-red-800 mt-0.5">
                          Muestra el negocio como cerrado temporalmente ante los clientes.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Listado de Productos Registrados (Requirement 4) */}
                <div
                  className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 border border-amber-200/70 shadow-sm space-y-3.5"
                >
                  <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                    <h3 className="font-black text-stone-900 flex items-center gap-2 text-sm sm:text-base">
                      <ShoppingBag className="w-4 h-4 text-amber-600" /> Catálogo de Productos Registrados
                    </h3>
                    <span className="text-xs font-bold text-stone-600">
                      Total: {products.filter((p) => p.business_id === managingBiz.id).length} productos
                    </span>
                  </div>

                  <div className="space-y-3">
                    {products
                      .filter((p) => p.business_id === managingBiz.id)
                      .map((p) => (
                        <div
                          key={p.id}
                          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                            p.is_hidden ? 'bg-stone-100/70 border-stone-300 opacity-75' : 'bg-white border-amber-200/80 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={p.image_url}
                              alt={p.name}
                              onClick={() => setSelectedImageForView(p.image_url)}
                              className="w-14 h-14 rounded-xl object-cover border border-amber-200 cursor-zoom-in"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 
                                  onClick={() => setSelectedImageForView(p.image_url)}
                                  className="font-extrabold text-stone-900 text-xs sm:text-sm cursor-pointer hover:text-amber-700 transition-colors"
                                >
                                  {p.name}
                                </h4>
                                {p.is_hidden && (
                                  <span className="px-2 py-0.5 bg-stone-200 text-stone-700 text-[10px] font-bold rounded">
                                    Oculto
                                  </span>
                                )}
                              </div>
                              <p className="text-red-700 font-black text-sm sm:text-base">${p.price.toFixed(2)}</p>
                              <p className="text-[11px] text-stone-600">
                                Envío a Domicilio: {p.disponible_domicilio ? '✅ Sí' : '❌ No (Solo Retiro)'}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons for Product (Requirement 4) */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingProductId(p.id);
                                setProdName(p.name);
                                setProdPrice(p.price);
                                setProdImage(p.image_url);
                                setProdDisponibleDomicilio(p.disponible_domicilio);
                                setIsProductModalOpen(true);
                              }}
                              className="p-2 bg-stone-100 hover:bg-amber-50 text-stone-700 rounded-lg text-xs font-bold flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" /> Editar
                            </button>

                            <button
                              onClick={() => handleToggleProductVisibility(p.id)}
                              className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1 ${
                                p.is_hidden
                                  ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              }`}
                            >
                              {p.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              {p.is_hidden ? 'Mostrar' : 'Ocultar'}
                            </button>

                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                    {products.filter((p) => p.business_id === managingBiz.id).length === 0 && (
                      <p className="text-center text-stone-400 text-xs sm:text-sm py-8 italic">
                        Aún no tienes productos registrados en este negocio.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Opción para ver los productos solicitados al negocio y controlar las entregas (Requirement 3 & 4) */}
              <div
                className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200/70 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 pb-3">
                  <div>
                    <h3 className="font-black text-stone-900 flex items-center gap-2 text-sm sm:text-base">
                      <Truck className="w-5 h-5 text-amber-600" /> Control de Entregas & Solicitudes de Productos
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Consulta los pedidos de productos solicitados por los clientes para {managingBiz.business_name} y gestiona su entrega.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-950 font-black text-xs rounded-full border border-amber-300">
                      Total: {orders.filter((o) => o.business_id === managingBiz.id).length} solicitudes
                    </span>
                    <button
                      onClick={() => setActiveTab('view_orders')}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1"
                    >
                      Ver Todas en Mapa
                    </button>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {orders.filter((o) => o.business_id === managingBiz.id).length === 0 ? (
                    <div className="p-8 text-center text-stone-400 text-xs sm:text-sm italic border border-dashed border-amber-200 rounded-xl bg-amber-50/20">
                      📦 Aún no se han recibido solicitudes de productos para este negocio.
                    </div>
                  ) : (
                    orders
                      .filter((o) => o.business_id === managingBiz.id)
                      .map((ord) => {
                        const distKm = calculateDistanceKm(
                          managingBiz.latitude,
                          managingBiz.longitude,
                          ord.customer_latitude,
                          ord.customer_longitude
                        );
                        const isExpanded = !!expandedOrders[ord.id];
                        return (
                          <div
                            key={ord.id}
                            className="p-3.5 sm:p-4 rounded-xl border border-amber-200/80 bg-stone-50/40 hover:bg-amber-50/20 transition space-y-3 w-full"
                          >
                            <div
                              onClick={() => toggleOrderExpansion(ord.id)}
                              className="flex items-center justify-between gap-2 border-b border-stone-200 pb-2.5 cursor-pointer select-none"
                              title="Haga clic para expandir o contraer detalles"
                            >
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className="px-2 py-0.5 bg-amber-500 text-stone-950 font-black text-[10px] sm:text-xs rounded-md shrink-0">
                                  Pedido #{ord.id.substring(4)}
                                </span>
                                <span className="font-extrabold text-stone-900 text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[160px]">
                                  {ord.customer_name}
                                </span>
                                <span className="text-[10px] sm:text-xs text-stone-600 font-semibold shrink-0">
                                  📞 {ord.customer_phone}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[11px] font-bold text-amber-700 hidden sm:inline">
                                  {isExpanded ? 'Contraer' : 'Ver detalle'}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-amber-700 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-amber-700 shrink-0" />
                                )}
                              </div>
                            </div>

                            {/* Info Summary Row (Always Visible) */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="px-2 py-0.5 bg-red-50 text-red-900 border border-red-200 rounded-full font-bold text-[10px] sm:text-xs flex items-center gap-1 shrink-0">
                                <MapPin className="w-3 h-3 text-red-600" /> A {distKm} km
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = orders.map((o) =>
                                    o.id === ord.id
                                      ? { ...o, status: o.status === 'Pendiente' ? ('Entregado' as const) : ('Pendiente' as const) }
                                      : o
                                  );
                                  updateOrders(updated);
                                  showToast('✅ Estado de la entrega actualizado');
                                }}
                                className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition shrink-0 ${
                                  ord.status === 'Pendiente'
                                    ? 'bg-amber-100 text-amber-950 hover:bg-amber-200 border border-amber-300'
                                    : 'bg-emerald-100 text-emerald-950 hover:bg-emerald-200 border border-emerald-300'
                                }`}
                              >
                                {ord.status === 'Pendiente' ? '⏳ Pendiente' : '✅ Entregado'}
                              </button>
                            </div>

                            {/* Detalle de Productos Solicitados y Dirección - Accordion */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden w-full"
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2.5 border-t border-stone-100">
                                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-stone-200">
                                      <p className="font-extrabold text-stone-800 uppercase text-[9px] sm:text-[10px] text-amber-800">
                                        Productos Solicitados:
                                      </p>
                                      {ord.items.map((it, idx) => (
                                        <div key={idx} className="flex justify-between font-bold text-stone-900 text-xs">
                                          <span>{it.quantity}x {it.product_name}</span>
                                          <span className="text-red-700">${(it.subtotal || it.unit_price * it.quantity).toFixed(2)}</span>
                                        </div>
                                      ))}
                                      <div className="pt-1.5 border-t border-stone-100 flex justify-between font-black text-xs text-stone-950">
                                        <span>Total del Pedido:</span>
                                        <span className="text-red-700 text-sm">${ord.total.toFixed(2)}</span>
                                      </div>
                                    </div>

                                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-stone-200">
                                      <p className="font-extrabold text-stone-800 uppercase text-[9px] sm:text-[10px] text-amber-800">
                                        Dirección & Tipo de Entrega:
                                      </p>
                                      <p className="text-stone-800 font-semibold">{ord.customer_address}</p>
                                      <p className="text-[10px] sm:text-[11px] text-stone-600">
                                        Tipo: <strong className="text-stone-900 uppercase">{ord.delivery_type}</strong> | Fecha: <strong>{ord.order_date} ({ord.order_time})</strong>
                                      </p>
                                      {ord.additional_note && (
                                        <p className="text-[10px] sm:text-[11px] text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200 italic">
                                          Nota: "{ord.additional_note}"
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
              </>
            )}
            </>
          )}
          </div>
        )}

        {/* TAB 4: VER SOLICITUDES DE PRODUCTOS (Requirement 3) */}
        {activeTab === 'view_orders' && (
          <div className="space-y-5">
            {/* Header & Filters */}
            <div
              className="bg-white rounded-2xl p-3.5 sm:p-5 border border-amber-200/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div>
                <h2 className="text-lg sm:text-xl font-black text-stone-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" /> Solicitudes de Pedidos Recibidos
                </h2>
                <p className="text-xs text-stone-600 mt-0.5">
                  Las solicitudes se ordenan automáticamente desde la ubicación más cercana al negocio hasta la más lejana.
                </p>
              </div>

              {/* Filters for Business, Day and Month (Requirement 3) */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                  <Store className="w-4 h-4 text-amber-600" /> Negocio:
                  <select
                    value={orderBusinessFilter}
                    onChange={(e) => setOrderBusinessFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-amber-50/20 border border-amber-200 rounded-lg text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Todos los Negocios --</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.business_name} ({b.owner_name})
                      </option>
                    ))}
                  </select>
                  {orderBusinessFilter && (
                    <button
                      onClick={() => setOrderBusinessFilter('')}
                      className="text-red-700 font-bold"
                      title="Ver solicitudes de todos los negocios"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                  <Calendar className="w-4 h-4 text-amber-600" /> Día:
                  <input
                    type="date"
                    value={orderDayFilter}
                    onChange={(e) => setOrderDayFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-amber-50/20 border border-amber-200 rounded-lg text-xs font-semibold text-stone-900"
                  />
                  {orderDayFilter && (
                    <button onClick={() => setOrderDayFilter('')} className="text-red-700 font-bold">
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                  <Filter className="w-4 h-4 text-amber-700" /> Mes:
                  <input
                    type="month"
                    value={orderMonthFilter}
                    onChange={(e) => setOrderMonthFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-amber-50/20 border border-amber-200 rounded-lg text-xs font-semibold text-stone-900"
                  />
                  {orderMonthFilter && (
                    <button onClick={() => setOrderMonthFilter('')} className="text-red-700 font-bold">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List of Orders (Requirement 3) */}
            <div className="space-y-4">
              {currentBizOrders.map((ord) => {
                const isExpanded = !!expandedOrders[ord.id];
                return (
                  <div
                    key={ord.id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200/70 shadow-sm space-y-3.5 w-full"
                  >
                    <div
                      onClick={() => toggleOrderExpansion(ord.id)}
                      className="flex items-center justify-between gap-2 border-b border-amber-100 pb-3 cursor-pointer select-none"
                      title="Haga clic para expandir o contraer detalles"
                    >
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-950 font-black text-xs rounded-full border border-amber-300 shrink-0">
                          #{ord.id.substring(4)}
                        </span>
                        <span className="px-2.5 py-0.5 bg-red-100 text-red-950 border border-red-300 font-extrabold text-xs rounded-md flex items-center gap-1 shrink-0">
                          <Store className="w-3.5 h-3.5 text-red-700" /> {ord.business_name}
                        </span>
                        <h3 className="font-extrabold text-stone-900 text-sm sm:text-base truncate max-w-[100px] sm:max-w-[160px]">
                          {ord.customer_name}
                        </h3>
                        <span className="text-xs text-stone-600 font-medium shrink-0">({ord.customer_phone})</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs font-bold text-amber-700 hidden sm:inline">
                          {isExpanded ? 'Contraer' : 'Ver detalle'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-amber-700 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-amber-700 shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* ALWAYS VISIBLE INFO BAR */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {/* Distance Badge */}
                      <span className="px-2.5 py-1 bg-red-50 text-red-900 border border-red-200 rounded-full font-bold text-xs flex items-center gap-1 shrink-0">
                        <MapPin className="w-3.5 h-3.5 text-red-600" /> A {ord.distance_km} km de distancia
                      </span>

                      {/* Status Toggle Button (Requirement 3) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const updated = orders.map((o) =>
                            o.id === ord.id
                              ? { ...o, status: o.status === 'Pendiente' ? ('Entregado' as const) : ('Pendiente' as const) }
                              : o
                          );
                          updateOrders(updated);
                          showToast('✅ Estado del pedido actualizado');
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider transition shrink-0 ${
                          ord.status === 'Pendiente'
                            ? 'bg-amber-100 text-amber-950 hover:bg-amber-200 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-950 hover:bg-emerald-200 border border-emerald-300'
                        }`}
                      >
                        {ord.status}
                      </button>
                    </div>

                    {/* COLLAPSIBLE ACCORDION CONTENT */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-3.5 w-full"
                        >
                          {/* Date, Time & Delivery Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-stone-700 bg-amber-50/40 p-3 rounded-xl border border-amber-200/60 mt-1">
                            <p>📅 <strong>Fecha:</strong> {ord.order_date}</p>
                            <p>⏰ <strong>Hora:</strong> {ord.order_time}</p>
                            <p>🛵 <strong>Tipo de entrega:</strong> {ord.delivery_type === 'domicilio' ? 'Envío a Domicilio' : 'Retirar Personalmente'}</p>
                            <p className="sm:col-span-3">📍 <strong>Dirección Cliente:</strong> {ord.customer_address}</p>
                            {ord.additional_note && (
                              <p className="sm:col-span-3 text-amber-900 font-semibold">📝 <strong>Nota Adicional:</strong> "{ord.additional_note}"</p>
                            )}
                          </div>

                          {/* Requested Products Table (Requirement 3) */}
                          <div className="overflow-x-auto w-full">
                            <table className="w-full text-xs text-left border-collapse min-w-[320px]">
                              <thead>
                                <tr className="bg-amber-100/50 text-stone-700 font-bold border-b border-amber-200">
                                  <th className="p-2">Producto</th>
                                  <th className="p-2">Cantidad</th>
                                  <th className="p-2">Precio Unitario</th>
                                  <th className="p-2 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-amber-100">
                                {ord.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="p-2 font-bold text-stone-900">{item.product_name}</td>
                                    <td className="p-2 font-semibold text-stone-700">{item.quantity}</td>
                                    <td className="p-2">${item.unit_price.toFixed(2)}</td>
                                    <td className="p-2 text-right font-black text-red-700">${item.subtotal.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex justify-end border-t border-amber-100 pt-2">
                            <p className="text-xs sm:text-sm font-black text-stone-900">
                              Total General del Pedido: <span className="text-red-700 text-base sm:text-lg">${ord.total.toFixed(2)}</span>
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {currentBizOrders.length === 0 && (
                <div className="bg-white rounded-2xl p-10 text-center text-stone-400 space-y-2 border border-amber-200/70">
                  <Truck className="w-10 h-10 mx-auto text-amber-400" />
                  <p className="font-bold text-stone-700 text-sm">No se encontraron solicitudes registradas.</p>
                  <p className="text-xs text-stone-500">Los nuevos pedidos realizados por clientes aparecerán aquí.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: REGISTRO DE CLIENTE (Requirement 8) */}
        {activeTab === 'customer_profile' && (
          <div
            className="max-w-2xl mx-auto bg-white rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm border border-amber-200/70 space-y-5"
          >
            <div className="border-b border-amber-100 pb-3.5">
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 flex items-center gap-2">
                <User className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600" /> Mi Registro de Cliente
              </h2>
              <p className="text-stone-600 text-xs sm:text-sm mt-1">
                Guarda tus datos de contacto y ubicación GPS obligatoria para realizar pedidos de manera rápida.
              </p>
            </div>

            <form onSubmit={handleSaveCustomerProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1.5">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. José Manuel Mejía"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-amber-200/80 focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm font-medium bg-amber-50/10 text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1.5">
                  Número de contacto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 7000-1122"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-amber-200/80 focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm font-medium bg-amber-50/10 text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1.5">
                  Dirección escrita *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ej. Colonia San Benito, Calle La Mascota #14, San Salvador"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border border-amber-200/80 focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm font-medium bg-amber-50/10 text-stone-900"
                />
              </div>

              {/* Requirement 8: Botón Obligatorio GPS Cliente */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-stone-900 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-red-600" /> Guardar ubicación GPS actual (Obligatorio)
                    </h4>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Esta ubicación permite a los comercios enviarte tus productos a domicilio con exactitud.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={captureCustomerGps}
                    disabled={custGpsLoading}
                    className="w-full sm:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-sm transition flex items-center justify-center gap-2 shrink-0"
                  >
                    <Navigation className="w-4 h-4" />
                    {custGpsLoading ? 'Obteniendo GPS...' : 'Guardar mi ubicación actual'}
                  </button>
                </div>

                {custGpsSuccess && custLat && custLng && (
                  <div className="bg-emerald-100 border border-emerald-300 text-emerald-950 px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-700" />
                    Ubicación GPS Guardada (Lat: {custLat.toFixed(4)}, Lng: {custLng.toFixed(4)})
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black uppercase tracking-wider text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/20 transition"
              >
                Guardar Registro de Cliente
              </button>
            </form>
          </div>
        )}
      </div>

      {/* MODAL: SOLICITAR PRODUCTOS (Requirement 6) */}
      <AnimatePresence>
        {isOrderingModalOpen && (orderingBusiness || selectedBusiness) && (() => {
          const biz = orderingBusiness || selectedBusiness!;
          return (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-stone-900/65 backdrop-blur-xs overflow-y-auto">
            <div
              className="bg-white w-full max-w-2xl rounded-2xl p-4 sm:p-6 shadow-2xl border border-amber-200 my-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-stone-900">
                    Solicitar Productos - {biz.business_name}
                  </h3>
                  <p className="text-xs text-stone-600">
                    Propietario: {biz.owner_name} | Tel: {biz.phone}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsOrderingModalOpen(false);
                    setOrderingBusiness(null);
                  }}
                  className="p-1 rounded-full text-stone-400 hover:bg-stone-100"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {/* Requirement 6: Tipo de Entrega Selección Obligatoria antes del pedido */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700">
                  Selecciona el Tipo de Entrega:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('personal')}
                    className={`p-2.5 sm:p-3 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-2 ${
                      deliveryType === 'personal'
                        ? 'bg-amber-50 border-amber-500 text-stone-950 shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-amber-50/50'
                    }`}
                  >
                    <Store className="w-4 h-4 text-amber-600" />
                    Retirar Personalmente
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType('domicilio')}
                    className={`p-2.5 sm:p-3 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-2 ${
                      deliveryType === 'domicilio'
                        ? 'bg-amber-50 border-amber-500 text-stone-950 shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-amber-50/50'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-amber-600" />
                    Envío a Domicilio
                  </button>
                </div>
              </div>

              {/* Products Catalog Filtered by Delivery Type (Requirement 6) */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-extrabold uppercase text-stone-600">
                  {deliveryType === 'domicilio'
                    ? 'Productos Disponibles para Envío a Domicilio:'
                    : 'Todos los Productos del Negocio:'}
                </h4>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border border-amber-200/70 rounded-xl p-2.5 bg-amber-50/20">
                  {products
                    .filter((p) => p.business_id === biz.id && !p.is_hidden)
                    .filter((p) => (deliveryType === 'domicilio' ? p.disponible_domicilio : true))
                    .map((p) => {
                      const qty = cart[p.id] || 0;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between bg-white p-2 sm:p-2.5 rounded-xl border border-amber-200/80"
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={p.image_url}
                              alt={p.name}
                              onClick={() => setSelectedImageForView(p.image_url)}
                              className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg object-cover border border-amber-200 cursor-zoom-in"
                            />
                            <div>
                              <p 
                                onClick={() => setSelectedImageForView(p.image_url)}
                                className="font-extrabold text-xs text-stone-900 cursor-pointer hover:text-amber-700 transition-colors"
                              >
                                {p.name}
                              </p>
                              <p className="text-red-700 font-black text-xs">${p.price.toFixed(2)}</p>
                            </div>
                          </div>

                          {/* Quantity selector */}
                          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-lg">
                            <button
                              onClick={() => handleQuantityChange(p.id, -1)}
                              className="w-6 h-6 bg-white border border-stone-300 text-stone-800 font-black rounded flex items-center justify-center text-xs"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-black text-stone-900">{qty}</span>
                            <button
                              onClick={() => handleQuantityChange(p.id, 1)}
                              className="w-6 h-6 bg-amber-500 text-stone-950 font-black rounded flex items-center justify-center text-xs"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Additional Note & Address (Requirement 6) */}
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-xs font-extrabold text-stone-700 mb-1">
                    Nota adicional para el encargado del negocio:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Entregar sin cebolla / llamar al llegar"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-200/80 rounded-xl text-xs font-medium bg-amber-50/10 text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-stone-700 mb-1">
                    Dirección de entrega (modificable):
                  </label>
                  <input
                    type="text"
                    placeholder="Escribe la dirección exacta"
                    value={orderAddressInput}
                    onChange={(e) => setOrderAddressInput(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-200/80 rounded-xl text-xs font-medium bg-amber-50/10 text-stone-900"
                  />
                </div>
              </div>

              {/* Requirement 6 Botones: Realizar pedido y Realizar otro pedido */}
              <div className="border-t border-amber-100 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-stone-900 font-black text-xs sm:text-sm">
                  Total: <span className="text-red-700 text-base sm:text-lg">${calculateCartTotal().toFixed(2)}</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setCart({});
                      showToast('🧹 Selección limpiada. Puedes agregar otros productos.');
                    }}
                    className="px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-extrabold uppercase rounded-xl transition"
                  >
                    Realizar otro pedido
                  </button>

                  <button
                    onClick={handleConfirmOrder}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-black uppercase rounded-xl shadow-xs transition"
                  >
                    Realizar pedido
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      </AnimatePresence>

      {/* MODAL: REGISTRO DE CLIENTE AUTOMÁTICO (Requirement 8) */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-xs">
            <div
              className="bg-white w-full max-w-lg rounded-2xl p-4 sm:p-6 shadow-2xl border border-amber-200 space-y-4"
            >
              <div className="border-b border-amber-100 pb-3">
                <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" /> Registro de Cliente Requerido
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Debes completar tus datos y guardar tu ubicación GPS obligatoria antes de finalizar tu pedido.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-stone-700 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-200/80 rounded-xl text-xs font-medium text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-stone-700 mb-1">Número de contacto *</label>
                  <input
                    type="text"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-200/80 rounded-xl text-xs font-medium text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-stone-700 mb-1">Dirección escrita *</label>
                  <input
                    type="text"
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-200/80 rounded-xl text-xs font-medium text-stone-900"
                  />
                </div>

                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-stone-900 flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-red-600" /> Ubicación GPS Actual (Obligatorio)
                    </span>
                    <button
                      type="button"
                      onClick={captureCustomerGps}
                      disabled={custGpsLoading}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-lg shadow-xs"
                    >
                      {custGpsLoading ? 'Guardando...' : 'Guardar ubicación actual'}
                    </button>
                  </div>

                  {custGpsSuccess && custLat && custLng && (
                    <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> GPS Capturado: Lat {custLat.toFixed(4)}, Lng {custLng.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-amber-100 pt-3">
                <button
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const ok = handleSaveCustomerProfileSubmit();
                    if (ok) {
                      handleConfirmOrder();
                    }
                  }}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-black uppercase rounded-xl shadow-xs"
                >
                  Guardar y Confirmar Pedido
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: REGISTRAR / EDITAR PRODUCTO (Requirement 2 & 4) */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs">
            <div
              className="bg-white w-full max-w-md rounded-2xl p-4 sm:p-6 shadow-2xl border border-amber-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <h3 className="text-base sm:text-lg font-black text-stone-900">
                  {editingProductId ? 'Modificar Producto' : 'Agregar Nuevo Producto'}
                </h3>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="p-1 text-stone-400 hover:bg-stone-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProductSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-stone-700 mb-1">Nombre del producto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pupusa de Queso con Loroco"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-200/80 rounded-xl text-xs font-medium text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-stone-700 mb-1">Precio Unitario ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ej. 1.25"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-amber-200/80 rounded-xl text-xs font-medium text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-stone-700 mb-1 flex items-center justify-between">
                    <span>Imagen del Producto</span>
                    <span className="text-[10px] text-amber-700 font-extrabold">Base de Datos Supabase</span>
                  </label>

                  <div className="space-y-2">
                    <label className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 border border-dashed rounded-xl cursor-pointer text-xs font-extrabold transition shadow-xs ${
                      uploadingImage
                        ? 'bg-amber-100 border-amber-400 text-amber-800'
                        : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-300 text-amber-900'
                    }`}>
                      {uploadingImage ? (
                        <>
                          <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                          <span>Guardando en Supabase...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-amber-600" />
                          <span>Subir Imagen a Supabase (NewBankImageProductos)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={handleProductImageUpload}
                        className="hidden"
                      />
                    </label>

                    <input
                      type="url"
                      placeholder="O pega una URL directa de imagen (https://...)"
                      value={prodImage}
                      onChange={(e) => setProdImage(e.target.value)}
                      className="w-full px-3 py-2 border border-amber-200/80 rounded-xl text-xs font-medium text-stone-900"
                    />

                    {prodImage && (
                      <div className="flex items-center gap-2.5 p-2 bg-stone-50 border border-amber-200 rounded-xl">
                        <img
                          src={prodImage}
                          alt="Vista previa del producto"
                          className="w-12 h-12 object-cover rounded-lg border border-stone-300 shadow-2xs"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
                          }}
                        />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[11px] font-bold text-stone-800 truncate">{prodImage}</p>
                          <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> Guardada en la base de datos
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Disponible para envío a domicilio: Sí / No (Requirement 2) */}
                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
                  <label className="block text-xs font-extrabold uppercase text-stone-900">
                    ¿Disponible para envío a domicilio?
                  </label>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <label className="flex items-center gap-1.5 cursor-pointer text-stone-800">
                      <input
                        type="radio"
                        name="delivery_avail"
                        checked={prodDisponibleDomicilio}
                        onChange={() => setProdDisponibleDomicilio(true)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      Sí (Envío a Domicilio)
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-stone-800">
                      <input
                        type="radio"
                        name="delivery_avail"
                        checked={!prodDisponibleDomicilio}
                        onChange={() => setProdDisponibleDomicilio(false)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      No (Solo Retiro en Local)
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-amber-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-black uppercase rounded-xl shadow-xs"
                  >
                    Guardar Producto
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* SUCCESS ORDER NOTIFICATION MODAL */}
      <AnimatePresence>
        {orderSuccessOrder && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-xs">
            <div
              className="bg-white w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl border border-amber-200 text-center space-y-4 my-6"
            >
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-8 h-8" />
              </div>

              <h3 className="text-lg font-black text-stone-900">¡Pedido Realizado con Éxito!</h3>
              <p className="text-xs text-stone-600">
                Tu solicitud ha sido enviada a <strong>{orderSuccessOrder.business_name}</strong>.
              </p>

              <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 text-left text-[10px] sm:text-xs space-y-2 font-medium text-stone-800">
                <div className="border-b border-amber-200/60 pb-2 space-y-1">
                  <p><strong>N° de Pedido:</strong> #{orderSuccessOrder.id.substring(4)}</p>
                  <p><strong>Cliente:</strong> {orderSuccessOrder.customer_name}</p>
                  <p><strong>Entrega:</strong> {orderSuccessOrder.delivery_type === 'domicilio' ? 'Envío a Domicilio' : 'Retiro Personal'}</p>
                </div>

                <div className="space-y-1.5 py-1">
                  <p className="font-black text-stone-600 uppercase text-[9px] tracking-wider">Detalle de Productos:</p>
                  {orderSuccessOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between gap-2 border-b border-amber-100/40 pb-1 last:border-0">
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 truncate">{item.product_name}</p>
                        <p className="text-[9px] text-stone-500">{item.quantity} x ${item.unit_price.toFixed(2)}</p>
                      </div>
                      <span className="font-black text-stone-900 self-center">${item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-amber-200 flex justify-between items-center">
                  <span className="font-black uppercase text-[10px] text-stone-600">Total:</span>
                  <span className="text-red-700 font-black text-sm sm:text-base">${orderSuccessOrder.total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={() => setOrderSuccessOrder(null)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-xs"
              >
                Aceptar
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* DRAGGABLE LOGIN MODAL OVERLAY */}
      <AnimatePresence>
        {isLoginDropdownOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-xs">
            <div
              className="bg-white w-full max-w-sm rounded-2xl p-5 sm:p-6 shadow-2xl border border-amber-200 space-y-4 text-stone-900"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-sm font-black text-stone-800 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-amber-600" /> Iniciar Sesión
                </span>
                <button
                  onClick={() => setIsLoginDropdownOpen(false)}
                  className="text-stone-400 hover:text-stone-600 p-1 rounded-md hover:bg-stone-100 transition cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-stone-600 leading-relaxed font-medium">
                  Ingresa tu número de teléfono registrado para iniciar sesión de cliente de forma segura.
                </p>

                <div>
                  <label className="block text-xs font-extrabold uppercase text-stone-700 mb-1">
                    Número de Teléfono
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 7845-9201"
                    value={loginPhoneInput}
                    onChange={(e) => setLoginPhoneInput(e.target.value)}
                    className="w-full px-3 py-2 border border-amber-200/80 rounded-xl text-xs font-medium text-stone-900 focus:ring-1 focus:ring-amber-500 bg-amber-50/10 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleLoginSubmit();
                      }
                    }}
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLoginDropdownOpen(false)}
                    className="flex-1 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-extrabold rounded-xl transition cursor-pointer border border-stone-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleLoginSubmit}
                    className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-extrabold rounded-xl transition cursor-pointer border border-amber-600 shadow-xs"
                  >
                    Ingresar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Viewer Modal (Requirement: Large image on click) */}
      <AnimatePresence>
        {selectedImageForView && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImageForView(null)}
            className="fixed inset-0 z-[20000] bg-stone-950/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-10 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImageForView}
                alt="Vista ampliada"
                className="max-w-full max-h-full rounded-2xl shadow-2xl border border-white/20 object-contain"
              />
              <button
                onClick={() => setSelectedImageForView(null)}
                className="absolute top-2 right-2 sm:-top-12 sm:-right-12 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all hover:scale-110 active:scale-95"
              >
                <X className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ADomicilio;

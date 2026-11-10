import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabase';
import {
  rouletteService,
  RouletteSettings,
  RouletteGift,
  RouletteOption,
  GiftWinner,
  AdministrativeAuditLog,
  calculateDistanceKm
} from '../services/rouletteService';

interface AdminGiftsPanelProps {
  user: any;
  products: any[];
}

export const AdminGiftsPanel: React.FC<AdminGiftsPanelProps> = ({ user, products }) => {
  const [subTab, setSubTab] = useState<'dashboard' | 'gifts' | 'wildcards' | 'winners' | 'geo' | 'audit'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [settings, setSettings] = useState<RouletteSettings | null>(null);
  const [gifts, setGifts] = useState<RouletteGift[]>([]);
  const [options, setOptions] = useState<RouletteOption[]>([]);
  const [winners, setWinners] = useState<GiftWinner[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdministrativeAuditLog[]>([]);

  // Search and filter for winners
  const [winnerSearch, setWinnerSearch] = useState('');
  const [winnerStatusFilter, setWinnerStatusFilter] = useState<'ALL' | 'PENDING' | 'DELIVERED'>('ALL');
  const [editingWinnerNames, setEditingWinnerNames] = useState<Record<string, string>>({});
  const [savedWinnerId, setSavedWinnerId] = useState<string | null>(null);

  // Search and filter for catalog products
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showNewGiftModal, setShowNewGiftModal] = useState(false);
  const [editingGift, setEditingGift] = useState<RouletteGift | null>(null);

  // Form state for configuring catalog product as gift
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<any | null>(null);
  const [catalogGiftForm, setCatalogGiftForm] = useState({
    name: '',
    quantity: 5,
    probability: 5,
    is_active: true
  });

  // Form state for creating custom gift
  const [customGiftForm, setCustomGiftForm] = useState({
    name: '',
    description: '',
    image_url: '',
    quantity: 5,
    probability: 5,
    is_active: true
  });

  // State for Geographic Area & Map Restriction
  const [geoForm, setGeoForm] = useState({
    enabled: false,
    latitude: 13.6929,
    longitude: -89.2182,
    radiusKm: 25,
    zoneName: 'San Salvador y alrededores'
  });

  const geoMapContainerRef = useRef<HTMLDivElement | null>(null);
  const geoMapInstanceRef = useRef<L.Map | null>(null);
  const geoMarkerRef = useRef<L.Marker | null>(null);
  const geoCircleRef = useRef<L.Circle | null>(null);

  // Sync settings with geoForm when settings load
  useEffect(() => {
    if (settings) {
      setGeoForm({
        enabled: !!settings.geo_restriction_enabled,
        latitude: typeof settings.geo_latitude === 'number' && !isNaN(settings.geo_latitude) ? settings.geo_latitude : 13.6929,
        longitude: typeof settings.geo_longitude === 'number' && !isNaN(settings.geo_longitude) ? settings.geo_longitude : -89.2182,
        radiusKm: typeof settings.geo_radius_km === 'number' && !isNaN(settings.geo_radius_km) ? settings.geo_radius_km : 25,
        zoneName: settings.geo_zone_name || 'San Salvador y alrededores'
      });
    }
  }, [settings]);

  // Leaflet map initialization and updates when in 'geo' tab
  useEffect(() => {
    if (subTab !== 'geo') {
      if (geoMapInstanceRef.current) {
        geoMapInstanceRef.current.remove();
        geoMapInstanceRef.current = null;
        geoMarkerRef.current = null;
        geoCircleRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!geoMapContainerRef.current) return;

      const lat = !isNaN(geoForm.latitude) ? geoForm.latitude : 13.6929;
      const lng = !isNaN(geoForm.longitude) ? geoForm.longitude : -89.2182;
      const radiusMeters = (geoForm.radiusKm || 25) * 1000;

      if (!geoMapInstanceRef.current) {
        const map = L.map(geoMapContainerRef.current, {
          center: [lat, lng],
          zoom: 11,
          zoomControl: false
        });

        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          attribution: '&copy; Google Maps',
          maxZoom: 20
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        const customMarkerIcon = L.divIcon({
          className: 'roulette-geo-pin',
          html: `<div style="background-color:#2563eb; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 16px rgba(0,0,0,0.4); border:3px solid white; cursor:move;"><span style="font-size:20px;">🎯</span></div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19]
        });

        const marker = L.marker([lat, lng], {
          icon: customMarkerIcon,
          draggable: true
        }).addTo(map);

        marker.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          setGeoForm((prev) => ({
            ...prev,
            latitude: Math.round(pos.lat * 10000) / 10000,
            longitude: Math.round(pos.lng * 10000) / 10000
          }));
        });

        const circle = L.circle([lat, lng], {
          radius: radiusMeters,
          color: '#2563eb',
          weight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 0.22
        }).addTo(map);

        map.on('click', (e: L.LeafletMouseEvent) => {
          const newLat = Math.round(e.latlng.lat * 10000) / 10000;
          const newLng = Math.round(e.latlng.lng * 10000) / 10000;
          marker.setLatLng([newLat, newLng]);
          circle.setLatLng([newLat, newLng]);
          setGeoForm((prev) => ({
            ...prev,
            latitude: newLat,
            longitude: newLng
          }));
        });

        geoMapInstanceRef.current = map;
        geoMarkerRef.current = marker;
        geoCircleRef.current = circle;
      } else {
        geoMapInstanceRef.current.setView([lat, lng]);
        geoMarkerRef.current?.setLatLng([lat, lng]);
        geoCircleRef.current?.setLatLng([lat, lng]);
        geoCircleRef.current?.setRadius(radiusMeters);
        geoMapInstanceRef.current.invalidateSize();
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [subTab, geoForm.latitude, geoForm.longitude, geoForm.radiusKm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, g, o, w, a] = await Promise.all([
        rouletteService.getSettings(),
        rouletteService.getGifts(true),
        rouletteService.getOptions(),
        rouletteService.getAllWinners(),
        rouletteService.getAuditLogs()
      ]);

      // Direct live fetch from Supabase table 'gifts' to guarantee real-time database display
      let dbGiftsList: RouletteGift[] = [];
      let giftsFetchedDirectly = false;
      try {
        const { data: dbGifts, error: dbErr } = await supabase
          .from('gifts')
          .select('*')
          .order('created_at', { ascending: false });
        if (!dbErr && dbGifts) {
          dbGiftsList = dbGifts;
          giftsFetchedDirectly = true;
        }
      } catch (err) {
        console.warn('Direct Supabase gifts fetch failed:', err);
      }

      // Direct live fetch from Supabase table 'gift_winners' to guarantee real-time winners display
      let dbWinnersList: GiftWinner[] = [];
      let winnersFetchedDirectly = false;
      try {
        const { data: dbWinners, error: wErr } = await supabase
          .from('gift_winners')
          .select('*')
          .order('created_at', { ascending: false });
        if (!wErr && dbWinners) {
          dbWinnersList = dbWinners as GiftWinner[];
          winnersFetchedDirectly = true;
        }
      } catch (err) {
        console.warn('Direct Supabase winners fetch failed:', err);
      }

      setSettings(s);
      setGifts(giftsFetchedDirectly && dbGiftsList.length > 0 ? dbGiftsList : (g.length > 0 ? g : dbGiftsList));
      setOptions(o);
      setWinners(winnersFetchedDirectly ? dbWinnersList : (w.length > 0 ? w : dbWinnersList));
      setAuditLogs(a);
    } catch (err) {
      console.error('Error fetching admin roulette data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen to real-time changes in Supabase 'gifts' and 'gift_winners' tables
    const rouletteChannel = supabase
      .channel('admin_roulette_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gifts' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gift_winners' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(rouletteChannel);
    };
  }, []);

  // Total probability calculation
  const totalActiveGiftsProb = gifts
    .filter((g) => g.is_active)
    .reduce((acc, curr) => acc + Number(curr.probability || 0), 0);

  const totalActiveOptionsProb = options
    .filter((o) => o.is_active)
    .reduce((acc, curr) => acc + Number(curr.probability || 0), 0);

  const totalProb = Math.round((totalActiveGiftsProb + totalActiveOptionsProb) * 100) / 100;

  // Normalization helper
  const handleNormalizeProbabilities = async () => {
    if (totalProb === 0) return;
    if (!confirm(`La suma actual es ${totalProb}%. ¿Deseas normalizar automáticamente todas las opciones y regalos activos para que sumen exactamente 100%?`)) {
      return;
    }

    setActionLoading('normalizing');
    try {
      const factor = 100 / totalProb;

      // Update gifts
      for (const gift of gifts) {
        if (gift.is_active) {
          const newProb = Math.round(Number(gift.probability) * factor * 10) / 10;
          await rouletteService.saveGift({ ...gift, probability: newProb }, user);
        }
      }

      // Update options
      for (const opt of options) {
        if (opt.is_active) {
          const newProb = Math.round(Number(opt.probability) * factor * 10) / 10;
          await rouletteService.updateOption({ ...opt, probability: newProb }, user);
        }
      }

      alert('¡Probabilidades normalizadas exitosamente a 100%!');
      fetchData();
    } catch (err: any) {
      alert('Error normalizando: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Impossible Mode with confirmation
  const handleToggleImpossible = async () => {
    if (!settings) return;
    const nextState = !settings.impossible_mode;
    const confirmMsg = nextState
      ? '⚠️ ¿ACTIVAR MODO IMPOSIBLE?\n\nAl activar esta opción, ningún usuario podrá ganar regalos físicos mientras esté habilitada. Las opciones se limitarán estrictamente a los comodines, conservando el inventario intacto.'
      : '¿Desactivar Modo Imposible y restaurar la entrega normal de premios según las probabilidades vigentes?';

    if (!confirm(confirmMsg)) return;

    setActionLoading('toggle-impossible');
    try {
      const updated = await rouletteService.toggleImpossibleMode(nextState, user);
      setSettings(updated);
      alert(`Modo Imposible ${nextState ? 'ACTIVADO' : 'DESACTIVADO'}.`);
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle general roulette active status
  const handleToggleRouletteActive = async () => {
    if (!settings) return;
    const nextState = !settings.is_active;
    setActionLoading('toggle-active');
    try {
      const updated = await rouletteService.updateSettings({ is_active: nextState }, user);
      setSettings(updated);
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Update owner phone or cooldown
  const handleUpdateGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setActionLoading('saving-settings');
    try {
      const updated = await rouletteService.updateSettings(settings, user);
      setSettings(updated);
      alert('Configuración general guardada exitosamente.');
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Save Geographic coverage & restriction settings
  const handleSaveGeoSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setActionLoading('saving-geo-settings');
    try {
      const payload: Partial<RouletteSettings> = {
        ...settings,
        geo_restriction_enabled: geoForm.enabled,
        geo_latitude: Number(geoForm.latitude),
        geo_longitude: Number(geoForm.longitude),
        geo_radius_km: Number(geoForm.radiusKm),
        geo_zone_name: geoForm.zoneName.trim()
      };

      const updated = await rouletteService.updateSettings(payload, user);
      setSettings(updated);
      alert('¡Configuración de área geográfica de la Ruleta actualizada con éxito!');
      await fetchData();
    } catch (err: any) {
      alert('Error guardando configuración geográfica: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Fast preset zones
  const handleSelectGeoPreset = (name: string, lat: number, lng: number, radiusKm: number) => {
    setGeoForm((prev) => ({
      ...prev,
      zoneName: name,
      latitude: lat,
      longitude: lng,
      radiusKm
    }));
  };

  // GPS current location for admin
  const handleGetAdminCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('La geolocalización no está soportada en tu navegador.');
      return;
    }
    setActionLoading('getting-gps');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setActionLoading(null);
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lng = Math.round(pos.coords.longitude * 10000) / 10000;
        setGeoForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          zoneName: prev.zoneName || 'Ubicación actual del Administrador'
        }));
      },
      (err) => {
        setActionLoading(null);
        alert('No se pudo obtener tu ubicación actual: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Select catalog product
  const handleSelectCatalogProduct = (prod: any) => {
    setSelectedCatalogProduct(prod);
    setCatalogGiftForm({
      name: prod.name,
      quantity: 5,
      probability: 5,
      is_active: true
    });
  };

  // Save product from catalog as gift
  const handleSaveCatalogGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalogProduct) return;

    setActionLoading('saving-catalog-gift');
    try {
      const imgUrl = (selectedCatalogProduct.image_urls?.[0] || selectedCatalogProduct.image_url || '').trim();
      const newGiftPayload = {
        id: 'gift_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        product_id: selectedCatalogProduct.id || null,
        name: catalogGiftForm.name || selectedCatalogProduct.name,
        description: selectedCatalogProduct.description || '',
        image_url: imgUrl !== '' ? imgUrl : 'https://picsum.photos/seed/gift/400/400',
        gift_type: 'product' as const,
        initial_quantity: Number(catalogGiftForm.quantity),
        available_quantity: Number(catalogGiftForm.quantity),
        won_quantity: 0,
        delivered_quantity: 0,
        probability: Number(catalogGiftForm.probability),
        is_active: catalogGiftForm.is_active
      };

      // Direct write to Supabase table 'gifts'
      try {
        await supabase.from('gifts').upsert({
          ...newGiftPayload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Direct Supabase catalog gift upsert error:', dbErr);
      }

      await rouletteService.saveGift(newGiftPayload, user);

      setShowCatalogModal(false);
      setSelectedCatalogProduct(null);
      alert('¡Producto agregado al inventario promocional de regalos!');
      await fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle custom image upload to Supabase storage if file chosen
  const handleImageUpload = async (file: File) => {
    setActionLoading('uploading-image');
    try {
      const fileName = `roulette_gift_${Date.now()}.webp`;
      const reader = new FileReader();
      const webpUrl = await new Promise<string>((resolve, reject) => {
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target?.result as string;
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const webpData = canvas.toDataURL('image/webp', 0.85);
            const byteChars = atob(webpData.split(',')[1]);
            const bytes = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
            const { error } = await supabase.storage
              .from('NewBankImageProductos')
              .upload(fileName, new Blob([bytes], { type: 'image/webp' }), { upsert: true });

            if (error) reject(error);
            else resolve(supabase.storage.from('NewBankImageProductos').getPublicUrl(fileName).data.publicUrl);
          };
        };
      });

      setCustomGiftForm((prev) => ({ ...prev, image_url: webpUrl }));
      alert('Imagen cargada con éxito.');
    } catch (err: any) {
      console.error(err);
      alert('No se pudo subir la imagen. Puedes pegar una URL directamente.');
    } finally {
      setActionLoading(null);
    }
  };

  // Save custom gift
  const handleSaveCustomGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGiftForm.name) {
      alert('El nombre del regalo es obligatorio');
      return;
    }

    setActionLoading('saving-custom-gift');
    try {
      const customImgUrl = (customGiftForm.image_url || '').trim();
      const newCustomGift = {
        id: 'gift_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        product_id: null,
        name: customGiftForm.name,
        description: customGiftForm.description,
        image_url: customImgUrl !== '' ? customImgUrl : 'https://picsum.photos/seed/gift/400/400',
        gift_type: 'custom' as const,
        initial_quantity: Number(customGiftForm.quantity),
        available_quantity: Number(customGiftForm.quantity),
        won_quantity: 0,
        delivered_quantity: 0,
        probability: Number(customGiftForm.probability),
        is_active: customGiftForm.is_active
      };

      // Direct write to Supabase table 'gifts'
      try {
        await supabase.from('gifts').upsert({
          ...newCustomGift,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Direct Supabase custom gift upsert error:', dbErr);
      }

      await rouletteService.saveGift(newCustomGift, user);

      setShowNewGiftModal(false);
      setCustomGiftForm({
        name: '',
        description: '',
        image_url: '',
        quantity: 5,
        probability: 5,
        is_active: true
      });
      alert('¡Nuevo regalo registrado exitosamente!');
      await fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Update existing gift in list
  const handleUpdateGift = async (gift: RouletteGift) => {
    setActionLoading('updating-gift-' + gift.id);
    try {
      const sanitizedGift = {
        ...gift,
        product_id: (gift.product_id && gift.product_id.trim() !== '') ? gift.product_id : null,
        image_url: (gift.image_url || '').trim() || 'https://picsum.photos/seed/gift/400/400'
      };
      try {
        await supabase.from('gifts').upsert({
          ...sanitizedGift,
          updated_at: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Direct Supabase gift update error:', dbErr);
      }

      await rouletteService.saveGift(sanitizedGift, user);
      setEditingGift(null);
      await fetchData();
    } catch (err: any) {
      alert('Error actualizando regalo: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Delete gift
  const handleDeleteGift = async (giftId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este regalo de la ruleta? (El historial de ganadores previos no se borrará).')) return;
    setActionLoading('deleting-gift-' + giftId);
    try {
      try {
        await supabase.from('gifts').delete().eq('id', giftId);
      } catch (dbErr) {
        console.warn('Direct Supabase gift delete error:', dbErr);
      }

      await rouletteService.deleteGift(giftId, user);
      await fetchData();
    } catch (err: any) {
      alert('Error eliminando regalo: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Update Option
  const handleUpdateOption = async (option: RouletteOption) => {
    setActionLoading('updating-option-' + option.id);
    try {
      await rouletteService.updateOption(option, user);
      fetchData();
    } catch (err: any) {
      alert('Error actualizando opción: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Save Winner Name and Surname
  const handleSaveWinnerName = async (winnerId: string) => {
    const newName = (editingWinnerNames[winnerId] !== undefined ? editingWinnerNames[winnerId] : '').trim();
    if (!newName) {
      alert('Por favor ingresa un nombre y un apellido válido.');
      return;
    }

    setActionLoading('saving-winner-name-' + winnerId);
    try {
      await rouletteService.updateWinnerName(winnerId, newName, user);
      setWinners(prev => prev.map(w => w.id === winnerId ? { ...w, user_name: newName } : w));
      setSavedWinnerId(winnerId);
      setTimeout(() => {
        setSavedWinnerId(null);
      }, 2500);
    } catch (err: any) {
      alert('Error guardando nombre y apellido: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle visibility in monthly winners table
  const handleToggleMonthlyVisibility = async (winner: GiftWinner) => {
    const isCurrentlyVisible = winner.show_in_monthly_winners !== false;
    setActionLoading('toggling-visibility-' + winner.id);
    try {
      const newVisibility = await rouletteService.toggleWinnerMonthlyVisibility(winner.id, isCurrentlyVisible, user);
      setWinners(prev => prev.map(w => w.id === winner.id ? { ...w, show_in_monthly_winners: newVisibility } : w));
    } catch (err: any) {
      alert('Error cambiando visibilidad: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Mark Prize as Delivered
  const handleMarkAsDelivered = async (winner: GiftWinner) => {
    const pendingName = editingWinnerNames[winner.id]?.trim();
    const currentName = pendingName || winner.user_name || 'Usuario Ganador';

    if (!confirm(`¿Confirmas que el premio "${winner.gift_name_snapshot}" (Código: ${winner.unique_code}) fue entregado al usuario ${currentName}?`)) {
      return;
    }

    setActionLoading('delivering-' + winner.id);
    try {
      if (pendingName && pendingName !== winner.user_name) {
        await rouletteService.updateWinnerName(winner.id, pendingName, user);
      }
      await rouletteService.markAsDelivered(winner.id, user);
      alert('¡Premio marcado como ENTREGADO! La cuenta del usuario se ha actualizado automáticamente.');
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter winners
  const filteredWinners = winners.filter((w) => {
    const searchLower = winnerSearch.toLowerCase();
    const matchesSearch =
      w.user_name?.toLowerCase().includes(searchLower) ||
      w.user_email?.toLowerCase().includes(searchLower) ||
      w.user_phone?.toLowerCase().includes(searchLower) ||
      w.unique_code?.toLowerCase().includes(searchLower) ||
      w.gift_name_snapshot?.toLowerCase().includes(searchLower);

    const matchesStatus =
      winnerStatusFilter === 'ALL'
        ? true
        : winnerStatusFilter === 'PENDING'
        ? w.status === 'PENDING'
        : w.status === 'DELIVERED';

    return matchesSearch && matchesStatus;
  });

  // Filter catalog products for search
  const filteredCatalog = products.filter((p) =>
    p.name.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Sub-navigation tabs inside Regalos */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-2xl font-black uppercase text-slate-900 flex items-center gap-2">
            <span>🎁</span> Administración de Regalos y Ruleta
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Control integral del módulo promocional «Probar mi suerte», inventario de premios, probabilidades y entregas.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'gifts', label: 'Regalos & Stock', icon: '🎁' },
            { id: 'wildcards', label: 'Comodines & Probabilidades', icon: '🎲' },
            { id: 'winners', label: 'Usuarios Ganadores', icon: '🏆', badge: winners.filter(w => w.status === 'PENDING').length },
            { id: 'geo', label: 'Área Geográfica & Mapa', icon: '📍' },
            { id: 'audit', label: 'Auditoría', icon: '📜' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                subTab === tab.id
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
              {tab.badge && tab.badge > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-900 text-[10px] font-black">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Sincronizando Módulo de Regalos...
          </p>
        </div>
      ) : (
        <>
          {/* SUBTAB 1: DASHBOARD DE REGALOS */}
          {subTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Quick Status Banners */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Impossible mode toggle card */}
                <div
                  className={`p-6 rounded-3xl border-2 transition-all flex items-center justify-between gap-4 ${
                    settings?.impossible_mode
                      ? 'bg-red-50 border-red-300 text-red-900 shadow-lg'
                      : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
                      Control Especial
                    </span>
                    <h4 className="text-base font-black uppercase">
                      Modo Imposible: {settings?.impossible_mode ? 'ACTIVADO' : 'INACTIVO'}
                    </h4>
                    <p className="text-xs opacity-80 max-w-sm">
                      {settings?.impossible_mode
                        ? '⚠️ Los usuarios NO pueden ganar regalos. Las tiradas caen estrictamente en comodines sin alterar inventario.'
                        : 'Los usuarios pueden ganar premios según las probabilidades y disponibilidad de inventario.'}
                    </p>
                  </div>

                  <button
                    disabled={actionLoading === 'toggle-impossible'}
                    onClick={handleToggleImpossible}
                    className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-md transition cursor-pointer ${
                      settings?.impossible_mode
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-slate-900 text-white hover:bg-black'
                    }`}
                  >
                    {actionLoading === 'toggle-impossible'
                      ? 'Cambiando...'
                      : settings?.impossible_mode
                      ? 'DESACTIVAR'
                      : 'ACTIVAR MODO IMPOSIBLE'}
                  </button>
                </div>

                {/* Roulette General Active Toggle */}
                <div className="p-6 rounded-3xl bg-white border-2 border-slate-200 shadow-sm flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      Disponibilidad Global
                    </span>
                    <h4 className="text-base font-black uppercase text-slate-900">
                      Ruleta: {settings?.is_active ? 'HABILITADA' : 'DESACTIVADA'}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm">
                      {settings?.is_active
                        ? 'La sección y botón de giro están operativos para los usuarios.'
                        : 'La ruleta está temporalmente en pausa para todos los usuarios.'}
                    </p>
                  </div>

                  <button
                    disabled={actionLoading === 'toggle-active'}
                    onClick={handleToggleRouletteActive}
                    className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-md transition cursor-pointer ${
                      settings?.is_active
                        ? 'bg-slate-900 text-white hover:bg-red-600'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {actionLoading === 'toggle-active'
                      ? 'Procesando...'
                      : settings?.is_active
                      ? 'PAUSAR RULETA'
                      : 'ACTIVAR RULETA'}
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Regalos Config.</span>
                  <p className="text-2xl font-black text-slate-900">{gifts.length}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Stock Disponible</span>
                  <p className="text-2xl font-black text-blue-600">
                    {gifts.reduce((acc, g) => acc + (g.available_quantity || 0), 0)}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Total Ganados</span>
                  <p className="text-2xl font-black text-purple-600">{winners.length}</p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Por Reclamar</span>
                  <p className="text-2xl font-black text-amber-600">
                    {winners.filter((w) => w.status === 'PENDING').length}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Entregados</span>
                  <p className="text-2xl font-black text-green-600">
                    {winners.filter((w) => w.status === 'DELIVERED').length}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Suma Prob.</span>
                  <p className={`text-2xl font-black ${totalProb === 100 ? 'text-green-600' : 'text-red-500'}`}>
                    {totalProb}%
                  </p>
                </div>
              </div>

              {/* General Settings Form */}
              {settings && (
                <form
                  onSubmit={handleUpdateGeneralSettings}
                  className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6"
                >
                  <div className="flex justify-between items-center border-b pb-4 border-slate-100">
                    <div>
                      <h4 className="font-black uppercase text-slate-900 text-sm">
                        Parámetros de Contacto y Tiempo de Espera
                      </h4>
                      <p className="text-xs text-slate-400 font-medium">
                        Configura el número al que los ganadores se comunicarán y el tiempo de enfriamiento entre tiradas.
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading === 'saving-settings'}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-wider hover:bg-blue-700 transition shadow-md cursor-pointer"
                    >
                      {actionLoading === 'saving-settings' ? 'Guardando...' : 'Guardar Parámetros'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                        Teléfono del Propietario (WhatsApp de Entrega)
                      </label>
                      <input
                        type="text"
                        required
                        value={settings.owner_phone}
                        onChange={(e) => setSettings({ ...settings, owner_phone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                        placeholder="Ej. 50370914941"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                        Tiempo de Espera entre Giros (Minutos)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        required
                        value={settings.participation_cooldown_minutes}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            participation_cooldown_minutes: Number(e.target.value)
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                      <span className="text-[9px] text-slate-400 font-bold block mt-1">Por defecto: 60 minutos (1 hora)</span>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                        ID Producto «Kit Personal» Tienda
                      </label>
                      <input
                        type="text"
                        value={settings.personal_kit_product_id}
                        onChange={(e) => setSettings({ ...settings, personal_kit_product_id: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm font-mono text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                      />
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* SUBTAB 2: REGALOS Y GESTIÓN DE STOCK */}
          {subTab === 'gifts' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div>
                  <h4 className="font-black uppercase text-slate-900 text-lg">
                    Inventario Promocional de Regalos
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Los regalos son independientes del inventario comercial y no alteran los precios de la tienda.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCatalogModal(true)}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🔍</span> Del Catálogo
                  </button>
                  <button
                    onClick={() => setShowNewGiftModal(true)}
                    className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>➕</span> Regalo Nuevo
                  </button>
                </div>
              </div>

              {/* Gifts Table */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                        <th className="px-6 py-4">Regalo</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4 text-center">Inicial</th>
                        <th className="px-6 py-4 text-center">Disponible</th>
                        <th className="px-6 py-4 text-center">Ganados</th>
                        <th className="px-6 py-4 text-center">Entregados</th>
                        <th className="px-6 py-4 text-center">Probabilidad</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {gifts.map((gift) => (
                        <tr key={gift.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-6 py-4 flex items-center gap-3">
                            {gift.image_url ? (
                              <img
                                src={gift.image_url}
                                alt={gift.name}
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                                className="w-12 h-12 object-cover rounded-xl border border-slate-200 shrink-0 bg-white"
                              />
                            ) : null}
                            {!gift.image_url && (
                              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl shrink-0">
                                🎁
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-black text-slate-900 truncate max-w-[200px]">{gift.name}</p>
                              {gift.description && (
                                <p className="text-[10px] text-slate-400 line-clamp-1 italic">{gift.description}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600">
                              {gift.gift_type === 'product' ? 'Catálogo' : 'Personalizado'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-slate-500">{gift.initial_quantity}</td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`font-black text-sm px-2 py-0.5 rounded-lg ${
                                gift.available_quantity > 0
                                  ? 'text-green-600 bg-green-50'
                                  : 'text-red-600 bg-red-50'
                              }`}
                            >
                              {gift.available_quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-purple-600">{gift.won_quantity || 0}</td>
                          <td className="px-6 py-4 text-center font-bold text-slate-600">{gift.delivered_quantity || 0}</td>
                          <td className="px-6 py-4 text-center font-mono font-black text-blue-600">
                            {gift.probability}%
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleUpdateGift({ ...gift, is_active: !gift.is_active })}
                              className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase cursor-pointer ${
                                gift.is_active
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {gift.is_active ? 'Activo' : 'Inactivo'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => setEditingGift(gift)}
                              className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded-lg font-bold text-[11px] cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteGift(gift.id)}
                              className="px-2.5 py-1 text-red-500 hover:bg-red-50 rounded-lg font-bold text-[11px] cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {gifts.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400 font-bold uppercase text-xs">
                            No hay regalos registrados aún. Agrega productos del catálogo o crea regalos nuevos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 3: COMODINES Y PROBABILIDADES */}
          {subTab === 'wildcards' && (
            <div className="space-y-6">
              {/* Integrity bar */}
              <div
                className={`p-6 rounded-3xl border-2 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                  totalProb === 100
                    ? 'bg-green-50/80 border-green-200 text-green-950'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{totalProb === 100 ? '✅' : '⚠️'}</span>
                    <h4 className="text-base font-black uppercase">
                      Integridad de Probabilidades: {totalProb}%
                    </h4>
                  </div>
                  <p className="text-xs mt-1 opacity-90">
                    {totalProb === 100
                      ? 'La suma de probabilidades de los premios y comodines activos es perfecta (100%).'
                      : `La suma de probabilidades es ${totalProb}%. Debe sumar exactamente 100% para una distribución matemática óptima.`}
                  </p>
                </div>

                {totalProb !== 100 && (
                  <button
                    onClick={handleNormalizeProbabilities}
                    disabled={actionLoading === 'normalizing'}
                    className="px-5 py-3 bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-md hover:bg-amber-700 transition cursor-pointer"
                  >
                    {actionLoading === 'normalizing' ? 'Normalizando...' : 'Normalizar a 100%'}
                  </button>
                )}
              </div>

              {/* Wildcard Options Config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {options.map((opt) => (
                  <div
                    key={opt.id}
                    className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          {opt.option_type === 'extra_attempt' ? 'Giro Adicional' : 'Sin Premio / Enfriamiento'}
                        </span>
                        <h4 className="text-lg font-black text-slate-900 mt-1">{opt.name}</h4>
                      </div>
                      <button
                        onClick={() => handleUpdateOption({ ...opt, is_active: !opt.is_active })}
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase cursor-pointer ${
                          opt.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {opt.is_active ? 'Habilitado' : 'Desactivado'}
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                        Probabilidad Asignada (%)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={opt.probability}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setOptions(options.map((o) => (o.id === opt.id ? { ...o, probability: val } : o)));
                          }}
                          className="flex-grow bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm"
                        />
                        <button
                          onClick={() => handleUpdateOption(opt)}
                          className="px-4 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition cursor-pointer"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBTAB 4: USUARIOS GANADORES */}
          {subTab === 'winners' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div>
                  <h4 className="font-black uppercase text-slate-900 text-lg">
                    Registro de Premios Ganados ({winners.length})
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Seguimiento y control de entrega de premios a los usuarios con su código único de verificación.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={winnerSearch}
                    onChange={(e) => setWinnerSearch(e.target.value)}
                    placeholder="Buscar código, nombre, apellido o contacto..."
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold flex-grow sm:flex-initial"
                  />
                  <select
                    value={winnerStatusFilter}
                    onChange={(e: any) => setWinnerStatusFilter(e.target.value)}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold"
                  >
                    <option value="ALL">Todos los Estados</option>
                    <option value="PENDING">Pendientes de Reclamar</option>
                    <option value="DELIVERED">Entregados</option>
                  </select>
                </div>
              </div>

              {/* Winners Table */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                        <th className="px-6 py-4">Código Único</th>
                        <th className="px-6 py-4">Usuario (Nombre y Apellido)</th>
                        <th className="px-6 py-4">Premio Ganado</th>
                        <th className="px-6 py-4">Fecha y Hora</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4">Entrega</th>
                        <th className="px-6 py-4 text-center">Tabla del Mes</th>
                        <th className="px-6 py-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredWinners.map((winner) => (
                        <tr key={winner.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-6 py-4 font-mono font-black text-blue-600">
                            {winner.unique_code}
                          </td>
                          <td className="px-6 py-4 min-w-[240px]">
                            <div className="space-y-1.5">
                              <div>
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                                  👤 Nombre y Apellido:
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={
                                      editingWinnerNames[winner.id] !== undefined
                                        ? editingWinnerNames[winner.id]
                                        : (winner.user_name || '')
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditingWinnerNames(prev => ({ ...prev, [winner.id]: val }));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveWinnerName(winner.id);
                                      }
                                    }}
                                    placeholder="Nombre y apellido del ganador..."
                                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:border-blue-500 text-xs font-bold text-slate-900 placeholder:text-slate-400 transition shadow-inner w-full"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveWinnerName(winner.id)}
                                    disabled={actionLoading === 'saving-winner-name-' + winner.id}
                                    title="Guardar nombre y apellido"
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition shrink-0 cursor-pointer ${
                                      savedWinnerId === winner.id
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                    }`}
                                  >
                                    {actionLoading === 'saving-winner-name-' + winner.id ? '...' : savedWinnerId === winner.id ? '✓' : 'Guardar'}
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium truncate">
                                {winner.user_phone ? `📱 ${winner.user_phone}` : winner.user_email ? `✉️ ${winner.user_email}` : 'Sin contacto'}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 flex items-center gap-2">
                            {winner.gift_image_snapshot && (
                              <img
                                src={winner.gift_image_snapshot}
                                alt={winner.gift_name_snapshot}
                                className="w-8 h-8 rounded-lg object-cover border shrink-0"
                              />
                            )}
                            <span className="font-bold text-slate-800 truncate max-w-[150px]">
                              {winner.gift_name_snapshot}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[11px] text-slate-500">
                            {new Date(winner.won_at).toLocaleString('es-SV')}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                                winner.status === 'DELIVERED'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {winner.status === 'DELIVERED' ? 'Entregado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[10px] text-slate-500">
                            {winner.delivered_at ? (
                              <div>
                                <p className="font-bold">{new Date(winner.delivered_at).toLocaleDateString()}</p>
                                <p className="text-slate-400">Por: {winner.delivered_by || 'Admin'}</p>
                              </div>
                            ) : (
                              <span className="text-slate-300 italic">No entregado</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleMonthlyVisibility(winner)}
                              disabled={actionLoading === 'toggling-visibility-' + winner.id}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer ${
                                winner.show_in_monthly_winners !== false
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                              }`}
                              title={winner.show_in_monthly_winners !== false ? 'Visible en tabla del mes. Haz clic para ocultar.' : 'Oculto en tabla del mes. Haz clic para mostrar.'}
                            >
                              <span>{winner.show_in_monthly_winners !== false ? '👁️' : '🙈'}</span>
                              <span>{actionLoading === 'toggling-visibility-' + winner.id ? '...' : winner.show_in_monthly_winners !== false ? 'Visible' : 'Oculto'}</span>
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {winner.status === 'PENDING' ? (
                              <button
                                disabled={actionLoading === 'delivering-' + winner.id}
                                onClick={() => handleMarkAsDelivered(winner)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-green-700 transition shadow-sm cursor-pointer"
                              >
                                {actionLoading === 'delivering-' + winner.id ? 'Guardando...' : 'Marcar Entregado'}
                              </button>
                            ) : (
                              <span className="text-green-600 font-bold text-xs">✓ Entregado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredWinners.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 font-bold uppercase text-xs">
                            No se encontraron registros con los filtros seleccionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 5: ÁREA GEOGRÁFICA & MAPA */}
          {subTab === 'geo' && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      Geolocalización & Cobertura
                    </span>
                    <h4 className="text-xl font-black uppercase text-slate-900 mt-2 flex items-center gap-2">
                      <span>📍</span> Área Geográfica de la Ruleta Rusa
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1 max-w-2xl">
                      Selecciona en el mapa el área geográfica donde se le mostrará el juego de la ruleta a los usuarios según su ubicación. Si un usuario accede desde fuera del radio permitido, se le indicará: <span className="font-bold text-slate-700">«por el momento no hay juegos disponibles para tu ubicacion.»</span>
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-2xl">
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Estado del Filtro
                      </span>
                      <span className={`text-xs font-black uppercase ${geoForm.enabled ? 'text-green-600' : 'text-slate-500'}`}>
                        {geoForm.enabled ? 'ACTIVO (Restringido)' : 'INACTIVO (Global)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGeoForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                      className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        geoForm.enabled ? 'bg-green-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          geoForm.enabled ? 'translate-x-7' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      ⚡ Seleccionar Zona Rápida o GPS:
                    </span>
                    <button
                      type="button"
                      disabled={actionLoading === 'getting-gps'}
                      onClick={handleGetAdminCurrentLocation}
                      className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>🛰️</span> {actionLoading === 'getting-gps' ? 'Detectando...' : 'Usar mi ubicación GPS actual'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'San Salvador (Área Metropolitana)', lat: 13.6929, lng: -89.2182, r: 25 },
                      { name: 'Santa Tecla / La Libertad', lat: 13.6769, lng: -89.2797, r: 20 },
                      { name: 'Santa Ana (Occidente)', lat: 13.9942, lng: -89.5597, r: 25 },
                      { name: 'San Miguel (Oriente)', lat: 13.4833, lng: -88.1833, r: 25 },
                      { name: 'Sonsonate', lat: 13.7189, lng: -89.7242, r: 20 },
                      { name: 'Todo El Salvador (Nacional)', lat: 13.7942, lng: -88.8965, r: 90 }
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleSelectGeoPreset(preset.name, preset.lat, preset.lng, preset.r)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                          Math.abs(geoForm.latitude - preset.lat) < 0.01 && Math.abs(geoForm.longitude - preset.lng) < 0.01
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80'
                        }`}
                      >
                        {preset.name} ({preset.r} km)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Leaflet Map Interactive Display */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>💡 Haz clic en el mapa o arrastra el marcador 🎯 para reubicar el centro de cobertura.</span>
                    <span className="font-mono text-slate-400">Lat: {geoForm.latitude.toFixed(4)}, Lng: {geoForm.longitude.toFixed(4)}</span>
                  </div>
                  <div
                    ref={geoMapContainerRef}
                    className="w-full h-96 rounded-3xl border-2 border-slate-200 overflow-hidden shadow-inner relative z-0"
                    style={{ minHeight: '380px' }}
                  />
                </div>

                {/* Controls & Inputs */}
                <form onSubmit={handleSaveGeoSettings} className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {/* Zone Name */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider">
                      Nombre de la Zona
                    </label>
                    <input
                      type="text"
                      required
                      value={geoForm.zoneName}
                      onChange={(e) => setGeoForm({ ...geoForm, zoneName: e.target.value })}
                      placeholder="Ej: San Salvador y alrededores"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Radius Slider & input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider">
                        Radio de Cobertura
                      </label>
                      <span className="text-xs font-black text-blue-600 font-mono">
                        {geoForm.radiusKm} km
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="150"
                        step="1"
                        value={geoForm.radiusKm}
                        onChange={(e) => setGeoForm({ ...geoForm, radiusKm: Number(e.target.value) })}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={geoForm.radiusKm}
                        onChange={(e) => setGeoForm({ ...geoForm, radiusKm: Math.max(1, Number(e.target.value)) })}
                        className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-center text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Action Save Button */}
                  <div className="flex flex-col justify-end space-y-1.5">
                    <button
                      type="submit"
                      disabled={actionLoading === 'saving-geo-settings'}
                      className="w-full py-3.5 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading === 'saving-geo-settings' ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <span>💾</span> Guardar Área de Cobertura
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Explanation Banner */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <span>🛡️</span> Reglas de Cobertura Geográfica:
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-500">
                    <li>
                      <strong>Si la restricción está ACTIVA:</strong> Se verificará la ubicación del navegador del usuario al acceder a «Probar mi suerte». Si está dentro del círculo azul ({geoForm.radiusKm} km desde el centro), la ruleta se abrirá con normalidad.
                    </li>
                    <li>
                      <strong>Si está fuera del área:</strong> Se le mostrará amigablemente el mensaje: <em>«por el momento no hay juegos disponibles para tu ubicacion.»</em>
                    </li>
                    <li>
                      <strong>Si la restricción está INACTIVA:</strong> Todos los usuarios podrán participar sin importar su ubicación geográfica.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 6: AUDITORÍA ADMINISTRATIVA */}
          {subTab === 'audit' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
              <h4 className="font-black uppercase text-slate-900 text-base">
                Historial de Operaciones Administrativas (Auditoría)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                      <th className="px-4 py-3">Fecha y Hora</th>
                      <th className="px-4 py-3">Administrador</th>
                      <th className="px-4 py-3">Acción</th>
                      <th className="px-4 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                          {new Date(log.created_at).toLocaleString('es-SV')}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {log.administrator_name || log.administrator_id}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                          {JSON.stringify(log.new_values || log.previous_values || {})}
                        </td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 font-bold uppercase text-xs">
                          No hay operaciones de auditoría registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: SELECCIONAR PRODUCTO DEL CATÁLOGO EXISTENTE */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div>
                <h3 className="font-black uppercase text-slate-900 text-lg">
                  Agregar Producto Existente como Regalo
                </h3>
                <p className="text-xs text-slate-500">
                  Selecciona del catálogo. Esto no altera el precio ni inventario de la tienda.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCatalogModal(false);
                  setSelectedCatalogProduct(null);
                }}
                className="text-slate-400 hover:text-slate-800 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {!selectedCatalogProduct ? (
              <div className="space-y-4 flex-grow overflow-y-auto">
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar producto por nombre..."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {filteredCatalog.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectCatalogProduct(prod)}
                      className="p-3 rounded-2xl border border-slate-200 hover:border-blue-600 hover:bg-blue-50/30 transition flex items-center gap-3 cursor-pointer group"
                    >
                      <img
                        src={prod.image_urls?.[0] || 'https://picsum.photos/seed/prod/100/100'}
                        alt={prod.name}
                        className="w-12 h-12 rounded-xl object-cover border shrink-0"
                      />
                      <div className="min-w-0 flex-grow">
                        <p className="font-bold text-xs text-slate-900 truncate group-hover:text-blue-600">
                          {prod.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-black">
                          Ref: ${prod.price} • Stock Tienda: {prod.stock}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveCatalogGift} className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border">
                  <img
                    src={selectedCatalogProduct.image_urls?.[0]}
                    alt={selectedCatalogProduct.name}
                    className="w-14 h-14 rounded-xl object-cover border shrink-0"
                  />
                  <div>
                    <h5 className="font-bold text-sm text-slate-900">{selectedCatalogProduct.name}</h5>
                    <p className="text-xs text-slate-500">${selectedCatalogProduct.price} en tienda</p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Nombre Promocional</label>
                  <input
                    type="text"
                    required
                    value={catalogGiftForm.name}
                    onChange={(e) => setCatalogGiftForm({ ...catalogGiftForm, name: e.target.value })}
                    className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                      Cantidad para Regalar
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={catalogGiftForm.quantity}
                      onChange={(e) => setCatalogGiftForm({ ...catalogGiftForm, quantity: Number(e.target.value) })}
                      className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                      Probabilidad de Ganar (%)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      max="100"
                      step="0.5"
                      required
                      value={catalogGiftForm.probability}
                      onChange={(e) => setCatalogGiftForm({ ...catalogGiftForm, probability: Number(e.target.value) })}
                      className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedCatalogProduct(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase"
                  >
                    Cambiar Producto
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'saving-catalog-gift'}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-blue-200"
                  >
                    {actionLoading === 'saving-catalog-gift' ? 'Guardando...' : 'Confirmar como Regalo'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR REGALO NUEVO (PERSONALIZADO) */}
      {showNewGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div>
                <h3 className="font-black uppercase text-slate-900 text-lg">
                  Agregar Regalo Nuevo
                </h3>
                <p className="text-xs text-slate-500">
                  Registra un regalo independiente del catálogo comercial.
                </p>
              </div>
              <button
                onClick={() => setShowNewGiftModal(false)}
                className="text-slate-400 hover:text-slate-800 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomGift} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Nombre del Regalo</label>
                <input
                  type="text"
                  required
                  value={customGiftForm.name}
                  onChange={(e) => setCustomGiftForm({ ...customGiftForm, name: e.target.value })}
                  placeholder="Ej. Mochila Deportiva NewBank"
                  className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Descripción (Opcional)</label>
                <textarea
                  value={customGiftForm.description}
                  onChange={(e) => setCustomGiftForm({ ...customGiftForm, description: e.target.value })}
                  placeholder="Breve descripción del premio..."
                  className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-medium h-20 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Imagen del Regalo</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={customGiftForm.image_url}
                    onChange={(e) => setCustomGiftForm({ ...customGiftForm, image_url: e.target.value })}
                    placeholder="URL de imagen o sube un archivo..."
                    className="flex-grow p-3 bg-slate-50 border rounded-xl text-xs font-bold"
                  />
                  <label className="px-4 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase cursor-pointer hover:bg-black transition flex items-center">
                    <span>Subir</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Cantidad Total Disponible</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={customGiftForm.quantity}
                    onChange={(e) => setCustomGiftForm({ ...customGiftForm, quantity: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Probabilidad de Ganar (%)</label>
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.5"
                    required
                    value={customGiftForm.probability}
                    onChange={(e) => setCustomGiftForm({ ...customGiftForm, probability: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewGiftModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'saving-custom-gift'}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-blue-200"
                >
                  {actionLoading === 'saving-custom-gift' ? 'Guardando...' : 'Crear Regalo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR REGALO EXISTENTE */}
      {editingGift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h3 className="font-black uppercase text-slate-900 text-lg">
                Editar Regalo: {editingGift.name}
              </h3>
              <button
                onClick={() => setEditingGift(null)}
                className="text-slate-400 hover:text-slate-800 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Nombre</label>
                <input
                  type="text"
                  value={editingGift.name}
                  onChange={(e) => setEditingGift({ ...editingGift, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Cantidad Disponible
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingGift.available_quantity}
                    onChange={(e) =>
                      setEditingGift({
                        ...editingGift,
                        available_quantity: Number(e.target.value)
                      })
                    }
                    className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Probabilidad (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={editingGift.probability}
                    onChange={(e) =>
                      setEditingGift({
                        ...editingGift,
                        probability: Number(e.target.value)
                      })
                    }
                    className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingGift(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateGift(editingGift)}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-blue-200"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

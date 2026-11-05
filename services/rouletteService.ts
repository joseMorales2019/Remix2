import { supabase } from '../supabase';

export interface RouletteGift {
  id: string;
  product_id?: string | null;
  name: string;
  description?: string;
  image_url: string;
  gift_type: 'product' | 'custom';
  initial_quantity: number;
  available_quantity: number;
  won_quantity: number;
  delivered_quantity: number;
  probability: number; // Percentage (e.g. 10 for 10%)
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RouletteSettings {
  id: string;
  is_active: boolean;
  impossible_mode: boolean;
  owner_phone: string;
  personal_kit_product_id: string;
  participation_cooldown_minutes: number;
  configuration_version: number;
  updated_at: string;
}

export interface RouletteOption {
  id: string;
  option_type: 'extra_attempt' | 'no_prize';
  name: string;
  probability: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GiftWinner {
  id: string;
  unique_code: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  gift_id: string;
  gift_name_snapshot: string;
  gift_image_snapshot: string;
  status: 'PENDING' | 'DELIVERED'; // 'Pendiente de reclamar' | 'Entregado'
  won_at: string;
  delivered_at?: string | null;
  delivered_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRouletteStatus {
  user_id: string;
  next_available_at: string | null;
  is_in_cooldown: boolean;
  remaining_seconds: number;
  extra_attempt_available: boolean;
  current_status: 'AVAILABLE' | 'COOLDOWN' | 'EXTRA_ATTEMPT' | 'DISABLED';
  unclaimed_prizes_count: number;
}

export interface SpinResult {
  success: boolean;
  result_type: 'gift' | 'extra_attempt' | 'no_prize';
  result_id: string;
  item_name: string;
  slice_index: number;
  target_angle?: number;
  gift?: {
    id: string;
    name: string;
    image_url: string;
    description?: string;
  };
  winner_record?: GiftWinner;
  extra_attempt_granted?: boolean;
  next_available_at?: string;
  error?: string;
}

export interface AdministrativeAuditLog {
  id: string;
  administrator_id: string;
  administrator_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  previous_values?: any;
  new_values?: any;
  created_at: string;
}

const API_BASE = '/api/roulette';

const DEFAULT_SETTINGS: RouletteSettings = {
  id: 'roulette_global_settings',
  is_active: true,
  impossible_mode: false,
  owner_phone: '50370914941',
  personal_kit_product_id: 'eef3db8b-a23d-4bd2-831a-e72491cbae6b',
  participation_cooldown_minutes: 60,
  configuration_version: 1,
  updated_at: new Date().toISOString()
};

const DEFAULT_OPTIONS: RouletteOption[] = [
  {
    id: 'opt_extra_attempt',
    option_type: 'extra_attempt',
    name: '¡Tienes un intento más!',
    probability: 20,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'opt_no_prize',
    option_type: 'no_prize',
    name: 'Gracias por participar',
    probability: 50,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const DEFAULT_GIFTS: RouletteGift[] = [
  {
    id: 'gift_kit_personal',
    product_id: 'eef3db8b-a23d-4bd2-831a-e72491cbae6b',
    name: 'Kit Personal NewBank',
    description: 'Kit de cuidado y estilo exclusivo NewBank Store',
    image_url: 'https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/NewBankImageProductos/product_1793726811854_0.webp',
    gift_type: 'product',
    initial_quantity: 15,
    available_quantity: 15,
    won_quantity: 0,
    delivered_quantity: 0,
    probability: 15,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'gift_audifonos',
    product_id: '20c8bdf2-02b5-471d-9ce8-35b6dc14c27b',
    name: 'Audífonos Bluetooth A520 TWS',
    description: 'Audífonos inalámbricos de alta fidelidad con estuche de carga',
    image_url: 'https://m.media-amazon.com/images/I/61OS-Vh3NOL.jpg',
    gift_type: 'product',
    initial_quantity: 5,
    available_quantity: 5,
    won_quantity: 0,
    delivered_quantity: 0,
    probability: 10,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'gift_smartwatch',
    product_id: 'cff3f887-2237-46c5-a3a7-584d78421c37',
    name: 'Reloj inteligente H14 Ultra 2',
    description: 'Smartwatch multifuncional con monitoreo deportivo y llamadas',
    image_url: 'https://cdn.dotpe.in/longtail/store-items/7720394/d2ylpR50.webp',
    gift_type: 'product',
    initial_quantity: 3,
    available_quantity: 3,
    won_quantity: 0,
    delivered_quantity: 0,
    probability: 5,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const rouletteService = {
  async getSettings(): Promise<RouletteSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    try {
      const { data, error } = await supabase.from('roulette_settings').select('*').maybeSingle();
      if (!error && data) {
        return data as RouletteSettings;
      }
    } catch (e) {
      console.warn('Error reading roulette_settings from Supabase:', e);
    }

    return DEFAULT_SETTINGS;
  },

  async updateSettings(settings: Partial<RouletteSettings>, adminUser: any): Promise<RouletteSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, adminUser })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    const current = await this.getSettings();
    const updated: RouletteSettings = {
      ...current,
      ...settings,
      configuration_version: (current.configuration_version || 1) + 1,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('roulette_settings').upsert(updated).select().single();
    if (error) {
      console.warn('Error upserting roulette_settings:', error);
      return updated;
    }

    try {
      await supabase.from('administrative_audit_logs').insert({
        administrator_id: adminUser?.id || 'admin',
        administrator_name: adminUser?.full_name || 'Administrador',
        action: 'UPDATE_SETTINGS',
        entity_type: 'ROULETTE_SETTINGS',
        entity_id: updated.id,
        previous_values: current,
        new_values: updated,
        created_at: new Date().toISOString()
      });
    } catch (auditErr) {
      // Ignore audit failure
    }

    return data as RouletteSettings;
  },

  async getGifts(admin = false): Promise<RouletteGift[]> {
    try {
      const res = await fetch(`${API_BASE}/gifts?admin=${admin ? 'true' : 'false'}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    try {
      const { data, error } = await supabase
        .from('gifts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        if (admin) return data as RouletteGift[];
        return (data as RouletteGift[]).filter(g => g.is_active);
      }
    } catch (e) {
      console.warn('Error reading gifts from Supabase:', e);
    }

    if (admin) return DEFAULT_GIFTS;
    return DEFAULT_GIFTS.filter(g => g.is_active);
  },

  async saveGift(gift: Partial<RouletteGift>, adminUser: any): Promise<RouletteGift> {
    try {
      const res = await fetch(`${API_BASE}/gifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gift, adminUser })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    // Direct Supabase implementation with strict sanitization
    const sanitizeUuid = (val?: string | null): string | null => {
      if (!val) return null;
      const trimmed = val.trim();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(trimmed) ? trimmed : null;
    };

    const targetId = gift.id || `gift_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cleanProductId = sanitizeUuid(gift.product_id);
    const initialQty = Math.max(0, Number(gift.initial_quantity || gift.available_quantity || 1));
    const availQty = Math.max(0, Number(gift.available_quantity ?? initialQty));
    const prob = Math.min(100, Math.max(0, Number(gift.probability || 0)));

    const payload: Partial<RouletteGift> = {
      id: targetId,
      product_id: cleanProductId,
      name: gift.name || 'Nuevo Regalo',
      description: gift.description || '',
      image_url: (gift.image_url && gift.image_url.trim()) ? gift.image_url.trim() : 'https://picsum.photos/seed/gift/400/400',
      gift_type: gift.gift_type || 'custom',
      initial_quantity: initialQty,
      available_quantity: availQty,
      won_quantity: gift.won_quantity || 0,
      delivered_quantity: gift.delivered_quantity || 0,
      probability: prob,
      is_active: gift.is_active !== false,
      created_at: gift.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('gifts').upsert(payload).select().single();
    if (error) {
      console.error('Error upserting gift into Supabase:', error);
      throw new Error(`Error al guardar regalo en base de datos: ${error.message}`);
    }

    try {
      await supabase.from('administrative_audit_logs').insert({
        administrator_id: adminUser?.id || 'admin',
        administrator_name: adminUser?.full_name || 'Administrador',
        action: gift.id ? 'UPDATE_GIFT' : 'CREATE_GIFT',
        entity_type: 'GIFT',
        entity_id: targetId,
        new_values: data,
        created_at: new Date().toISOString()
      });
    } catch (auditErr) {
      // Ignore audit failure
    }

    return data as RouletteGift;
  },

  async deleteGift(giftId: string, adminUser: any): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/gifts/${giftId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUser })
      });
      if (res.ok) {
        return true;
      }
    } catch (e) {
      // Fallback to Supabase
    }

    const { error } = await supabase.from('gifts').delete().eq('id', giftId);
    if (error) {
      console.error('Error deleting gift from Supabase:', error);
      throw new Error(`Error al eliminar regalo: ${error.message}`);
    }

    try {
      await supabase.from('administrative_audit_logs').insert({
        administrator_id: adminUser?.id || 'admin',
        administrator_name: adminUser?.full_name || 'Administrador',
        action: 'DELETE_GIFT',
        entity_type: 'GIFT',
        entity_id: giftId,
        created_at: new Date().toISOString()
      });
    } catch (auditErr) {
      // Ignore
    }

    return true;
  },

  async getOptions(): Promise<RouletteOption[]> {
    try {
      const res = await fetch(`${API_BASE}/options`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    try {
      const { data, error } = await supabase.from('roulette_options').select('*');
      if (!error && data && data.length > 0) {
        return data as RouletteOption[];
      }
    } catch (e) {
      console.warn('Error reading roulette_options from Supabase:', e);
    }

    return DEFAULT_OPTIONS;
  },

  async updateOption(option: Partial<RouletteOption>, adminUser: any): Promise<RouletteOption> {
    try {
      const res = await fetch(`${API_BASE}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option, adminUser })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    const payload = {
      ...option,
      probability: Math.min(100, Math.max(0, Number(option.probability || 0))),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('roulette_options').upsert(payload).select().single();
    if (error) {
      console.error('Error updating option in Supabase:', error);
      throw new Error(`Error al actualizar opción: ${error.message}`);
    }

    return data as RouletteOption;
  },

  async getUserStatus(userId: string): Promise<UserRouletteStatus> {
    try {
      const res = await fetch(`${API_BASE}/user-status/${userId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    const settings = await this.getSettings();
    let userRecord: any = null;

    try {
      const { data } = await supabase.from('user_roulette_status').select('*').eq('user_id', userId).maybeSingle();
      userRecord = data;
    } catch (e) {
      // Ignore
    }

    const now = Date.now();
    let isInCooldown = false;
    let remainingSeconds = 0;
    let nextAvailableAt: string | null = userRecord?.next_available_at || null;

    if (nextAvailableAt) {
      const nextTime = new Date(nextAvailableAt).getTime();
      if (nextTime > now) {
        isInCooldown = true;
        remainingSeconds = Math.ceil((nextTime - now) / 1000);
      } else {
        nextAvailableAt = null;
      }
    }

    let unclaimedCount = 0;
    try {
      const { count } = await supabase
        .from('gift_winners')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'PENDING');
      unclaimedCount = count || 0;
    } catch (e) {
      // Ignore
    }

    let currentStatus: 'AVAILABLE' | 'COOLDOWN' | 'EXTRA_ATTEMPT' | 'DISABLED' = 'AVAILABLE';
    if (!settings.is_active) {
      currentStatus = 'DISABLED';
    } else if (userRecord?.extra_attempt_available) {
      currentStatus = 'EXTRA_ATTEMPT';
    } else if (isInCooldown) {
      currentStatus = 'COOLDOWN';
    }

    return {
      user_id: userId,
      next_available_at: nextAvailableAt,
      is_in_cooldown: isInCooldown,
      remaining_seconds: remainingSeconds,
      extra_attempt_available: !!userRecord?.extra_attempt_available,
      current_status: currentStatus,
      unclaimed_prizes_count: unclaimedCount
    };
  },

  async spin(userId: string, isExtraAttempt = false, userMetadata?: any): Promise<SpinResult> {
    try {
      const res = await fetch(`${API_BASE}/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isExtraAttempt, userMetadata })
      });
      if (res.ok) {
        return await res.json();
      }
      const data = await res.json().catch(() => ({}));
      if (data.error && res.status !== 404) {
        throw new Error(data.error);
      }
    } catch (e: any) {
      if (e.message && !e.message.includes('404') && !e.message.includes('Failed to fetch') && !e.message.includes('Unexpected token')) {
        throw e;
      }
    }

    // Direct client-side spin execution with Supabase sync & Strict Inventory Supervision
    const settings = await this.getSettings();
    if (!settings.is_active) {
      throw new Error('La ruleta se encuentra actualmente desactivada por el administrador.');
    }

    const userStatus = await this.getUserStatus(userId);
    if (userStatus.is_in_cooldown && !isExtraAttempt) {
      const diffMinutes = Math.ceil(userStatus.remaining_seconds / 60);
      throw new Error(`Debes esperar ${diffMinutes} minuto(s) antes de tu próxima tirada.`);
    }

    const gifts = await this.getGifts(false);
    const options = await this.getOptions();

    // SUPERVISION FILTER 1: Strictly exclude inactive gifts or out-of-stock gifts upfront
    const visualGifts = gifts.filter(g => g.is_active && (g.available_quantity > 0));
    const visualOptions = options.filter(o => o.is_active);

    const wheelSlices: Array<{
      type: 'gift' | 'extra_attempt' | 'no_prize';
      id: string;
      name: string;
      image_url?: string;
      probability: number;
      available_quantity?: number;
    }> = [];

    visualGifts.forEach(g => {
      wheelSlices.push({
        type: 'gift',
        id: g.id,
        name: g.name,
        image_url: g.image_url,
        probability: g.probability,
        available_quantity: g.available_quantity
      });
    });

    visualOptions.forEach(o => {
      wheelSlices.push({
        type: o.option_type,
        id: o.id,
        name: o.name,
        probability: o.probability
      });
    });

    if (wheelSlices.length === 0) {
      throw new Error('No hay opciones ni regalos configurados en la ruleta.');
    }

    const isExtraSpin = isExtraAttempt && userStatus.extra_attempt_available;

    let eligibleItems = wheelSlices;
    if (settings.impossible_mode || isExtraSpin) {
      eligibleItems = wheelSlices.filter(s => s.type !== 'gift');
    } else {
      eligibleItems = wheelSlices.filter(s => s.type !== 'gift' || (s.available_quantity && s.available_quantity > 0));
    }

    if (eligibleItems.length === 0) {
      eligibleItems = wheelSlices.filter(s => s.type === 'no_prize');
    }

    const totalProb = eligibleItems.reduce((acc, curr) => acc + (curr.probability || 1), 0);
    const randValue = Math.random() * totalProb;

    let accumulated = 0;
    let selectedSlice = eligibleItems[0];
    for (const item of eligibleItems) {
      accumulated += (item.probability || 1);
      if (randValue <= accumulated) {
        selectedSlice = item;
        break;
      }
    }

    // SUPERVISION FILTER 2: Real-time Database Stock Interception
    // Before awarding a gift, query live inventory from Supabase database to prevent race conditions & over-granting
    if (selectedSlice.type === 'gift') {
      try {
        const { data: liveGift, error: fetchErr } = await supabase
          .from('gifts')
          .select('id, name, image_url, available_quantity, won_quantity, is_active')
          .eq('id', selectedSlice.id)
          .maybeSingle();

        if (fetchErr || !liveGift || !liveGift.is_active || Number(liveGift.available_quantity) <= 0) {
          console.warn(`[SUPERVISIÓN RULETA] El regalo "${selectedSlice.name}" agotó existencias en tiempo real. Redirigiendo a no_prize.`);
          const fallbackNoPrize = wheelSlices.find(s => s.type === 'no_prize') || wheelSlices[0];
          selectedSlice = fallbackNoPrize;
        }
      } catch (supervisionErr) {
        console.warn('Error en mecanismo de supervisión de stock:', supervisionErr);
      }
    }

    let sliceIndex = wheelSlices.findIndex(s => s.id === selectedSlice.id);
    if (sliceIndex < 0) sliceIndex = 0;

    let winnerRecord: GiftWinner | undefined;
    let extraAttemptGranted = false;
    const cooldownMinutes = settings.participation_cooldown_minutes || 60;
    let nextAvailableAt: string | undefined;

    if (selectedSlice.type === 'gift') {
      const giftObj = gifts.find(g => g.id === selectedSlice.id);
      if (!giftObj || giftObj.available_quantity <= 0) {
        const fallbackNoPrize = wheelSlices.find(s => s.type === 'no_prize') || wheelSlices[0];
        selectedSlice = fallbackNoPrize;
        sliceIndex = wheelSlices.findIndex(s => s.id === selectedSlice.id);
      } else {
        // SUPERVISION STEP 3: Atomic stock update with available_quantity > 0 condition
        const newAvail = Math.max(0, giftObj.available_quantity - 1);
        const newWon = (giftObj.won_quantity || 0) + 1;

        const { data: updatedDbGift, error: updateStockErr } = await supabase
          .from('gifts')
          .update({
            available_quantity: newAvail,
            won_quantity: newWon,
            updated_at: new Date().toISOString()
          })
          .eq('id', giftObj.id)
          .gt('available_quantity', 0)
          .select()
          .maybeSingle();

        if (updateStockErr || !updatedDbGift) {
          console.warn(`[SUPERVISIÓN RULETA CONCURRENTE] Falló actualización atómica por stock agotado para ${giftObj.name}. Redirigiendo tirada.`);
          const fallbackNoPrize = wheelSlices.find(s => s.type === 'no_prize') || wheelSlices[0];
          selectedSlice = fallbackNoPrize;
          sliceIndex = wheelSlices.findIndex(s => s.id === selectedSlice.id);
        } else {
          // Stock successfully reserved! Proceed with winner creation
          giftObj.available_quantity = newAvail;
          giftObj.won_quantity = newWon;

          const randHex = Math.random().toString(36).substring(2, 8).toUpperCase();
          const uniqueCode = `NBK-GIFT-${randHex}-${Date.now().toString(36).toUpperCase()}`;
          const winnerId = `winner_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

          winnerRecord = {
            id: winnerId,
            unique_code: uniqueCode,
            user_id: userId,
            user_name: userMetadata?.full_name || 'Usuario NewBank',
            user_email: userMetadata?.email || '',
            user_phone: userMetadata?.phone || '',
            gift_id: giftObj.id,
            gift_name_snapshot: giftObj.name,
            gift_image_snapshot: giftObj.image_url,
            status: 'PENDING',
            won_at: new Date().toISOString(),
            delivered_at: null,
            delivered_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          await supabase.from('gift_winners').insert(winnerRecord);

          nextAvailableAt = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
          await supabase.from('user_roulette_status').upsert({
            user_id: userId,
            next_available_at: nextAvailableAt,
            extra_attempt_available: false,
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    if (selectedSlice.type === 'extra_attempt') {
      extraAttemptGranted = true;
      nextAvailableAt = undefined;
      await supabase.from('user_roulette_status').upsert({
        user_id: userId,
        next_available_at: null,
        extra_attempt_available: true,
        updated_at: new Date().toISOString()
      });
    } else if (selectedSlice.type === 'no_prize') {
      extraAttemptGranted = false;
      nextAvailableAt = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
      await supabase.from('user_roulette_status').upsert({
        user_id: userId,
        next_available_at: nextAvailableAt,
        extra_attempt_available: false,
        updated_at: new Date().toISOString()
      });
    }

    try {
      await supabase.from('roulette_participations').insert({
        user_id: userId,
        result_type: selectedSlice.type,
        result_id: selectedSlice.id,
        is_extra_attempt: isExtraSpin,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      // Ignore
    }

    return {
      success: true,
      result_type: selectedSlice.type,
      result_id: selectedSlice.id,
      item_name: selectedSlice.name,
      slice_index: sliceIndex >= 0 ? sliceIndex : 0,
      gift: selectedSlice.type === 'gift' ? {
        id: selectedSlice.id,
        name: selectedSlice.name,
        image_url: selectedSlice.image_url || ''
      } : undefined,
      winner_record: winnerRecord,
      extra_attempt_granted: extraAttemptGranted,
      next_available_at: nextAvailableAt
    };
  },

  async getMyPrizes(userId: string): Promise<GiftWinner[]> {
    try {
      const res = await fetch(`${API_BASE}/my-prizes/${userId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    try {
      const { data, error } = await supabase
        .from('gift_winners')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as GiftWinner[];
      }
    } catch (e) {
      console.warn('Error reading my-prizes from Supabase:', e);
    }

    return [];
  },

  async getAllWinners(): Promise<GiftWinner[]> {
    try {
      const res = await fetch(`${API_BASE}/admin/winners`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    try {
      const { data, error } = await supabase
        .from('gift_winners')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as GiftWinner[];
      }
    } catch (e) {
      console.warn('Error reading gift_winners from Supabase:', e);
    }

    return [];
  },

  async markAsDelivered(winnerId: string, adminUser: any): Promise<GiftWinner> {
    try {
      const res = await fetch(`${API_BASE}/admin/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId, adminUser })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    const deliveredBy = adminUser?.full_name || adminUser?.email || 'Administrador';
    const deliveredAt = new Date().toISOString();

    const { data: updatedWinner, error } = await supabase
      .from('gift_winners')
      .update({
        status: 'DELIVERED',
        delivered_at: deliveredAt,
        delivered_by: deliveredBy,
        updated_at: new Date().toISOString()
      })
      .eq('id', winnerId)
      .select()
      .single();

    if (error || !updatedWinner) {
      throw new Error(`Error al marcar entregado en Supabase: ${error?.message || 'No encontrado'}`);
    }

    // Increment delivered_quantity on corresponding gift
    try {
      if (updatedWinner.gift_id) {
        const { data: giftData } = await supabase.from('gifts').select('delivered_quantity').eq('id', updatedWinner.gift_id).single();
        if (giftData) {
          await supabase.from('gifts').update({
            delivered_quantity: (giftData.delivered_quantity || 0) + 1,
            updated_at: new Date().toISOString()
          }).eq('id', updatedWinner.gift_id);
        }
      }
    } catch (e) {
      // Ignore
    }

    try {
      await supabase.from('administrative_audit_logs').insert({
        administrator_id: adminUser?.id || 'admin',
        administrator_name: adminUser?.full_name || 'Administrador',
        action: 'MARK_DELIVERED',
        entity_type: 'WINNER_PRIZE',
        entity_id: winnerId,
        new_values: updatedWinner,
        created_at: new Date().toISOString()
      });
    } catch (auditErr) {
      // Ignore
    }

    return updatedWinner as GiftWinner;
  },

  async toggleImpossibleMode(enabled: boolean, adminUser: any): Promise<RouletteSettings> {
    try {
      const res = await fetch(`${API_BASE}/admin/toggle-impossible`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, adminUser })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    return await this.updateSettings({ impossible_mode: !!enabled }, adminUser);
  },

  async getAuditLogs(): Promise<AdministrativeAuditLog[]> {
    try {
      const res = await fetch(`${API_BASE}/admin/audit-logs`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback to Supabase
    }

    try {
      const { data, error } = await supabase
        .from('administrative_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        return data as AdministrativeAuditLog[];
      }
    } catch (e) {
      console.warn('Error reading audit_logs from Supabase:', e);
    }

    return [];
  }
};

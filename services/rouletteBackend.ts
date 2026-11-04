import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'roulette_store.json');

const supabaseUrl = 'https://stqthrzbvuqcavtsonba.supabase.co';
const supabaseKey = 'sb_publishable_wCWbStazCktCFs1_RPAHuA_uQeg3CD5';
const supabase = createClient(supabaseUrl, supabaseKey);

interface StoreData {
  settings: {
    id: string;
    is_active: boolean;
    impossible_mode: boolean;
    owner_phone: string;
    personal_kit_product_id: string;
    participation_cooldown_minutes: number;
    configuration_version: number;
    updated_at: string;
  };
  options: Array<{
    id: string;
    option_type: 'extra_attempt' | 'no_prize';
    name: string;
    probability: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  gifts: Array<{
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
    probability: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  winners: Array<{
    id: string;
    unique_code: string;
    user_id: string;
    user_name?: string;
    user_email?: string;
    user_phone?: string;
    gift_id: string;
    gift_name_snapshot: string;
    gift_image_snapshot: string;
    status: 'PENDING' | 'DELIVERED';
    won_at: string;
    delivered_at?: string | null;
    delivered_by?: string | null;
    created_at: string;
    updated_at: string;
  }>;
  user_statuses: Record<string, {
    user_id: string;
    next_available_at: string | null;
    extra_attempt_available: boolean;
    consecutive_extra_attempts?: number;
    updated_at: string;
  }>;
  participations: Array<{
    id: string;
    user_id: string;
    result_type: 'gift' | 'extra_attempt' | 'no_prize';
    result_id: string;
    is_extra_attempt: boolean;
    created_at: string;
  }>;
  audit_logs: Array<{
    id: string;
    administrator_id: string;
    administrator_name?: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    previous_values?: any;
    new_values?: any;
    created_at: string;
  }>;
}

const DEFAULT_STORE: StoreData = {
  settings: {
    id: 'roulette_global_settings',
    is_active: true,
    impossible_mode: false,
    owner_phone: '50370914941',
    personal_kit_product_id: 'eef3db8b-a23d-4bd2-831a-e72491cbae6b',
    participation_cooldown_minutes: 60,
    configuration_version: 1,
    updated_at: new Date().toISOString()
  },
  options: [
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
  ],
  gifts: [
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
  ],
  winners: [],
  user_statuses: {},
  participations: [],
  audit_logs: []
};

// In-memory mutex for atomic concurrent transactions
let isLocked = false;
async function acquireLock(maxWaitMs = 5000): Promise<() => void> {
  const start = Date.now();
  while (isLocked) {
    if (Date.now() - start > maxWaitMs) {
      throw new Error('Timeout esperando bloqueo de concurrencia');
    }
    await new Promise(r => setTimeout(r, 50));
  }
  isLocked = true;
  return () => { isLocked = false; };
}

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_STORE, null, 2), 'utf-8');
      return DEFAULT_STORE;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULT_STORE.settings, ...(parsed.settings || {}) },
      options: parsed.options || DEFAULT_STORE.options,
      gifts: parsed.gifts || DEFAULT_STORE.gifts,
      winners: parsed.winners || [],
      user_statuses: parsed.user_statuses || {},
      participations: parsed.participations || [],
      audit_logs: parsed.audit_logs || []
    };
  } catch (err) {
    console.error('Error cargando roulette_store.json:', err);
    return DEFAULT_STORE;
  }
}

function saveStore(data: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error guardando roulette_store.json:', err);
  }
}

// Cryptographically secure float in range [0, 1)
function secureRandom(): number {
  const buf = crypto.randomBytes(4);
  return buf.readUInt32BE(0) / 0xffffffff;
}

export function registerRouletteRoutes(app: express.Application, io: Server) {
  // 1. GET /api/roulette/settings
  app.get('/api/roulette/settings', (req, res) => {
    const store = loadStore();
    res.json(store.settings);
  });

  // 2. POST /api/roulette/settings (Admin update)
  app.post('/api/roulette/settings', async (req, res) => {
    const unlock = await acquireLock();
    try {
      const { settings, adminUser } = req.body;
      const store = loadStore();

      const prev = { ...store.settings };
      store.settings = {
        ...store.settings,
        ...settings,
        configuration_version: store.settings.configuration_version + 1,
        updated_at: new Date().toISOString()
      };

      store.audit_logs.unshift({
        id: 'audit_' + Date.now(),
        administrator_id: adminUser?.id || 'admin',
        administrator_name: adminUser?.full_name || 'Administrador',
        action: 'UPDATE_SETTINGS',
        entity_type: 'ROULETTE_SETTINGS',
        entity_id: store.settings.id,
        previous_values: prev,
        new_values: store.settings,
        created_at: new Date().toISOString()
      });

      saveStore(store);
      io.emit('roulette:settings_updated', store.settings);
      res.json(store.settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      unlock();
    }
  });

  // 3. GET /api/roulette/gifts
  app.get('/api/roulette/gifts', async (req, res) => {
    const isAdmin = req.query.admin === 'true';

    try {
      const { data: dbGifts, error: dbErr } = await supabase
        .from('gifts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!dbErr && dbGifts) {
        if (dbGifts.length > 0) {
          // Keep in-memory cache synchronized with live database
          const store = loadStore();
          store.gifts = dbGifts;
          saveStore(store);

          if (isAdmin) {
            return res.json(dbGifts);
          }
          return res.json(dbGifts.filter((g: any) => g.is_active));
        } else {
          // If table exists in DB but is empty, seed initial default gifts into Supabase
          const store = loadStore();
          if (store.gifts.length > 0) {
            for (const g of store.gifts) {
              await supabase.from('gifts').upsert({
                id: g.id,
                product_id: g.product_id || null,
                name: g.name,
                description: g.description || '',
                image_url: g.image_url,
                gift_type: g.gift_type,
                initial_quantity: g.initial_quantity,
                available_quantity: g.available_quantity,
                won_quantity: g.won_quantity || 0,
                delivered_quantity: g.delivered_quantity || 0,
                probability: g.probability,
                is_active: g.is_active,
                created_at: g.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Fallback to local store for gifts query:', e);
    }

    const store = loadStore();
    if (isAdmin) {
      return res.json(store.gifts);
    }
    return res.json(store.gifts.filter(g => g.is_active));
  });

  // 4. POST /api/roulette/gifts (Admin create or update gift)
  app.post('/api/roulette/gifts', async (req, res) => {
    const unlock = await acquireLock();
    try {
      const { gift, adminUser } = req.body;
      if (!gift || !gift.name || gift.probability === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
      }

      const store = loadStore();
      const existingIdx = store.gifts.findIndex(g => g.id === gift.id);

      let savedGift: any;
      if (existingIdx >= 0) {
        const prev = store.gifts[existingIdx];
        const newAvail = Math.max(0, Number(gift.available_quantity ?? prev.available_quantity));
        savedGift = {
          ...prev,
          ...gift,
          available_quantity: newAvail,
          probability: Math.min(100, Math.max(0, Number(gift.probability))),
          updated_at: new Date().toISOString()
        };
        store.gifts[existingIdx] = savedGift;

        store.audit_logs.unshift({
          id: 'audit_' + Date.now(),
          administrator_id: adminUser?.id || 'admin',
          administrator_name: adminUser?.full_name || 'Administrador',
          action: 'UPDATE_GIFT',
          entity_type: 'GIFT',
          entity_id: savedGift.id,
          previous_values: prev,
          new_values: savedGift,
          created_at: new Date().toISOString()
        });
      } else {
        const initialQty = Math.max(0, Number(gift.initial_quantity || gift.available_quantity || 1));
        savedGift = {
          id: gift.id || 'gift_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          product_id: gift.product_id || null,
          name: gift.name,
          description: gift.description || '',
          image_url: gift.image_url || 'https://picsum.photos/seed/gift/400/400',
          gift_type: gift.gift_type || 'custom',
          initial_quantity: initialQty,
          available_quantity: initialQty,
          won_quantity: 0,
          delivered_quantity: 0,
          probability: Math.min(100, Math.max(0, Number(gift.probability))),
          is_active: gift.is_active !== false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        store.gifts.push(savedGift);

        store.audit_logs.unshift({
          id: 'audit_' + Date.now(),
          administrator_id: adminUser?.id || 'admin',
          administrator_name: adminUser?.full_name || 'Administrador',
          action: 'CREATE_GIFT',
          entity_type: 'GIFT',
          entity_id: savedGift.id,
          new_values: savedGift,
          created_at: new Date().toISOString()
        });
      }

      // Synchronize directly with Supabase database 'gifts' table
      try {
        await supabase.from('gifts').upsert({
          id: savedGift.id,
          product_id: savedGift.product_id || null,
          name: savedGift.name,
          description: savedGift.description || '',
          image_url: savedGift.image_url,
          gift_type: savedGift.gift_type,
          initial_quantity: savedGift.initial_quantity,
          available_quantity: savedGift.available_quantity,
          won_quantity: savedGift.won_quantity || 0,
          delivered_quantity: savedGift.delivered_quantity || 0,
          probability: savedGift.probability,
          is_active: savedGift.is_active,
          created_at: savedGift.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (dbErr) {
        console.warn('Error syncing gift to Supabase table:', dbErr);
      }

      saveStore(store);
      io.emit('roulette:gifts_updated', store.gifts);
      res.json(savedGift);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      unlock();
    }
  });

  // 5. DELETE /api/roulette/gifts/:id
  app.delete('/api/roulette/gifts/:id', async (req, res) => {
    const unlock = await acquireLock();
    try {
      const giftId = req.params.id;
      const { adminUser } = req.body;
      const store = loadStore();

      const existing = store.gifts.find(g => g.id === giftId);
      if (!existing) {
        return res.status(404).json({ error: 'Regalo no encontrado' });
      }

      store.gifts = store.gifts.filter(g => g.id !== giftId);

      store.audit_logs.unshift({
        id: 'audit_' + Date.now(),
        administrator_id: adminUser?.id || 'admin',
        administrator_name: adminUser?.full_name || 'Administrador',
        action: 'DELETE_GIFT',
        entity_type: 'GIFT',
        entity_id: giftId,
        previous_values: existing,
        created_at: new Date().toISOString()
      });

      // Synchronize deletion with Supabase table 'gifts'
      try {
        await supabase.from('gifts').delete().eq('id', giftId);
      } catch (dbErr) {
        console.warn('Error deleting gift from Supabase:', dbErr);
      }

      saveStore(store);
      io.emit('roulette:gifts_updated', store.gifts);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      unlock();
    }
  });

  // 6. GET /api/roulette/options
  app.get('/api/roulette/options', (req, res) => {
    const store = loadStore();
    res.json(store.options);
  });

  // 7. POST /api/roulette/options
  app.post('/api/roulette/options', async (req, res) => {
    const unlock = await acquireLock();
    try {
      const { option, adminUser } = req.body;
      const store = loadStore();

      const idx = store.options.findIndex(o => o.id === option.id || o.option_type === option.option_type);
      if (idx >= 0) {
        const prev = store.options[idx];
        store.options[idx] = {
          ...prev,
          ...option,
          probability: Math.min(100, Math.max(0, Number(option.probability))),
          updated_at: new Date().toISOString()
        };

        store.audit_logs.unshift({
          id: 'audit_' + Date.now(),
          administrator_id: adminUser?.id || 'admin',
          administrator_name: adminUser?.full_name || 'Administrador',
          action: 'UPDATE_OPTION',
          entity_type: 'OPTION',
          entity_id: option.id,
          previous_values: prev,
          new_values: store.options[idx],
          created_at: new Date().toISOString()
        });
      }

      saveStore(store);
      io.emit('roulette:options_updated', store.options);
      res.json(store.options[idx]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      unlock();
    }
  });

  // 8. GET /api/roulette/user-status/:userId
  app.get('/api/roulette/user-status/:userId', (req, res) => {
    const userId = req.params.userId;
    const store = loadStore();
    const userStatus = store.user_statuses[userId] || {
      user_id: userId,
      next_available_at: null,
      extra_attempt_available: false,
      consecutive_extra_attempts: 0,
      updated_at: new Date().toISOString()
    };

    const now = Date.now();
    let isInCooldown = false;
    let remainingSeconds = 0;

    if (userStatus.next_available_at) {
      const nextTime = new Date(userStatus.next_available_at).getTime();
      if (nextTime > now) {
        isInCooldown = true;
        remainingSeconds = Math.ceil((nextTime - now) / 1000);
      } else {
        // Cooldown expired
        userStatus.next_available_at = null;
        store.user_statuses[userId] = userStatus;
        saveStore(store);
      }
    }

    const unclaimedCount = store.winners.filter(w => w.user_id === userId && w.status === 'PENDING').length;

    let currentStatus = 'AVAILABLE';
    if (!store.settings.is_active) {
      currentStatus = 'DISABLED';
    } else if (userStatus.extra_attempt_available) {
      currentStatus = 'EXTRA_ATTEMPT';
    } else if (isInCooldown) {
      currentStatus = 'COOLDOWN';
    }

    res.json({
      user_id: userId,
      next_available_at: userStatus.next_available_at,
      is_in_cooldown: isInCooldown,
      remaining_seconds: remainingSeconds,
      extra_attempt_available: !!userStatus.extra_attempt_available,
      current_status: currentStatus,
      unclaimed_prizes_count: unclaimedCount
    });
  });

  // 9. POST /api/roulette/spin
  // CRITICAL: Evaluates probability, prevents manipulation, executes atomically
  app.post('/api/roulette/spin', async (req, res) => {
    const unlock = await acquireLock();
    try {
      const { userId, isExtraAttempt, userMetadata } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'Identificador de usuario no proporcionado' });
      }

      const store = loadStore();

      // Check if roulette is globally active
      if (!store.settings.is_active) {
        return res.status(403).json({ error: 'La ruleta se encuentra actualmente desactivada por el administrador.' });
      }

      let userStatus = store.user_statuses[userId];
      if (!userStatus) {
        userStatus = {
          user_id: userId,
          next_available_at: null,
          extra_attempt_available: false,
          consecutive_extra_attempts: 0,
          updated_at: new Date().toISOString()
        };
      }

      const now = Date.now();

      // Check cooldown
      if (userStatus.next_available_at) {
        const nextTime = new Date(userStatus.next_available_at).getTime();
        if (nextTime > now && !isExtraAttempt) {
          const diffMinutes = Math.ceil((nextTime - now) / 60000);
          return res.status(429).json({
            error: `Debes esperar ${diffMinutes} minuto(s) antes de tu próxima tirada.`,
            remaining_seconds: Math.ceil((nextTime - now) / 1000)
          });
        }
      }

      // Check extra attempt validity
      const isExtraSpin = isExtraAttempt && userStatus.extra_attempt_available;

      // Build visual slices for the wheel:
      // Slices must contain: active gifts + active options
      const visualGifts = store.gifts.filter(g => g.is_active);
      const visualOptions = store.options.filter(o => o.is_active);

      // Total wheel items list in stable order:
      // Alternate gifts and options for aesthetic presentation
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
        return res.status(500).json({ error: 'No hay opciones ni regalos configurados en la ruleta.' });
      }

      // DETERMINING ELIGIBLE POOL FOR THIS SPIN:
      // Rule 1: If impossible_mode is ACTIVE, NO GIFTS can be won. Pool is strictly wildcards!
      // Rule 2: If isExtraSpin, it CANNOT generate gifts (Section 2.5.B: "El siguiente resultado deberá ser seleccionado aleatoriamente entre: Tienes un intento más o Gracias por participar. Este segundo giro especial no podrá generar premios.")
      // Rule 3: If a gift has available_quantity <= 0, it cannot be won (Section 4.3).
      let eligibleItems: typeof wheelSlices = [];

      if (store.settings.impossible_mode || isExtraSpin) {
        // Only wildcards eligible
        eligibleItems = wheelSlices.filter(s => s.type !== 'gift');
      } else {
        // Filter out out-of-stock gifts
        eligibleItems = wheelSlices.filter(s => s.type !== 'gift' || (s.available_quantity && s.available_quantity > 0));
      }

      if (eligibleItems.length === 0) {
        // Fallback to "no_prize"
        eligibleItems = wheelSlices.filter(s => s.type === 'no_prize');
      }

      // Calculate total probability of eligible items for normalization
      const totalProb = eligibleItems.reduce((acc, curr) => acc + (curr.probability || 1), 0);
      const randValue = secureRandom() * totalProb;

      let accumulated = 0;
      let selectedSlice = eligibleItems[0];
      for (const item of eligibleItems) {
        accumulated += (item.probability || 1);
        if (randValue <= accumulated) {
          selectedSlice = item;
          break;
        }
      }

      // If consecutive extra attempts exceeded (max 1 chained extra attempt), force 'no_prize'
      if (selectedSlice.type === 'extra_attempt' && isExtraSpin && (userStatus.consecutive_extra_attempts || 0) >= 1) {
        const noPrizeOpt = eligibleItems.find(i => i.type === 'no_prize') || wheelSlices.find(i => i.type === 'no_prize');
        if (noPrizeOpt) selectedSlice = noPrizeOpt;
      }

      // Find the index of the selected item in the complete wheelSlices list for client wheel animation
      const sliceIndex = wheelSlices.findIndex(s => s.id === selectedSlice.id);

      // RESOLVE OUTCOME:
      let winnerRecord: any = null;
      let extraAttemptGranted = false;
      const cooldownMinutes = store.settings.participation_cooldown_minutes || 60;

      if (selectedSlice.type === 'gift') {
        // Deduct inventory atomically
        const giftObj = store.gifts.find(g => g.id === selectedSlice.id);
        if (!giftObj || giftObj.available_quantity <= 0) {
          // In the rare race condition where another user took the last unit, re-route to 'no_prize'
          const noPrize = wheelSlices.find(s => s.type === 'no_prize') || wheelSlices[0];
          selectedSlice = noPrize;
        } else {
          giftObj.available_quantity -= 1;
          giftObj.won_quantity += 1;
          giftObj.updated_at = new Date().toISOString();

          // Generate unique code
          const randHex = crypto.randomBytes(4).toString('hex').toUpperCase();
          const uniqueCode = `NBK-GIFT-${randHex}-${Date.now().toString(36).toUpperCase()}`;

          winnerRecord = {
            id: 'winner_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
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

          store.winners.unshift(winnerRecord);

          // Update inventory and save winner in Supabase
          try {
            await supabase.from('gifts').update({
              available_quantity: giftObj.available_quantity,
              won_quantity: giftObj.won_quantity,
              updated_at: new Date().toISOString()
            }).eq('id', giftObj.id);

            await supabase.from('gift_winners').insert({
              id: winnerRecord.id,
              unique_code: winnerRecord.unique_code,
              user_id: winnerRecord.user_id,
              user_name: winnerRecord.user_name,
              user_email: winnerRecord.user_email,
              user_phone: winnerRecord.user_phone,
              gift_id: winnerRecord.gift_id,
              gift_name_snapshot: winnerRecord.gift_name_snapshot,
              gift_image_snapshot: winnerRecord.gift_image_snapshot,
              status: winnerRecord.status,
              won_at: winnerRecord.won_at,
              created_at: winnerRecord.created_at
            });
          } catch (dbErr) {
            console.warn('Error syncing spin win to Supabase:', dbErr);
          }

          // User enters cooldown after winning
          const nextAvailable = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
          userStatus.next_available_at = nextAvailable;
          userStatus.extra_attempt_available = false;
          userStatus.consecutive_extra_attempts = 0;
          userStatus.updated_at = new Date().toISOString();
        }
      }

      if (selectedSlice.type === 'extra_attempt') {
        extraAttemptGranted = true;
        userStatus.extra_attempt_available = true;
        userStatus.consecutive_extra_attempts = isExtraSpin ? (userStatus.consecutive_extra_attempts || 0) + 1 : 1;
        userStatus.next_available_at = null; // Can spin immediately!
        userStatus.updated_at = new Date().toISOString();
      } else if (selectedSlice.type === 'no_prize') {
        extraAttemptGranted = false;
        userStatus.extra_attempt_available = false;
        userStatus.consecutive_extra_attempts = 0;
        // Enter 1 hour cooldown period (Section 2.5.C & 9)
        const nextAvailable = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
        userStatus.next_available_at = nextAvailable;
        userStatus.updated_at = new Date().toISOString();
      }

      // Record participation
      store.participations.push({
        id: 'part_' + Date.now(),
        user_id: userId,
        result_type: selectedSlice.type,
        result_id: selectedSlice.id,
        is_extra_attempt: isExtraSpin,
        created_at: new Date().toISOString()
      });

      store.user_statuses[userId] = userStatus;
      saveStore(store);

      // Realtime notification
      if (winnerRecord) {
        io.emit('roulette:prize_won', winnerRecord);
      }

      return res.json({
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
        next_available_at: userStatus.next_available_at
      });
    } catch (err: any) {
      console.error('Error in /api/roulette/spin:', err);
      return res.status(500).json({ error: err.message || 'Error procesando tirada' });
    } finally {
      unlock();
    }
  });

  // 10. GET /api/roulette/my-prizes/:userId
  app.get('/api/roulette/my-prizes/:userId', (req, res) => {
    const userId = req.params.userId;
    const store = loadStore();
    const userPrizes = store.winners.filter(w => w.user_id === userId);
    res.json(userPrizes);
  });

  // 11. GET /api/roulette/admin/winners
  app.get('/api/roulette/admin/winners', (req, res) => {
    const store = loadStore();
    res.json(store.winners);
  });

  // 12. POST /api/roulette/admin/deliver (Mark prize as delivered)
  app.post('/api/roulette/admin/deliver', async (req, res) => {
    const unlock = await acquireLock();
    try {
      const { winnerId, adminUser } = req.body;
      const store = loadStore();

      const winner = store.winners.find(w => w.id === winnerId);
      if (!winner) {
        return res.status(404).json({ error: 'Premio no encontrado' });
      }

      const prev = { ...winner };
      winner.status = 'DELIVERED';
      winner.delivered_at = new Date().toISOString();
      winner.delivered_by = adminUser?.full_name || adminUser?.email || 'Administrador';
      winner.updated_at = new Date().toISOString();

      // Increment delivered_quantity on the corresponding gift
      const giftObj = store.gifts.find(g => g.id === winner.gift_id);
      if (giftObj) {
        giftObj.delivered_quantity = (giftObj.delivered_quantity || 0) + 1;
        giftObj.updated_at = new Date().toISOString();
      }

      // Synchronize delivery in Supabase
      try {
        await supabase.from('gift_winners').update({
          status: 'DELIVERED',
          delivered_at: winner.delivered_at,
          delivered_by: winner.delivered_by,
          updated_at: winner.updated_at
        }).eq('id', winner.id);

        if (giftObj) {
          await supabase.from('gifts').update({
            delivered_quantity: giftObj.delivered_quantity,
            updated_at: new Date().toISOString()
          }).eq('id', giftObj.id);
        }
      } catch (dbErr) {
        console.warn('Error syncing delivery to Supabase:', dbErr);
      }

      store.audit_logs.unshift({
        id: 'audit_' + Date.now(),
        administrator_id: adminUser?.id || 'admin',
        administrator_name: adminUser?.full_name || 'Administrador',
        action: 'MARK_DELIVERED',
        entity_type: 'WINNER_PRIZE',
        entity_id: winner.id,
        previous_values: prev,
        new_values: winner,
        created_at: new Date().toISOString()
      });

      saveStore(store);
      io.emit('roulette:prize_delivered', winner);
      res.json(winner);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      unlock();
    }
  });

  // 13. POST /api/roulette/admin/toggle-impossible
  app.post('/api/roulette/admin/toggle-impossible', async (req, res) => {
    const unlock = await acquireLock();
    try {
      const { enabled, adminUser } = req.body;
      const store = loadStore();

      const prevMode = store.settings.impossible_mode;
      store.settings.impossible_mode = !!enabled;
      store.settings.configuration_version += 1;
      store.settings.updated_at = new Date().toISOString();

      store.audit_logs.unshift({
        id: 'audit_' + Date.now(),
        administrator_id: adminUser?.id || 'admin',
        administrator_name: adminUser?.full_name || 'Administrador',
        action: enabled ? 'ENABLE_IMPOSSIBLE_MODE' : 'DISABLE_IMPOSSIBLE_MODE',
        entity_type: 'ROULETTE_SETTINGS',
        entity_id: store.settings.id,
        previous_values: { impossible_mode: prevMode },
        new_values: { impossible_mode: store.settings.impossible_mode },
        created_at: new Date().toISOString()
      });

      saveStore(store);
      io.emit('roulette:settings_updated', store.settings);
      res.json(store.settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      unlock();
    }
  });

  // 14. GET /api/roulette/admin/audit-logs
  app.get('/api/roulette/admin/audit-logs', (req, res) => {
    const store = loadStore();
    res.json(store.audit_logs.slice(0, 100));
  });
}

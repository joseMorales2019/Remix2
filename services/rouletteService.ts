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

export const rouletteService = {
  async getSettings(): Promise<RouletteSettings> {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Error al obtener configuración de la ruleta');
    return res.json();
  },

  async updateSettings(settings: Partial<RouletteSettings>, adminUser: any): Promise<RouletteSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings, adminUser })
    });
    if (!res.ok) throw new Error('Error al actualizar configuración');
    return res.json();
  },

  async getGifts(admin = false): Promise<RouletteGift[]> {
    const res = await fetch(`${API_BASE}/gifts?admin=${admin ? 'true' : 'false'}`);
    if (!res.ok) throw new Error('Error al obtener lista de regalos');
    return res.json();
  },

  async saveGift(gift: Partial<RouletteGift>, adminUser: any): Promise<RouletteGift> {
    const res = await fetch(`${API_BASE}/gifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gift, adminUser })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al guardar regalo');
    }
    return res.json();
  },

  async deleteGift(giftId: string, adminUser: any): Promise<boolean> {
    const res = await fetch(`${API_BASE}/gifts/${giftId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUser })
    });
    if (!res.ok) throw new Error('Error al eliminar regalo');
    return true;
  },

  async getOptions(): Promise<RouletteOption[]> {
    const res = await fetch(`${API_BASE}/options`);
    if (!res.ok) throw new Error('Error al obtener opciones comodín');
    return res.json();
  },

  async updateOption(option: Partial<RouletteOption>, adminUser: any): Promise<RouletteOption> {
    const res = await fetch(`${API_BASE}/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option, adminUser })
    });
    if (!res.ok) throw new Error('Error al actualizar opción');
    return res.json();
  },

  async getUserStatus(userId: string): Promise<UserRouletteStatus> {
    const res = await fetch(`${API_BASE}/user-status/${userId}`);
    if (!res.ok) throw new Error('Error al consultar estado del usuario');
    return res.json();
  },

  async spin(userId: string, isExtraAttempt = false, userMetadata?: any): Promise<SpinResult> {
    const res = await fetch(`${API_BASE}/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, isExtraAttempt, userMetadata })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo realizar el giro en el servidor');
    }
    return data;
  },

  async getMyPrizes(userId: string): Promise<GiftWinner[]> {
    const res = await fetch(`${API_BASE}/my-prizes/${userId}`);
    if (!res.ok) throw new Error('Error al cargar mis premios');
    return res.json();
  },

  async getAllWinners(): Promise<GiftWinner[]> {
    const res = await fetch(`${API_BASE}/admin/winners`);
    if (!res.ok) throw new Error('Error al cargar ganadores');
    return res.json();
  },

  async markAsDelivered(winnerId: string, adminUser: any): Promise<GiftWinner> {
    const res = await fetch(`${API_BASE}/admin/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerId, adminUser })
    });
    if (!res.ok) throw new Error('Error al marcar premio como entregado');
    return res.json();
  },

  async toggleImpossibleMode(enabled: boolean, adminUser: any): Promise<RouletteSettings> {
    const res = await fetch(`${API_BASE}/admin/toggle-impossible`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, adminUser })
    });
    if (!res.ok) throw new Error('Error al cambiar modo imposible');
    return res.json();
  },

  async getAuditLogs(): Promise<AdministrativeAuditLog[]> {
    const res = await fetch(`${API_BASE}/admin/audit-logs`);
    if (!res.ok) throw new Error('Error al obtener registros de auditoría');
    return res.json();
  }
};

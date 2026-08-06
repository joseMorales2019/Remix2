export type LoanStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'DEFAULTED' | 'VERIFIED';
export type SavingStatus = 'PENDING' | 'ACTIVE' | 'RETURNED' | 'RETURN_REQUESTED';

export interface UserProfile {
  id: string;
  full_name: string;
  dui: string;
  password?: string;
  email: string;
  phone: string;
  address: string;
  workplace?: string;
  bank_account?: string;
  bank_name?: string;
  is_admin: boolean;
  reliability_score: number; // Ahora de 0 a 300
  created_at: string;
  profile_image_url?: string;
  dui_url?: string;
  is_hidden?: boolean;
  consecutive_payments?: number;
  // Nuevos campos de la tienda
  store_diamonds: number;
  is_verified: boolean;
  verified_until?: string;
  project_vision_units: number;
  // Inventario de proyectos
  project_trust_insignia_count: number;
  pref_location_count: number;
  feedback_count: number;
  // Campos de perfil y especialidad
  free_shipping_departments?: string[];
  profile_type: 'invitado' | 'estudiante' | 'especialista' | 'inversionista' | 'MYPE' | 'jugador' | 'aliado' | 'ayudame' | 'creditos';
  specialist_metadata?: any;
}

export type HelpRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';

export interface HelpRequest {
  id: string;
  requester_id: string;
  specialist_id: string;
  document_url: string;
  modification_notes: string;
  offered_diamonds: number;
  status: HelpRequestStatus;
  modified_document_url?: string;
  specialist_observations?: string;
  created_at: string;
  updated_at: string;
  requester?: UserProfile;
  specialist?: UserProfile;
}

export interface Loan {
  id: string;
  user_id: string;
  amount: number;
  status: LoanStatus;
  due_date: string;
  created_at: string;
  approved_at?: string;
  payment_voucher_url?: string;
  analysis_score?: number;
  analysis_summary?: string;
  user_profile?: UserProfile;
}

export interface Saving {
  id: string;
  user_id: string;
  amount: number;
  status: SavingStatus;
  voucher_url: string;
  return_voucher_url?: string;
  deposit_date: string;
  deposit_time: string;
  depositor_name: string;
  depositor_dui: string;
  approved_at?: string;
  created_at: string;
  user?: UserProfile;
}

export interface Reference {
  id: string;
  applicant_id: string;
  referrer_id: string;
  is_trustworthy: boolean;
  comments: string;
  created_at: string;
}

export interface Defaulter {
  id: string;
  name: string;
  address_general: string;
  workplace: string;
  due_date: string;
  amount: number;
}

export interface Project {
  id: string;
  creator_id?: string;
  project_visibility?: 'me' | 'public' | 'specialist' | 'private';
  comment_visibility?: 'me' | 'public' | 'specialist';
  name: string;
  cover_image_url?: string;
  summary_vision: string;
  summary_problem: string;
  summary_solution: string;
  summary_business_model: string;
  summary_amount: number;
  summary_use_of_funds: string;
  summary_roi: string;
  desc_mission: string;
  desc_vision: string;
  desc_values: string;
  desc_history: string;
  desc_stage: string;
  desc_legal_form: string;
  desc_location: string;
  market_size: string;
  market_target: string;
  market_trends: string;
  market_opportunity: string;
  comp_direct: string;
  comp_diff: string;
  prod_desc: string;
  prod_roadmap: string;
  prod_tech: string;
  team_profiles: string;
  team_advisors: string;
  team_org: string;
  model_revenue: string;
  model_equity: number;
  model_pre_money: number;
  model_post_money: number;
  model_rights: string;
  model_exit: string;
  marketing_attraction: string;
  marketing_strategy: string;
  marketing_channels: string;
  ops_timeline: string;
  ops_resources: string;
  ops_risks: string;
  fin_use_funds: string;
  fin_projections: string;
  fin_break_even: string;
  fin_scenarios: string;
  legal_compliance: string;
  legal_assets: string;
  legal_fintech: string;
  legal_contracts: string;
  legal_kyc: string;
  legal_taxes: string;
  risks_reg: string;
  risks_market: string;
  risks_ops: string;
  risks_fin: string;
  risks_contingency: string;
  annexes: string;
  created_at: string;
  // Nuevos campos de asignación
  has_trust_insignia: boolean;
  is_preferential: boolean;
  has_feedback_assigned: boolean;
  pref_location_units: number;
  feedback_units: number;
}

export interface BusinessSchedule {
  id: string;
  days: string[];
  open_time: string;
  close_time: string;
}

export interface DomicilioBusiness {
  id: string;
  user_id?: string;
  owner_name: string;
  phone: string;
  business_name: string;
  is_24_7: boolean;
  schedules: BusinessSchedule[];
  latitude: number;
  longitude: number;
  address_text?: string;
  delivery_paused?: boolean;
  manual_closed?: boolean;
  created_at: string;
}

export interface DomicilioProduct {
  id: string;
  business_id: string;
  name: string;
  price: number;
  image_url: string;
  disponible_domicilio: boolean;
  is_hidden: boolean;
  created_at: string;
}

export interface DomicilioCustomerProfile {
  id: string;
  full_name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface DomicilioOrderItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  image_url?: string;
  item_note?: string;
}

export interface DomicilioOrder {
  id: string;
  business_id: string;
  business_name: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_latitude: number;
  customer_longitude: number;
  order_date: string;
  order_time: string;
  delivery_type: 'personal' | 'domicilio';
  items: DomicilioOrderItem[];
  total: number;
  additional_note?: string;
  status: 'Pendiente' | 'Entregado';
  created_at: string;
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area, LineChart, Line, Legend
} from 'recharts';
import { 
  Activity, Zap, RefreshCw, Database, Users, DollarSign, 
  ShieldCheck, TrendingUp, AlertTriangle, CheckCircle2, Clock, 
  ShoppingBag, Store, CreditCard, Sparkles, Server, ArrowUpRight, 
  ArrowDownRight, Layers, Radio, Globe, PieChart as PieIcon,
  ShieldAlert, UserCheck, Smartphone, Eye, Filter, Lock
} from 'lucide-react';
import { supabase } from '../supabase';
import { WebAnalyticsRealtime } from './WebAnalyticsRealtime';

interface SystemRealtimeMetricsProps {
  user: any;
  onNavigateTab?: (tabId: string) => void;
}

interface MetricSummary {
  // Préstamos
  totalLoans: number;
  pendingLoans: number;
  approvedLoans: number;
  paidLoans: number;
  verifiedLoans: number;
  defaultedLoans: number;
  totalDisbursed: number;
  totalRecovered: number;
  totalPendingRecovery: number;
  defaultRate: number;
  avgAiScore: number;

  // Ahorros & Liquidez
  totalSavings: number;
  activeSavingsCount: number;
  pendingSavingsCount: number;
  returnRequestedCount: number;
  totalSavingsAmount: number;
  totalBackingAllocated: number;
  availableLiquidity: number;
  liquidityReserveRatio: number;

  // Usuarios
  totalUsers: number;
  verifiedUsers: number;
  usersByRole: { [key: string]: number };
  newUsersLast7Days: number;
  totalReferences: number;

  // Tienda y A Domicilio
  totalProducts: number;
  totalProductOrders: number;
  totalProductRevenue: number;
  totalDomicilioBusinesses: number;
  totalDomicilioProducts: number;
  totalDomicilioOrders: number;
  totalDomicilioRevenue: number;

  // Canjes de Diamantes
  totalPaymentRequests: number;
  pendingPaymentRequests: number;
  paidPaymentRequestsAmount: number;
  pendingPaymentRequestsAmount: number;

  // Proyectos
  totalProjects: number;
  totalProjectFundingGoal: number;

  // Telemetría
  totalSystemRecords: number;
  lastUpdated: Date;
  eventsCount: number;
}

interface ActivityEvent {
  id: string;
  type: 'loan' | 'saving' | 'user' | 'order' | 'domicilio' | 'diamond' | 'system';
  title: string;
  detail: string;
  amount?: number;
  timestamp: Date;
  status?: string;
  badgeColor?: string;
}

export const SystemRealtimeMetrics: React.FC<SystemRealtimeMetricsProps> = ({ user, onNavigateTab }) => {
  const [metrics, setMetrics] = useState<MetricSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshSecs, setAutoRefreshSecs] = useState<number>(10);
  const [latencyMs, setLatencyMs] = useState<number>(45);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'finance' | 'savings' | 'users' | 'commerce' | 'web_analytics'>('all');
  const [recentEvents, setRecentEvents] = useState<ActivityEvent[]>([]);
  const [isLiveConnected, setIsLiveConnected] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionChannelsRef = useRef<any[]>([]);

  // Fetch full system data and calculate real metrics
  const fetchRealtimeSystemMetrics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    const startTime = performance.now();

    try {
      // 1. Fetch Loans
      const { data: loans, error: loansErr } = await supabase
        .from('loans')
        .select('*')
        .order('created_at', { ascending: false });

      // 2. Fetch Savings & Backing
      const { data: savings, error: savingsErr } = await supabase
        .from('savings')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: backings } = await supabase
        .from('loan_savings_backing')
        .select('*');

      // 3. Fetch Profiles & References
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: references } = await supabase
        .from('community_references')
        .select('*');

      // 4. Fetch Products & Product Orders
      const { data: products } = await supabase
        .from('products')
        .select('*');

      const { data: productOrders } = await supabase
        .from('product_orders')
        .select('*')
        .order('created_at', { ascending: false });

      // 5. Fetch A Domicilio Comercios & Orders
      const { data: domBusinesses } = await supabase
        .from('domicilio_businesses')
        .select('*');

      const { data: domProducts } = await supabase
        .from('domicilio_products')
        .select('*');

      const { data: domOrders } = await supabase
        .from('domicilio_orders')
        .select('*')
        .order('created_at', { ascending: false });

      // 6. Fetch Diamond Payment Requests
      const { data: paymentReqs } = await supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      // 7. Fetch Projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*');

      const endTime = performance.now();
      setLatencyMs(Math.max(12, Math.round(endTime - startTime)));

      // ================= CALCULATION OF REAL METRICS =================
      const allLoans = loans || [];
      const allSavings = savings || [];
      const allBackings = backings || [];
      const allProfiles = profiles || [];
      const allRefs = references || [];
      const allProds = products || [];
      const allPOrders = productOrders || [];
      const allDBiz = domBusinesses || [];
      const allDProds = domProducts || [];
      const allDOrders = domOrders || [];
      const allPReqs = paymentReqs || [];
      const allProjects = projectsData || [];

      // Loans metrics
      const pendingLoans = allLoans.filter(l => l.status === 'PENDING').length;
      const approvedLoans = allLoans.filter(l => l.status === 'APPROVED').length;
      const paidLoans = allLoans.filter(l => l.status === 'PAID').length;
      const verifiedLoans = allLoans.filter(l => l.status === 'VERIFIED').length;
      const defaultedLoans = allLoans.filter(l => l.status === 'DEFAULTED').length;

      const totalDisbursed = allLoans
        .filter(l => ['APPROVED', 'PAID', 'VERIFIED', 'DEFAULTED'].includes(l.status))
        .reduce((sum, l) => sum + Number(l.amount || 25), 0);

      const totalRecovered = allLoans
        .filter(l => ['PAID', 'VERIFIED'].includes(l.status))
        .reduce((sum, l) => sum + (Number(l.amount || 25) + 5), 0); // Capital + Interés ($30)

      const totalPendingRecovery = allLoans
        .filter(l => ['APPROVED', 'DEFAULTED'].includes(l.status))
        .reduce((sum, l) => sum + (Number(l.amount || 25) + 5), 0);

      const activeAndDefaultedCount = approvedLoans + defaultedLoans + paidLoans + verifiedLoans;
      const defaultRate = activeAndDefaultedCount > 0 
        ? (defaultedLoans / activeAndDefaultedCount) * 100 
        : 0;

      const scores = allLoans.map(l => l.analysis_score).filter(s => typeof s === 'number' && !isNaN(s));
      const avgAiScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
        : 82;

      // Savings metrics
      const activeSavingsList = allSavings.filter(s => s.status === 'ACTIVE');
      const pendingSavingsList = allSavings.filter(s => s.status === 'PENDING');
      const returnRequestedList = allSavings.filter(s => s.status === 'RETURN_REQUESTED');

      const totalSavingsAmount = activeSavingsList.reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const totalBackingAllocated = allBackings.reduce((sum, b) => sum + Number(b.amount_used || 0), 0);
      const availableLiquidity = Math.max(0, totalSavingsAmount - totalBackingAllocated);
      const liquidityReserveRatio = totalSavingsAmount > 0 
        ? (availableLiquidity / totalSavingsAmount) * 100 
        : 100;

      // Users metrics
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const newUsersLast7Days = allProfiles.filter(p => p.created_at && new Date(p.created_at) >= sevenDaysAgo).length;

      const usersByRole: { [key: string]: number } = {};
      allProfiles.forEach(p => {
        const role = p.profile_type || 'invitado';
        usersByRole[role] = (usersByRole[role] || 0) + 1;
      });

      // Count verified users (users with >= 5 positive references)
      const refCountMap: { [userId: string]: number } = {};
      allRefs.filter(r => r.is_trustworthy).forEach(r => {
        if (r.applicant_id) {
          refCountMap[r.applicant_id] = (refCountMap[r.applicant_id] || 0) + 1;
        }
      });
      const verifiedUsers = allProfiles.filter(p => (refCountMap[p.id] || 0) >= 5 || p.is_verified).length;

      // Commerce & Domicilio metrics
      const totalProductRevenue = allPOrders
        .filter(o => o.status !== 'CANCELLED')
        .reduce((sum, o) => sum + Number(o.total_price || 0), 0);

      const totalDomicilioRevenue = allDOrders
        .filter(o => o.status !== 'CANCELLED')
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      // Diamond requests
      const pendingPReqs = allPReqs.filter(r => r.status === 'PENDING');
      const paidPReqs = allPReqs.filter(r => r.status === 'PAID');
      const paidPaymentRequestsAmount = paidPReqs.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
      const pendingPaymentRequestsAmount = pendingPReqs.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

      // Projects
      const totalProjectFundingGoal = allProjects.reduce((sum, p) => sum + Number(p.summary_amount || 0), 0);

      const totalSystemRecords = 
        allLoans.length + 
        allSavings.length + 
        allProfiles.length + 
        allRefs.length + 
        allProds.length + 
        allPOrders.length + 
        allDBiz.length + 
        allDOrders.length + 
        allPReqs.length + 
        allProjects.length;

      const summary: MetricSummary = {
        totalLoans: allLoans.length,
        pendingLoans,
        approvedLoans,
        paidLoans,
        verifiedLoans,
        defaultedLoans,
        totalDisbursed,
        totalRecovered,
        totalPendingRecovery,
        defaultRate,
        avgAiScore,

        totalSavings: allSavings.length,
        activeSavingsCount: activeSavingsList.length,
        pendingSavingsCount: pendingSavingsList.length,
        returnRequestedCount: returnRequestedList.length,
        totalSavingsAmount,
        totalBackingAllocated,
        availableLiquidity,
        liquidityReserveRatio,

        totalUsers: allProfiles.length,
        verifiedUsers,
        usersByRole,
        newUsersLast7Days,
        totalReferences: allRefs.length,

        totalProducts: allProds.length,
        totalProductOrders: allPOrders.length,
        totalProductRevenue,
        totalDomicilioBusinesses: allDBiz.length,
        totalDomicilioProducts: allDProds.length,
        totalDomicilioOrders: allDOrders.length,
        totalDomicilioRevenue,

        totalPaymentRequests: allPReqs.length,
        pendingPaymentRequests: pendingPReqs.length,
        paidPaymentRequestsAmount,
        pendingPaymentRequestsAmount,

        totalProjects: allProjects.length,
        totalProjectFundingGoal,

        totalSystemRecords,
        lastUpdated: new Date(),
        eventsCount: 0
      };

      setMetrics(summary);
      setLastSyncTime(new Date());

      // Generate Live Events Feed from newest records
      const eventList: ActivityEvent[] = [];

      allLoans.slice(0, 8).forEach(l => {
        eventList.push({
          id: `loan-${l.id}`,
          type: 'loan',
          title: `Préstamo #${l.id.slice(0, 6).toUpperCase()}`,
          detail: `Estado: ${l.status} • Score IA: ${l.analysis_score || 'N/A'}%`,
          amount: Number(l.amount || 25),
          timestamp: new Date(l.created_at || Date.now()),
          status: l.status,
          badgeColor: l.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : l.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' : l.status === 'DEFAULTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
        });
      });

      allSavings.slice(0, 6).forEach(s => {
        eventList.push({
          id: `saving-${s.id}`,
          type: 'saving',
          title: `Ahorro Comunitario`,
          detail: `Estado: ${s.status}`,
          amount: Number(s.amount || 0),
          timestamp: new Date(s.created_at || Date.now()),
          status: s.status,
          badgeColor: s.status === 'ACTIVE' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
        });
      });

      allDOrders.slice(0, 5).forEach(o => {
        eventList.push({
          id: `dom-${o.id}`,
          type: 'domicilio',
          title: `Pedido A Domicilio`,
          detail: `Cliente: ${o.customer_name || 'Usuario'} • ${o.delivery_type || 'Envío'}`,
          amount: Number(o.total_amount || 0),
          timestamp: new Date(o.created_at || Date.now()),
          status: o.status,
          badgeColor: 'bg-emerald-100 text-emerald-800'
        });
      });

      allProfiles.slice(0, 6).forEach(p => {
        eventList.push({
          id: `user-${p.id}`,
          type: 'user',
          title: `Nuevo Usuario Registrado`,
          detail: `${p.full_name || 'Usuario'} • Perfil: ${p.profile_type || 'General'}`,
          timestamp: new Date(p.created_at || Date.now()),
          badgeColor: 'bg-slate-100 text-slate-700'
        });
      });

      allPReqs.slice(0, 4).forEach(r => {
        eventList.push({
          id: `diamond-${r.id}`,
          type: 'diamond',
          title: `Canje de Diamantes`,
          detail: `💎 ${r.diamonds_amount} diamantes • ${r.full_name || 'Usuario'}`,
          amount: Number(r.total_amount || 0),
          timestamp: new Date(r.created_at || Date.now()),
          status: r.status,
          badgeColor: 'bg-cyan-100 text-cyan-800'
        });
      });

      // Sort chronological
      eventList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setRecentEvents(eventList.slice(0, 18));

    } catch (err) {
      console.error('Error fetching realtime system metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load and Realtime Subscriptions via Supabase Channels
  useEffect(() => {
    fetchRealtimeSystemMetrics();

    // Setup Supabase Realtime Listeners on critical tables
    try {
      const channel = supabase
        .channel('system-realtime-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => {
          fetchRealtimeSystemMetrics();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'savings' }, () => {
          fetchRealtimeSystemMetrics();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          fetchRealtimeSystemMetrics();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'domicilio_orders' }, () => {
          fetchRealtimeSystemMetrics();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'product_orders' }, () => {
          fetchRealtimeSystemMetrics();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => {
          fetchRealtimeSystemMetrics();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsLiveConnected(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsLiveConnected(false);
          }
        });

      subscriptionChannelsRef.current.push(channel);
    } catch (err) {
      console.warn('Realtime channel error:', err);
    }

    return () => {
      subscriptionChannelsRef.current.forEach(ch => supabase.removeChannel(ch));
    };
  }, []);

  // Handle Polling interval
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (autoRefreshSecs > 0) {
      refreshTimerRef.current = setInterval(() => {
        fetchRealtimeSystemMetrics();
      }, autoRefreshSecs * 1000);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [autoRefreshSecs]);

  // Chart Data: Status of Loans
  const loanStatusChartData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Pendientes', count: metrics.pendingLoans, color: '#F59E0B' },
      { name: 'Activos', count: metrics.approvedLoans, color: '#3B82F6' },
      { name: 'Pagados', count: metrics.paidLoans, color: '#10B981' },
      { name: 'Verificados', count: metrics.verifiedLoans, color: '#059669' },
      { name: 'En Mora', count: metrics.defaultedLoans, color: '#EF4444' }
    ];
  }, [metrics]);

  // Chart Data: Financial Flow & Liquidity Balance
  const financialBalanceData = useMemo(() => {
    if (!metrics) return [];
    return [
      {
        name: 'Liquidez Disponible',
        monto: metrics.availableLiquidity,
        color: '#10B981'
      },
      {
        name: 'Capital Comprometido',
        monto: metrics.totalBackingAllocated,
        color: '#6366F1'
      },
      {
        name: 'Desembolsos Totales',
        monto: metrics.totalDisbursed,
        color: '#3B82F6'
      },
      {
        name: 'Capital Recuperado',
        monto: metrics.totalRecovered,
        color: '#059669'
      },
      {
        name: 'Cartera por Cobrar',
        monto: metrics.totalPendingRecovery,
        color: '#F97316'
      }
    ];
  }, [metrics]);

  // Chart Data: Users by Role
  const usersRoleChartData = useMemo(() => {
    if (!metrics) return [];
    const roleLabels: { [key: string]: string } = {
      admin: 'Administradores',
      inversionista: 'Inversionistas',
      MYPE: 'MYPE / Negocios',
      estudiante: 'Estudiantes',
      especialista: 'Especialistas',
      aliado: 'Aliados Comerciales',
      ayudame: 'Red Solidaria',
      creditos: 'Solicitantes',
      jugador: 'Jugadores Arcade',
      invitado: 'Invitados / Clientes'
    };
    return Object.entries(metrics.usersByRole).map(([role, count]) => ({
      role: roleLabels[role] || role,
      cantidad: count
    })).sort((a, b) => b.cantidad - a.cantidad);
  }, [metrics]);

  if (loading && !metrics) {
    return (
      <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm text-center">
        <div className="inline-flex p-4 rounded-2xl bg-blue-50 text-blue-600 mb-4 animate-pulse">
          <Activity className="w-8 h-8 animate-spin" />
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-2">Conectando Telemetría en Tiempo Real...</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Sincronizando registros en vivo de préstamos, ahorros, perfiles de usuario, órdenes y transacciones del sistema NewBank AI.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* ========================================================
          PANEL SUPERIOR DE TELEMETRÍA & CONTROL EN VIVO
          ======================================================== */}
      <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 relative overflow-hidden">
        
        {/* Fondo decorativo con gradiente cibernético */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-600/20 via-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none"></div>

        <div className="relative z-10">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
            
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLiveConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isLiveConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  {isLiveConnected ? 'SISTEMA CONECTADO EN TIEMPO REAL' : 'MODO POLLING ACTIVO'}
                </span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                <span>Métricas y Telemetría Global</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  v2.8 Live Engine
                </span>
              </h2>
              
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Monitoreo operacional, financiero, transaccional y comunitario instantáneo de la plataforma.
              </p>
            </div>

            {/* Controles de refresco y estado de red */}
            <div className="flex flex-wrap items-center gap-3">
              
              <div className="flex items-center gap-2 bg-slate-900/90 px-3.5 py-2 rounded-2xl border border-slate-800 text-xs font-bold text-slate-300">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Latencia: <strong className="text-emerald-400">{latencyMs}ms</strong></span>
              </div>

              <div className="flex items-center gap-2 bg-slate-900/90 px-3.5 py-2 rounded-2xl border border-slate-800 text-xs font-bold text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Sync: <strong className="text-slate-200">{lastSyncTime.toLocaleTimeString()}</strong></span>
              </div>

              {/* Selector de Auto-refresco */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-2xl border border-slate-800 text-xs">
                <span className="text-[10px] font-black text-slate-500 uppercase px-2">Refresco:</span>
                {[
                  { label: '3s', val: 3 },
                  { label: '10s', val: 10 },
                  { label: '30s', val: 30 },
                  { label: 'Off', val: 0 }
                ].map(item => (
                  <button
                    key={item.val}
                    onClick={() => setAutoRefreshSecs(item.val)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition cursor-pointer ${
                      autoRefreshSecs === item.val 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Botón manual de refresco */}
              <button
                type="button"
                onClick={() => fetchRealtimeSystemMetrics(true)}
                disabled={refreshing}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-blue-900/30 flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
              </button>

            </div>

          </div>

          {/* Barra de Estadísticas Rápidas de Salud del Sistema */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-6">
            
            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Registros Totales</span>
              <span className="text-lg sm:text-xl font-black text-white">{metrics?.totalSystemRecords.toLocaleString() || 0}</span>
              <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">En 10 tablas activas</span>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Liquidez Neta</span>
              <span className="text-lg sm:text-xl font-black text-emerald-400">${metrics?.availableLiquidity.toFixed(2) || '0.00'}</span>
              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Libre para desembolsos</span>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Préstamos Vivos</span>
              <span className="text-lg sm:text-xl font-black text-blue-400">{metrics?.approvedLoans || 0}</span>
              <span className="text-[10px] text-blue-300/80 font-bold block mt-0.5">${metrics?.totalDisbursed.toFixed(2)} colocados</span>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tasa de Mora</span>
              <span className={`text-lg sm:text-xl font-black ${(metrics?.defaultRate || 0) > 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {metrics?.defaultRate.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{metrics?.defaultedLoans} préstamos vencidos</span>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Comunidad & Usuarios</span>
              <span className="text-lg sm:text-xl font-black text-indigo-300">{metrics?.totalUsers || 0}</span>
              <span className="text-[10px] text-indigo-400 font-bold block mt-0.5">{metrics?.verifiedUsers} verificados</span>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Score Promedio IA</span>
              <span className="text-lg sm:text-xl font-black text-amber-300">{metrics?.avgAiScore} / 100</span>
              <span className="text-[10px] text-amber-400 font-bold block mt-0.5">Calificación Crediticia</span>
            </div>

          </div>

        </div>

      </div>

      {/* ========================================================
          SELECTOR DE FILTROS POR MÓDULOS
          ======================================================== */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'Todo el Sistema', icon: Layers },
          { id: 'web_analytics', label: 'Analítica Web en Vivo', icon: Globe },
          { id: 'finance', label: 'Microcréditos & Pagos', icon: DollarSign },
          { id: 'savings', label: 'Ahorros & Liquidez', icon: ShieldCheck },
          { id: 'users', label: 'Usuarios & Comunidad', icon: Users },
          { id: 'commerce', label: 'Comercios, Tienda & Canjes', icon: Store }
        ].map(cat => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {selectedCategory === 'web_analytics' && (
        <WebAnalyticsRealtime user={user} />
      )}

      {/* ========================================================
          SECCIÓN 1: KPIS FINANCIEROS Y DE CARTERA
          ======================================================== */}
      {(selectedCategory === 'all' || selectedCategory === 'finance') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <span>Cartera de Microcréditos y Salud Financiera</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">Actualizado en vivo</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Préstamos Solicitados Totales */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest">Total Solicitudes</span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600"><CreditCard className="w-4 h-4" /></span>
              </div>
              <div className="text-3xl font-black text-slate-900 mb-1">{metrics?.totalLoans}</div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">{metrics?.pendingLoans} por evaluar</span>
              </div>
            </div>

            {/* Card 2: Capital Desembolsado Activo */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest">Capital Colocado</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><ArrowUpRight className="w-4 h-4" /></span>
              </div>
              <div className="text-3xl font-black text-emerald-600 mb-1">${metrics?.totalDisbursed.toFixed(2)}</div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>{metrics?.approvedLoans} préstamos activos</span>
              </div>
            </div>

            {/* Card 3: Capital Recuperado + Intereses */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest">Capital Recuperado</span>
                <span className="p-2 rounded-xl bg-teal-50 text-teal-600"><CheckCircle2 className="w-4 h-4" /></span>
              </div>
              <div className="text-3xl font-black text-teal-600 mb-1">${metrics?.totalRecovered.toFixed(2)}</div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>{metrics?.paidLoans + (metrics?.verifiedLoans || 0)} préstamos saldados</span>
              </div>
            </div>

            {/* Card 4: Cartera en Mora */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest">Cartera en Mora</span>
                <span className="p-2 rounded-xl bg-rose-50 text-rose-600"><AlertTriangle className="w-4 h-4" /></span>
              </div>
              <div className="text-3xl font-black text-rose-600 mb-1">{metrics?.defaultedLoans}</div>
              <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                <span className="bg-rose-50 px-2 py-0.5 rounded-md">Tasa: {metrics?.defaultRate.toFixed(1)}%</span>
                <span className="text-slate-400">• ${(metrics?.defaultedLoans ? metrics.defaultedLoans * 30 : 0).toFixed(2)} en riesgo</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          SECCIÓN 2: AHORROS, FONDO DE LIQUIDEZ Y RESPALDO
          ======================================================== */}
      {(selectedCategory === 'all' || selectedCategory === 'savings') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <span>Fondo Comunitario de Ahorros y Cobertura de Liquidez</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block mb-1">Masa Total de Ahorros</span>
              <div className="text-3xl font-black text-white mb-2">${metrics?.totalSavingsAmount.toFixed(2)}</div>
              <p className="text-xs text-indigo-200/80 leading-relaxed mb-4">
                Fondo colectivo respaldado por los inversionistas y ahorrantes comunitarios.
              </p>
              <div className="pt-3 border-t border-indigo-800/60 flex items-center justify-between text-xs font-bold text-indigo-200">
                <span>Ahorros Activos:</span>
                <strong className="text-white">{metrics?.activeSavingsCount} cuentas</strong>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest">Saldo Real Disponible</span>
                  <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><TrendingUp className="w-4 h-4" /></span>
                </div>
                <div className="text-3xl font-black text-emerald-600 mb-1">${metrics?.availableLiquidity.toFixed(2)}</div>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Liquidez no comprometida lista para financiar nuevas solicitudes de crédito.
                </p>
              </div>

              {/* Barra de progreso de reserva */}
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                  <span>Ratio de Reserva Libre:</span>
                  <span className="text-emerald-600 font-extrabold">{metrics?.liquidityReserveRatio.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, metrics?.liquidityReserveRatio || 0)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest">Ahorro Comprometido (Garantía)</span>
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-600"><Lock className="w-4 h-4 text-amber-600" /></span>
                </div>
                <div className="text-3xl font-black text-amber-600 mb-1">${metrics?.totalBackingAllocated.toFixed(2)}</div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Fondos asignados mediante la tabla <code className="text-[10px] font-bold bg-slate-100 px-1 py-0.5 rounded">loan_savings_backing</code> para respaldar préstamos en circulación.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Vouchers Pendientes:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-black">
                  {metrics?.pendingSavingsCount} por revisar
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          SECCIÓN 3: GRÁFICOS VISUALES EN TIEMPO REAL
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico 1: Estado de Cartera de Préstamos */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-base font-black text-slate-900">Distribución de Estados de Préstamos</h4>
              <p className="text-xs text-slate-500 font-medium">Conteo en tiempo real de la cartera crediticia</p>
            </div>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600"><PieIcon className="w-4 h-4" /></span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={loanStatusChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {loanStatusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-5 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
            {loanStatusChartData.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter truncate block">{item.name}</span>
                <span className="text-sm font-black" style={{ color: item.color }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 2: Desglose de Usuarios por Perfil */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-base font-black text-slate-900">Composición de la Comunidad por Rol</h4>
              <p className="text-xs text-slate-500 font-medium">Usuarios registrados clasificados en el sistema</p>
            </div>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><Users className="w-4 h-4" /></span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usersRoleChartData.slice(0, 6)} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                <YAxis dataKey="role" type="category" tick={{ fontSize: 10, fontWeight: 700, fill: '#334155' }} width={90} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="cantidad" fill="#6366F1" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total Usuarios: <strong className="text-slate-900">{metrics?.totalUsers}</strong></span>
            <span className="text-emerald-600 font-extrabold">+{metrics?.newUsersLast7Days} últimos 7 días</span>
          </div>
        </div>

      </div>

      {/* ========================================================
          SECCIÓN 4: E-COMMERCE, A DOMICILIO Y DIAMANTES
          ======================================================== */}
      {(selectedCategory === 'all' || selectedCategory === 'commerce') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-600" />
              <span>Ecosistema de Comercio, A Domicilio y Canjes</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Comercios A Domicilio */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest">Comercios a Domicilio</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600"><Store className="w-4 h-4" /></span>
              </div>
              <div className="text-3xl font-black text-slate-900 mb-1">{metrics?.totalDomicilioBusinesses}</div>
              <div className="text-xs font-bold text-slate-500">
                {metrics?.totalDomicilioProducts} productos en menú GPS
              </div>
            </div>

            {/* Pedidos A Domicilio */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest">Pedidos Delivery</span>
                <span className="p-2 rounded-xl bg-teal-50 text-teal-600"><Smartphone className="w-4 h-4" /></span>
              </div>
              <div className="text-3xl font-black text-teal-600 mb-1">{metrics?.totalDomicilioOrders}</div>
              <div className="text-xs font-bold text-emerald-600">
                ${metrics?.totalDomicilioRevenue.toFixed(2)} procesados
              </div>
            </div>

            {/* Tienda y Wishlist */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest">Catálogo Tienda</span>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600"><ShoppingBag className="w-4 h-4" /></span>
              </div>
              <div className="text-3xl font-black text-blue-600 mb-1">{metrics?.totalProducts}</div>
              <div className="text-xs font-bold text-slate-500">
                {metrics?.totalProductOrders} órdenes registradas
              </div>
            </div>

            {/* Canje de Diamantes */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest">Canjes Diamantes</span>
                <span className="p-2 rounded-xl bg-cyan-50 text-cyan-600"><Sparkles className="w-4 h-4" /></span>
              </div>
              <div className="text-3xl font-black text-cyan-600 mb-1">
                ${metrics?.paidPaymentRequestsAmount.toFixed(2)}
              </div>
              <div className="text-xs font-bold text-amber-600">
                {metrics?.pendingPaymentRequests} solicitudes pendientes (${metrics?.pendingPaymentRequestsAmount.toFixed(2)})
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          SECCIÓN 5: FEED DE ACTIVIDAD EN TIEMPO REAL
          ======================================================== */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span>Flujo de Actividad y Eventos en Vivo</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">Últimas acciones registradas automáticamente en el sistema</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {recentEvents.length} Eventos Recientes
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-100 mt-2 max-h-96 overflow-y-auto pr-1">
          {recentEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-bold text-xs uppercase">
              No hay eventos recientes registrados
            </div>
          ) : (
            recentEvents.map(evt => (
              <div key={evt.id} className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-2xl transition">
                
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
                    evt.type === 'loan' ? 'bg-blue-100 text-blue-700' :
                    evt.type === 'saving' ? 'bg-indigo-100 text-indigo-700' :
                    evt.type === 'domicilio' ? 'bg-emerald-100 text-emerald-700' :
                    evt.type === 'diamond' ? 'bg-cyan-100 text-cyan-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {evt.type === 'loan' ? '💸' : evt.type === 'saving' ? '💰' : evt.type === 'domicilio' ? '🛵' : evt.type === 'diamond' ? '💎' : '👤'}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 truncate">{evt.title}</p>
                    <p className="text-[11px] text-slate-500 font-medium truncate">{evt.detail}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {evt.amount !== undefined && evt.amount > 0 && (
                    <span className="text-xs font-black text-slate-900 block">
                      ${evt.amount.toFixed(2)}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-bold block">
                    {evt.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

              </div>
            ))
          )}
        </div>

      </div>

      {/* ========================================================
          MATRIZ DE MONITOREO DE TABLAS DEL SISTEMA (TELEMETRÍA)
          ======================================================== */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800">
        
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              <span>Matriz de Tablas y Estado de Almacenamiento</span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">Registros indexados en base de datos PostgreSQL / Supabase</p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-800/60">
            SCHEMA: public
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-slate-400 font-mono text-[11px] block">public.loans</span>
            <span className="text-base font-black text-white">{metrics?.totalLoans || 0}</span>
            <span className="text-[10px] text-emerald-400 font-bold block">● Tabla activa</span>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-slate-400 font-mono text-[11px] block">public.savings</span>
            <span className="text-base font-black text-white">{metrics?.totalSavings || 0}</span>
            <span className="text-[10px] text-emerald-400 font-bold block">● Tabla activa</span>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-slate-400 font-mono text-[11px] block">public.profiles</span>
            <span className="text-base font-black text-white">{metrics?.totalUsers || 0}</span>
            <span className="text-[10px] text-emerald-400 font-bold block">● Tabla activa</span>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-slate-400 font-mono text-[11px] block">public.domicilio_orders</span>
            <span className="text-base font-black text-white">{metrics?.totalDomicilioOrders || 0}</span>
            <span className="text-[10px] text-emerald-400 font-bold block">● Tabla activa</span>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-slate-400 font-mono text-[11px] block">public.payment_requests</span>
            <span className="text-base font-black text-white">{metrics?.totalPaymentRequests || 0}</span>
            <span className="text-[10px] text-emerald-400 font-bold block">● Tabla activa</span>
          </div>

        </div>

      </div>

    </div>
  );
};

export default SystemRealtimeMetrics;

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { motion } from 'motion/react';

const PaymentRequests: React.FC<{ user: any }> = ({ user }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    phone: '',
    email: user?.email || ''
  });
  const [diamondsToExchange, setDiamondsToExchange] = useState(0);
  const [status, setStatus] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const PRICE_PER_DIAMOND = 0.25; // $0.25 per diamond

  const fetchData = async () => {
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profileData) {
      setProfile(profileData);
      setDiamondsToExchange(profileData.store_diamonds || 0);
    }

    const { data: historyData } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (historyData) {
      setHistory(historyData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!profile || profile.store_diamonds < 40) {
      setStatus({ msg: "El monto mínimo para cambiar es de 40 diamantes.", type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const totalAmount = (profile.store_diamonds * PRICE_PER_DIAMOND) * 0.7; // 30% admin fee deduction
      const diamondsUsed = profile.store_diamonds;

      // 1. Create the request
      const { error: requestError } = await supabase.from('payment_requests').insert({
        user_id: user.id,
        full_name: profile.full_name,
        dui: profile.dui,
        diamonds_amount: diamondsUsed,
        price_per_diamond: PRICE_PER_DIAMOND,
        total_amount: totalAmount,
        bank_name: formData.bank_name,
        account_number: formData.account_number,
        phone: formData.phone,
        email: formData.email,
        status: 'PENDING'
      });

      if (requestError) throw requestError;

      // 2. Deduct diamonds from profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ store_diamonds: 0 })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setStatus({ msg: "Solicitud enviada con éxito. Tus diamantes han sido descontados.", type: 'success' });
      setProfile({ ...profile, store_diamonds: 0 });
      setDiamondsToExchange(0);
      fetchData(); // Refresh history
    } catch (err) {
      console.error(err);
      setStatus({ msg: "Error al procesar la solicitud. Asegúrate de que la tabla 'payment_requests' exista.", type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center font-black uppercase">Cargando...</div>;
  
  const grossAmount = diamondsToExchange * PRICE_PER_DIAMOND;
  const adminFee = grossAmount * 0.3;
  const totalToReceive = (grossAmount - adminFee).toFixed(2);
  const currentDate = new Date().toLocaleString();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-2xl rounded-[2rem] overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter italic">Solicitud de Pago</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">NewBank AI - Departamento de Tesorería</p>
          </div>
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
            <span className="text-white font-black text-3xl">N</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 sm:p-12">
          {status && (
            <div className={`mb-6 p-4 rounded-2xl border font-bold text-xs uppercase tracking-widest ${status.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {status.msg}
            </div>
          )}
          {/* Document Section */}
          <div className="bg-slate-50 p-8 rounded-3xl border-2 border-dashed border-slate-200 mb-8 relative">
            <div className="absolute top-4 right-8 opacity-10 pointer-events-none">
              <span className="text-6xl font-black uppercase rotate-12 block">ORIGINAL</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre de la Empresa</label>
                  <p className="text-sm font-black text-slate-900 uppercase">NEWBANK AI</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">ID de Usuario</label>
                  <p className="text-sm font-bold text-slate-700 font-mono">{user.id}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha de Solicitud</label>
                  <p className="text-sm font-bold text-slate-700">{currentDate}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre Completo</label>
                  <p className="text-sm font-black text-slate-900 uppercase">{profile?.full_name}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">DUI</label>
                  <p className="text-sm font-bold text-slate-700">{profile?.dui}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest block mb-1">Diamantes a Cambiar</label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💎</span>
                  <div>
                    <span className="text-2xl font-black text-slate-900">{diamondsToExchange}</span>
                    <p className="text-[9px] font-bold text-green-600 uppercase tracking-widest">≈ ${(diamondsToExchange * PRICE_PER_DIAMOND).toFixed(2)} USD</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest block mb-1">Precio por Diamante</label>
                <div className="text-2xl font-black text-slate-900">${PRICE_PER_DIAMOND.toFixed(2)}</div>
              </div>
              <div className="bg-slate-100 p-4 rounded-2xl shadow-sm border border-slate-200">
                <label className="text-[9px] font-black text-red-600 uppercase tracking-widest block mb-1">Gastos Administrativos (30%)</label>
                <div className="text-2xl font-black text-red-600">-${adminFee.toFixed(2)}</div>
              </div>
              <div className="bg-blue-600 p-4 rounded-2xl shadow-lg border border-blue-500 text-white">
                <label className="text-[9px] font-black text-blue-200 uppercase tracking-widest block mb-1">Total a Recibir</label>
                <div className="text-3xl font-black">${totalToReceive}</div>
              </div>
            </div>
          </div>

          {/* Input Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
              <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
              Información de Depósito
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre del Banco</label>
                <input 
                  type="text"
                  required
                  value={formData.bank_name}
                  onChange={e => setFormData({...formData, bank_name: e.target.value})}
                  className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 bg-slate-50"
                  placeholder="Ej: Banco Agrícola"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Número de Cuenta</label>
                <input 
                  type="text"
                  required
                  value={formData.account_number}
                  onChange={e => setFormData({...formData, account_number: e.target.value})}
                  className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 bg-slate-50"
                  placeholder="0000-000000-00"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Número de Teléfono</label>
                <input 
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 bg-slate-50"
                  placeholder="7000-0000"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Correo Electrónico</label>
                <input 
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 bg-slate-50"
                  placeholder="usuario@ejemplo.com"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={submitting || diamondsToExchange < 40}
              className="w-full bg-slate-900 hover:bg-black text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-8"
            >
              {submitting ? 'Procesando...' : 'Solicitar Pago'}
            </button>
            
            {diamondsToExchange < 40 && (
              <p className="text-center text-red-500 font-bold text-xs uppercase mt-4">
                {diamondsToExchange <= 0 
                  ? "No tienes diamantes disponibles para canjear." 
                  : `El monto mínimo para canjear es de 40 diamantes (Tienes ${diamondsToExchange}).`}
              </p>
            )}
          </div>
        </form>
      </motion.div>

      {/* History Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-12 bg-white shadow-xl rounded-[2rem] overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-100 p-6 border-b border-slate-200">
          <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
            <span className="w-2 h-6 bg-slate-900 rounded-full"></span>
            Historial de Solicitudes
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black tracking-widest border-b">
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Diamantes</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Banco / Cuenta</th>
                <th className="px-6 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold uppercase text-xs">No tienes solicitudes previas</td>
                </tr>
              ) : (
                history.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-600">
                      {new Date(req.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-black text-blue-600 text-xs">💎 {req.diamonds_amount}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-900 text-xs">${req.total_amount.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700 text-[10px] uppercase">{req.bank_name}</div>
                      <div className="text-[9px] text-slate-400 font-mono">{req.account_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        req.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {req.status === 'PAID' ? 'PAGADO' : 'PENDIENTE'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentRequests;

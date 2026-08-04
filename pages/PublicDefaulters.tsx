import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Defaulter } from '../types';

const PublicDefaulters: React.FC<{ user: any }> = ({ user }) => {
  const [defaulters, setDefaulters] = useState<Defaulter[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchDefaulters = async () => {
      const { data, error } = await supabase
        .from('loans')
        .select(`
          id, 
          amount, 
          due_date, 
          profiles (full_name, address, workplace)
        `)
        .eq('status', 'DEFAULTED');

      if (data) {
        const formatted: Defaulter[] = data.map((d: any) => ({
          id: d.id,
          name: d.profiles?.full_name?.split(' ')[0] + ' ***',
          address_general: d.profiles?.address || 'N/A',
          workplace: d.profiles?.workplace || 'Privado',
          due_date: new Date(d.due_date).toLocaleDateString(),
          amount: d.amount
        }));
        setDefaulters(formatted);
      }
      setLoading(false);
    };

    fetchDefaulters();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-white p-12 rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-4">Acceso Restringido</h2>
          <p className="text-slate-500 mb-8 font-medium">Debes iniciar sesión para acceder al Observatorio de Confiabilidad y ver la lista pública de morosos.</p>
          <Link to="/register" className="inline-block bg-blue-600 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition">
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  const filtered = defaulters.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.workplace.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8 sm:mb-12 text-center sm:text-left">
        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter">Observatorio de Confiabilidad</h2>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2">Transparencia radical para proteger el fondo común.</p>
        <p className="text-[10px] font-black text-red-600 uppercase mt-2 tracking-widest">aqui aparecen los usuarios que no han pagado sus prestamos</p>
      </div>

      <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Buscar alias o trabajo..." 
              className="w-full md:w-[400px] pl-10 pr-4 sm:pl-12 sm:pr-6 py-3 sm:py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-medium text-xs sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="w-4 h-4 sm:w-5 h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px] sm:min-w-0">
            <thead className="bg-slate-50/80 text-[8px] sm:text-[10px] text-slate-400 uppercase font-black tracking-widest">
              <tr>
                <th className="px-6 sm:px-8 py-4 sm:py-6">Usuario</th>
                <th className="px-6 sm:px-8 py-4 sm:py-6">Jurisdicción</th>
                <th className="px-6 sm:px-8 py-4 sm:py-6">Trabajo</th>
                <th className="px-6 sm:px-8 py-4 sm:py-6">Vencimiento</th>
                <th className="px-6 sm:px-8 py-4 sm:py-6">Monto</th>
                <th className="px-6 sm:px-8 py-4 sm:py-6">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 sm:px-8 py-4 sm:py-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 sm:w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-400 flex-shrink-0">
                        {d.name[0]}
                      </div>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">{d.name}</span>
                    </div>
                  </td>
                  <td className="px-6 sm:px-8 py-4 sm:py-6 text-slate-600 text-[10px] sm:text-sm font-medium">{d.address_general}</td>
                  <td className="px-6 sm:px-8 py-4 sm:py-6 text-slate-600 text-[10px] sm:text-sm font-medium">{d.workplace}</td>
                  <td className="px-6 sm:px-8 py-4 sm:py-6">
                    <span className="text-red-600 font-black text-[10px] sm:text-sm">{d.due_date}</span>
                  </td>
                  <td className="px-6 sm:px-8 py-4 sm:py-6">
                    <span className="text-slate-900 font-black text-sm sm:text-lg">${d.amount.toFixed(2)}</span>
                  </td>
                  <td className="px-6 sm:px-8 py-4 sm:py-6">
                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[8px] sm:text-[10px] font-black uppercase">Mora</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-16 sm:py-20 text-center">
                    {loading ? (
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                        <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cargando...</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs sm:text-sm">No se registran deudas críticas.</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PublicDefaulters;
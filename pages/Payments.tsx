import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const Payments: React.FC<{ user: any }> = ({ user }) => {
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [paymentVouchers, setPaymentVouchers] = useState<Record<string, string>>({});
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);

  const calculateTotal = (loan: any) => {
    const baseAmount = 25; const interest = 5; let penalty = 0;
    const dueDate = new Date(loan.due_date); const now = new Date();
    if (now > dueDate) {
      const monthsDiff = (now.getFullYear() - dueDate.getFullYear()) * 12 + (now.getMonth() - dueDate.getMonth());
      penalty = (Math.max(0, monthsDiff) + 1) * 10;
    }
    return { total: baseAmount + interest + penalty, capital: baseAmount, interest, penalty, isLate: penalty > 0 };
  };

  const updateScoreOnPayment = async (isLate: boolean) => {
    const { data: profile } = await supabase.from('profiles').select('reliability_score, consecutive_payments').eq('id', user.id).single();
    if (!profile) return;

    let bonus = isLate ? 0 : 100;
    let streak = isLate ? 0 : (profile.consecutive_payments || 0) + 1;
    if (streak > 1 && !isLate) bonus += 25;

    const newScore = Math.min(300, (profile.reliability_score || 0) + bonus);
    await supabase.from('profiles').update({ 
      reliability_score: newScore,
      consecutive_payments: streak 
    }).eq('id', user.id);
  };

  useEffect(() => {
    const fetchLoans = async () => {
      const { data } = await supabase.from('loans').select('*').eq('user_id', user.id).in('status', ['APPROVED', 'PENDING', 'PAID', 'DEFAULTED', 'VERIFIED']).order('created_at', { ascending: false });
      if (data) {
        setActiveLoans(data);
        if (data.length > 0) {
          const firstPayable = data.find(l => l.status === 'APPROVED' || l.status === 'DEFAULTED');
          if (firstPayable) setSelectedLoan(firstPayable);
        }
      }
      setLoading(false);
    };
    fetchLoans();
  }, [user.id]);

  // Carga del script de Wompi
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://pagos.wompi.sv/js/wompi.pagos.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [selectedLoan]); // Se re-ejecuta si cambia el seleccionado para asegurar que el widget se renderice

  const handleReportVoucher = async (loan: any) => {
    const voucher = paymentVouchers[loan.id];
    if (!voucher) return alert("Por favor, sube la captura del comprobante.");
    setProcessing(loan.id);
    try {
      const fileName = `${loan.id}_p_${Date.now()}.webp`;
      const byteChars = atob(voucher.split(',')[1]);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      await supabase.storage.from('newBankImagesComprobantePagadoPrestamo').upload(fileName, new Blob([bytes], { type: 'image/webp' }), { upsert: true });
      const url = supabase.storage.from('newBankImagesComprobantePagadoPrestamo').getPublicUrl(fileName).data.publicUrl;
      
      const { error } = await supabase.from('loans').update({ status: 'PAID', payment_voucher_url: url }).eq('id', loan.id);
      if (error) throw error;

      const breakdown = calculateTotal(loan);
      await updateScoreOnPayment(breakdown.isLate);
      
      setActiveLoans(prev => prev.map(l => l.id === loan.id ? { ...l, status: 'PAID', payment_voucher_url: url } : l));
      alert('Pago reportado exitosamente. Revisaremos tu comprobante.');
    } catch (err) { console.error(err); }
    finally { setProcessing(null); }
  };

  if (loading) return <div className="p-20 text-center uppercase font-black opacity-40 animate-pulse">Cargando Billetera...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12 bg-[#f8f9fa] min-h-screen">
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Pasarela de Pagos</h2>
        <p className="text-sm text-slate-500 font-medium mt-2">Gestiona tus micro-créditos directamente desde esta pantalla.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* LADO IZQUIERDO: LISTA DE PRÉSTAMOS */}
        <div className="lg:w-7/12 space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mis Préstamos Activos</h3>
          {activeLoans.map(loan => {
            const breakdown = calculateTotal(loan);
            const isSelected = selectedLoan?.id === loan.id;
            const isPayable = loan.status === 'APPROVED' || loan.status === 'DEFAULTED';

            return (
              <div 
                key={loan.id} 
                onClick={() => isPayable && setSelectedLoan(loan)}
                className={`bg-white p-6 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'border-blue-600 ring-4 ring-blue-50 shadow-xl' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white ${loan.status === 'VERIFIED' ? 'bg-green-500' : 'bg-blue-600'}`}>
                      NB
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase">Referencia: {loan.id.slice(0,8)}</div>
                      <div className="text-xl font-black text-slate-900">Micro-Préstamo</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-slate-900">${breakdown.total.toFixed(2)}</div>
                    <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded inline-block ${breakdown.isLate ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {loan.status}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {activeLoans.length === 0 && (
            <div className="py-20 text-center border-4 border-dashed rounded-[2rem] border-slate-200 opacity-40 font-black uppercase tracking-widest text-xs">
              Sin deudas activas
            </div>
          )}
        </div>

        {/* LADO DERECHO: INTERFAZ TIPO CHECKOUT (Wompi) */}
        <div className="lg:w-5/12">
          {selectedLoan ? (
            <div className="bg-white rounded-lg shadow-2xl border border-slate-100 overflow-hidden sticky top-8">
              <div className="p-4 border-b border-slate-50 bg-white">
                <h3 className="text-sm font-bold text-slate-700">Fan Page NewBank</h3>
              </div>
              
              <div className="p-8">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-b pb-1">INFORMACIÓN DE PAGO</h4>
                
                <div className="space-y-6">
                  {/* Forma de Pago */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-3">Forma de pago</label>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" name="payType" defaultChecked className="w-4 h-4 text-blue-600 border-slate-300" />
                        <span className="text-xs font-bold text-slate-600">Tarjeta de crédito / Débito</span>
                        <div className="flex gap-1 ml-auto">
                           <div className="w-6 h-4 bg-slate-100 rounded"></div>
                           <div className="w-6 h-4 bg-slate-200 rounded"></div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer opacity-40 grayscale pointer-events-none">
                        <input type="radio" name="payType" className="w-4 h-4" />
                        <span className="text-xs font-bold text-slate-600">Pago con puntos (Banco Agrícola)</span>
                      </label>
                    </div>
                  </div>

                  <div className="py-4 border-t border-b border-slate-50 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-700">Total a pagar</span>
                    <span className="text-2xl font-black text-slate-900">${calculateTotal(selectedLoan).total.toFixed(2)}</span>
                  </div>

                  {/* Wompi Widget Directo */}
                  <div className="flex justify-center py-4">
                    <div 
                      className="wompi_button_widget" 
                      data-url-pago={`https://pagos.wompi.sv/IntentoPago/Redirect?id=f1eab0a7-1913-4a27-bad4-b9f762fd8d36&esWidget=1&monto=${calculateTotal(selectedLoan).total.toFixed(2)}`}
                      data-render="widget"
                    ></div>
                  </div>

                  {/* Datos adicionales como en la imagen */}
                  <div className="pt-4 space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">DATOS ADICIONALES PEDIDO</h4>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email comprador</label>
                      <input 
                        readOnly 
                        value={user.email} 
                        className="w-full px-4 py-3 border rounded text-xs font-bold text-slate-400 bg-slate-50 outline-none" 
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="w-4 h-4 border-slate-300 rounded text-blue-600" />
                      <span className="text-[10px] font-bold text-slate-500">He leído y acepto los <span className="text-blue-600 underline cursor-pointer">términos y condiciones</span></span>
                    </div>
                  </div>

                  {/* Respaldo Manual */}
                  <div className="mt-10 pt-8 border-t border-slate-100">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">¿Prefieres reporte manual?</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition cursor-pointer relative">
                      <input 
                        type="file" 
                        onChange={e => {
                          const r = new FileReader(); r.onloadend = () => setPaymentVouchers(p => ({...p, [selectedLoan.id]: r.result as string}));
                          if(e.target.files?.[0]) r.readAsDataURL(e.target.files[0]);
                        }} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      />
                      <span className="text-[10px] font-bold text-blue-600 uppercase">Subir Comprobante</span>
                      {paymentVouchers[selectedLoan.id] && (
                        <div className="mt-2 text-[9px] text-green-600 font-bold">Imagen Cargada ✓</div>
                      )}
                    </div>
                    <button 
                      onClick={() => handleReportVoucher(selectedLoan)}
                      disabled={!paymentVouchers[selectedLoan.id] || processing === selectedLoan.id}
                      className="w-full mt-3 py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs hover:bg-black transition disabled:opacity-30"
                    >
                      {processing === selectedLoan.id ? 'Reportando...' : 'Reportar Comprobante'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pago Seguro • NewBank SV</p>
              </div>
            </div>
          ) : (
            <div className="h-full bg-slate-100/50 rounded-3xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center p-12 text-center opacity-40">
              <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <p className="text-xs font-black uppercase tracking-widest">Selecciona un préstamo para proceder al pago</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Payments;
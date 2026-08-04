import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const Savings: React.FC<{ user: any }> = ({ user }) => {
  const [amount, setAmount] = useState('');
  const [depositorName, setDepositorName] = useState(user?.full_name || '');
  const [depositorDui, setDepositorDui] = useState(user?.dui || '');
  const [voucherBase64, setVoucherBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mySavings, setMySavings] = useState<any[]>([]);

  const sanitizeInput = (val: string) => {
    if (typeof val !== 'string') return '';
    return val.replace(/[<>"';%()]/g, '').trim();
  };

  useEffect(() => { fetchMySavings(); }, []);

  const calculateSavingTotal = (saving: any) => {
    if (!saving.approved_at) return saving.amount;
    const approvalDate = new Date(saving.approved_at); const now = new Date();
    // Fix: replace undefined 'dueDate' with 'approvalDate'
    const monthsDiff = (now.getFullYear() - approvalDate.getFullYear()) * 12 + (now.getMonth() - approvalDate.getMonth());
    return saving.amount + (Math.max(0, monthsDiff) * 0.01 * saving.amount);
  };

  const fetchMySavings = async () => {
    const { data } = await supabase.from('savings').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (data) setMySavings(data);
  };

  const updateScoreOnSaving = async (amt: number) => {
    const { data: profile } = await supabase.from('profiles').select('reliability_score').eq('id', user.id).single();
    if (!profile) return;
    const bonus = Math.min(100, 50 + amt); // +50 base + 1 por cada dolar, max 100
    const newScore = Math.min(300, (profile.reliability_score || 0) + bonus);
    await supabase.from('profiles').update({ reliability_score: newScore }).eq('id', user.id);
  };

  const penalizeForReturn = async () => {
    await supabase.from('profiles').update({ reliability_score: 0 }).eq('id', user.id); // -100% del score actual
  };

  const reportSaving = async () => {
    if (!amount || !voucherBase64) return alert("Completa los datos.");
    setLoading(true);
    try {
      const fileName = `a_${Date.now()}.webp`;
      const byteChars = atob(voucherBase64.split(',')[1]);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      await supabase.storage.from('newBankImagesComprobantePagadoPrestamo').upload(fileName, new Blob([bytes], { type: 'image/webp' }));
      const { data: publicUrl } = supabase.storage.from('newBankImagesComprobantePagadoPrestamo').getPublicUrl(fileName);

      await supabase.from('savings').insert({
        user_id: user.id, amount: parseFloat(amount), deposit_date: new Date().toISOString().split('T')[0],
        deposit_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        depositor_name: sanitizeInput(depositorName), depositor_dui: sanitizeInput(depositorDui),
        voucher_url: publicUrl.publicUrl, status: 'PENDING'
      });

      await updateScoreOnSaving(parseFloat(amount));
      alert("Ahorro reportado. (+ Score ganado)");
      setAmount(''); setVoucherBase64(null); fetchMySavings();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const requestTransfer = async (savingId: string) => {
    if (!confirm("¿Solicitar devolución? Tu score de confianza bajará a 0.")) return;
    setLoading(true);
    try {
      await supabase.from('savings').update({ status: 'RETURN_REQUESTED' }).eq('id', savingId);
      await penalizeForReturn();
      alert("Solicitud enviada. Score penalizado.");
      fetchMySavings();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 pb-32">
      <h2 className="text-4xl font-black uppercase tracking-tighter mb-10">AHORRO SEGURO</h2>
      <p className="text-[10px] font-black text-blue-600 uppercase mb-10 tracking-widest leading-relaxed">para registrar un Ahorro debe de realizar una transferencia con el valor total del monto ahorro a la cuenta del Banco Agricola 3720591608, enviar imagen de dicho comprobante y dar clic en el boton Reportar Ahorro.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-white p-8 rounded-[2rem] border shadow-xl">
           <h3 className="font-black uppercase text-blue-600 mb-6 tracking-widest text-xs">Nuevo Ahorro</h3>
           <input type="number" placeholder="Monto $USD" className="w-full p-4 rounded-xl border mb-4 font-black" value={amount} onChange={e => setAmount(e.target.value)} />
           <div className="border-2 border-dashed p-6 rounded-xl text-center mb-6">
              <input type="file" onChange={e => {
                const r = new FileReader(); r.onloadend = () => setVoucherBase64(r.result as string);
                if(e.target.files?.[0]) r.readAsDataURL(e.target.files[0]);
              }} />
           </div>
           <button onClick={reportSaving} disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase shadow-lg shadow-blue-100">Reportar Ahorro (+Score)</button>
        </div>

        <div className="space-y-4">
          <h3 className="font-black uppercase opacity-40 text-xs tracking-widest">Mis Registros</h3>
          {mySavings.map(s => (
            <div key={s.id} className="bg-white p-6 rounded-2xl border shadow-sm flex justify-between items-center">
              <div>
                <div className="text-2xl font-black">${s.amount.toFixed(2)}</div>
                <div className="text-[8px] font-black uppercase text-slate-300">Rendimiento: 1% mensual</div>
              </div>
              {s.status === 'ACTIVE' && (
                <button onClick={() => requestTransfer(s.id)} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-black uppercase text-[8px] tracking-widest">Devolver</button>
              )}
              {s.status !== 'ACTIVE' && <span className="text-[10px] font-black uppercase opacity-40">{s.status}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Savings;
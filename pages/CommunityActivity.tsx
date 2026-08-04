import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';

const CommunityActivity: React.FC<{ user: any }> = ({ user }) => {
  const [pendingValidations, setPendingValidations] = useState<any[]>([]);
  const [myLoans, setMyLoans] = useState<any[]>([]);
  const [rejectionFound, setRejectionFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vouchingId, setVouchingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const { data: references, error: refError } = await supabase
        .from('community_references')
        .select(`
          id,
          applicant:profiles!community_references_applicant_id_fkey (
            id, full_name, dui, reliability_score
          )
        `)
        .eq('referrer_id', user.id)
        .eq('is_trustworthy', false)
        .is('comments', null);

      if (refError) throw refError;

      const { data: mine } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const { data: rejections } = await supabase
        .from('community_references')
        .select('id')
        .eq('applicant_id', user.id)
        .eq('is_trustworthy', false)
        .not('comments', 'is', null)
        .limit(1);

      setRejectionFound((rejections?.length || 0) > 0);
      setPendingValidations(references || []);
      setMyLoans(mine || []);
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user.id]);

  const updateScore = async (userId: string, points: number, isPercentage: boolean = false) => {
    const { data: profile } = await supabase.from('profiles').select('reliability_score').eq('id', userId).single();
    if (!profile) return;
    
    let newScore = profile.reliability_score || 0;
    if (isPercentage) {
      newScore = Math.max(0, newScore * (1 + points / 100));
    } else {
      newScore = Math.max(0, Math.min(300, newScore + points));
    }
    
    await supabase.from('profiles').update({ reliability_score: Math.round(newScore) }).eq('id', userId);
  };

  const handleVouch = async (referenceId: string) => {
    setVouchingId(referenceId);
    try {
      const { data: ref } = await supabase.from('community_references').select('applicant_id').eq('id', referenceId).single();
      
      const { error } = await supabase.from('community_references').update({ 
        is_trustworthy: true, 
        comments: 'Validado positivamente.' 
      }).eq('id', referenceId);
      
      if (error) throw error;
      
      // Bonus por calificar a otro: +25 puntos
      await updateScore(user.id, 25);
      
      // Bonus al solicitante por recibir aval (Algoritmo Paso 4)
      // Se integra con el cálculo del score del solicitante (máx +100 por ciclo)
      if (ref) await updateScore(ref.applicant_id, 20); // Incremento gradual por cada aval positivo

      setPendingValidations(prev => prev.filter(v => v.id !== referenceId));
    } catch (err) { console.error(err); }
    finally { setVouchingId(null); }
  };

  const handleReject = async (referenceId: string) => {
    if (!confirm("¿Reportar como NO confiable?")) return;
    setVouchingId(referenceId);
    try {
      const { data: ref } = await supabase.from('community_references').select('applicant_id').eq('id', referenceId).single();

      const { error } = await supabase.from('community_references').update({ 
        is_trustworthy: false, 
        comments: 'RECHAZADO: El referente indica que este usuario NO es confiable.' 
      }).eq('id', referenceId);
      
      if (error) throw error;

      if (ref) {
        // Penalización al solicitante según número de avales negativos (Paso 3)
        // Por simplicidad, aplicamos la penalización porcentual base (-25%)
        await updateScore(ref.applicant_id, -25, true);
      }

      setPendingValidations(prev => prev.filter(v => v.id !== referenceId));
    } catch (err) { console.error(err); }
    finally { setVouchingId(null); }
  };

  if (loading) return <div className="p-32 text-center font-black uppercase opacity-40">Sincronizando...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <h2 className="text-3xl font-black uppercase tracking-tighter">Centro de Validaciones</h2>
          <p className="text-xs text-slate-500 font-medium mt-2 mb-6">Aqui parecen las personas que necesitan que tu las valores si son de confianza o no. Ellas en ningun momento sabran como las has calificado. Ayudanos a tener una comunidad libre de personas desleales</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingValidations.map((v) => (
              <div key={v.id} className="bg-white p-8 rounded-[2.5rem] border shadow-xl">
                <h4 className="font-black text-slate-900 mb-2 uppercase">{v.applicant?.full_name}</h4>
                <p className="text-[10px] font-black text-blue-600 uppercase mb-6 tracking-widest">Score: {v.applicant?.reliability_score} pts</p>
                <div className="space-y-2">
                  <button onClick={() => handleVouch(v.id)} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs">Aprobar (+25 pts para ti)</button>
                  <button onClick={() => handleReject(v.id)} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-black uppercase text-[10px]">Reportar</button>
                </div>
              </div>
            ))}
            {pendingValidations.length === 0 && <div className="col-span-2 py-20 text-center opacity-40 uppercase font-black tracking-widest text-xs border-2 border-dashed rounded-[3rem]">Sin pendientes</div>}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl font-black tracking-tighter uppercase">Estado de Mi Cuenta</h2>
          <div className={`p-8 rounded-[2.5rem] text-white shadow-2xl ${rejectionFound ? 'bg-red-600 animate-pulse border-4 border-red-500' : 'bg-blue-600 shadow-blue-100'}`}>
            <h4 className="font-black text-[10px] uppercase tracking-widest mb-2 opacity-80">Score de Confiaza</h4>
            <div className="text-5xl font-black">{user.reliability_score} pts</div>
            <p className="text-[10px] mt-4 font-medium uppercase tracking-tight leading-relaxed">
              {rejectionFound ? 'Cuenta inhabilitada por reportes comunitarios' : 'Necesitas un score alto para habilitar beneficios premium.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityActivity;
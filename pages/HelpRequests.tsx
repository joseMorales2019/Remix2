
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { HelpRequest, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface HelpRequestsProps {
  user: UserProfile;
}

const HelpRequests: React.FC<HelpRequestsProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [specialists, setSpecialists] = useState<UserProfile[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states for requester
  const [newRequest, setNewRequest] = useState({
    specialist_id: '',
    modification_notes: '',
    offered_diamonds: 0,
    document_file: null as File | null
  });

  // States for specialist response
  const [responseFile, setResponseFile] = useState<File | null>(null);
  const [observations, setObservations] = useState('');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch requests
      let query = supabase.from('help_requests').select(`
        *,
        requester:profiles!requester_id(*),
        specialist:profiles!specialist_id(*)
      `);

      if (user.profile_type === 'ayudame') {
        query = query.eq('requester_id', user.id);
      } else if (user.profile_type === 'especialista') {
        query = query.eq('specialist_id', user.id);
      } else if (user.is_admin) {
        // Admin sees all
      } else {
        // Other types might see nothing or their own if they were allowed
        query = query.or(`requester_id.eq.${user.id},specialist_id.eq.${user.id}`);
      }

      const { data: reqData, error: reqErr } = await query.order('created_at', { ascending: false });
      if (reqErr) throw reqErr;
      setRequests(reqData || []);

      // Fetch specialists if user is requester
      if (user.profile_type === 'ayudame' || user.is_admin) {
        const { data: specData, error: specErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('profile_type', 'especialista');
        if (specErr) throw specErr;
        setSpecialists(specData || []);
      }
    } catch (err: any) {
      console.error('Error fetching help requests:', err);
      setError('Error al cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.specialist_id || !newRequest.document_file || !newRequest.modification_notes || newRequest.offered_diamonds <= 0) {
      setError('Por favor completa todos los campos.');
      return;
    }

    if (user.store_diamonds < newRequest.offered_diamonds) {
      setError('No tienes suficientes diamantes.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Upload document
      const fileExt = newRequest.document_file.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `help_docs/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('newBankDocumentosParaRevision')
        .upload(filePath, newRequest.document_file);

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('newBankDocumentosParaRevision')
        .getPublicUrl(filePath);

      // 2. Create request and freeze diamonds (atomic-ish)
      // First subtract diamonds
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ store_diamonds: user.store_diamonds - newRequest.offered_diamonds })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      // Then create request
      const { error: insertErr } = await supabase.from('help_requests').insert({
        requester_id: user.id,
        specialist_id: newRequest.specialist_id,
        document_url: publicUrl,
        modification_notes: newRequest.modification_notes,
        offered_diamonds: newRequest.offered_diamonds,
        status: 'PENDING'
      });

      if (insertErr) {
        // Rollback diamonds if insert fails
        await supabase
          .from('profiles')
          .update({ store_diamonds: user.store_diamonds })
          .eq('id', user.id);
        throw insertErr;
      }

      setSuccess('Solicitud enviada con éxito. Tus diamantes han sido congelados.');
      
      // Send email and push notification
      const specialist = specialists.find(s => s.id === newRequest.specialist_id);
      if (specialist && (specialist.email || specialist.id)) {
        fetch('/api/notify-specialist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            specialistId: specialist.id,
            specialistEmail: specialist.email,
            specialistName: specialist.full_name,
            requesterName: user.full_name,
            requestType: 'Revisión de Documento'
          })
        }).catch(err => console.error("Notification failed:", err));
      }

      setNewRequest({ specialist_id: '', modification_notes: '', offered_diamonds: 0, document_file: null });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error al enviar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (requestId: string, newStatus: 'ACCEPTED' | 'REJECTED', requesterId: string, diamonds: number) => {
    setLoading(true);
    setError('');
    try {
      const { error: updateErr } = await supabase
        .from('help_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (updateErr) throw updateErr;

      if (newStatus === 'REJECTED') {
        // Return diamonds to requester
        const { data: reqProfile } = await supabase.from('profiles').select('store_diamonds').eq('id', requesterId).single();
        if (reqProfile) {
          await supabase
            .from('profiles')
            .update({ store_diamonds: reqProfile.store_diamonds + diamonds })
            .eq('id', requesterId);
        }
      }

      setSuccess(`Solicitud ${newStatus === 'ACCEPTED' ? 'aceptada' : 'rechazada'} con éxito.`);
      fetchData();
    } catch (err: any) {
      setError('Error al actualizar el estado.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingTo || !responseFile || !observations) {
      setError('Por favor sube el documento modificado y añade observaciones.');
      return;
    }

    const request = requests.find(r => r.id === respondingTo);
    if (!request) return;

    setLoading(true);
    setError('');
    try {
      // 1. Upload modified document
      const fileExt = responseFile.name.split('.').pop();
      const fileName = `modified_${request.id}_${Date.now()}.${fileExt}`;
      const filePath = `help_docs/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('NewBankDocumentosRevisados')
        .upload(filePath, responseFile);

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('NewBankDocumentosRevisados')
        .getPublicUrl(filePath);

      // 2. Update request status to COMPLETED
      const { error: updateErr } = await supabase
        .from('help_requests')
        .update({
          status: 'COMPLETED',
          modified_document_url: publicUrl,
          specialist_observations: observations,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateErr) throw updateErr;

      // 3. Add diamonds to specialist
      const { data: specProfile } = await supabase.from('profiles').select('store_diamonds').eq('id', user.id).single();
      if (specProfile) {
        await supabase
          .from('profiles')
          .update({ store_diamonds: specProfile.store_diamonds + request.offered_diamonds })
          .eq('id', user.id);
      }

      setSuccess('Solicitud completada. Los diamantes han sido añadidos a tu cuenta.');
      setRespondingTo(null);
      setResponseFile(null);
      setObservations('');
      fetchData();
    } catch (err: any) {
      setError('Error al completar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: any = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      ACCEPTED: 'bg-blue-100 text-blue-700',
      REJECTED: 'bg-red-100 text-red-700',
      COMPLETED: 'bg-green-100 text-green-700'
    };
    const labels: any = {
      PENDING: 'PENDIENTE',
      ACCEPTED: 'EN REVISIÓN',
      REJECTED: 'RECHAZADA',
      COMPLETED: 'COMPLETADA'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
            {user.profile_type === 'ayudame' ? 'Ayúdame con un documento' : 'Documentos para revisar'}
          </h1>
          <p className="text-slate-500 font-medium">
            {user.profile_type === 'ayudame' 
              ? 'Solicita modificaciones profesionales a tus documentos.' 
              : 'Gestiona y revisa las solicitudes de documentos asignadas.'}
          </p>
        </div>
        <div className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
          <span className="text-xl">💎</span>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase opacity-60 leading-none">Tus Diamantes</span>
            <span className="text-lg font-black leading-none mt-1">{user.store_diamonds}</span>
          </div>
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100">
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-green-50 text-green-600 rounded-2xl text-xs font-bold border border-green-100">
          {success}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Requester Form */}
        {user.profile_type === 'ayudame' && (
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl sticky top-24">
              <h2 className="text-xl font-black text-slate-900 uppercase mb-6 flex items-center gap-2">
                <span className="text-blue-600">➕</span> Nueva Solicitud
              </h2>
              <form onSubmit={handleCreateRequest} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Documento original</label>
                  <input 
                    type="file" 
                    onChange={e => setNewRequest({...newRequest, document_file: e.target.files?.[0] || null})}
                    className="w-full text-xs p-3 border rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">¿Qué quieres modificar?</label>
                  <textarea 
                    placeholder="Describe detalladamente los cambios..." 
                    className="w-full p-4 rounded-xl border text-sm min-h-[100px]"
                    value={newRequest.modification_notes}
                    onChange={e => setNewRequest({...newRequest, modification_notes: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Diamantes a ofrecer</label>
                  <input 
                    type="number" 
                    placeholder="Cantidad de diamantes" 
                    className="w-full p-4 rounded-xl border font-bold"
                    value={newRequest.offered_diamonds || ''}
                    onChange={e => setNewRequest({...newRequest, offered_diamonds: parseInt(e.target.value) || 0})}
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Seleccionar Especialista</label>
                  <select 
                    className="w-full p-4 rounded-xl border font-bold text-sm"
                    value={newRequest.specialist_id}
                    onChange={e => setNewRequest({...newRequest, specialist_id: e.target.value})}
                    required
                  >
                    <option value="">-- Seleccionar --</option>
                    {specialists.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.specialist_metadata?.professional_title || 'Especialista'})</option>
                    ))}
                  </select>
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-blue-700 transition"
                >
                  {loading ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Requests List */}
        <div className={user.profile_type === 'ayudame' ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="space-y-4">
            <h2 className="text-xl font-black text-slate-900 uppercase mb-4 flex items-center gap-2">
              <span className="text-blue-600">📋</span> {user.profile_type === 'ayudame' ? 'Mis Solicitudes' : 'Solicitudes Recibidas'}
            </h2>
            
            {loading && requests.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-100">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-400 font-bold uppercase text-[10px]">Cargando solicitudes...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[10px]">No hay solicitudes registradas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <AnimatePresence>
                  {requests.map((req) => (
                    <motion.div 
                      key={req.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="flex-grow">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusBadge(req.status)}
                            <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(req.created_at).toLocaleDateString()}</span>
                          </div>
                          <h3 className="font-black text-slate-900 uppercase text-sm mb-1">
                            {user.profile_type === 'ayudame' 
                              ? `Especialista: ${req.specialist?.full_name}` 
                              : `Solicitante: ${req.requester?.full_name}`}
                          </h3>
                          <p className="text-xs text-slate-600 mb-4 line-clamp-2">{req.modification_notes}</p>
                          
                          <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl">
                              <span className="text-xs">💎</span>
                              <span className="text-xs font-black text-blue-600">{req.offered_diamonds}</span>
                            </div>
                            <a 
                              href={req.document_url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[10px] font-black text-blue-600 uppercase hover:underline flex items-center gap-1"
                            >
                              📄 Ver Documento Original
                            </a>
                            {req.modified_document_url && (
                              <a 
                                href={req.modified_document_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[10px] font-black text-green-600 uppercase hover:underline flex items-center gap-1"
                              >
                                ✅ Ver Documento Modificado
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          {user.profile_type === 'especialista' && req.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleStatusChange(req.id, 'ACCEPTED', req.requester_id, req.offered_diamonds)}
                                className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-blue-700 transition"
                              >
                                Aceptar
                              </button>
                              <button 
                                onClick={() => handleStatusChange(req.id, 'REJECTED', req.requester_id, req.offered_diamonds)}
                                className="flex-1 sm:flex-none px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-red-600 transition"
                              >
                                Rechazar
                              </button>
                            </div>
                          )}

                          {user.profile_type === 'especialista' && req.status === 'ACCEPTED' && (
                            <button 
                              onClick={() => setRespondingTo(req.id)}
                              className="w-full px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-green-700 transition"
                            >
                              Completar Revisión
                            </button>
                          )}
                        </div>
                      </div>

                      {req.specialist_observations && (
                        <div className="mt-4 p-4 bg-green-50 rounded-2xl border border-green-100">
                          <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Observaciones del Especialista:</p>
                          <p className="text-xs text-slate-700 italic">"{req.specialist_observations}"</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Response Modal */}
      <AnimatePresence>
        {respondingTo && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                <h3 className="text-xl font-black uppercase">Completar Revisión</h3>
                <button onClick={() => setRespondingTo(null)} className="text-2xl">×</button>
              </div>
              <form onSubmit={handleCompleteRequest} className="p-8 space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Documento Modificado</label>
                  <input 
                    type="file" 
                    onChange={e => setResponseFile(e.target.files?.[0] || null)}
                    className="w-full text-xs p-3 border rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Observaciones de lo realizado</label>
                  <textarea 
                    placeholder="Explica qué cambios realizaste..." 
                    className="w-full p-4 rounded-xl border text-sm min-h-[120px]"
                    value={observations}
                    onChange={e => setObservations(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setRespondingTo(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-[2] py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-green-700 transition"
                  >
                    {loading ? 'Subiendo...' : 'Enviar Documento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HelpRequests;

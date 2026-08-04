import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const FeedbackRequests: React.FC<{ user: any }> = ({ user }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSpecialistProjects = async () => {
    setLoading(true);
    try {
      // Obtenemos los proyectos donde el usuario es creador o socio (especialista asignado)
      // O proyectos con visibilidad 'specialist'
      const { data: creatorRefs } = await supabase
        .from('project_creators')
        .select('project_id')
        .eq('user_id', user.id);

      const projectIds = creatorRefs?.map(ref => ref.project_id) || [];

      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      // Si no es admin, filtramos por los proyectos donde está asignado o visibilidad especialista
      if (!user.is_admin) {
        query = query.or(`project_visibility.eq.specialist,id.in.(${projectIds.join(',')})`);
      }

      const { data } = await query;
      if (data) setProjects(data);
    } catch (err) {
      console.error("Error cargando solicitudes de feedback:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecialistProjects();
  }, [user.id]);

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim() || !selectedProject) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('project_comments').insert({
        project_id: selectedProject.id,
        author_name: `Especialista: ${user.full_name}`,
        content: feedbackText
      });
      if (error) throw error;
      
      alert("Feedback enviado con éxito al usuario.");
      setFeedbackText('');
      setSelectedProject(null);
      fetchSpecialistProjects();
    } catch (err) {
      console.error(err);
      alert("Error al enviar el feedback.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-32 text-center font-black uppercase opacity-40 animate-pulse">Cargando solicitudes...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-12">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter">Mis Solicitudes de Feedback</h2>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2">Analiza proyectos y brinda tu expertise profesional a la comunidad.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Lista de Proyectos (Similar a Admin) */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Proyectos Pendientes</h3>
          {projects.map(p => (
            <div 
              key={p.id}
              onClick={() => { setSelectedProject(p); setFeedbackText(''); }}
              className={`p-6 bg-white rounded-3xl border transition-all cursor-pointer group ${selectedProject?.id === p.id ? 'border-blue-600 ring-4 ring-blue-50 shadow-xl' : 'border-slate-100 hover:border-slate-300'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase">{p.desc_stage || 'Idea'}</span>
                <span className="text-[8px] font-black text-slate-400 uppercase">#{p.id.slice(0,6)}</span>
              </div>
              <h4 className="font-black text-slate-900 uppercase leading-tight group-hover:text-blue-600 transition">{p.name}</h4>
              <p className="text-[10px] text-slate-500 font-bold mt-2 truncate">{p.summary_vision}</p>
              <div className="mt-4 flex justify-between items-center text-blue-600 font-black text-[11px]">
                <span>${p.summary_amount?.toLocaleString()}</span>
                <span>{p.model_equity}% Eq.</span>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="py-20 text-center border-4 border-dashed rounded-[2.5rem] border-slate-100 opacity-40 font-black uppercase text-xs">
              Sin solicitudes activas
            </div>
          )}
        </div>

        {/* Detalle y Espacio de Feedback */}
        <div className="lg:col-span-2">
          {selectedProject ? (
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-fade-in">
              <div className="p-8 sm:p-12 border-b border-slate-50">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tighter">{selectedProject.name}</h3>
                    <p className="text-xs font-bold text-blue-600 uppercase mt-1">Ubicación: {selectedProject.desc_location || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Monto Requerido</span>
                    <span className="text-xl font-black text-slate-900">${selectedProject.summary_amount?.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-6">
                    <div>
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b pb-1">Problema / Solución</h5>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        <span className="font-bold text-slate-900">Problema:</span> {selectedProject.summary_problem} <br /><br />
                        <span className="font-bold text-slate-900">Solución:</span> {selectedProject.summary_solution}
                      </p>
                    </div>
                    <div>
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b pb-1">Modelo de Negocio</h5>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">{selectedProject.summary_business_model}</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                      <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">Variables Financieras</h5>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Acciones Ofrecidas</span>
                          <span className="text-xs font-black text-slate-900">{selectedProject.model_equity}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Val. Pre-Money</span>
                          <span className="text-xs font-black text-slate-900">${selectedProject.model_pre_money?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">ROI Estimado</span>
                          <span className="text-xs font-black text-green-600">{selectedProject.summary_roi}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                       <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b pb-1">Uso de Fondos</h5>
                       <p className="text-xs text-slate-600 font-medium italic">{selectedProject.summary_use_of_funds}</p>
                    </div>
                  </div>
                </div>

                {/* Espacio para Feedback / Anotaciones */}
                <div className="pt-8 border-t border-slate-100">
                  <h4 className="text-lg font-black text-slate-900 uppercase mb-4 flex items-center gap-2">
                    <span className="text-blue-600">📝</span> Anotaciones de Feedback al Usuario
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">Tus comentarios serán visibles para el creador del proyecto como guía profesional.</p>
                  <textarea 
                    className="w-full p-6 rounded-[2rem] border-2 border-slate-100 bg-slate-50/50 outline-none focus:border-blue-400 focus:bg-white transition-all text-sm font-medium min-h-[200px]"
                    placeholder="Escribe aquí tu análisis detallado, sugerencias de mejora o dudas técnicas..."
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                  />
                  <div className="mt-6 flex justify-end gap-4">
                    <button 
                      onClick={() => setSelectedProject(null)}
                      className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition"
                    >
                      Cerrar Vista
                    </button>
                    <button 
                      disabled={isSubmitting || !feedbackText.trim()}
                      onClick={handleSubmitFeedback}
                      className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition active:scale-95 disabled:opacity-30"
                    >
                      {isSubmitting ? 'Enviando...' : 'Enviar Feedback Profesional'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full bg-white/50 rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center p-20 text-center opacity-40">
              <div className="text-6xl mb-6">🔍</div>
              <h3 className="text-xl font-black uppercase tracking-widest text-slate-300">Selecciona un proyecto para analizar</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackRequests;
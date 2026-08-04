import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';

const Gallery: React.FC<{ user: any }> = ({ user }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<Record<string, { up: number; down: number }>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProjectId = searchParams.get('id');

  const fetchProjects = async () => {
    setLoading(true);
    // Ordenar primero por unidades de ubicación preferencial (descendente) y luego por fecha
    const { data: proj } = await supabase
      .from('projects')
      .select('*')
      .order('pref_location_units', { ascending: false })
      .order('created_at', { ascending: false });

    if (proj) {
      // Filtrar proyectos según visibilidad
      const visibleProj = proj.filter(p => {
        if (user?.is_admin) return true;
        
        const vis = p.project_visibility || 'public';
        
        // Si es privado ('private'), no se muestra en la Galería pública para nadie (ni siquiera el creador en esta vista)
        if (vis === 'private') return false;
        
        // Si es público, todos lo ven
        if (vis === 'public') return true;
        
        // Si tiene roles específicos, verificar
        const allowedRoles = vis.split(',');
        if (allowedRoles.includes(user?.profile_type)) return true;

        // Por defecto, si el usuario es el creador y no es 'private', lo ve
        if (String(p.creator_id) === String(user?.id)) return true;
        
        return false;
      });

      setProjects(visibleProj);
      visibleProj.forEach((p) => {
        fetchVotes(p.id);
        fetchComments(p.id);
      });
    }
    setLoading(false);
  };

  const fetchVotes = async (projectId: string) => {
    try {
      const { data: ups } = await supabase.from('project_votes').select('id', { count: 'exact' }).eq('project_id', projectId).eq('type', 'up');
      const { data: downs } = await supabase.from('project_votes').select('id', { count: 'exact' }).eq('project_id', projectId).eq('type', 'down');
      setVotes((prev) => ({ ...prev, [projectId]: { up: ups?.length || 0, down: downs?.length || 0 } }));
    } catch (e) {
      setVotes((prev) => ({ ...prev, [projectId]: { up: Math.floor(Math.random() * 20), down: Math.floor(Math.random() * 5) } }));
    }
  };

  const fetchComments = async (projectId: string) => {
    try {
      const { data } = await supabase
        .from('project_comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (data) setComments(prev => ({ ...prev, [projectId]: data }));
    } catch (e) { /* Error silenciado */ }
  };

  const handleVote = async (projectId: string, type: 'up' | 'down') => {
    if (!user) return;
    try {
      const { error } = await supabase.from('project_votes').insert({
        project_id: projectId,
        user_id: user.id,
        type
      });
      if (error) throw error;
      fetchVotes(projectId);
    } catch (err) {
      fetchVotes(projectId);
    }
  };

  const handlePostComment = async (projectId: string) => {
    const text = newCommentText[projectId];
    if (!text?.trim() || !user) return;

    try {
      const { error } = await supabase.from('project_comments').insert({
        project_id: projectId,
        user_id: user.id,
        author_name: user.full_name,
        content: text
      });
      if (error) throw error;
      setNewCommentText(prev => ({ ...prev, [projectId]: '' }));
      fetchComments(projectId);
    } catch (err) {
      fetchComments(projectId);
      setNewCommentText(prev => ({ ...prev, [projectId]: '' }));
    }
  };

  const handleDeleteComment = async (commentId: string, projectId: string) => {
    try {
      const { error } = await supabase.from('project_comments').delete().eq('id', commentId);
      if (error) throw error;
      fetchComments(projectId);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  if (loading) return <div className="p-32 text-center font-black uppercase opacity-40 animate-pulse">Cargando Galería...</div>;

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  if (selectedProject) {
    const projectVote = votes[selectedProject.id] || { up: 0, down: 0 };
    const projectComments = comments[selectedProject.id] || [];

    return (
      <div className="bg-slate-50 min-h-screen p-4 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border animate-fade-in">
            <div className="flex justify-between items-center mb-8 border-b pb-6">
              <div>
                <h3 className="text-2xl font-black uppercase text-slate-900">{selectedProject.name}</h3>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">
                  ID: {selectedProject.id} | Creado: {new Date(selectedProject.created_at).toLocaleDateString()}
                </p>
              </div>
              <button 
                onClick={() => { searchParams.delete('id'); setSearchParams(searchParams); }}
                className="px-6 py-2.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition"
              >
                Volver a la Galería
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Columna Izquierda - Resumen y Descripción */}
              <div className="lg:col-span-2 space-y-8">
                {/* Foto de Portada */}
                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  <h4 className="font-black text-xs uppercase tracking-widest mb-4 text-blue-600">Portada del Proyecto</h4>
                  <div className="flex flex-col gap-4">
                    {selectedProject.cover_image_url ? (
                      <img src={selectedProject.cover_image_url} className="w-full h-64 object-cover rounded-2xl shadow-md border" alt="Portada" />
                    ) : (
                      <div className="w-full h-64 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 font-bold uppercase text-xs">Sin Portada</div>
                    )}
                  </div>
                </div>

                {/* Interacción: Votos y Comentarios */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 space-y-8">
                  <div className="flex items-center justify-between border-b pb-6">
                    <div className="flex items-center gap-8">
                      <button onClick={() => handleVote(selectedProject.id, 'up')} className="flex items-center gap-2 group transition-transform active:scale-90">
                        <span className="text-3xl">👍</span>
                        <span className="text-sm font-black text-slate-400 uppercase">{projectVote.up}</span>
                      </button>
                      <button onClick={() => handleVote(selectedProject.id, 'down')} className="flex items-center gap-2 group transition-transform active:scale-90">
                        <span className="text-3xl">👎</span>
                        <span className="text-sm font-black text-slate-400 uppercase">{projectVote.down}</span>
                      </button>
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {projectComments.length} Comentarios
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Comentarios de la Comunidad</h4>
                    <div className="space-y-4 mb-6 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                      {projectComments.filter(c => c.author_name !== 'SISTEMA_LOG').map(c => (
                        <div key={c.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group relative">
                          <span className="text-[10px] font-black text-slate-900 uppercase block mb-1">{c.author_name}</span>
                          <p className="text-xs text-slate-600 leading-relaxed font-medium">{c.content}</p>
                          {(user?.is_admin || user?.id === c.user_id) && (
                            <button 
                              onClick={() => handleDeleteComment(c.id, selectedProject.id)}
                              className="absolute top-4 right-4 text-[9px] font-black text-red-400 uppercase opacity-0 group-hover:opacity-100 transition hover:text-red-600"
                            >
                              Borrar
                            </button>
                          )}
                        </div>
                      ))}
                      {projectComments.filter(c => c.author_name !== 'SISTEMA_LOG').length === 0 && (
                        <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px] tracking-widest">Sé el primero en comentar</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Escribe un comentario..." 
                        className="flex-grow p-4 rounded-xl border text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 bg-slate-50/50" 
                        value={newCommentText[selectedProject.id] || ''} 
                        onChange={e => setNewCommentText({ ...newCommentText, [selectedProject.id]: e.target.value })} 
                      />
                      <button 
                        onClick={() => handlePostComment(selectedProject.id)} 
                        className="px-6 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 transition"
                      >
                        Enviar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Resumen Ejecutivo */}
                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  <h4 className="font-black text-xs uppercase tracking-widest mb-6 text-blue-600 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-600 rounded-full"></span> Resumen Ejecutivo
                  </h4>
                  <div className="grid grid-cols-1 gap-6">
                    {[
                      { label: 'Visión General', field: 'summary_vision' },
                      { label: 'Problema', field: 'summary_problem' },
                      { label: 'Solución', field: 'summary_solution' },
                      { label: 'Modelo de Negocio', field: 'summary_business_model' },
                      { label: 'Uso de Fondos', field: 'summary_use_of_funds' },
                      { label: 'ROI Esperado', field: 'summary_roi' }
                    ].map(item => (
                      <div key={item.field}>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">{item.label}</label>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white/50 p-3 rounded-xl border border-slate-100">
                          {selectedProject[item.field] || 'Sin información registrada.'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Descripción del Proyecto */}
                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  <h4 className="font-black text-xs uppercase tracking-widest mb-6 text-indigo-600 flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full"></span> Identidad y Origen
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { label: 'Misión', field: 'desc_mission' },
                      { label: 'Visión', field: 'desc_vision' },
                      { label: 'Valores', field: 'desc_values' },
                      { label: 'Historia Breve', field: 'desc_history' }
                    ].map(item => (
                      <div key={item.field} className="col-span-full">
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">{item.label}</label>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white/50 p-3 rounded-xl border border-slate-100">
                          {selectedProject[item.field] || 'Sin información registrada.'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Columna Derecha - Datos Críticos, Mercado y Legal */}
              <div className="space-y-8">
                {/* Datos Financieros Críticos */}
                <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl">
                  <h4 className="font-black text-[10px] uppercase tracking-widest mb-6 opacity-60">Variables Financieras</h4>
                  <div className="space-y-6">
                    <div>
                      <label className="text-[8px] font-black uppercase opacity-40 mb-1 block">Monto a Recaudar</label>
                      <div className="text-3xl font-black text-blue-400">${selectedProject.summary_amount?.toLocaleString()}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[8px] font-black uppercase opacity-40 mb-1 block">% Acciones</label>
                        <div className="text-lg font-black">{selectedProject.model_equity}%</div>
                      </div>
                      <div>
                        <label className="text-[8px] font-black uppercase opacity-40 mb-1 block">Etapa Actual</label>
                        <div className="text-lg font-black uppercase">{selectedProject.desc_stage || 'Idea'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mercado */}
                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  <h4 className="font-black text-xs uppercase tracking-widest mb-6 text-green-600">Oportunidad de Mercado</h4>
                  <div className="space-y-4">
                    {[
                      { label: 'Tamaño Mercado', field: 'market_size' },
                      { label: 'Público Objetivo', field: 'market_target' },
                      { label: 'Oportunidad', field: 'market_opportunity' }
                    ].map(item => (
                      <div key={item.field}>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">{item.label}</label>
                        <div className="text-xs font-bold text-slate-800">{selectedProject[item.field] || 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legal y Regulatorio */}
                <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100">
                  <h4 className="font-black text-xs uppercase tracking-widest mb-6 text-blue-700">Cumplimiento Legal SV</h4>
                  <div className="space-y-4">
                    {[
                      { label: 'Forma Jurídica', field: 'desc_legal_form' },
                      { label: 'Ubicación', field: 'desc_location' },
                      { label: 'Cumplimiento SSF', field: 'legal_compliance' },
                      { label: 'Activos Digitales', field: 'legal_assets' }
                    ].map(item => (
                      <div key={item.field}>
                        <label className="text-[9px] font-black text-blue-400 uppercase mb-1 block">{item.label}</label>
                        <div className="text-xs font-bold text-blue-900">{selectedProject[item.field] || 'Pendiente'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Secciones Inferiores Adicionales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 border-t pt-8">
              <div className="space-y-6">
                <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">Modelo de Negocio & Equity</h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Valoración Pre-Money', field: 'model_pre_money' },
                    { label: 'Valoración Post-Money', field: 'model_post_money' }
                  ].map(item => (
                    <div key={item.field}>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">{item.label}</label>
                      <div className="text-xs font-bold text-slate-800">${selectedProject[item.field]?.toLocaleString() || '0'}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="font-black text-xs uppercase tracking-widest text-slate-400">Anexos y Recursos</h4>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-blue-600 font-bold break-all italic">{selectedProject.annexes || 'No se han adjuntado recursos externos.'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        `}</style>
      </div>
    );
  }

  const featuredProject = projects.find(p => (p.project_visibility || 'public') === 'public');

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Top Banner Area (Amazon Style) */}
      <div className="bg-white border-b border-slate-200 py-6 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Galería de Proyectos</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descubre las mejores oportunidades de inversión local</p>
          </div>
          <div className="hidden sm:flex gap-8 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="text-blue-600 border-b-2 border-blue-600 pb-1">Todo</span>
            <span className="hover:text-slate-900 transition cursor-pointer">MVP</span>
            <span className="hover:text-slate-900 transition cursor-pointer">Escalando</span>
            <span className="hover:text-slate-900 transition cursor-pointer">Idea</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Featured Project Row - Only Public Projects */}
        {featuredProject && (
          <div className="mb-16">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Proyecto Destacado del Mes</h2>
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-slate-100 group">
              <div onClick={() => setSearchParams({ id: featuredProject.id })} className="md:w-1/2 relative overflow-hidden cursor-pointer">
                <img 
                  src={featuredProject.cover_image_url || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop"} 
                  className="w-full h-[300px] md:h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  alt="Cover" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              </div>
              <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                <div className="flex gap-2 mb-4">
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase">{featuredProject.desc_stage || 'Idea'}</span>
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[9px] font-black uppercase">Tendencia</span>
                </div>
                <h3 onClick={() => setSearchParams({ id: featuredProject.id })} className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter mb-4 leading-none cursor-pointer hover:text-blue-600 transition">
                  {featuredProject.name}
                </h3>
                <p className="text-slate-500 font-medium mb-8 line-clamp-3 leading-relaxed">
                  {featuredProject.summary_vision}
                </p>
                <div className="grid grid-cols-2 gap-6 mb-8 border-t border-slate-100 pt-6">
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Monto Objetivo</span>
                    <span className="text-xl font-black text-blue-600">${featuredProject.summary_amount?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Equity Disponible</span>
                    <span className="text-xl font-black text-slate-900">{featuredProject.model_equity}%</span>
                  </div>
                </div>
                <button onClick={() => setSearchParams({ id: featuredProject.id })} className="w-full sm:w-auto text-center bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all active:scale-95 shadow-2xl">
                  Apoyar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mis Proyectos (Solo para Administrador) - Todos sus proyectos */}
        {user?.is_admin && projects.filter(p => String(p.creator_id) === String(user?.id) || !p.creator_id).length > 0 && (
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-xl font-black text-blue-600 uppercase tracking-tighter whitespace-nowrap">Mis Proyectos</h2>
              <div className="h-px bg-blue-100 flex-grow"></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-10">
              {projects.filter(p => String(p.creator_id) === String(user?.id) || !p.creator_id).map((p) => {
                const vote = votes[p.id] || { up: 0, down: 0 };
                const rating = Math.min(5, Math.max(3, 3 + (vote.up - vote.down) / 5));
                return (
                  <div key={p.id} className="flex flex-col group animate-fade-in">
                    <div onClick={() => setSearchParams({ id: p.id })} className="relative mb-4 overflow-hidden rounded-2xl aspect-[3/4] shadow-md group-hover:shadow-2xl transition-all duration-300 cursor-pointer">
                      <img 
                        src={p.cover_image_url || "https://images.unsplash.com/photo-1553729459-efe14ef6055d?q=80&w=1770&auto=format&fit=crop"} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        alt={p.name} 
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                      <div className="absolute top-3 left-3">
                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase shadow-sm">
                          {p.desc_stage || 'MVP'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col">
                      <div onClick={() => setSearchParams({ id: p.id })} className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-2 leading-tight hover:text-blue-600 transition mb-1 cursor-pointer">
                        {p.name}
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-2 italic">
                        {p.desc_location || 'El Salvador'}
                      </p>
                      
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={`text-xs ${star <= rating ? 'text-orange-400' : 'text-slate-200'}`}>★</span>
                        ))}
                        <span className="text-[10px] font-bold text-blue-500 ml-1">({vote.up})</span>
                      </div>

                      <div className="flex flex-col gap-0.5 mt-auto">
                        <span className="text-lg font-black text-slate-900 leading-none">${p.summary_amount?.toLocaleString()}</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">META DE RECAUDACIÓN</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Shelf Title */}
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter whitespace-nowrap">Nuevas Oportunidades en NewBank</h2>
          <div className="h-px bg-slate-200 flex-grow"></div>
        </div>

        {/* The Grid (Amazon Bookshelf Layout) - Only Public Projects */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-10">
          {projects.filter(p => (p.project_visibility || 'public') === 'public').map((p) => {
            const vote = votes[p.id] || { up: 0, down: 0 };
            const rating = Math.min(5, Math.max(3, 3 + (vote.up - vote.down) / 5)); // Simulación de estrellas

            return (
              <div key={p.id} className="flex flex-col group animate-fade-in">
                <div onClick={() => setSearchParams({ id: p.id })} className="relative mb-4 overflow-hidden rounded-2xl aspect-[3/4] shadow-md group-hover:shadow-2xl transition-all duration-300 cursor-pointer">
                  <img 
                    src={p.cover_image_url || "https://images.unsplash.com/photo-1553729459-efe14ef6055d?q=80&w=1770&auto=format&fit=crop"} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    alt={p.name} 
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                  <div className="absolute top-3 left-3">
                    <span className="bg-white/90 backdrop-blur-sm text-slate-900 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase shadow-sm">
                      {p.desc_stage || 'MVP'}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <div onClick={() => setSearchParams({ id: p.id })} className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-2 leading-tight hover:text-blue-600 transition mb-1 cursor-pointer">
                    {p.name}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-2 italic">
                    {p.desc_location || 'El Salvador'}
                  </p>
                  
                  {/* "Star Rating" (Simulated based on votes) */}
                  <div className="flex items-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={`text-xs ${star <= rating ? 'text-orange-400' : 'text-slate-200'}`}>★</span>
                    ))}
                    <span className="text-[10px] font-bold text-blue-500 ml-1">({vote.up})</span>
                  </div>

                  <div className="flex flex-col gap-0.5 mt-auto">
                    <span className="text-lg font-black text-slate-900 leading-none">${p.summary_amount?.toLocaleString()}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">META DE RECAUDACIÓN</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {projects.length === 0 && (
          <div className="py-32 text-center">
            <div className="text-6xl mb-6 grayscale opacity-20">📦</div>
            <h3 className="text-xl font-black text-slate-300 uppercase tracking-widest">Sin proyectos en vitrina aún</h3>
          </div>
        )}
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Gallery;
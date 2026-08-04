import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

const ProjectsView: React.FC<{ user: any }> = ({ user }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedProjectId = searchParams.get('id');
  
  // Estados para comentarios y votos
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [votes, setVotes] = useState<Record<string, { up: number, down: number }>>({});
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});

  // Estados para Creadores de Proyecto
  const [projectCreators, setProjectCreators] = useState<Record<string, any[]>>({});
  const [creatorSearchQuery, setCreatorSearchQuery] = useState<Record<string, string>>({});
  const [creatorSearchResults, setCreatorSearchResults] = useState<Record<string, any[]>>({});
  
  // Estados para Feedback Request Flow
  const [feedbackProjectId, setFeedbackProjectId] = useState<string | null>(null);
  const [feedbackStep, setFeedbackStep] = useState<1 | 2>(1);
  const [selectedSpecialty, setSelectedSpecialty] = useState<'Legal' | 'Tecnológica' | 'Financiera' | null>(null);
  const [specialistResults, setSpecialistResults] = useState<any[]>([]);
  const [selectedSpecialistForFeedback, setSelectedSpecialistForFeedback] = useState<any | null>(null);
  const [feedbackQuestions, setFeedbackQuestions] = useState<string>('');
  const [requestLoading, setRequestLoading] = useState(false);

  // Estados para Edición
  const [isEditing, setIsEditing] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);

  // Estados para creación de proyecto (como en Admin)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>('resumen');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newProject, setNewProject] = useState<any>({
    name: '',
    project_visibility: 'public',
    comment_visibility: 'public',
    cover_image_url: '',
    summary_vision: '',
    summary_problem: '',
    summary_solution: '',
    summary_business_model: '',
    summary_amount: 0,
    summary_use_of_funds: '',
    summary_roi: '',
    desc_mission: '',
    desc_vision: '',
    desc_values: '',
    desc_history: '',
    desc_stage: '',
    desc_legal_form: '',
    desc_location: '',
    market_size: '',
    market_target: '',
    market_trends: '',
    market_opportunity: '',
    comp_direct: '',
    comp_diff: '',
    prod_desc: '',
    prod_roadmap: '',
    prod_tech: '',
    team_profiles: '',
    team_advisors: '',
    team_org: '',
    model_revenue: '',
    model_equity: 0,
    model_pre_money: 0,
    model_post_money: 0,
    model_rights: '',
    model_exit: '',
    marketing_attraction: '',
    marketing_strategy: '',
    marketing_channels: '',
    ops_timeline: '',
    ops_resources: '',
    ops_risks: '',
    fin_use_funds: '',
    fin_projections: '',
    fin_break_even: '',
    fin_scenarios: '',
    legal_compliance: '',
    legal_assets: '',
    legal_fintech: '',
    legal_contracts: '',
    legal_kyc: '',
    legal_taxes: '',
    risks_reg: '',
    risks_market: '',
    risks_ops: '',
    risks_fin: '',
    risks_contingency: '',
    annexes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    const { data: proj } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (proj) {
      setProjects(proj);
      proj.forEach(p => {
        fetchComments(p.id);
        fetchVotes(p.id);
        fetchCreators(p.id);
      });
    }
    if (prof) {
      setProfile(prof);
      console.log('ProjectsView - User Profile:', prof);
    }
    setLoading(false);
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

  const fetchVotes = async (projectId: string) => {
    try {
      const { data: ups } = await supabase.from('project_votes').select('id', { count: 'exact' }).eq('project_id', projectId).eq('type', 'up');
      const { data: downs } = await supabase.from('project_votes').select('id', { count: 'exact' }).eq('project_id', projectId).eq('type', 'down');
      setVotes(prev => ({ ...prev, [projectId]: { up: ups?.length || 0, down: downs?.length || 0 } }));
    } catch (e) { 
      setVotes(prev => ({ ...prev, [projectId]: { up: Math.floor(Math.random() * 20), down: Math.floor(Math.random() * 5) } }));
    }
  };

  const fetchCreators = async (projectId: string) => {
    try {
      const { data } = await supabase
        .from('project_creators')
        .select(`
          id,
          profile:profiles(*)
        `)
        .eq('project_id', projectId);
      if (data) setProjectCreators(prev => ({ ...prev, [projectId]: data.map(d => d.profile) }));
    } catch (e) { /* Error silenciado */ }
  };

  const handleProjectImageUpload = async (file: File, isEdit: boolean = false) => {
    setActionLoading(isEdit ? 'uploading-edit-image' : 'uploading-project-image');
    try {
      const reader = new FileReader();
      const webpUrl = await new Promise<string>((resolve, reject) => {
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target?.result as string;
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const webpData = canvas.toDataURL('image/webp', 0.8);
            const byteChars = atob(webpData.split(',')[1]);
            const bytes = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
            const fileName = `cover_${Date.now()}.webp`;
            const { error } = await supabase.storage.from('newBankPortadaProyecto').upload(fileName, new Blob([bytes], { type: 'image/webp' }));
            if (error) reject(error);
            else resolve(supabase.storage.from('newBankPortadaProyecto').getPublicUrl(fileName).data.publicUrl);
          };
        };
      });

      if (isEdit) {
        setEditProject(prev => ({ ...prev, cover_image_url: webpUrl }));
      } else {
        setNewProject(prev => ({ ...prev, cover_image_url: webpUrl }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const closeFeedbackModal = () => {
    setFeedbackProjectId(null);
    setFeedbackStep(1);
    setSelectedSpecialty(null);
    setSpecialistResults([]);
    setSelectedSpecialistForFeedback(null);
    setFeedbackQuestions('');
  };

  useEffect(() => {
    if (feedbackStep === 2 && selectedSpecialty) {
      const loadSpecialists = async () => {
        setRequestLoading(true);
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, dui, profile_image_url, reliability_score, email')
            .order('reliability_score', { ascending: false })
            .limit(10);
          
          if (data) setSpecialistResults(data);
        } catch (err) {
          console.error(err);
        } finally {
          setRequestLoading(false);
        }
      };
      loadSpecialists();
    }
  }, [feedbackStep, selectedSpecialty]);

  const submitFeedbackRequest = async () => {
    if (!feedbackProjectId || !selectedSpecialty || !selectedSpecialistForFeedback) return;
    setRequestLoading(true);
    try {
      await supabase.from('project_creators').insert({
        project_id: feedbackProjectId,
        user_id: selectedSpecialistForFeedback.id
      });

      await supabase.from('project_comments').insert([
        {
          project_id: feedbackProjectId,
          author_name: 'SISTEMA_LOG',
          content: `[FEEDBACK_LOG:${selectedSpecialty}:${selectedSpecialistForFeedback.full_name}:${selectedSpecialistForFeedback.id}:${selectedSpecialistForFeedback.profile_image_url || ''}]`
        },
        {
          project_id: feedbackProjectId,
          author_name: user.full_name,
          content: `❓ PREGUNTAS PARA EL ESPECIALISTA (${selectedSpecialty}):\n${feedbackQuestions}`
        }
      ]);

      fetchComments(feedbackProjectId);
      fetchCreators(feedbackProjectId);

      // Send email and push notification
      if (selectedSpecialistForFeedback.email || selectedSpecialistForFeedback.id) {
        fetch('/api/notify-specialist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            specialistId: selectedSpecialistForFeedback.id,
            specialistEmail: selectedSpecialistForFeedback.email,
            specialistName: selectedSpecialistForFeedback.full_name,
            requesterName: user.full_name,
            requestType: 'Feedback Técnico',
            projectTitle: projects.find(p => p.id === feedbackProjectId)?.name
          })
        }).catch(err => console.error("Notification failed:", err));
      }

      closeFeedbackModal();
    } catch (err) {
      console.error(err);
    } finally {
      setRequestLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const handlePostComment = async (projectId: string) => {
    const text = newCommentText[projectId];
    if (!text?.trim()) return;

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

  const handleVote = async (projectId: string, type: 'up' | 'down') => {
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

  const handleCreateProject = async () => {
    if (!profile.is_admin && (profile.store_diamonds || 0) < 10) {
      return;
    }

    setActionLoading('creating-project');
    try {
      const { error } = await supabase.from('projects').insert({
        ...newProject,
        creator_id: user.id
      });
      if (error) throw error;

      if (!profile.is_admin) {
        const { error: diamondErr } = await supabase
          .from('profiles')
          .update({ store_diamonds: profile.store_diamonds - 10 })
          .eq('id', user.id);
        if (diamondErr) throw diamondErr;
      }

      setShowCreateForm(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateProject = async () => {
    if (!editProject) return;
    setActionLoading('updating-project');
    try {
      const { error } = await supabase
        .from('projects')
        .update(editProject)
        .eq('id', editProject.id);
      if (error) throw error;
      setIsEditing(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignItem = async (targetProjectId: string, type: 'insignia' | 'ubicacion' | 'feedback') => {
    if (!targetProjectId || !profile) return;
    const proj = projects.find(p => p.id === targetProjectId);
    if (!proj) return;
    
    setActionLoading('assigning');
    try {
      const pUpdates: any = {};
      const projUpdates: any = {};
      
      if (type === 'insignia') {
        if ((profile.project_trust_insignia_count || 0) < 25) { setActionLoading(null); return; }
        if (proj.has_trust_insignia) { setActionLoading(null); return; }
        pUpdates.project_trust_insignia_count = profile.project_trust_insignia_count - 25;
        projUpdates.has_trust_insignia = true;
      } else if (type === 'ubicacion') {
        const amountStr = prompt(`¿Cuántas unidades de ubicación preferencial deseas asignar? (Disponibles: ${profile.pref_location_count})`);
        const amount = parseInt(amountStr || '0');
        if (isNaN(amount) || amount <= 0 || amount > (profile.pref_location_count || 0)) { setActionLoading(null); return; }
        pUpdates.pref_location_count = profile.pref_location_count - amount;
        projUpdates.pref_location_units = (proj.pref_location_units || 0) + amount;
        projUpdates.is_preferential = true;
      } else if (type === 'feedback') {
        if (!profile.feedback_count || profile.feedback_count <= 0) {
          navigate('/store');
          return;
        }
        setFeedbackProjectId(targetProjectId);
        setFeedbackStep(1);
        setSelectedSpecialty(null);
        setSelectedSpecialistForFeedback(null);
        setFeedbackQuestions('');
        setActionLoading(null);
        return;
      }

      const { error: profErr } = await supabase.from('profiles').update(pUpdates).eq('id', user.id);
      if (profErr) throw profErr;
      
      const { error: projErr } = await supabase.from('projects').update(projUpdates).eq('id', targetProjectId);
      if (projErr) throw projErr;

      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleVisibility = async (projectId: string, currentVisibility: string | null | undefined) => {
    if (actionLoading) return;
    setActionLoading('toggling-visibility');
    try {
      // Cambiamos entre 'public' y 'private' (según lo solicitado por el usuario)
      const newVisibility = currentVisibility === 'private' ? 'public' : 'private';
      
      const { error } = await supabase
        .from('projects')
        .update({ project_visibility: newVisibility })
        .eq('id', projectId);
        
      if (error) throw error;
      
      // Actualización optimista del estado local
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, project_visibility: newVisibility } : p));
    } catch (err) {
      console.error('Error toggling visibility:', err);
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const toggleAccordion = (section: string) => {
    setOpenAccordion(openAccordion === section ? null : section);
  };

  if (loading && !showCreateForm) return <div className="p-20 text-center animate-pulse font-black uppercase opacity-40">Cargando Oportunidades...</div>;

  const canCreate = profile?.is_admin || (profile?.store_diamonds || 0) >= 10;

  const filteredProjects = projects.filter(p => {
    if (profile?.is_admin) return true;
    if (String(p.creator_id) === String(user.id)) return true;
    const vis = p.project_visibility || 'public';
    if (vis === 'public') return true;
    const allowedRoles = vis.split(',');
    if (allowedRoles.includes(user.profile_type)) return true;
    if (projectCreators[p.id]?.some(c => String(c.id) === String(user.id))) return true;
    return false;
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const canEdit = selectedProject && (String(selectedProject.creator_id) === String(user.id) || profile?.is_admin);

  const startEditing = () => {
    setEditProject({ ...selectedProject });
    setIsEditing(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* AREA DE INVENTARIO DEL USUARIO */}
      <div className="mb-10 flex flex-wrap items-center gap-4 justify-center md:justify-start">
         <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Tu Inventario:</div>
         <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 hover:scale-105 transition-transform">
            <span className="text-xl animate-spin-slow">🔍</span>
            <div className="flex flex-col">
               <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Unidades de Visión</span>
               <span className="text-sm font-black text-indigo-600">{profile?.project_vision_units || 0}</span>
            </div>
         </div>
         <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 hover:scale-105 transition-transform">
            <span className="text-xl animate-pulse">🛡️</span>
            <div className="flex flex-col">
               <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Insignia de Confianza en proyecto</span>
               <span className="text-sm font-black text-green-600">{profile?.project_trust_insignia_count || 0}</span>
            </div>
         </div>
         <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 hover:scale-105 transition-transform">
            <span className="text-xl animate-bounce">📍</span>
            <div className="flex flex-col">
               <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Unidades de ubicación preferencial</span>
               <span className="text-sm font-black text-purple-600">{profile?.pref_location_count || 0}</span>
            </div>
         </div>
         <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 hover:scale-105 transition-transform">
            <span className="text-xl animate-pulse">💬</span>
            <div className="flex flex-col">
               <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Unidades de Comprar Feedback</span>
               <span className="text-sm font-black text-yellow-600">{profile?.feedback_count || 0}</span>
            </div>
         </div>
      </div>

      {selectedProject ? (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border">
            <div className="flex justify-between items-center mb-8 border-b pb-6">
              <div>
                {isEditing ? (
                  <input 
                    type="text" 
                    className="text-2xl font-black uppercase text-slate-900 border-b border-blue-600 outline-none w-full bg-blue-50/50 p-2 rounded"
                    value={editProject.name}
                    onChange={e => setEditProject({...editProject, name: e.target.value})}
                  />
                ) : (
                  <h3 className="text-2xl font-black uppercase text-slate-900">{selectedProject.name}</h3>
                )}
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">
                  ID: {selectedProject.id} | Creado: {new Date(selectedProject.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-3">
                {!isEditing && (
                  <button 
                    onClick={() => fetchData()}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 transition"
                  >
                    Actualizar
                  </button>
                )}
                {canEdit && !isEditing && (
                  <button 
                    onClick={startEditing}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition"
                  >
                    Editar Proyecto
                  </button>
                )}
                {isEditing && (
                  <>
                    <button 
                      onClick={handleUpdateProject}
                      disabled={actionLoading === 'updating-project'}
                      className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-green-100 hover:bg-green-700 transition"
                    >
                      {actionLoading === 'updating-project' ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="px-6 py-2.5 bg-red-100 text-red-700 border border-red-200 rounded-xl text-[10px] font-black uppercase hover:bg-red-200 transition"
                    >
                      Cancelar
                    </button>
                  </>
                )}
                <button 
                  onClick={() => { searchParams.delete('id'); setSearchParams(searchParams); setIsEditing(false); }}
                  className="px-6 py-2.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition"
                >
                  Volver a la Lista
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  <h4 className="font-black text-xs uppercase tracking-widest mb-4 text-blue-600">Portada del Proyecto</h4>
                  <div className="flex flex-col gap-4">
                    {isEditing ? (
                      <div className="space-y-4">
                        {(editProject.cover_image_url || selectedProject.cover_image_url) && (
                          <img src={editProject.cover_image_url || selectedProject.cover_image_url || undefined} className="w-full h-64 object-cover rounded-2xl shadow-md border" alt="Portada" />
                        )}
                        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border-2 border-dashed border-blue-200">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="text-[10px] font-black uppercase"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleProjectImageUpload(file, true);
                            }}
                          />
                          {actionLoading === 'uploading-edit-image' && <span className="animate-pulse text-[9px] font-black text-blue-600">Subiendo...</span>}
                        </div>
                      </div>
                    ) : (
                      selectedProject.cover_image_url ? (
                        <img src={selectedProject.cover_image_url || undefined} className="w-full h-64 object-cover rounded-2xl shadow-md border" alt="Portada" />
                      ) : (
                        <div className="w-full h-64 bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 font-bold uppercase text-xs">Sin Portada</div>
                      )
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  { (String(selectedProject.creator_id) === String(user.id) || profile?.is_admin) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                      <button onClick={() => handleAssignItem(selectedProject.id, 'insignia')} disabled={!profile?.project_trust_insignia_count || (profile?.project_trust_insignia_count < 25) || selectedProject.has_trust_insignia} className="flex flex-col items-center gap-1 p-4 bg-white border-2 border-green-100 rounded-2xl hover:border-green-500 transition disabled:opacity-30 group">
                        <span className="text-2xl">🛡️</span>
                        <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-green-600 text-center">Asignar Insignia de Confianza en proyecto</span>
                        <span className="text-[10px] font-black text-green-600">Posees: {profile?.project_trust_insignia_count || 0}</span>
                        <span className="text-[7px] font-black text-slate-400">Costo: 25 unidades</span>
                        {selectedProject.has_trust_insignia && <span className="text-[7px] font-black bg-green-500 text-white px-1.5 rounded uppercase">Asignada</span>}
                      </button>
                      <button onClick={() => handleAssignItem(selectedProject.id, 'ubicacion')} disabled={!profile?.pref_location_count} className="flex flex-col items-center gap-1 p-4 bg-white border-2 border-purple-100 rounded-2xl hover:border-purple-500 transition disabled:opacity-30 group">
                        <span className="text-2xl">📍</span>
                        <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-purple-600 text-center">Asignar Unidades de ubicación preferencial</span>
                        <span className="text-[10px] font-black text-purple-600">Posees: {profile?.pref_location_count || 0}</span>
                        {selectedProject.pref_location_units > 0 && <span className="text-[7px] font-black bg-purple-500 text-white px-1.5 rounded uppercase">Asignadas: {selectedProject.pref_location_units}</span>}
                      </button>
                      <button onClick={() => handleAssignItem(selectedProject.id, 'feedback')} disabled={!profile?.feedback_count} className="flex flex-col items-center gap-1 p-4 bg-white border-2 border-yellow-100 rounded-2xl hover:border-yellow-500 transition disabled:opacity-30 group">
                        <span className="text-2xl">💬</span>
                        <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-yellow-600 text-center">Asignar Unidades de Comprar Feedback</span>
                        <span className="text-[10px] font-black text-yellow-600">Posees: {profile?.feedback_count || 0}</span>
                        {selectedProject.feedback_units > 0 && <span className="text-[7px] font-black bg-yellow-500 text-white px-1.5 rounded uppercase">Asignadas: {selectedProject.feedback_units}</span>}
                      </button>
                    </div>
                  )}
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
                        {isEditing ? (
                          <textarea 
                            className="w-full p-3 rounded-xl border text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500" 
                            rows={3} 
                            value={editProject[item.field] || ''} 
                            onChange={e => setEditProject({...editProject, [item.field]: e.target.value})}
                          />
                        ) : (
                          <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white/50 p-3 rounded-xl border border-slate-100">
                            {selectedProject[item.field] || 'Sin información registrada.'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sección de Respuestas de Feedback */}
                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  <h4 className="font-black text-xs uppercase tracking-widest mb-6 text-indigo-600 flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full"></span> Respuestas de Feedback (Expertos)
                  </h4>
                  <div className="space-y-4">
                    {comments[selectedProject.id]?.filter(c => c.author_name.startsWith('Especialista:')).length > 0 ? (
                      comments[selectedProject.id]
                        .filter(c => c.author_name.startsWith('Especialista:'))
                        .map((c, idx) => (
                          <div key={idx} className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm animate-fade-in">
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">{c.author_name}</span>
                              <span className="text-[8px] font-black text-slate-400 uppercase">{new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                              {c.content}
                            </p>
                          </div>
                        ))
                    ) : (
                      <div className="py-10 text-center border-2 border-dashed rounded-2xl border-slate-200">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Aún no hay respuestas de feedback técnico registradas.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl">
                  <h4 className="font-black text-[10px] uppercase tracking-widest mb-6 opacity-60">Variables Financieras</h4>
                  <div className="space-y-6">
                    <div>
                      <label className="text-[8px] font-black uppercase opacity-40 mb-1 block">Monto a Recaudar</label>
                      {isEditing ? (
                        <input 
                          type="number" 
                          className="bg-white/10 w-full p-3 rounded-xl border border-white/20 text-white font-black text-2xl outline-none"
                          value={Number.isNaN(editProject.summary_amount as any) ? '' : editProject.summary_amount} 
                          onChange={e => setEditProject({...editProject, summary_amount: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})}
                        />
                      ) : (
                        <div className="text-3xl font-black text-blue-400">${selectedProject.summary_amount?.toLocaleString()}</div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[8px] font-black uppercase opacity-40 mb-1 block">% Acciones</label>
                        {isEditing ? (
                          <input 
                            type="number" 
                            className="bg-white/10 w-full p-2 rounded-lg border border-white/20 text-white font-bold text-xs"
                            value={Number.isNaN(editProject.model_equity as any) ? '' : editProject.model_equity} 
                            onChange={e => setEditProject({...editProject, model_equity: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})}
                          />
                        ) : (
                          <div className="text-lg font-black">{selectedProject.model_equity}%</div>
                        )}
                      </div>
                      <div>
                        <label className="text-[8px] font-black uppercase opacity-40 mb-1 block">Etapa Actual</label>
                        {isEditing ? (
                          <input 
                            type="text" 
                            className="bg-white/10 w-full p-2 rounded-lg border border-white/20 text-white font-bold text-xs"
                            value={editProject.desc_stage} 
                            onChange={e => setEditProject({...editProject, desc_stage: e.target.value})}
                          />
                        ) : (
                          <div className="text-lg font-black uppercase">{selectedProject.desc_stage || 'Idea'}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-6">
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tighter italic">Proyectos de Inversión</h2>
              <p className="text-sm text-slate-500 font-bold mt-2 uppercase tracking-widest">Invierte en el futuro de la comunidad</p>
            </div>
            
            <div className="flex items-center gap-4">
              {canCreate && (
                <button 
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className={`px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl transition active:scale-95 ${showCreateForm ? 'bg-slate-200 text-slate-800' : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'}`}
                >
                  {showCreateForm ? 'Cancelar' : profile?.is_admin ? 'Crear Proyecto' : 'Crear Proyecto (10 💎)'}
                </button>
              )}
            </div>
          </div>

          {showCreateForm ? (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border">
              <h3 className="text-xl font-black uppercase mb-8 border-b pb-4">Crear Nuevo Proyecto de Inversión</h3>
              
              <div className="space-y-4">
                {/* Acordeón 1: Resumen Ejecutivo */}
                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => toggleAccordion('resumen')}
                    className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'resumen' ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className="font-black uppercase text-xs tracking-widest text-blue-600">1. Resumen Ejecutivo y Portada</span>
                    <span className={`transform transition-transform ${openAccordion === 'resumen' ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {openAccordion === 'resumen' && (
                    <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-50 animate-fade-in">
                      <div className="md:col-span-2 p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-2">
                         <label className="block text-[10px] font-black text-blue-600 uppercase mb-2">Imagen de Portada (WebP Auto-Convert)</label>
                         <div className="flex items-center gap-4">
                            <input 
                              type="file" 
                              className="text-[10px] font-bold" 
                              accept="image/*"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleProjectImageUpload(file, false);
                              }}
                            />
                            {newProject.cover_image_url && (
                              <img src={newProject.cover_image_url || undefined} className="w-12 h-12 rounded object-cover border border-blue-200" alt="Previa" />
                            )}
                            {actionLoading === 'uploading-project-image' && <span className="animate-pulse text-[9px] font-black text-blue-600 uppercase">Procesando...</span>}
                         </div>
                      </div>
                      <input type="text" placeholder="Nombre del Proyecto" className="p-3 rounded-xl border font-bold text-xs" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
                      <textarea placeholder="Visión General" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_vision} onChange={e => setNewProject({...newProject, summary_vision: e.target.value})} />
                      <textarea placeholder="Qué problema resuelve" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_problem} onChange={e => setNewProject({...newProject, summary_problem: e.target.value})} />
                      <textarea placeholder="Solución propuesta" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_solution} onChange={e => setNewProject({...newProject, summary_solution: e.target.value})} />
                      <textarea placeholder="Modelo de negocio" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_business_model} onChange={e => setNewProject({...newProject, summary_business_model: e.target.value})} />
                      <input type="number" placeholder="Monto a recaudar" className="p-3 rounded-xl border font-bold text-xs" value={Number.isNaN(newProject.summary_amount as any) ? '' : newProject.summary_amount} onChange={e => setNewProject({...newProject, summary_amount: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})} />
                      <textarea placeholder="Uso de fondos" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_use_of_funds} onChange={e => setNewProject({...newProject, summary_use_of_funds: e.target.value})} />
                      <textarea placeholder="Proyecciones clave (ROI)" className="p-3 rounded-xl border text-xs" rows={2} value={newProject.summary_roi} onChange={e => setNewProject({...newProject, summary_roi: e.target.value})} />
                    </div>
                  )}
                </div>

                {/* Acordeón 2: Descripción del Proyecto */}
                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => toggleAccordion('identidad')}
                    className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'identidad' ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className="font-black uppercase text-xs tracking-widest text-indigo-600">2. Identidad y Origen</span>
                    <span className={`transform transition-transform ${openAccordion === 'identidad' ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {openAccordion === 'identidad' && (
                    <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-50 animate-fade-in">
                      <textarea placeholder="Misión" className="p-3 rounded-xl border text-xs" value={newProject.desc_mission} onChange={e => setNewProject({...newProject, desc_mission: e.target.value})} />
                      <textarea placeholder="Visión" className="p-3 rounded-xl border text-xs" value={newProject.desc_vision} onChange={e => setNewProject({...newProject, desc_vision: e.target.value})} />
                      <textarea placeholder="Valores" className="p-3 rounded-xl border text-xs" value={newProject.desc_values} onChange={e => setNewProject({...newProject, desc_values: e.target.value})} />
                      <textarea placeholder="Historia breve" className="p-3 rounded-xl border text-xs" value={newProject.desc_history} onChange={e => setNewProject({...newProject, desc_history: e.target.value})} />
                      <input type="text" placeholder="Etapa actual (MVP, Beta...)" className="p-3 rounded-xl border text-xs" value={newProject.desc_stage} onChange={e => setNewProject({...newProject, desc_stage: e.target.value})} />
                      <input type="text" placeholder="Forma jurídica" className="p-3 rounded-xl border text-xs" value={newProject.desc_legal_form} onChange={e => setNewProject({...newProject, desc_legal_form: e.target.value})} />
                      <input type="text" placeholder="Ubicación" className="p-3 rounded-xl border text-xs" value={newProject.desc_location} onChange={e => setNewProject({...newProject, desc_location: e.target.value})} />
                    </div>
                  )}
                </div>

                {/* Acordeón 3: Mercado y Competencia */}
                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => toggleAccordion('mercado')}
                    className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'mercado' ? 'bg-green-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className="font-black uppercase text-xs tracking-widest text-green-600">3. Mercado y Competencia</span>
                    <span className={`transform transition-transform ${openAccordion === 'mercado' ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {openAccordion === 'mercado' && (
                    <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-50 animate-fade-in">
                      <div className="space-y-3">
                        <input type="text" placeholder="Tamaño mercado objetivo" className="w-full p-3 rounded-xl border text-xs" value={newProject.market_size} onChange={e => setNewProject({...newProject, market_size: e.target.value})} />
                        <input type="text" placeholder="Público objetivo" className="w-full p-3 rounded-xl border text-xs" value={newProject.market_target} onChange={e => setNewProject({...newProject, market_target: e.target.value})} />
                        <textarea placeholder="Tendencias y Oportunidad" className="w-full p-3 rounded-xl border text-xs" value={newProject.market_trends} onChange={e => setNewProject({...newProject, market_trends: e.target.value})} />
                      </div>
                      <div className="space-y-3">
                        <textarea placeholder="Competidores directos" className="w-full p-3 rounded-xl border text-xs" value={newProject.comp_direct} onChange={e => setNewProject({...newProject, comp_direct: e.target.value})} />
                        <textarea placeholder="Diferenciadores" className="w-full p-3 rounded-xl border text-xs" value={newProject.comp_diff} onChange={e => setNewProject({...newProject, comp_diff: e.target.value})} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Acordeón 4: Producto y Equipo */}
                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => toggleAccordion('producto')}
                    className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'producto' ? 'bg-orange-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className="font-black uppercase text-xs tracking-widest text-orange-600">4. Producto y Equipo</span>
                    <span className={`transform transition-transform ${openAccordion === 'producto' ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {openAccordion === 'producto' && (
                    <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-50 animate-fade-in">
                      <div className="space-y-3">
                        <textarea placeholder="Detalle desarrollo acciones" className="w-full p-3 rounded-xl border text-xs" value={newProject.prod_desc} onChange={e => setNewProject({...newProject, prod_desc: e.target.value})} />
                        <textarea placeholder="Roadmap (Fases)" className="w-full p-3 rounded-xl border text-xs" value={newProject.prod_roadmap} onChange={e => setNewProject({...newProject, prod_roadmap: e.target.value})} />
                        <input type="text" placeholder="Tecnología" className="w-full p-3 rounded-xl border text-xs" value={newProject.prod_tech} onChange={e => setNewProject({...newProject, prod_tech: e.target.value})} />
                      </div>
                      <div className="space-y-3">
                        <textarea placeholder="Perfiles equipo" className="w-full p-3 rounded-xl border text-xs" value={newProject.team_profiles} onChange={e => setNewProject({...newProject, team_profiles: e.target.value})} />
                        <textarea placeholder="Advisors o socios" className="w-full p-3 rounded-xl border text-xs" value={newProject.team_advisors} onChange={e => setNewProject({...newProject, team_advisors: e.target.value})} />
                        <input type="text" placeholder="Estructura organizacional" className="w-full p-3 rounded-xl border text-xs" value={newProject.team_org} onChange={e => setNewProject({...newProject, team_org: e.target.value})} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Acordeón 5: Modelo de Negocio y Equity */}
                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => toggleAccordion('negocio')}
                    className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'negocio' ? 'bg-slate-900' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className={`font-black uppercase text-xs tracking-widest ${openAccordion === 'negocio' ? 'text-white' : 'text-slate-900'}`}>5. Modelo de Negocio y Equity</span>
                    <span className={`transform transition-transform ${openAccordion === 'negocio' ? 'rotate-180 text-white' : ''}`}>▼</span>
                  </button>
                  {openAccordion === 'negocio' && (
                    <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-slate-50 animate-fade-in">
                      <textarea placeholder="Cómo genera ingresos" className="p-3 rounded-xl border text-xs" value={newProject.model_revenue} onChange={e => setNewProject({...newProject, model_revenue: e.target.value})} />
                      <input type="number" placeholder="% Acciones ofrecidas" className="p-3 rounded-xl border text-xs" value={Number.isNaN(newProject.model_equity as any) ? '' : newProject.model_equity} onChange={e => setNewProject({...newProject, model_equity: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})} />
                      <input type="number" placeholder="Valoración pre-money" className="p-3 rounded-xl border text-xs" value={Number.isNaN(newProject.model_pre_money as any) ? '' : newProject.model_pre_money} onChange={e => setNewProject({...newProject, model_pre_money: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})} />
                      <input type="number" placeholder="Valoración post-money" className="p-3 rounded-xl border text-xs" value={Number.isNaN(newProject.model_post_money as any) ? '' : newProject.model_post_money} onChange={e => setNewProject({...newProject, model_post_money: (e.target.value === '' ? '' as any : parseFloat(e.target.value))})} />
                      <textarea placeholder="Derechos (Voto, dividendos, salida)" className="p-3 rounded-xl border text-xs" value={newProject.model_rights} onChange={e => setNewProject({...newProject, model_rights: e.target.value})} />
                      <textarea placeholder="Estrategia de salida (Exit strategy)" className="p-3 rounded-xl border text-xs" value={newProject.model_exit} onChange={e => setNewProject({...newProject, model_exit: e.target.value})} />
                    </div>
                  )}
                </div>

                {/* Acordeón 6: Marketing y Plan Operativo */}
                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => toggleAccordion('marketing')}
                    className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'marketing' ? 'bg-pink-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className="font-black uppercase text-xs tracking-widest text-pink-600">6. Marketing y Plan Operativo</span>
                    <span className={`transform transition-transform ${openAccordion === 'marketing' ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {openAccordion === 'marketing' && (
                    <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-50 animate-fade-in">
                      <div className="space-y-3">
                        <textarea placeholder="Cómo atraer inversionistas" className="w-full p-3 rounded-xl border text-xs" value={newProject.marketing_attraction} onChange={e => setNewProject({...newProject, marketing_attraction: e.target.value})} />
                        <textarea placeholder="Estrategia venta acciones" className="w-full p-3 rounded-xl border text-xs" value={newProject.marketing_strategy} onChange={e => setNewProject({...newProject, marketing_strategy: e.target.value})} />
                        <input type="text" placeholder="Canales" className="w-full p-3 rounded-xl border text-xs" value={newProject.marketing_channels} onChange={e => setNewProject({...newProject, marketing_channels: e.target.value})} />
                      </div>
                      <div className="space-y-3">
                        <textarea placeholder="Cronograma detallado (Hitos)" className="w-full p-3 rounded-xl border text-xs" value={newProject.ops_timeline} onChange={e => setNewProject({...newProject, ops_timeline: e.target.value})} />
                        <textarea placeholder="Recursos necesarios" className="w-full p-3 rounded-xl border text-xs" value={newProject.ops_resources} onChange={e => setNewProject({...newProject, ops_resources: e.target.value})} />
                        <textarea placeholder="Riesgos mitigación" className="w-full p-3 rounded-xl border text-xs" value={newProject.ops_risks} onChange={e => setNewProject({...newProject, ops_risks: e.target.value})} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Acordeón 7: Finanzas, Legal y Riesgos */}
                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => toggleAccordion('legal')}
                    className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'legal' ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className="font-black uppercase text-xs tracking-widest text-blue-700">7. Finanzas, Legal y Riesgos</span>
                    <span className={`transform transition-transform ${openAccordion === 'legal' ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {openAccordion === 'legal' && (
                    <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-slate-50 animate-fade-in">
                      <div className="space-y-3">
                        <textarea placeholder="Desglose uso fondos" className="w-full p-3 rounded-xl border text-xs" value={newProject.fin_use_funds} onChange={e => setNewProject({...newProject, fin_use_funds: e.target.value})} />
                        <textarea placeholder="Proyecciones 3-5 años" className="w-full p-3 rounded-xl border text-xs" value={newProject.fin_projections} onChange={e => setNewProject({...newProject, fin_projections: e.target.value})} />
                        <input type="text" placeholder="Break-even point" className="w-full p-3 rounded-xl border text-xs" value={newProject.fin_break_even} onChange={e => setNewProject({...newProject, fin_break_even: e.target.value})} />
                      </div>
                      <div className="space-y-3">
                        <textarea placeholder="Cumplimiento SSF/BCR" className="w-full p-3 rounded-xl border text-xs" value={newProject.legal_compliance} onChange={e => setNewProject({...newProject, legal_compliance: e.target.value})} />
                        <textarea placeholder="Activos digitales / Tokens" className="w-full p-3 rounded-xl border text-xs" value={newProject.legal_assets} onChange={e => setNewProject({...newProject, legal_assets: e.target.value})} />
                        <textarea placeholder="KYC / AML" className="w-full p-3 rounded-xl border text-xs" value={newProject.legal_kyc} onChange={e => setNewProject({...newProject, legal_kyc: e.target.value})} />
                      </div>
                      <div className="space-y-3">
                        <textarea placeholder="Regulatorios / Mercados" className="w-full p-3 rounded-xl border text-xs" value={newProject.risks_reg} onChange={e => setNewProject({...newProject, risks_reg: e.target.value})} />
                        <textarea placeholder="Plan contingencia" className="w-full p-3 rounded-xl border text-xs" value={newProject.risks_contingency} onChange={e => setNewProject({...newProject, risks_contingency: e.target.value})} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Acordeón 8: Anexos */}
                <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => toggleAccordion('anexos')}
                    className={`w-full flex justify-between items-center p-6 text-left transition-colors ${openAccordion === 'anexos' ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className="font-black uppercase text-xs tracking-widest text-slate-500">8. Anexos y Otros</span>
                    <span className={`transform transition-transform ${openAccordion === 'anexos' ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {openAccordion === 'anexos' && (
                    <div className="p-6 bg-white border-t border-slate-50 animate-fade-in">
                      <textarea placeholder="URLs de Anexos (CVs, Prototipos, Screenshots...)" className="w-full p-3 rounded-xl border text-xs" rows={2} value={newProject.annexes} onChange={e => setNewProject({...newProject, annexes: e.target.value})} />
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={handleCreateProject}
                disabled={actionLoading === 'creating-project' || !newProject.name}
                className="mt-10 w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-black transition disabled:opacity-30"
              >
                {actionLoading === 'creating-project' ? 'Creando Proyecto...' : 'Publicar'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {filteredProjects.map(p => (
              <div key={p.id} className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
                <div className="bg-slate-900 p-8 text-white relative">
                  <div className="absolute top-4 right-8 flex gap-2">
                    {p.has_trust_insignia && <span className="bg-green-500 text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase shadow-lg">🛡️ Verificado</span>}
                    {p.pref_location_units > 0 && <span className="bg-purple-500 text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase shadow-lg">📍 VIP ({p.pref_location_units})</span>}
                    <div className="bg-blue-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{p.desc_stage || 'Idea'}</div>
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">{p.name}</h3>
                  <div className="flex items-center gap-4 text-blue-400 font-black text-sm uppercase mb-4">
                    <span>${p.summary_amount?.toLocaleString()} Objetivo</span>
                    <span>•</span>
                    <span>{p.model_equity}% Acciones</span>
                  </div>
                  {p.summary_vision && (
                    <p className="text-[11px] text-slate-300 font-medium italic border-t border-white/10 pt-4 line-clamp-3">
                      "{p.summary_vision}"
                    </p>
                  )}

                  {/* BOTONES DE ASIGNACIÓN EN LISTA (Colocados debajo del texto de visión y datos financieros) */}
                  {(String(p.creator_id) === String(user.id) || profile?.is_admin) && (
                    <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAssignItem(p.id, 'insignia'); }} 
                        disabled={!profile?.project_trust_insignia_count || (profile?.project_trust_insignia_count < 25) || p.has_trust_insignia} 
                        className="flex items-center justify-between px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase border border-white/20 transition disabled:opacity-20 shadow-lg"
                      >
                         <div className="flex items-center gap-2">
                           <span className="text-lg">🛡️</span>
                           <span>Insignia de Confianza en proyecto</span>
                         </div>
                         <div className="flex flex-col items-end">
                           <span className="opacity-40 text-[8px]">Costo: 25 U.</span>
                           {p.has_trust_insignia && <span className="text-green-400 text-[7px] font-black">Ya Asignada</span>}
                         </div>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAssignItem(p.id, 'ubicacion'); }} 
                        disabled={!profile?.pref_location_count} 
                        className="flex items-center justify-between px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase border border-white/20 transition disabled:opacity-20 shadow-lg"
                      >
                         <div className="flex items-center gap-2">
                           <span className="text-lg">📍</span>
                           <span>Unidades de ubicación preferencial</span>
                         </div>
                         <span className="opacity-40 text-[8px]">Dispo: {profile?.pref_location_count || 0}</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAssignItem(p.id, 'feedback'); }} 
                        disabled={!profile?.feedback_count} 
                        className="flex items-center justify-between px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase border border-white/20 transition disabled:opacity-20 shadow-lg"
                      >
                         <div className="flex items-center gap-2">
                           <span className="text-lg">💬</span>
                           <span>Unidades de Comprar Feedback</span>
                         </div>
                         <span className="opacity-40 text-[8px]">Dispo: {profile?.feedback_count || 0}</span>
                      </button>
                      <div 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (actionLoading !== 'toggling-visibility') {
                            handleToggleVisibility(p.id, p.project_visibility); 
                          }
                        }} 
                        className={`flex items-center justify-between px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition cursor-pointer shadow-lg group/switch ${actionLoading === 'toggling-visibility' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                         <div className="flex items-center gap-3">
                           <span className="text-lg transition-transform group-hover/switch:scale-110">
                             {p.project_visibility === 'private' ? '👁️‍🗨️' : '👁️'}
                           </span>
                           <div className="flex flex-col">
                             <span className="text-[10px] font-black uppercase tracking-tight">
                               {p.project_visibility === 'private' ? 'Proyecto Privado' : 'Proyecto Público'}
                             </span>
                             <span className="opacity-40 text-[8px] font-bold uppercase">
                               {p.project_visibility === 'private' ? 'Oculto en Galería' : 'Visible en Galería'}
                             </span>
                           </div>
                         </div>
                         <div className={`relative w-10 h-5 rounded-full transition-all duration-300 border border-white/10 ${p.project_visibility === 'private' ? 'bg-slate-700' : 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]'}`}>
                           <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform duration-300 ${p.project_visibility === 'private' ? 'translate-x-0' : 'translate-x-5'}`}>
                             {actionLoading === 'toggling-visibility' && (
                               <div className="absolute inset-0 flex items-center justify-center">
                                 <div className="w-2 h-2 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                               </div>
                             )}
                           </div>
                         </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center mt-auto">
                   <div className="text-[10px] font-black text-slate-400 uppercase">Jurisdicción: El Salvador</div>
                   <button onClick={() => setSearchParams({ id: p.id })} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition">
                     Ver Detalles
                   </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default ProjectsView;
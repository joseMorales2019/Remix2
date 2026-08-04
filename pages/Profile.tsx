
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const Profile: React.FC<{ user: any }> = ({ user }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationDuis, setValidationDuis] = useState<string[]>([]);
  const [hasPendingLoan, setHasPendingLoan] = useState(false);
  const [editedUser, setEditedUser] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    workplace: user?.workplace || '',
    bank_account: user?.bank_account || '',
    password: user?.password || '',
  });
  const [newProfileImage, setNewProfileImage] = useState<string | null>(null);
  const [freeShippingDeps, setFreeShippingDeps] = useState<string[]>(user?.free_shipping_departments || []);

  const DEPARTAMENTOS_SV = [
    "Ahuachapán", "Santa Ana", "Sonsonate", "Chalatenango", "La Libertad", 
    "San Salvador", "Cuscatlán", "La Paz", "Cabañas", "San Vicente", 
    "Usulután", "San Miguel", "Morazán", "La Unión"
  ];

  const toggleDepartment = (dep: string) => {
    setFreeShippingDeps(prev => 
      prev.includes(dep) ? prev.filter(d => d !== dep) : [...prev, dep]
    );
  };

  // Funciones de validación
  const validateFullName = (name: string) => {
    const trimmed = name.trim();
    const words = trimmed.split(/\s+/);
    const noSpecialChars = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(trimmed);
    return words.length >= 2 && noSpecialChars;
  };
  const validateEmail = (email: string) => email.includes('@');
  const validatePhone = (phone: string) => /^\d{4}-\d{4}$/.test(phone);
  const validateAddress = (addr: string) => addr.trim().split(/\s+/).length >= 2;

  useEffect(() => {
    const checkUserStatus = async () => {
      if (!user?.id) return;
      
      // Obtener DUIs de avales
      const { data: refData } = await supabase
        .from('community_references')
        .select('profiles!community_references_referrer_id_fkey(dui)')
        .eq('applicant_id', user.id);
      
      if (refData) {
        setValidationDuis(refData.map((r: any) => r.profiles?.dui).filter(Boolean));
      }

      // Verificar préstamos pendientes (Cualquier préstamo que no esté VERIFIED)
      const { data: loans } = await supabase
        .from('loans')
        .select('id')
        .eq('user_id', user.id)
        .neq('status', 'VERIFIED');
      
      setHasPendingLoan(loans && loans.length > 0);
    };
    checkUserStatus();
  }, [user?.id]);

  if (!user) return null;

  const base64ToBlob = (base64: string, contentType: string) => {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  };

  const convertToWebP = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('No ctx');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/webp', 0.8));
        };
      };
      reader.onerror = reject;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const webpData = await convertToWebP(file);
        setNewProfileImage(webpData);
      } catch (err) {
        console.error("Error procesando imagen:", err);
      }
    }
  };

  const handleEditClick = () => {
    if (hasPendingLoan) {
      alert("No puedes editar tu perfil mientras tengas un préstamo pendiente de pago o en proceso de verificación.");
      return;
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let profileImageUrl = user.profile_image_url;

      if (newProfileImage) {
        const blob = base64ToBlob(newProfileImage, 'image/webp');
        const fileName = `${user.dui}_perfil_${Date.now()}.webp`;
        await supabase.storage.from('newBankImagesPerfil').upload(fileName, blob, { upsert: true });
        profileImageUrl = supabase.storage.from('newBankImagesPerfil').getPublicUrl(fileName).data.publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editedUser.full_name,
          email: editedUser.email,
          phone: editedUser.phone,
          address: editedUser.address,
          workplace: editedUser.workplace,
          bank_account: editedUser.bank_account,
          password: editedUser.password, // Actualización de contraseña
          profile_image_url: profileImageUrl,
        })
        .eq('id', user.id);

      if (error) throw error;
      
      setIsEditing(false);
      alert("Perfil actualizado correctamente.");
      window.location.reload();
    } catch (err) {
      console.error("Error actualizando perfil:", err);
      alert("Error al actualizar el perfil.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          free_shipping_departments: freeShippingDeps
        })
        .eq('id', user.id);

      if (error) throw error;
      alert("Configuración de envíos actualizada.");
      window.location.reload();
    } catch (err) {
      console.error("Error actualizando config:", err);
      alert("Error al actualizar la configuración.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-16 space-y-8">
      <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 sm:p-10 text-white">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl sm:text-4xl font-black shadow-inner overflow-hidden border-2 border-white/30">
                {newProfileImage || user.profile_image_url ? (
                  <img src={newProfileImage || user.profile_image_url} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  user.full_name?.[0] || 'U'
                )}
              </div>
              {isEditing && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer rounded-3xl">
                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white">Cambiar</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
              )}
            </div>
            <div className="flex-grow text-center sm:text-left">
              {isEditing ? (
                <>
                  <input 
                    type="text" 
                    className={`bg-white/10 border-b-2 outline-none text-xl sm:text-3xl font-black tracking-tight w-full focus:border-white transition text-center sm:text-left ${editedUser.full_name && !validateFullName(editedUser.full_name) ? 'border-red-500' : 'border-white/30'}`}
                    value={editedUser.full_name}
                    onChange={e => setEditedUser({...editedUser, full_name: e.target.value})}
                  />
                  {editedUser.full_name && !validateFullName(editedUser.full_name) && (
                    <p className="text-[10px] text-red-300 font-bold mt-1">Mínimo 2 palabras y solo letras.</p>
                  )}
                </>
              ) : (
                <h2 className="text-xl sm:text-3xl font-black tracking-tight">{user.full_name}</h2>
              )}
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-white/10 rounded-full text-[8px] sm:text-xs font-bold uppercase tracking-widest">
                  Activo
                </span>
                {user.is_admin && (
                  <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-yellow-400 text-yellow-900 rounded-full text-[8px] sm:text-xs font-bold uppercase tracking-widest">
                    Admin
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button 
                onClick={() => isEditing ? handleSave() : handleEditClick()}
                disabled={loading}
                className={`flex-grow sm:flex-none px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-lg ${
                  isEditing ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                {loading ? '...' : isEditing ? 'Guardar' : 'Editar'}
              </button>
              {isEditing && (
                <button 
                  onClick={() => { setIsEditing(false); setNewProfileImage(null); }}
                  className="px-4 sm:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-white hover:bg-red-500/40 transition"
                >
                  X
                </button>
              )}
            </div>
          </div>
          {hasPendingLoan && !isEditing && (
            <div className="mt-4 p-2 bg-yellow-400/20 rounded-xl border border-yellow-400/30 text-center">
              <p className="text-[10px] font-black uppercase tracking-tighter">Edición bloqueada: Tienes un préstamo activo</p>
            </div>
          )}
        </div>

        <div className="p-6 sm:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
            <div className="space-y-6 sm:space-y-8">
              <div>
                <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-6 bg-orange-50 p-3 rounded-xl border border-orange-100">Recuerda tener tu ibfirmacion actualizada y usar fotografia ya que de no hacerlo se desactivara tu cuenta.</p>
                
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Información de Acceso</h3>
                <div className="space-y-4 mb-8">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase">DUI</span>
                    <span className="text-slate-900 font-bold text-sm sm:text-lg">{user.dui || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Contraseña</span>
                    {isEditing ? (
                      <>
                        <input 
                          type="password"
                          className={`mt-1 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-bold ${editedUser.password && editedUser.password.length < 4 ? 'border-red-500' : 'border-slate-200'}`} 
                          value={editedUser.password} 
                          onChange={e => setEditedUser({...editedUser, password: e.target.value})} 
                          placeholder="Nueva contraseña"
                        />
                        {editedUser.password && editedUser.password.length < 4 && (
                          <p className="text-[10px] text-red-500 font-bold mt-1">Mínimo 4 caracteres.</p>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-900 font-bold text-xs sm:text-sm">••••••••</span>
                    )}
                  </div>
                </div>

                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Información Personal</h3>
                <div className="space-y-4">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Cuenta de Banco</span>
                    {isEditing ? (
                      <input className="mt-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-bold" value={editedUser.bank_account} onChange={e => setEditedUser({...editedUser, bank_account: e.target.value})} placeholder="Número de cuenta para recibir" />
                    ) : (
                      <span className="text-slate-900 font-bold text-xs sm:text-sm">{user.bank_account || 'Pendiente de agregar'}</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Email</span>
                    {isEditing ? (
                      <>
                        <input 
                          type="email"
                          className={`mt-1 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-bold ${editedUser.email && !validateEmail(editedUser.email) ? 'border-red-500' : 'border-slate-200'}`} 
                          value={editedUser.email} 
                          onChange={e => setEditedUser({...editedUser, email: e.target.value})} 
                        />
                        {editedUser.email && !validateEmail(editedUser.email) && (
                          <p className="text-[10px] text-red-500 font-bold mt-1">Correo inválido.</p>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-900 font-bold text-xs sm:text-sm">{user.email || 'N/A'}</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Teléfono</span>
                    {isEditing ? (
                      <>
                        <input className={`mt-1 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-bold ${editedUser.phone && !validatePhone(editedUser.phone) ? 'border-red-500' : 'border-slate-200'}`} value={editedUser.phone} onChange={e => setEditedUser({...editedUser, phone: e.target.value})} />
                        {editedUser.phone && !validatePhone(editedUser.phone) && (
                          <p className="text-[10px] text-red-500 font-bold mt-1">Formato: 0000-0000</p>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-900 font-bold text-xs sm:text-sm">{user.phone || 'N/A'}</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Residencia</h3>
                <div className="space-y-4">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase">Dirección</span>
                    {isEditing ? (
                      <>
                        <textarea className={`mt-1 px-3 py-1.5 rounded-lg border text-xs font-medium ${editedUser.address && !validateAddress(editedUser.address) ? 'border-red-500' : 'border-slate-200'}`} rows={2} value={editedUser.address} onChange={e => setEditedUser({...editedUser, address: e.target.value})} />
                        {editedUser.address && !validateAddress(editedUser.address) && (
                          <p className="text-[10px] text-red-500 font-bold mt-1">Mínimo 2 palabras.</p>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-900 font-medium text-xs leading-relaxed">{user.address || 'N/A'}</span>
                    )}
                  </div>
                  {!user.is_hidden && (
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase">DUIs de Validación (Avales)</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {validationDuis.length > 0 ? (
                          validationDuis.map((dui, idx) => (
                            <span key={idx} className="text-slate-900 font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {dui}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[10px] font-bold">Sin avales registrados</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6 sm:space-y-8">
              <div className="bg-slate-50 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 border border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 sm:mb-8 text-center sm:text-left">Confiabilidad</h3>
                <div className="text-center mb-4 sm:mb-8">
                  <div className="text-4xl sm:text-6xl font-black text-blue-600">
                    {user.reliability_score || 0}%
                  </div>
                </div>
                <div className="w-full bg-slate-200 h-1.5 sm:h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${user.reliability_score || 0}%` }}></div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Documentación</h3>
                <div className="bg-white rounded-xl border border-slate-200 p-2 sm:p-4">
                  {user.dui_url ? (
                    <img src={user.dui_url} alt="DUI" className="w-full h-32 sm:h-40 object-contain sm:object-cover rounded-xl" />
                  ) : (
                    <div className="h-32 sm:h-40 bg-slate-100 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-4">
                      No hay imagen del DUI
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50/50 p-4 sm:p-6 border-t border-slate-100 text-center">
          <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {user.id} • {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* SECCIÓN DE CONFIGURACIÓN - SOLO ALIADOS Y ADMINS */}
      {(user.profile_type === 'aliado' || user.is_admin) && (
        <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden p-6 sm:p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-xl">
              ⚙️
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Configuración</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Envíos Gratuitos por Departamento</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {DEPARTAMENTOS_SV.map((dep) => (
              <button
                key={dep}
                onClick={() => toggleDepartment(dep)}
                className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${
                  freeShippingDeps.includes(dep)
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                }`}
              >
                <span className={`text-xs font-black uppercase tracking-tight ${
                  freeShippingDeps.includes(dep) ? 'text-blue-600' : 'text-slate-600'
                }`}>
                  {dep}
                </span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  freeShippingDeps.includes(dep) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                }`}>
                  {freeShippingDeps.includes(dep) && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-10 flex justify-end">
            <button
              onClick={handleSaveConfig}
              disabled={loading}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center gap-2 hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
import React, { useState, useRef, useEffect } from 'react';
import { analyzeReliability, ReliabilityAnalysis } from '../services/geminiService';
import { supabase } from '../supabase';
import { Link, useNavigate } from 'react-router-dom';

const LoanApplication: React.FC<{ user: any }> = ({ user }) => {
  const [step, setStep] = useState(0); // 0 means checking requirements
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ReliabilityAnalysis | null>(null);
  const [error, setError] = useState('');
  const [approvedCount, setApprovedCount] = useState(0);
  const [isRejected, setIsRejected] = useState(false);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [checkingReqs, setCheckingReqs] = useState(true);
  const [references, setReferences] = useState<string[]>(['', '', '', '', '']);
  const [foundRefs, setFoundRefs] = useState<(any | null)[]>([null, null, null, null, null]);
  const [paymentDate, setPaymentDate] = useState('');
  const [userDiamonds, setUserDiamonds] = useState(0);
  const [hasActiveLoan, setHasActiveLoan] = useState(false);
  const [useExistingDui, setUseExistingDui] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(25);
  const navigate = useNavigate();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sanitizeInput = (val: string) => {
    if (typeof val !== 'string') return '';
    return val.replace(/[<>"';%()]/g, '').trim();
  };

  // Calcular capacidad máxima de préstamo según diamantes
  const maxPossibleAmount = Math.max(25, Math.min(75, Math.floor(userDiamonds / 100) * 25));

  const calculateDynamicTotal = () => {
    if (!paymentDate) return selectedAmount * 1.2;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(paymentDate + 'T12:00:00');
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const dailyRate = 0.20 / 30;
    return selectedAmount * (1 + (dailyRate * diffDays));
  };

  useEffect(() => {
    const checkTrustStatus = async () => {
      setCheckingReqs(true);
      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        let diamonds = 0;
        if (profile) {
          diamonds = profile.store_diamonds || 0;
          setUserDiamonds(diamonds);
          // Por defecto seleccionar el máximo permitido
          setSelectedAmount(Math.max(25, Math.min(75, Math.floor(diamonds / 100) * 25)));

          // Verificar si el perfil está incompleto
          const isIncomplete = 
            !profile.full_name || 
            profile.full_name === 'Invitado' || 
            !profile.phone || 
            !profile.address || 
            !profile.bank_account || 
            !profile.profile_image_url || 
            !profile.dui_url;

          // Si es administrador, funcionalmente consideramos el perfil completo para propósitos de préstamo
          const finalIsIncomplete = isIncomplete && !profile.is_admin;
          setIsProfileIncomplete(finalIsIncomplete);

          console.log('LoanApplication - User Profile:', profile);
          console.log('LoanApplication - isProfileIncomplete:', finalIsIncomplete);
          
          // Los administradores no necesitan un perfil completo para solicitar préstamos
          if (finalIsIncomplete) {
            setStep(-3); // Nuevo paso para perfil incompleto
            setCheckingReqs(false);
            return;
          }
        }

        // Verificar si tiene préstamos pendientes (Cualquiera que no esté VERIFIED)
        const { data: activeLoans } = await supabase
          .from('loans')
          .select('id')
          .eq('user_id', user.id)
          .neq('status', 'VERIFIED')
          .limit(1);
        
        setHasActiveLoan(activeLoans && activeLoans.length > 0);

        const { data: rejections } = await supabase
          .from('community_references')
          .select('id')
          .eq('applicant_id', user.id)
          .eq('is_trustworthy', false)
          .not('comments', 'is', null)
          .limit(1);

        if (rejections && rejections.length > 0) {
          setIsRejected(true);
          setStep(-2);
          return;
        }

        const { count, error: countErr } = await supabase
          .from('community_references')
          .select('*', { count: 'exact', head: true })
          .eq('applicant_id', user.id)
          .eq('is_trustworthy', true);
        
        if (countErr) throw countErr;
        const endorsements = count || 0;
        setApprovedCount(endorsements);
        
        // REGLA ACTUALIZADA: 5 avales O 100 diamantes permiten iniciar. Los administradores no necesitan avales ni diamantes.
        if (endorsements >= 5 || diamonds >= 100 || profile.is_admin) {
          setStep(1);
        } else {
          setStep(-1);
        }
      } catch (err) {
        console.error("Error verificando estatus de confianza:", err);
      } finally {
        setCheckingReqs(false);
      }
    };
    checkTrustStatus();
  }, [user.id]);

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Tu navegador no soporta el acceso a la cámara o micrófono.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }, 
        audio: true 
      }).catch(async (err) => {
        console.warn("Falló acceso con parámetros ideales, intentando básicos...", err);
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing media devices.", err);
      setError('No se pudo acceder a la cámara o micrófono. Asegúrate de que no esté en uso por otra pestaña o app y otorga los permisos.');
    }
  };

  const captureAndAnalyze = async () => {
    setLoading(true);
    setError('');
    
    if (canvasRef.current && videoRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, 640, 480);
        const imageData = canvasRef.current.toDataURL('image/jpeg');
        
        try {
          const result = await analyzeReliability(
            `Analyze this borrower's facial expressions and reliability. They are requesting a $${selectedAmount} loan. Look for stress, honesty, and emotional stability.`,
            imageData
          );
          setAnalysis(result);
          setStep(3);
        } catch (err) {
          setError('Error en el análisis de IA. Intenta de nuevo.');
        }
      }
    }
    setLoading(false);
  };

  const searchReference = async (index: number, query: string) => {
    const cleanQuery = query.replace(/[-\s]/g, '');
    if (cleanQuery.length < 3) return;

    const resetFound = [...foundRefs];
    resetFound[index] = null;
    setFoundRefs(resetFound);

    const otherReferences = references.filter((r, idx) => idx !== index && r.trim() !== '');
    if (otherReferences.some(r => r.replace(/[-\s]/g, '') === cleanQuery)) {
      const newFound = [...foundRefs];
      newFound[index] = { is_invalid: true, error_msg: 'Duplicado' };
      setFoundRefs(newFound);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, dui')
      .or(`dui.eq.${query},dui.eq.${cleanQuery},full_name.ilike.%${query}%`)
      .limit(1)
      .single();
    
    if (profile) {
      if (profile.id === user.id) {
        const newFound = [...foundRefs];
        newFound[index] = { is_invalid: true, error_msg: 'Eres tú' };
        setFoundRefs(newFound);
        return;
      }

      const { data: rejections } = await supabase
        .from('community_references')
        .select('id')
        .eq('applicant_id', profile.id)
        .eq('is_trustworthy', false)
        .not('comments', 'is', null)
        .limit(1);

      if (rejections && rejections.length > 0) {
        const newFound = [...foundRefs];
        newFound[index] = { is_invalid: true, error_msg: 'Inactiva/No confiable' };
        setFoundRefs(newFound);
        return;
      }

      const newFound = [...foundRefs];
      newFound[index] = profile;
      setFoundRefs(newFound);
    }
  };

  const submitApplication = async () => {
    if (hasActiveLoan) {
      setError('No puedes solicitar un nuevo préstamo si tienes uno pendiente de pago o verificación.');
      return;
    }

    const cleanRefs = references.map(r => r.replace(/[-\s]/g, '')).filter(r => r !== '');
    if (new Set(cleanRefs).size !== cleanRefs.length) {
      setError('No puedes usar el mismo DUI para múltiples referencias.');
      return;
    }

    if (!paymentDate) {
      setError('Por favor selecciona una fecha de pago prometida.');
      return;
    }

    setLoading(true);
    try {
      const isAutoApproved = analysis?.is_trustworthy;
      const { data: loan, error: loanError } = await supabase.from('loans').insert({
        user_id: user.id,
        amount: selectedAmount,
        status: isAutoApproved ? 'APPROVED' : 'PENDING',
        due_date: new Date(paymentDate + 'T12:00:00').toISOString(),
        approved_at: isAutoApproved ? new Date().toISOString() : null,
        analysis_score: analysis?.confidence_score,
        analysis_summary: sanitizeInput(analysis?.summary || '')
      }).select().single();

      if (loanError) throw loanError;

      // Descontar diamantes (100 por cada $25 del préstamo solicitado)
      const diamondsToDeduct = Math.floor(selectedAmount / 25) * 100;
      const newDiamonds = Math.max(0, userDiamonds - diamondsToDeduct);
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ store_diamonds: newDiamonds })
        .eq('id', user.id);
      
      if (profileError) throw profileError;
      
      // Actualizar contador localmente para reflejar el descuento
      setUserDiamonds(newDiamonds);

      const refsToInsert = foundRefs
        .filter(ref => ref !== null && ref.id && !ref.is_invalid)
        .map(ref => ({
          applicant_id: user.id,
          referrer_id: ref.id,
          is_trustworthy: false,
          comments: null 
        }));

      if (refsToInsert.length > 0) {
        const { error: refError } = await supabase.from('community_references').insert(refsToInsert);
        if (refError) console.error("Error guardando referencias:", refError);
      }

      setStep(4);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingReqs) {
    return (
      <div className="flex flex-col items-center justify-center p-32 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Verificando estatus de confianza...</p>
      </div>
    );
  }

  if (step === -3) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-24 text-center">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100">
          <div className="text-6xl mb-6 animate-bounce">👤</div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 uppercase italic">Perfil Incompleto</h2>
          <p className="text-slate-500 mb-8 font-medium">
            Para realizar un pedido, primero debes completar toda la información de tu perfil. 
            Asegúrate de incluir tu nombre completo, teléfono, dirección, cuenta bancaria y fotografías (perfil y DUI).
          </p>
          <Link to="/profile" className="inline-block bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:scale-105 transition">
            Completar Mi Perfil
          </Link>
        </div>
      </div>
    );
  }

  if (userDiamonds < 100 && approvedCount < 5) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-24 text-center">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100">
          <div className="text-6xl mb-6 animate-bounce">💎</div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 uppercase italic">¡Faltan Diamantes!</h2>
          <p className="text-slate-500 mb-8 font-medium">
            Necesitas al menos 100 Diamantes para habilitar la opción de préstamos. 
            Cada bloque de 100 diamantes te permite solicitar un microcrédito de $25.00 (máximo $75.00).
          </p>
          <Link to="/store" className="inline-block bg-blue-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:scale-105 transition">
            Ir a la Tienda
          </Link>
        </div>
      </div>
    );
  }

  if (step === -2) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-24">
        <div className="bg-white rounded-[2.5rem] shadow-2xl border-4 border-red-500 p-8 sm:p-16 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tighter uppercase">Cuenta Inhabilitada</h2>
          <p className="text-slate-500 mb-8 text-sm sm:text-base leading-relaxed max-w-lg mx-auto font-medium">
            Tu cuenta no está habilitada para realizar préstamos por no haber tenido un resultado favorable en la verificación comunitaria.
          </p>
          <div className="space-y-4">
            <Link to="/comunidad" className="block w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl hover:bg-black transition text-sm">
              Ver Detalles en Validaciones
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === -1) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-24">
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 sm:p-16 text-center">
          <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tighter uppercase">Validación Insuficiente</h2>
          <p className="text-slate-500 mb-8 text-sm sm:text-base leading-relaxed max-w-lg mx-auto font-medium">
            Tu perfil aún no cuenta con los <span className="text-blue-600 font-black">5 avales comunitarios</span> necesarios para solicitar préstamos. Actualmente tienes <span className="font-black text-slate-800">{approvedCount} de 5</span> avales aprobados.
            <br /><br />
            <span className="text-slate-900 font-black italic">¿No quieres esperar avales?</span> Para habilitar tu préstamo inmediatamente, debes comprar al menos <span className="text-blue-600 font-black">100 diamantes</span> en la <Link to="/store" className="underline font-black">sección llamada tienda</Link>.
          </p>
          <div className="space-y-4">
            <Link to="/store" className="block w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition text-sm mb-2">
              Comprar Diamantes en Tienda
            </Link>
            <Link to="/comunidad" className="block w-full bg-slate-100 text-slate-600 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-slate-200 transition text-sm">
              Ver Mis Avales
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8 sm:mb-12">
        <div className="flex justify-between mb-4">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s} 
              className={`w-1/4 h-1.5 sm:h-2 rounded-full mx-0.5 sm:mx-1 transition-all duration-500 ${step >= s ? 'bg-blue-600' : 'bg-slate-200'}`}
            ></div>
          ))}
        </div>
        <h2 className="text-lg sm:text-2xl font-bold text-slate-900 text-center sm:text-left font-black uppercase tracking-tight">
          {step === 1 && "Verificación de Identidad"}
          {step === 2 && "Entrevista Biométrica (IA)"}
          {step === 3 && "Planificación y Aval Adicional"}
          {step === 4 && "Solicitud Finalizada"}
        </h2>
      </div>

      {/* Indicador de Diamantes y Capacidad de Préstamo Actualizado */}
      {step > 0 && step < 4 && (
        <div className="mb-8 bg-blue-50 border border-blue-100 p-6 rounded-3xl shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm animate-bounce">💎</div>
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Diamantes Actuales</p>
              <p className="text-xl font-black text-slate-900">{userDiamonds} 💎</p>
            </div>
          </div>
          <div className="h-10 w-px bg-blue-100 hidden lg:block"></div>
          <div className="text-center lg:text-left">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Capacidad Seleccionada</p>
            <p className="text-xl font-black text-blue-600">
              ${selectedAmount.toFixed(2)} USD
            </p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight mt-1 italic">
              Interés: 20% | Penalidad: $10.00 por mora
            </p>
          </div>
          <div className="flex flex-col items-center lg:items-end">
            <p className="text-[9px] font-bold text-slate-500 text-center lg:text-right leading-tight max-w-[220px]">
              Puedes comprar diamantes en la <Link to="/store" className="text-blue-600 underline font-black">tienda</Link> para prestar más. <br />
              Máximo: <span className="text-slate-900 font-black">$75.00/mes</span> y <span className="text-red-600 font-black">sin préstamos pendientes</span>.
            </p>
            {hasActiveLoan && (
              <span className="text-[8px] font-black text-red-500 uppercase mt-1 bg-red-50 px-2 py-0.5 rounded border border-red-100">⚠ Tienes un préstamo pendiente</span>
            )}
          </div>
        </div>
      )}

      {/* Escala de Crédito Comunitario con Resaltado Dinámico y Selección */}
      {step > 0 && step < 4 && (
        <div className="mb-8 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="text-center mb-6">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">Escala de Crédito Comunitario</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Elige tu préstamo según tus diamantes disponibles</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { diamonds: 100, amount: 25 },
              { diamonds: 200, amount: 50 },
              { diamonds: 300, amount: 75 }
            ].map((tier) => {
              const isEnabled = userDiamonds >= tier.diamonds;
              const isSelected = selectedAmount === tier.amount;
              return (
                <div 
                  key={tier.diamonds} 
                  onClick={() => isEnabled && setSelectedAmount(tier.amount)}
                  className={`p-4 rounded-2xl border-2 transition-all relative cursor-pointer ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 shadow-md ring-4 ring-blue-50' 
                      : isEnabled 
                        ? 'border-slate-200 bg-white hover:border-blue-300' 
                        : 'border-slate-100 bg-slate-50 opacity-40 grayscale cursor-not-allowed'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase">Seleccionado</div>
                  )}
                  {!isSelected && isEnabled && (
                    <div className="absolute top-2 right-2 bg-green-100 text-green-600 text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase">Disponible</div>
                  )}
                  <div className="text-lg font-black text-slate-900 mb-1">{tier.diamonds} 💎</div>
                  <div className="text-xs font-black text-blue-600 uppercase">Préstamo de ${tier.amount}</div>
                  <div className="text-[8px] font-bold text-slate-400 uppercase mt-1">Tasa de Interés: 20%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 animate-bounce text-xs sm:text-sm font-bold">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
          <p className="mb-6 text-slate-600 text-sm sm:text-base font-medium leading-relaxed">
            Confirma tus documentos legales para continuar con la solicitud de microcrédito de <span className="text-blue-600 font-black">${selectedAmount.toFixed(2)} USD</span>.
          </p>

          {/* Vista previa de documentos legales existentes para selección directa */}
          {user.dui_url && (
            <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Documento en Perfil Detectado</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div 
                  onClick={() => setUseExistingDui(!useExistingDui)}
                  className={`cursor-pointer group relative overflow-hidden rounded-xl border-2 transition-all ${useExistingDui ? 'border-blue-500 ring-4 ring-blue-50 shadow-lg' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <img src={user.dui_url || undefined} alt="DUI Registrado" className="w-full h-32 object-cover transition group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/20 flex flex-col justify-end p-2">
                     <span className="text-[8px] font-black text-white uppercase bg-blue-600 px-2 py-0.5 rounded w-fit">DUI Registrado</span>
                  </div>
                  {useExistingDui && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1 shadow-lg">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-[10px] font-bold text-slate-500 leading-tight italic">
                    ¿Deseas utilizar tu DUI registrado previamente? Haz clic en la imagen para confirmarlo. De lo contrario, carga una nueva imagen a continuación.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
            <div className={`p-4 border-2 border-dashed rounded-xl hover:border-blue-400 transition cursor-pointer ${useExistingDui ? 'opacity-30 border-slate-100' : 'border-slate-200'}`}>
              <label className="block text-xs sm:text-sm font-black text-slate-700 mb-2 text-center uppercase tracking-widest cursor-pointer">
                {useExistingDui ? "DUI Confirmado" : "DUI Frontal (Nuevo)"}
                <input type="file" className="hidden" disabled={useExistingDui} />
                {!useExistingDui && <div className="mt-2 text-blue-600 text-[10px] sm:text-xs">Seleccionar Imagen</div>}
              </label>
            </div>
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-400 transition cursor-pointer">
              <label className="block text-xs sm:text-sm font-black text-slate-700 mb-2 text-center uppercase tracking-widest cursor-pointer">
                Ingresos / Recibo
                <input type="file" className="hidden" />
                <div className="mt-2 text-blue-600 text-[10px] sm:text-xs">Seleccionar Imagen</div>
              </label>
            </div>
          </div>
          <button 
            disabled={hasActiveLoan}
            onClick={() => { setStep(2); startCamera(); }}
            className={`w-full py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition active:scale-[0.98] text-sm sm:text-base ${hasActiveLoan ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'}`}
          >
            {hasActiveLoan ? 'Préstamo Pendiente Bloqueado' : 'Iniciar Análisis Biométrico'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative aspect-square sm:aspect-video flex flex-col items-center justify-center">
          <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          <canvas ref={canvasRef} width="640" height="480" className="hidden" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-4 sm:p-8">
            <div className="text-white mb-4 sm:mb-6">
              <h3 className="text-base sm:text-xl font-black uppercase tracking-tight mb-1">Pregunta de Seguridad:</h3>
              <p className="text-slate-300 text-sm sm:text-lg italic font-medium">¿Para qué utilizarás este micro-préstamo de ${selectedAmount.toFixed(2)} USD?</p>
            </div>
            <button 
              disabled={loading}
              onClick={captureAndAnalyze}
              className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition flex items-center justify-center space-x-2 text-sm sm:text-base ${
                loading ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 sm:w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Analizando micro-expresiones...</span>
                </>
              ) : (
                <span>Finalizar y Procesar</span>
              )}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          {analysis && (
            <div className={`p-4 sm:p-6 rounded-2xl border ${analysis.is_trustworthy ? 'bg-green-50 border-green-200 text-green-800' : 'bg-orange-50 border-orange-200 text-orange-800'}`}>
              <div className="flex justify-between items-start">
                <h3 className="text-base sm:text-xl font-black uppercase tracking-tighter mb-2">Análisis de IA</h3>
                <span className="text-xl sm:text-2xl font-black">{analysis.confidence_score}% Confianza</span>
              </div>
              <p className="text-[10px] sm:text-sm font-bold opacity-90 mb-4 italic leading-tight">{analysis.summary}</p>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {analysis.detected_emotions.map(e => (
                  <span key={e} className="px-3 py-1 bg-white/60 text-[8px] sm:text-[10px] font-black uppercase rounded-full border border-current">{e}</span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-base sm:text-xl font-black uppercase tracking-tighter mb-4 text-slate-900">Planificación de Pago</h3>
            <div className="mb-8 space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">¿En qué fecha realizarás tu abono al banco?</label>
              <input 
                type="date" 
                className="w-full px-5 py-3.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 font-black text-sm text-slate-800"
                value={paymentDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setPaymentDate(e.target.value)}
              />
              <p className="text-[9px] text-slate-400 mt-1.5 italic font-bold ml-1">Monto total a pagar: <span className="text-blue-600 font-black">${calculateDynamicTotal().toFixed(2)} USD</span> (Cálculo: (20% / 30 días) x días de uso).</p>
            </div>

            <h3 className="text-base sm:text-xl font-black uppercase tracking-tighter mb-2 text-slate-900">Avales de Respaldo</h3>
            <p className="text-[10px] sm:text-sm text-slate-500 mb-6 italic font-medium leading-tight">Busca y selecciona a 3 personas registradas en NewBank que den fe de tu honestidad para este pedido.</p>
            <div className="space-y-3">
              {references.map((ref, i) => (
                <div key={i} className="group flex flex-col space-y-1">
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      placeholder={`Aval Adicional ${i+1}: Nombre o DUI`} 
                      className={`flex-grow px-4 py-3 text-xs sm:text-sm rounded-xl border font-bold outline-none focus:ring-4 focus:ring-blue-100 transition ${foundRefs[i]?.id && !foundRefs[i]?.is_invalid ? 'border-green-500 bg-green-50 text-green-700' : (foundRefs[i]?.is_invalid ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200')}`}
                      onChange={(e) => {
                        const newRefs = [...references];
                        newRefs[i] = e.target.value;
                        setReferences(newRefs);
                        if (e.target.value.length >= 3) searchReference(i, e.target.value);
                      }}
                    />
                    {foundRefs[i]?.id && !foundRefs[i]?.is_invalid && (
                      <div className="flex items-center text-green-600 font-black text-[11px] px-1 uppercase">✓ Valido</div>
                    )}
                    {foundRefs[i]?.is_invalid && (
                      <div className="flex items-center text-red-600 font-black text-[11px] px-1 uppercase tracking-tighter">⚠ {foundRefs[i]?.error_msg}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button 
              disabled={loading || foundRefs.filter(r => r?.id && !r?.is_invalid).length < 3 || !paymentDate || hasActiveLoan}
              onClick={submitApplication}
              className={`w-full mt-8 py-4 rounded-xl font-black uppercase tracking-widest transition shadow-xl text-sm sm:text-base ${
                loading || foundRefs.filter(r => r?.id && !r?.is_invalid).length < 3 || !paymentDate || hasActiveLoan
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
              }`}
            >
              {loading ? 'Sincronizando...' : `Confirmar Pedido de $${selectedAmount.toFixed(2)}`}
            </button>
            {(foundRefs.filter(r => r?.id && !r?.is_invalid).length < 3 || !paymentDate || hasActiveLoan) && (
              <p className="text-center text-[10px] text-red-500 mt-4 font-black uppercase tracking-widest">
                {hasActiveLoan ? "Tienes un préstamo pendiente" : !paymentDate ? "Falta fecha de abono" : "Se requieren 3 avales para este préstamo"}
              </p>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-2xl border border-slate-100 text-center animate-fade-in">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <svg className="w-10 h-10 sm:w-12 sm:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 mb-3 tracking-tighter uppercase">¡Confirmado!</h2>
          <p className="text-sm sm:text-lg text-slate-500 mb-10 max-w-md mx-auto font-medium">
            Tu solicitud de microcrédito ha sido recibida y se encuentra en proceso de desembolso automático.
          </p>
          <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-[2rem] mb-10 shadow-2xl">
            <h4 className="font-black text-[11px] uppercase tracking-widest mb-4 opacity-60">Compromiso Financiero</h4>
            <div className="text-4xl sm:text-5xl font-black mb-4">${calculateDynamicTotal().toFixed(2)} USD</div>
            <div className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-4 py-2 rounded-xl inline-block">
              Fecha límite: {new Date(paymentDate + 'T12:00:00').toLocaleDateString()}
            </div>
          </div>
          <Link to="/" className="inline-block bg-blue-600 text-white px-10 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-100 text-sm">
            Ir a Mi Billetera
          </Link>
        </div>
      )}
    </div>
  );
};

export default LoanApplication;
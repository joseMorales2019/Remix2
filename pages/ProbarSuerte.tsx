import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { RouletteWheel, RouletteSlice } from '../components/RouletteWheel';
import { RouletteResultModal } from '../components/RouletteResultModal';
import { supabase } from '../supabase';
import {
  rouletteService,
  RouletteSettings,
  RouletteGift,
  RouletteOption,
  GiftWinner,
  UserRouletteStatus,
  SpinResult,
  calculateDistanceKm
} from '../services/rouletteService';

export const ProbarSuerte: React.FC<{ user: any }> = ({ user }) => {
  const navigate = useNavigate();

  const [guestId] = useState<string>(() => {
    let stored = localStorage.getItem('newbank_guest_roulette_id');
    if (!stored) {
      stored = 'guest_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
      localStorage.setItem('newbank_guest_roulette_id', stored);
    }
    return stored;
  });

  const activeUserId = user?.id || guestId;
  const activeUser = useMemo(() => {
    return user || {
      id: guestId,
      full_name: 'Usuario Invitado',
      email: '',
      phone: ''
    };
  }, [user, guestId]);

  const [activeTab, setActiveTab] = useState<'wheel' | 'my_prizes'>('wheel');
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<RouletteSettings | null>(null);
  const [gifts, setGifts] = useState<RouletteGift[]>([]);
  const [options, setOptions] = useState<RouletteOption[]>([]);
  const [userStatus, setUserStatus] = useState<UserRouletteStatus | null>(null);
  const [myPrizes, setMyPrizes] = useState<GiftWinner[]>([]);
  const [monthlyWinners, setMonthlyWinners] = useState<GiftWinner[]>([]);

  // Spin State
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [isExtraAttempt, setIsExtraAttempt] = useState<boolean>(false);

  // Live countdown timer in seconds
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const timerIntervalRef = useRef<any>(null);

  // Geographic restriction check state
  const [geoCheckStatus, setGeoCheckStatus] = useState<'checking' | 'allowed' | 'restricted'>('allowed');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);

  // Check if user is within the admin-defined coverage area
  const checkUserGeolocation = (currentSettings: RouletteSettings) => {
    if (!currentSettings.geo_restriction_enabled) {
      setGeoCheckStatus('allowed');
      return;
    }

    if (!navigator.geolocation) {
      setGeoCheckStatus('restricted');
      return;
    }

    setGeoCheckStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setUserLocation({ lat: userLat, lng: userLng });

        const centerLat = typeof currentSettings.geo_latitude === 'number' && !isNaN(currentSettings.geo_latitude) ? currentSettings.geo_latitude : 13.6929;
        const centerLng = typeof currentSettings.geo_longitude === 'number' && !isNaN(currentSettings.geo_longitude) ? currentSettings.geo_longitude : -89.2182;
        const radius = typeof currentSettings.geo_radius_km === 'number' && !isNaN(currentSettings.geo_radius_km) ? currentSettings.geo_radius_km : 25;

        const dist = calculateDistanceKm(userLat, userLng, centerLat, centerLng);
        setCalculatedDistance(dist);

        if (dist <= radius) {
          setGeoCheckStatus('allowed');
        } else {
          setGeoCheckStatus('restricted');
        }
      },
      (err) => {
        console.warn('Geolocation permission denied or unavailable in ProbarSuerte:', err);
        setGeoCheckStatus('restricted');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [fetchedSettings, fetchedGifts, fetchedOptions, fetchedMonthlyWinners] = await Promise.all([
        rouletteService.getSettings(),
        rouletteService.getGifts(false),
        rouletteService.getOptions(),
        rouletteService.getMonthlyWinners()
      ]);

      setSettings(fetchedSettings);
      setGifts(fetchedGifts);
      setOptions(fetchedOptions);
      setMonthlyWinners(fetchedMonthlyWinners);

      // Perform geo restriction validation
      checkUserGeolocation(fetchedSettings);

      if (activeUserId) {
        const [status, prizes] = await Promise.all([
          rouletteService.getUserStatus(activeUserId),
          rouletteService.getMyPrizes(activeUserId)
        ]);
        setUserStatus(status);
        setMyPrizes(prizes);

        setIsExtraAttempt(status.extra_attempt_available);
        setSecondsLeft(status.remaining_seconds || 0);
      }
    } catch (err) {
      console.error('Error cargando ruleta:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to realtime changes in gift_winners to keep monthly table updated
    const channel = supabase
      .channel('realtime_monthly_winners_ps')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gift_winners' }, () => {
        rouletteService.getMonthlyWinners().then((mw) => setMonthlyWinners(mw));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUserId]);

  // Live countdown timer tick
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          // Refetch user status once countdown finishes
          if (activeUserId) {
            rouletteService.getUserStatus(activeUserId).then((st) => setUserStatus(st));
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [secondsLeft, activeUserId]);

  // Format seconds to mm:ss
  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Build the wheel slices dynamically
  const wheelSlices: RouletteSlice[] = [];
  gifts.forEach((g) => {
    wheelSlices.push({
      id: g.id,
      type: 'gift',
      name: g.name,
      image_url: g.image_url,
      probability: g.probability
    });
  });

  options.forEach((o) => {
    wheelSlices.push({
      id: o.id,
      type: o.option_type,
      name: o.name,
      probability: o.probability
    });
  });

  // Handle spin button click
  const handleSpinClick = async () => {
    if (isSpinning || !activeUserId) return;
    if (secondsLeft > 0 && !isExtraAttempt) return;

    try {
      setIsSpinning(true);
      setSpinResult(null);

      // Request outcome from server
      const result = await rouletteService.spin(activeUserId, isExtraAttempt, {
        full_name: activeUser.full_name,
        email: activeUser.email,
        phone: activeUser.phone
      });

      setSpinResult(result);
      // Guarantee 100% exact alignment between winning item and visual wheel slice
      const exactWheelIndex = wheelSlices.findIndex(s => s.id === result.result_id);
      setTargetIndex(exactWheelIndex >= 0 ? exactWheelIndex : result.slice_index);
    } catch (err: any) {
      setIsSpinning(false);
      alert(err.message || 'Error al intentar girar la ruleta.');
    }
  };

  // Callback when visual rotation finishes
  const handleSpinEnd = () => {
    setIsSpinning(false);
    setShowResultModal(true);

    // Refresh prizes and status in background
    if (activeUserId) {
      rouletteService.getUserStatus(activeUserId).then((st) => {
        setUserStatus(st);
        setIsExtraAttempt(st.extra_attempt_available);
        setSecondsLeft(st.remaining_seconds || 0);
      });
      rouletteService.getMyPrizes(activeUserId).then((p) => setMyPrizes(p));
    }
    rouletteService.getMonthlyWinners().then((mw) => setMonthlyWinners(mw));
  };

  // Handle "Volver a Girar" for extra attempt wildcard
  const handleExtraSpin = () => {
    setShowResultModal(false);
    setIsExtraAttempt(true);
    setTimeout(() => {
      handleSpinClick();
    }, 400);
  };

  // Handle "Comprar Kit Personal" -> navigate to home section (/#/)
  const handleBuyKit = () => {
    setShowResultModal(false);
    navigate('/');
  };

  const unclaimedCount = myPrizes.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24">
      {/* Top Banner / Header */}
      <div className="bg-slate-900 text-white pt-8 pb-12 px-4 sm:px-6 lg:px-8 border-b border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/10 border border-amber-400/20 text-amber-300 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
              <span>🎡</span> Promoción NewBank Store
            </div>
            <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight">
              Probar mi suerte
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-xl mt-1">
              Gira la ruleta oficial y gana productos exclusivos, regalos directos o intentos adicionales para tu cuenta.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60 shadow-xl self-stretch md:self-auto">
            <button
              onClick={() => setActiveTab('wheel')}
              className={`flex-1 md:flex-initial px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === 'wheel'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🎡</span> Ruleta
            </button>
            <button
              onClick={() => setActiveTab('my_prizes')}
              className={`flex-1 md:flex-initial px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 relative ${
                activeTab === 'my_prizes'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🎁</span> Mis Premios
              {unclaimedCount > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-amber-500 text-slate-900 rounded-full text-[10px] font-black animate-pulse">
                  {unclaimedCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Cargando Ruleta de la Suerte...
            </p>
          </div>
        ) : (
          <>
            {/* Disclaimer when Impossible Mode is active */}
            {settings?.impossible_mode && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 flex items-start gap-3 shadow-sm"
              >
                <span className="text-2xl shrink-0">ℹ️</span>
                <div className="text-xs">
                  <h4 className="font-black uppercase tracking-wide text-amber-800">
                    Modalidad Promocional de Exhibición Activa
                  </h4>
                  <p className="font-medium text-amber-900/80 mt-0.5">
                    En esta sesión los productos se exhiben en la ruleta con fines de muestra. Las tiradas otorgarán oportunidades comodín especiales.
                  </p>
                </div>
              </motion.div>
            )}

            {/* TAB 1: RULETA INTERACTIVA */}
            {activeTab === 'wheel' && (
              <>
                {/* Checking geolocation status */}
                {settings?.geo_restriction_enabled && geoCheckStatus === 'checking' && (
                  <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Verificando disponibilidad de juegos para tu ubicación...
                    </p>
                  </div>
                )}

                {/* Restricted location: Display the exact required message */}
                {settings?.geo_restriction_enabled && geoCheckStatus === 'restricted' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-lg mx-auto bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xl text-center space-y-6 my-4"
                  >
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-4xl shadow-sm">
                      📍
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-600">
                        Restricción Geográfica
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                        por el momento no hay juegos disponibles para tu ubicacion.
                      </h3>
                      <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                        La Ruleta Rusa promocional solo está habilitada para usuarios dentro del área designada por la administración{settings?.geo_zone_name ? ` (${settings.geo_zone_name})` : ''}.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        onClick={() => settings && checkUserGeolocation(settings)}
                        className="px-5 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-wider hover:bg-black transition shadow cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>🔄</span> Reintentar con mi GPS
                      </button>
                      <button
                        onClick={() => navigate('/')}
                        className="px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition cursor-pointer"
                      >
                        Ir al Inicio
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Normal Roulette Wheel if unrestricted or location allowed */}
                {(!settings?.geo_restriction_enabled || geoCheckStatus === 'allowed') && (
                  <div className="w-full max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      {/* Left: Roulette Wheel & Controls */}
                      <div className="lg:col-span-7 xl:col-span-8 flex flex-col items-center">
                        {/* Status Bar */}
                        <div className="w-full max-w-md bg-white rounded-3xl p-4 mb-6 shadow-sm border border-slate-200/80 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                              {isExtraAttempt ? '⚡' : secondsLeft > 0 ? '⏳' : '✅'}
                            </div>
                            <div>
                              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
                                Estado de Participación
                              </span>
                              <p className="text-xs font-black uppercase text-slate-800">
                                {isExtraAttempt
                                  ? '¡Intento Extra Disponible!'
                                  : secondsLeft > 0
                                  ? `En espera: ${formatCountdown(secondsLeft)}`
                                  : '¡Listo para girar!'}
                              </p>
                            </div>
                          </div>

                          {secondsLeft > 0 && !isExtraAttempt && (
                            <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-center">
                              <span className="text-[9px] font-bold text-amber-600 uppercase block">Próximo giro en</span>
                              <span className="text-xs font-black font-mono text-amber-800">{formatCountdown(secondsLeft)}</span>
                            </div>
                          )}

                          {isExtraAttempt && (
                            <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase animate-pulse">
                              Giro Gratis
                            </span>
                          )}
                        </div>

                        {/* Roulette Wheel Component */}
                        <div className="w-full flex justify-center my-2">
                          <RouletteWheel
                            slices={wheelSlices}
                            isSpinning={isSpinning}
                            targetIndex={targetIndex}
                            onSpinEnd={handleSpinEnd}
                            onSpinClick={handleSpinClick}
                            disabled={
                              isSpinning ||
                              !settings?.is_active ||
                              (secondsLeft > 0 && !isExtraAttempt)
                            }
                            buttonLabel={
                              isSpinning
                                ? 'SUERTE...'
                                : isExtraAttempt
                                ? 'GIRAR ⚡'
                                : secondsLeft > 0
                                ? formatCountdown(secondsLeft)
                                : 'GIRAR'
                            }
                          />
                        </div>

                        {/* Quick Hint */}
                        <p className="text-[11px] font-bold text-slate-500 mt-1 mb-2 flex items-center justify-center gap-1.5 select-none text-center">
                          <span>💡</span> Toca cualquier premio en la ruleta para ver su imagen y nombre completo
                        </p>

                        {/* Bottom Guide info card */}
                        <div className="w-full max-w-xl mt-6 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm text-center space-y-2">
                          <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                            ¿Cómo funciona la ruleta de NewBank?
                          </h3>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Presiona el botón central para girar. Si ganas un regalo recibirás un código único para reclamarlo directamente con el propietario. Si obtienes un comodín podrás ganar un tiro adicional o probar tu suerte nuevamente en 1 hora.
                          </p>
                        </div>
                      </div>

                      {/* Right: Tabla de Ganadores del Mes */}
                      <div className="lg:col-span-5 xl:col-span-4 w-full">
                        <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4 sticky top-6">
                          {/* Header */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-slate-900 flex items-center justify-center text-2xl shadow-md shadow-amber-200">
                                🏆
                              </div>
                              <div>
                                <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight">
                                  Ganadores del Mes
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  {new Date().toLocaleDateString('es-SV', { month: 'long', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase">
                              {monthlyWinners.length} {monthlyWinners.length === 1 ? 'Ganador' : 'Ganadores'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                            Usuarios afortunados que han ganado un premio en la ruleta rusa de NewBank durante este mes:
                          </p>

                          {/* Table / List of Monthly Winners */}
                          {monthlyWinners.length === 0 ? (
                            <div className="py-12 text-center space-y-3 bg-slate-50/70 rounded-2xl p-4 border border-slate-100">
                              <div className="text-4xl">🎁</div>
                              <div>
                                <p className="text-xs font-black text-slate-700 uppercase">
                                  Sé el primer ganador del mes
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium mt-1">
                                  ¡Gira la ruleta y tu nombre aparecerá registrado aquí!
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                              {monthlyWinners.map((w, idx) => {
                                const wonDate = new Date(w.won_at).toLocaleDateString('es-SV', {
                                  day: 'numeric',
                                  month: 'short'
                                });
                                return (
                                  <div
                                    key={w.id || idx}
                                    className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50/80 hover:bg-slate-100/90 transition border border-slate-100/90 shadow-2xs"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-xs text-slate-700 shrink-0 shadow-2xs">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-900 truncate">
                                          {w.user_name || 'Usuario Ganador'}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-wider">
                                      {wonDate}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Footer note */}
                          <div className="pt-2 border-t border-slate-100 text-center">
                            <span className="text-[10px] text-slate-400 font-medium">
                              Actualizado en tiempo real • ¡Todos tienen oportunidad de ganar!
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
          </>
        )}

            {/* TAB 2: MIS PREMIOS GANADOS */}
            {activeTab === 'my_prizes' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                  <div>
                    <h3 className="text-xl font-black uppercase text-slate-900">
                      Mis Premios Obtenidos
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Historial completo de premios ganados con tu cuenta en la ruleta de NewBank.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-black uppercase">
                      {unclaimedCount} Pendientes
                    </span>
                    <span className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-black uppercase">
                      {myPrizes.filter((p) => p.status === 'DELIVERED').length} Entregados
                    </span>
                  </div>
                </div>

                {myPrizes.length === 0 ? (
                  <div className="bg-white rounded-3xl p-16 text-center border border-slate-200/80 shadow-sm space-y-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-3xl mx-auto">
                      🎁
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-800 uppercase">
                        Aún no tienes premios ganados
                      </h4>
                      <p className="text-xs text-slate-400 font-medium mt-1">
                        ¡Gira la ruleta en la pestaña anterior para tener la oportunidad de ganar!
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('wheel')}
                      className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg shadow-blue-100 hover:bg-blue-700 transition cursor-pointer"
                    >
                      Ir a Probar mi suerte
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myPrizes.map((prize) => {
                      const prizeDate = new Date(prize.won_at).toLocaleDateString('es-SV', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      });
                      const prizeTime = new Date(prize.won_at).toLocaleTimeString('es-SV', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      const isDelivered = prize.status === 'DELIVERED';

                      return (
                        <div
                          key={prize.id}
                          className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition"
                        >
                          <div className="flex gap-4 items-start">
                            {prize.gift_image_snapshot ? (
                              <img
                                src={prize.gift_image_snapshot}
                                alt={prize.gift_name_snapshot}
                                className="w-20 h-20 rounded-2xl object-cover border border-slate-100 shadow-sm shrink-0"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl shrink-0">
                                🎁
                              </div>
                            )}

                            <div className="space-y-1 flex-grow min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-black text-sm text-slate-900 leading-snug break-words">
                                  {prize.gift_name_snapshot}
                                </h4>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${
                                    isDelivered
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {isDelivered ? 'Entregado' : 'Pendiente de reclamar'}
                                </span>
                              </div>

                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                Obtenido: {prizeDate} • {prizeTime}
                              </p>

                              {prize.user_phone ? (
                                <p className="text-[10px] text-emerald-600 font-bold truncate">
                                  📱 {prize.user_phone}
                                </p>
                              ) : prize.user_email ? (
                                <p className="text-[10px] text-blue-600 font-bold truncate">
                                  ✉️ {prize.user_email}
                                </p>
                              ) : null}

                              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 mt-2">
                                <span className="text-[8px] font-black uppercase text-slate-400 block tracking-widest">
                                  CÓDIGO DE RECLAMO:
                                </span>
                                <span className="font-mono text-xs font-black text-blue-600 break-all">
                                  {prize.unique_code}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[11px]">
                            <span className="text-slate-500 font-medium">
                              Contacto de entrega: <strong className="text-slate-800">+{settings?.owner_phone || '50370914941'}</strong>
                            </span>

                            {!isDelivered ? (
                              <a
                                href={`https://wa.me/${(settings?.owner_phone || '50370914941').replace(/\+/g, '')}?text=${encodeURIComponent(`Hola, gané el premio: ${prize.gift_name_snapshot} con código único ${prize.unique_code}${prize.user_phone ? ` y mi WhatsApp es ${prize.user_phone}` : ''}`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-green-600 text-white rounded-xl font-black uppercase text-[10px] tracking-wider hover:bg-green-700 transition flex items-center gap-1"
                              >
                                <span>💬</span> Reclamar por WhatsApp
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold">
                                Entregado el {prize.delivered_at ? new Date(prize.delivered_at).toLocaleDateString() : 'fecha registrada'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Result Modal */}
      <RouletteResultModal
        isOpen={showResultModal}
        result={spinResult}
        user={activeUser}
        ownerPhone={settings?.owner_phone || '50370914941'}
        onClose={() => setShowResultModal(false)}
        onExtraSpin={handleExtraSpin}
        onBuyKit={handleBuyKit}
        onViewMyPrizes={() => setActiveTab('my_prizes')}
        onPhoneUpdated={(updatedPhone) => {
          if (spinResult?.winner_record) {
            spinResult.winner_record.user_phone = updatedPhone;
          }
          rouletteService.getMyPrizes(activeUserId).then((p) => setMyPrizes(p));
        }}
      />
    </div>
  );
};

export default ProbarSuerte;

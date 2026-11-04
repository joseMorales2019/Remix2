import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { RouletteWheel, RouletteSlice } from '../components/RouletteWheel';
import { RouletteResultModal } from '../components/RouletteResultModal';
import {
  rouletteService,
  RouletteSettings,
  RouletteGift,
  RouletteOption,
  GiftWinner,
  UserRouletteStatus,
  SpinResult
} from '../services/rouletteService';

export const ProbarSuerte: React.FC<{ user: any }> = ({ user }) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'wheel' | 'my_prizes'>('wheel');
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<RouletteSettings | null>(null);
  const [gifts, setGifts] = useState<RouletteGift[]>([]);
  const [options, setOptions] = useState<RouletteOption[]>([]);
  const [userStatus, setUserStatus] = useState<UserRouletteStatus | null>(null);
  const [myPrizes, setMyPrizes] = useState<GiftWinner[]>([]);

  // Spin State
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [isExtraAttempt, setIsExtraAttempt] = useState<boolean>(false);

  // Live countdown timer in seconds
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const timerIntervalRef = useRef<any>(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [fetchedSettings, fetchedGifts, fetchedOptions] = await Promise.all([
        rouletteService.getSettings(),
        rouletteService.getGifts(false),
        rouletteService.getOptions()
      ]);

      setSettings(fetchedSettings);
      setGifts(fetchedGifts);
      setOptions(fetchedOptions);

      if (user?.id) {
        const [status, prizes] = await Promise.all([
          rouletteService.getUserStatus(user.id),
          rouletteService.getMyPrizes(user.id)
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
  }, [user?.id]);

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
          if (user?.id) {
            rouletteService.getUserStatus(user.id).then((st) => setUserStatus(st));
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [secondsLeft, user?.id]);

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
    if (isSpinning || !user?.id) return;
    if (secondsLeft > 0 && !isExtraAttempt) return;

    try {
      setIsSpinning(true);
      setSpinResult(null);

      // Request outcome from server
      const result = await rouletteService.spin(user.id, isExtraAttempt, {
        full_name: user.full_name,
        email: user.email,
        phone: user.phone
      });

      setSpinResult(result);
      setTargetIndex(result.slice_index);
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
    if (user?.id) {
      rouletteService.getUserStatus(user.id).then((st) => {
        setUserStatus(st);
        setIsExtraAttempt(st.extra_attempt_available);
        setSecondsLeft(st.remaining_seconds || 0);
      });
      rouletteService.getMyPrizes(user.id).then((p) => setMyPrizes(p));
    }
  };

  // Handle "Volver a Girar" for extra attempt wildcard
  const handleExtraSpin = () => {
    setShowResultModal(false);
    setIsExtraAttempt(true);
    setTimeout(() => {
      handleSpinClick();
    }, 400);
  };

  // Handle "Comprar Kit Personal"
  const handleBuyKit = () => {
    setShowResultModal(false);
    navigate('/store');
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
            {/* Disclaimer when Impossible Mode is active (Section 6.3) */}
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
              <div className="flex flex-col items-center">
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
                                <h4 className="font-black text-sm text-slate-900 truncate">
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
                                href={`https://wa.me/${(settings?.owner_phone || '50370914941').replace(/\+/g, '')}?text=${encodeURIComponent(`Hola, gané el premio: ${prize.gift_name_snapshot} con código único ${prize.unique_code}`)}`}
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
        ownerPhone={settings?.owner_phone || '50370914941'}
        onClose={() => setShowResultModal(false)}
        onExtraSpin={handleExtraSpin}
        onBuyKit={handleBuyKit}
        onViewMyPrizes={() => setActiveTab('my_prizes')}
      />
    </div>
  );
};

export default ProbarSuerte;

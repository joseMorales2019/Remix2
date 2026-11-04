import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SpinResult } from '../services/rouletteService';

interface RouletteResultModalProps {
  isOpen: boolean;
  result: SpinResult | null;
  ownerPhone: string;
  onClose: () => void;
  onExtraSpin: () => void;
  onBuyKit: () => void;
  onViewMyPrizes?: () => void;
}

export const RouletteResultModal: React.FC<RouletteResultModalProps> = ({
  isOpen,
  result,
  ownerPhone,
  onClose,
  onExtraSpin,
  onBuyKit,
  onViewMyPrizes
}) => {
  if (!isOpen || !result) return null;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-SV', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const timeFormatted = now.toLocaleTimeString('es-SV', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-100 overflow-hidden text-center"
        >
          {/* Confetti / background flair */}
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* CASO A: GANADOR DE UN REGALO */}
          {result.result_type === 'gift' && (
            <div className="space-y-6">
              <div className="inline-flex p-4 bg-amber-100 rounded-3xl text-4xl shadow-inner">
                🎉
              </div>

              <div>
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-600 block mb-1">
                  ¡Premio Exclusivo!
                </span>
                <h3 className="text-3xl sm:text-4xl font-black uppercase text-slate-900 tracking-tight">
                  ¡FELICIDADES!
                </h3>
                <p className="text-xs sm:text-sm font-bold text-slate-500 mt-1">
                  Has ganado:
                </p>
              </div>

              {/* Product Card */}
              <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center gap-5 text-left">
                {result.gift?.image_url ? (
                  <img
                    src={result.gift.image_url}
                    alt={result.gift.name}
                    className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-2xl shadow-md border-2 border-white shrink-0"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-4xl shadow-md shrink-0">
                    🎁
                  </div>
                )}
                <div className="space-y-1.5 flex-grow">
                  <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-amber-400/20 text-amber-700 rounded-full">
                    Regalo Promocional
                  </span>
                  <h4 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                    {result.gift?.name || result.item_name}
                  </h4>
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                    <p><span className="font-bold text-slate-700">Fecha del premio:</span> {dateFormatted}</p>
                    <p><span className="font-bold text-slate-700">Hora:</span> {timeFormatted}</p>
                  </div>
                </div>
              </div>

              {/* Prize Details & Code */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 text-left space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Código de premio:</span>
                  <span className="font-mono font-black text-amber-300 tracking-wider">
                    {result.winner_record?.unique_code || 'NBK-GIFT-PENDING'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Estado:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black text-[10px] uppercase">
                    Pendiente de reclamar
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-white/10">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Número de contacto:</span>
                  <a
                    href={`https://wa.me/${ownerPhone.replace(/\+/g, '')}?text=${encodeURIComponent(`Hola, gané el premio: ${result.gift?.name} con código ${result.winner_record?.unique_code}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-blue-400 hover:text-blue-300 underline"
                  >
                    +{ownerPhone}
                  </a>
                </div>
              </div>

              <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-100 text-slate-700 text-xs leading-relaxed text-left">
                <p className="font-medium">
                  📢 <strong>Instrucciones:</strong> Comunícate con el propietario de Newbank Store para coordinar la entrega de tu premio. Presenta tu código de premio para facilitar su identificación.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {onViewMyPrizes && (
                  <button
                    onClick={() => {
                      onClose();
                      onViewMyPrizes();
                    }}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition shadow-lg"
                  >
                    Ver mis premios
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* CASO B: COMODÍN - TIENES UN INTENTO MÁS */}
          {result.result_type === 'extra_attempt' && (
            <div className="space-y-6">
              <div className="inline-flex p-4 bg-indigo-100 rounded-3xl text-4xl shadow-inner animate-bounce">
                ⚡
              </div>

              <div>
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-indigo-600 block mb-1">
                  Comodín Especial
                </span>
                <h3 className="text-3xl sm:text-4xl font-black uppercase text-slate-900 tracking-tight">
                  ¡TIENES UN INTENTO MÁS!
                </h3>
                <p className="text-xs sm:text-sm font-bold text-slate-500 mt-2">
                  ¡La suerte te sonríe! Tienes una oportunidad adicional gratuita para volver a girar la ruleta de inmediato.
                </p>
              </div>

              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-indigo-900 text-xs text-left">
                <p className="font-medium">
                  🎯 <strong>Regla especial:</strong> Este tiro adicional no descuenta intentos ni costo extra. ¡Presiona volver a girar para descubrir tu siguiente oportunidad!
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={onExtraSpin}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
                >
                  🎲 VOLVER A GIRAR
                </button>
              </div>
            </div>
          )}

          {/* CASO C: COMODÍN - GRACIAS POR PARTICIPAR */}
          {result.result_type === 'no_prize' && (
            <div className="space-y-6">
              <div className="inline-flex p-4 bg-slate-100 rounded-3xl text-4xl shadow-inner">
                ✨
              </div>

              <div>
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 block mb-1">
                  Resultado de la Tirada
                </span>
                <h3 className="text-2xl sm:text-3xl font-black uppercase text-slate-900 tracking-tight">
                  ¡Gracias por participar!
                </h3>
                <p className="text-xs sm:text-sm font-bold text-slate-500 mt-2 leading-relaxed">
                  «Hoy puede que no hayas ganado un regalo, pero todavía puedes probar tu suerte».
                </p>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/70 text-amber-900 text-xs text-left">
                <p className="font-semibold">
                  ⏳ <strong>Tiempo de espera:</strong> Tu siguiente participación estará habilitada nuevamente en 1 hora.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={onBuyKit}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>🛍️</span> Comprar Kit Personal
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3.5 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition cursor-pointer"
                >
                  Probar mi suerte en 1 hora
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

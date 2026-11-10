import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SpinResult, rouletteService } from '../services/rouletteService';
import { supabase } from '../supabase';

interface RouletteResultModalProps {
  isOpen: boolean;
  result: SpinResult | null;
  user?: any;
  ownerPhone: string;
  onClose: () => void;
  onExtraSpin: () => void;
  onBuyKit: () => void;
  onViewMyPrizes?: () => void;
  onPhoneUpdated?: (phone: string) => void;
  onEmailUpdated?: (email: string) => void;
}

export const RouletteResultModal: React.FC<RouletteResultModalProps> = ({
  isOpen,
  result,
  user,
  ownerPhone,
  onClose,
  onExtraSpin,
  onBuyKit,
  onViewMyPrizes,
  onPhoneUpdated,
  onEmailUpdated
}) => {
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [isSavingPhone, setIsSavingPhone] = useState<boolean>(false);
  const [phoneSaved, setPhoneSaved] = useState<boolean>(false);
  const [phoneError, setPhoneError] = useState<string>('');

  // States for Class Money gifts
  const [fullNameInput, setFullNameInput] = useState<string>('');
  const [accountNumberInput, setAccountNumberInput] = useState<string>('');
  const [bankNameInput, setBankNameInput] = useState<string>('');
  const [moneyDataSaved, setMoneyDataSaved] = useState<boolean>(false);
  const [moneySaveError, setMoneySaveError] = useState<string>('');
  const [isSavingMoney, setIsSavingMoney] = useState<boolean>(false);

  const winnerId = result?.winner_record?.id || result?.winner_record?.unique_code;

  const isMoneyGift = Boolean(
    result?.gift?.gift_class === 'money' ||
    result?.winner_record?.gift_class_snapshot === 'money' ||
    (result?.gift?.name && /dinero|efectivo|transferencia|\$\d+/i.test(result.gift.name)) ||
    (result?.item_name && /dinero|efectivo|transferencia|\$\d+/i.test(result.item_name))
  );

  useEffect(() => {
    if (!isOpen || !result) return;

    if (result.winner_record?.user_phone) {
      setPhoneInput(result.winner_record.user_phone);
      setPhoneSaved(true);
    } else if (user?.phone) {
      setPhoneInput(user.phone);
      setPhoneSaved(false);
    } else {
      setPhoneInput('');
      setPhoneSaved(false);
    }
    setPhoneError('');

    // Prepopulate full name
    if (result.winner_record?.user_name && result.winner_record.user_name !== 'Usuario NewBank') {
      setFullNameInput(result.winner_record.user_name);
    } else if (user?.full_name) {
      setFullNameInput(user.full_name);
    } else {
      setFullNameInput('');
    }

    // Prepopulate bank account & bank name
    if (result.winner_record?.bank_account) {
      setAccountNumberInput(result.winner_record.bank_account);
    } else if (user?.bank_account) {
      setAccountNumberInput(user.bank_account);
    } else {
      setAccountNumberInput('');
    }

    if (result.winner_record?.bank_name) {
      setBankNameInput(result.winner_record.bank_name);
    } else {
      setBankNameInput('');
    }

    if (result.winner_record?.bank_account && result.winner_record?.bank_name) {
      setMoneyDataSaved(true);
    } else {
      setMoneyDataSaved(false);
    }
    setMoneySaveError('');
  }, [isOpen, winnerId]);

  // Inyección dinámica del script oficial de Wompi para el widget de pago en caso de no premio
  useEffect(() => {
    if (isOpen && result?.result_type === 'no_prize') {
      const scriptId = 'wompi-roulette-script';
      const existing = document.getElementById(scriptId);
      if (existing) {
        existing.remove();
      }
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://pagos.wompi.sv/js/wompi.pagos.js';
      script.async = true;
      document.body.appendChild(script);

      return () => {
        const s = document.getElementById(scriptId);
        if (s) s.remove();
      };
    }
  }, [isOpen, result?.result_type]);

  if (!isOpen || !result) return null;

  const handleSavePhone = async () => {
    const trimmed = phoneInput.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (!trimmed || digits.length < 8) {
      setPhoneError('Por favor ingresa un número de WhatsApp válido (ej. 7845-1234 o +503 7845-1234)');
      return;
    }

    setIsSavingPhone(true);
    setPhoneError('');

    try {
      const winnerId = result.winner_record?.id;
      const uniqueCode = result.winner_record?.unique_code;

      if (winnerId || uniqueCode) {
        await rouletteService.updateWinnerContact(winnerId || uniqueCode || '', {
          user_phone: trimmed
        });
      }

      if (result.winner_record) {
        result.winner_record.user_phone = trimmed;
      }

      setPhoneSaved(true);
      if (onPhoneUpdated) {
        onPhoneUpdated(trimmed);
      }
      if (onEmailUpdated) {
        onEmailUpdated(trimmed);
      }
    } catch (err) {
      console.error('Error al guardar WhatsApp del ganador:', err);
      setPhoneError('Ocurrió un error al vincular tu WhatsApp. Intenta nuevamente.');
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleSaveMoneyData = async () => {
    const trimmedPhone = phoneInput.trim();
    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    const trimmedFullName = fullNameInput.trim();
    const trimmedAccount = accountNumberInput.trim();
    const trimmedBank = bankNameInput.trim();

    if (!trimmedPhone || phoneDigits.length < 8) {
      setMoneySaveError('Por favor ingresa un número de WhatsApp válido (ej. 7845-1234)');
      return;
    }
    if (!trimmedFullName) {
      setMoneySaveError('Por favor ingresa tu nombre completo');
      return;
    }
    if (!trimmedAccount) {
      setMoneySaveError('Por favor ingresa tu número de cuenta bancaria');
      return;
    }
    if (!trimmedBank) {
      setMoneySaveError('Por favor ingresa el nombre de tu banco');
      return;
    }

    setIsSavingMoney(true);
    setMoneySaveError('');

    try {
      const winnerId = result.winner_record?.id;
      const uniqueCode = result.winner_record?.unique_code;

      await rouletteService.updateWinnerContact(winnerId || uniqueCode || '', {
        user_phone: trimmedPhone,
        user_name: trimmedFullName,
        bank_account: trimmedAccount,
        bank_name: trimmedBank
      });

      if (user?.id) {
        try {
          await supabase.from('profiles').update({
            full_name: trimmedFullName,
            phone: trimmedPhone,
            bank_account: trimmedAccount
          }).eq('id', user.id);
        } catch {
          // ignore profile update error
        }
      }

      if (result.winner_record) {
        result.winner_record.user_phone = trimmedPhone;
        result.winner_record.user_name = trimmedFullName;
        result.winner_record.bank_account = trimmedAccount;
        result.winner_record.bank_name = trimmedBank;
      }

      setMoneyDataSaved(true);
      setPhoneSaved(true);
      if (onPhoneUpdated) onPhoneUpdated(trimmedPhone);
    } catch (err) {
      console.error('Error al guardar datos de transferencia:', err);
      setMoneySaveError('Ocurrió un error al guardar los datos. Intenta nuevamente.');
    } finally {
      setIsSavingMoney(false);
    }
  };

  const handleClose = async () => {
    if (result.result_type === 'gift') {
      if (isMoneyGift) {
        if (!moneyDataSaved && phoneInput.trim() && fullNameInput.trim() && accountNumberInput.trim() && bankNameInput.trim()) {
          await handleSaveMoneyData();
        }
      } else {
        if (phoneInput.trim() && !phoneSaved && phoneInput.replace(/\D/g, '').length >= 8) {
          await handleSavePhone();
        }
      }
    }
    onClose();
  };

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

  const whatsappContactMessage = isMoneyGift
    ? `Hola, gané el premio de dinero: ${result.gift?.name || result.item_name} con código ${result.winner_record?.unique_code || 'NBK-GIFT'}.\nMis datos para la transferencia son:\n• Nombre completo: ${fullNameInput || result.winner_record?.user_name || 'N/A'}\n• WhatsApp: ${phoneInput || 'N/A'}\n• N° de cuenta: ${accountNumberInput || 'N/A'}\n• Nombre del Banco: ${bankNameInput || 'N/A'}`
    : `Hola, gané el premio: ${result.gift?.name || result.item_name} con código ${result.winner_record?.unique_code || ''} y mi WhatsApp es ${phoneInput || 'registrado'}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-100 overflow-hidden text-center max-h-[90vh] overflow-y-auto"
        >
          {/* Confetti / background flair */}
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* CASO A: GANADOR DE UN REGALO */}
          {result.result_type === 'gift' && (
            <div className="space-y-6">
              <div className="inline-flex p-4 bg-amber-100 rounded-3xl text-4xl shadow-inner">
                {isMoneyGift ? '💵' : '🎉'}
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

              {/* Product / Money Card */}
              <div className="bg-gradient-to-b from-slate-50 to-slate-100/70 rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center gap-5 text-left">
                {result.gift?.image_url ? (
                  <img
                    src={result.gift.image_url}
                    alt={result.gift.name}
                    className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-2xl shadow-md border-2 border-white shrink-0"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-4xl shadow-md shrink-0">
                    {isMoneyGift ? '💵' : '🎁'}
                  </div>
                )}
                <div className="space-y-1.5 flex-grow">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                    isMoneyGift ? 'bg-emerald-400/20 text-emerald-700' : 'bg-amber-400/20 text-amber-700'
                  }`}>
                    {isMoneyGift ? 'Premio en Dinero' : 'Regalo Promocional'}
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

              {/* Formulario según clase de regalo: Dinero vs Producto */}
              {isMoneyGift ? (
                <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-4 text-left space-y-3 shadow-sm">
                  <div>
                    <label className="text-[10px] font-black uppercase text-emerald-900 tracking-wider block mb-1">
                      📱 Número de WhatsApp para entrega del premio:
                    </label>
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => {
                        setPhoneInput(e.target.value);
                        setMoneyDataSaved(false);
                        setMoneySaveError('');
                      }}
                      placeholder="Ingresa tu WhatsApp (ej. 7845-1234)"
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-emerald-900 tracking-wider block mb-1">
                      Nombre completo:
                    </label>
                    <input
                      type="text"
                      value={fullNameInput}
                      onChange={(e) => {
                        setFullNameInput(e.target.value);
                        setMoneyDataSaved(false);
                        setMoneySaveError('');
                      }}
                      placeholder="Ingresa tu nombre completo"
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-emerald-900 tracking-wider block mb-1">
                      N° de cuenta:
                    </label>
                    <input
                      type="text"
                      value={accountNumberInput}
                      onChange={(e) => {
                        setAccountNumberInput(e.target.value);
                        setMoneyDataSaved(false);
                        setMoneySaveError('');
                      }}
                      placeholder="Ingresa tu número de cuenta bancaria"
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-emerald-900 tracking-wider block mb-1">
                      Nombre del Banco:
                    </label>
                    <input
                      type="text"
                      value={bankNameInput}
                      onChange={(e) => {
                        setBankNameInput(e.target.value);
                        setMoneyDataSaved(false);
                        setMoneySaveError('');
                      }}
                      placeholder="Ingresa el nombre del banco (ej. Banco Agrícola, BAC, Cuscatlán)"
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    onClick={handleSaveMoneyData}
                    disabled={isSavingMoney || !phoneInput.trim() || !fullNameInput.trim() || !accountNumberInput.trim() || !bankNameInput.trim()}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm cursor-pointer"
                  >
                    {isSavingMoney ? 'Guardando...' : moneyDataSaved ? '✓ Guardado' : 'Guardar'}
                  </button>

                  {moneySaveError && (
                    <p className="text-[10px] font-bold text-red-600">{moneySaveError}</p>
                  )}
                  {moneyDataSaved && (
                    <p className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      ✓ Datos para la transferencia guardados correctamente.
                    </p>
                  )}
                </div>
              ) : (
                /* WhatsApp Request Section para premios tipo producto */
                <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-4 text-left space-y-2 shadow-sm">
                  <label className="text-[10px] font-black uppercase text-emerald-900 tracking-wider block">
                    📱 Número de WhatsApp para entrega del premio:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => {
                        setPhoneInput(e.target.value);
                        setPhoneSaved(false);
                        setPhoneError('');
                      }}
                      placeholder="Ingresa tu WhatsApp (ej. 7845-1234)"
                      className="flex-grow px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={handleSavePhone}
                      disabled={isSavingPhone || !phoneInput.trim()}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm shrink-0 cursor-pointer"
                    >
                      {isSavingPhone ? 'Guardando...' : phoneSaved ? '✓ Guardado' : 'Guardar'}
                    </button>
                  </div>
                  {phoneError && (
                    <p className="text-[10px] font-bold text-red-600">{phoneError}</p>
                  )}
                  {phoneSaved && (
                    <p className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      ✓ Número de WhatsApp vinculado correctamente a tu premio.
                    </p>
                  )}
                </div>
              )}

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
                    href={`https://wa.me/${ownerPhone.replace(/\+/g, '')}?text=${encodeURIComponent(whatsappContactMessage)}`}
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
                  📢 <strong>Instrucciones:</strong> Comunícate con el propietario de Newbank Store para coordinar la entrega de tu premio. Presenta tu código de premio y tu número de WhatsApp.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {onViewMyPrizes && (
                  <button
                    onClick={async () => {
                      await handleClose();
                      onViewMyPrizes();
                    }}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition shadow-lg cursor-pointer"
                  >
                    Ver mis premios
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-200 cursor-pointer"
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

              {/* Botón de pago Wompi solicitado para reactivar la suerte */}
              <div className="w-full flex flex-col items-center justify-center pt-1">
                <p className="text-base sm:text-lg font-black uppercase text-slate-900 tracking-tight mb-2 text-center">
                  Comprar un giro por $1
                </p>
                <div 
                  className="wompi_button_widget flex items-center justify-center w-full min-h-[48px]" 
                  data-url-pago="https://pagos.wompi.sv/IntentoPago/Redirect?id=60d8bc69-eb98-4e31-a40e-cb003df29380&esWidget=1" 
                  data-render="widget"
                >
                  <a
                    href="https://pagos.wompi.sv/IntentoPago/Redirect?id=60d8bc69-eb98-4e31-a40e-cb003df29380&esWidget=1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-6 bg-[#592c82] hover:bg-[#4a246d] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>💳</span> comprar mas giros ya
                  </a>
                </div>
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

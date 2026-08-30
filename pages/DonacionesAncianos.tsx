import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  Award, 
  Sparkles, 
  Users, 
  DollarSign, 
  CreditCard, 
  ArrowRight, 
  ExternalLink, 
  HelpCircle, 
  Info, 
  Gift, 
  Smile, 
  Clock, 
  Activity, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  Phone,
  Mail,
  Share2,
  Building,
  HeartHandshake
} from 'lucide-react';

interface DonacionesAncianosProps {
  user?: any;
}

export const DonacionesAncianos: React.FC<DonacionesAncianosProps> = ({ user }) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const wompiContainerRef = useRef<HTMLDivElement>(null);

  const wompiPaymentUrl = "https://pagos.wompi.sv/IntentoPago/Redirect?id=09c75adb-9e7c-49d3-8d9e-6e555537d9a5&esWidget=1";

  useEffect(() => {
    // Inyectar el script oficial de Wompi El Salvador
    const existingScript = document.getElementById('wompi-script');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'wompi-script';
    script.src = 'https://pagos.wompi.sv/js/wompi.pagos.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      const s = document.getElementById('wompi-script');
      if (s) s.remove();
    };
  }, []);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Donaciones para Adultos Mayores Salvadoreños | Solidaridad NewBank',
        text: 'Únete y apoya con una donación a los ancianos más vulnerables en El Salvador. Cada ayuda transforma una vida.',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const impactTiers = [
    {
      amount: 5,
      title: 'Kit de Alimentación Diaria',
      desc: 'Provee raciones nutritivas y complementos alimenticios balanceados para un adulto mayor.',
      icon: '🍲',
      beneficiaries: '1 abuelito/a por 3 días',
      accentColor: '#F4A261', // Coral Suave
      bgColor: 'bg-[#FDF7F2]',
      borderColor: 'border-[#F4A261]/40',
      image: '/images/donacion_alimentacion.jpg',
      imageAlt: 'Kit de alimentación nutritiva para adultos mayores'
    },
    {
      amount: 15,
      title: 'Medicamentos & Salud Básica',
      desc: 'Cubre tratamientos esenciales para hipertensión, diabetes, analgésicos y chequeos médicos preventivos.',
      icon: '💊',
      beneficiaries: 'Tratamiento mensual continuo',
      popular: true,
      accentColor: '#2A9D8F', // Verde Azulado
      bgColor: 'bg-[#F0F8F6]',
      borderColor: 'border-[#2A9D8F]',
      image: '/images/donacion_salud.jpg',
      imageAlt: 'Atención médica y medicamentos esenciales'
    },
    {
      amount: 30,
      title: 'Cuidado Integral & Higiene',
      desc: 'Incluye paquete de pañales geriátricos, artículos de aseo personal y atención en centros de cuidado diurno.',
      icon: '🩺',
      beneficiaries: 'Asistencia geriátrica completa',
      accentColor: '#A8C5A0', // Verde Suave
      bgColor: 'bg-[#F4F8F3]',
      borderColor: 'border-[#A8C5A0]/60',
      image: '/images/donacion_higiene.jpg',
      imageAlt: 'Artículos de higiene y cuidado geriátrico'
    },
    {
      amount: 50,
      title: 'Apadrinamiento Mensual',
      desc: 'Asegura alimentación completa, terapias físicas, recreación digna y acompañamiento afectivo continuo.',
      icon: '🏡',
      beneficiaries: 'Soporte vital durante todo el mes',
      accentColor: '#1D3557', // Azul Profundo
      bgColor: 'bg-[#F2E9D8]/50',
      borderColor: 'border-[#F2E9D8]',
      image: '/images/donacion_apadrinamiento.jpg',
      imageAlt: 'Apadrinamiento y convivencia para abuelitos'
    }
  ];

  const faqs = [
    {
      q: '¿Cómo se procesa mi donación y qué tan segura es?',
      a: 'Las transacciones se procesan directamente mediante Wompi El Salvador (plataforma oficial de pagos del Banco Agrícola). Cuenta con certificación internacional PCI-DSS y cifrado SSL de 256 bits. Tus datos financieros nunca son almacenados en nuestros servidores.'
    },
    {
      q: '¿Qué métodos de pago son aceptados?',
      a: 'Puedes donar con tarjetas de crédito y débito Visa, Mastercard, transferencias bancarias locales y billeteras digitales compatibles a través del widget seguro de Wompi.'
    },
    {
      q: '¿Cuál es el propósito de esta iniciativa de apoyo a los adultos mayores?',
      a: 'Está enfocada en la labor humanitaria y comunitaria en El Salvador, brindando vejez digna, salud, nutrición diaria y amor a ancianos en situación de abandono o extrema pobreza.'
    },
    {
      q: '¿Puedo donar si resido fuera de El Salvador (diáspora salvadoreña)?',
      a: '¡Sí, totalmente! La pasarela Wompi acepta tarjetas internacionales de Estados Unidos, Canadá, Europa y toda Latinoamérica. Tu donación se procesa en dólares (USD).'
    },
    {
      q: '¿Recibiré un comprobante oficial de mi donación?',
      a: 'Sí. Inmediatamente después de completar el pago en Wompi, el sistema emitirá en pantalla y enviará a tu correo electrónico el recibo digital con el número de autorización oficial del Banco Agrícola.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1D3557] pb-24 selection:bg-[#2A9D8F]/20 selection:text-[#1D3557]">
      
      {/* ========================================================
          HERO BANNER PRINCIPAL (Azul Profundo #1D3557 & Acentos)
          ======================================================== */}
      <section className="relative bg-[#1D3557] text-white py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden shadow-xl border-b border-[#2A9D8F]/30">
        
        {/* Imagen de Fondo en el Encabezado con Overlay Optimizado */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://www.magnific.com/es/fotos-vectores-gratis/ancianos-grandes" 
            alt="Adultos Mayores Salvadoreños"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/images/ancianos_salvadorenos_donaciones.jpg';
            }}
            className="w-full h-full object-cover object-center opacity-20 mix-blend-luminosity filter brightness-75 scale-105"
            referrerPolicy="no-referrer"
          />
          {/* Degradado Azul Profundo (#1D3557) con toques Verde Azulado (#2A9D8F) */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1D3557] via-[#1D3557]/90 to-[#122238]/95"></div>
          {/* Patrón sutil decorativo */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D6EAF8_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>

        <div className="max-w-5xl mx-auto relative z-10 text-center">
          
          {/* Badge Superior: Verde Azulado (#2A9D8F) + Coral Suave (#F4A261) */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2A9D8F]/20 border border-[#2A9D8F]/50 text-[#D6EAF8] text-xs font-black uppercase tracking-wider mb-4 backdrop-blur-md shadow-xs">
            <Heart className="w-3.5 h-3.5 text-[#F4A261] fill-[#F4A261] animate-pulse" />
            <span>Fundación Comunitaria • El Salvador</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-3 sm:mb-4 px-2">
            Unidos por los <span className="text-[#D6EAF8]">Adultos Mayores</span> de El Salvador
          </h1>

          <p className="text-[#D6EAF8]/90 text-sm sm:text-base md:text-lg max-w-3xl mx-auto font-medium leading-relaxed mb-6 sm:mb-8 px-2">
            Canalizamos tu apoyo solidario para brindar alimentación diaria, medicinas, abrigo y dignidad a abuelitos salvadoreños en condiciones de vulnerabilidad.
          </p>

          {/* Tarjeta Visual de Encabezado con marco Cálido */}
          <div className="max-w-xs sm:max-w-md mx-auto mb-6 sm:mb-8 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-2 border-[#F2E9D8]/30 bg-[#122238]/60 backdrop-blur-md group">
            <div className="h-44 sm:h-56 w-full overflow-hidden relative">
              <img 
                src="https://www.magnific.com/es/fotos-vectores-gratis/ancianos-grandes" 
                alt="Abuelitos Salvadoreños"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/images/ancianos_salvadorenos_donaciones.jpg';
                }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1D3557]/90 via-transparent to-transparent flex items-end p-3.5 sm:p-4">
                <span className="text-xs sm:text-sm font-bold text-[#F2E9D8] drop-shadow-md flex items-center gap-1.5">
                  <Smile className="w-4 h-4 text-[#F4A261]" /> Cuidado, amor y respeto para nuestros mayores
                </span>
              </div>
            </div>
          </div>

          {/* Sellos de Seguridad Rápidos en el Hero */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-[11px] sm:text-xs font-bold text-[#D6EAF8]">
            <div className="flex items-center gap-1.5 bg-[#122238]/70 px-3 py-1.5 rounded-xl backdrop-blur-xs border border-[#2A9D8F]/40 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-[#2A9D8F]" />
              <span>Pasarela Wompi / Banco Agrícola</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#122238]/70 px-3 py-1.5 rounded-xl backdrop-blur-xs border border-[#D6EAF8]/30 shadow-xs">
              <Lock className="w-4 h-4 text-[#D6EAF8]" />
              <span>Cifrado SSL 256-bit</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#122238]/70 px-3 py-1.5 rounded-xl backdrop-blur-xs border border-[#F4A261]/40 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-[#F4A261]" />
              <span>100% Ayuda Directa</span>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================
          CONTENEDOR PRINCIPAL
          ======================================================== */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 relative z-20">
        
        {/* ========================================================
            TARJETA PRINCIPAL DE PAGO WOMPI (Beige Cálido & Azul)
            ======================================================== */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl border border-[#F2E9D8] mb-10 sm:mb-12">
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pb-6 sm:pb-8 border-b border-[#F2E9D8]">
            
            <div className="space-y-1.5 text-center lg:text-left w-full lg:w-auto">
              <span className="inline-block text-[11px] font-black uppercase tracking-widest text-[#2A9D8F] bg-[#2A9D8F]/10 px-3 py-1 rounded-lg border border-[#2A9D8F]/20">
                Paso Único • Donación Segura
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1D3557] tracking-tight">
                Realiza tu aporte con Wompi
              </h2>
              <p className="text-xs sm:text-sm text-[#6C757D] max-w-lg mx-auto lg:mx-0">
                Haz clic en el botón oficial para efectuar tu donación mediante tarjeta de crédito/débito o cuenta bancaria.
              </p>
            </div>

            {/* Sello de Confianza Wompi / Banco Agrícola */}
            <div className="flex items-center gap-3 bg-[#FAF8F5] p-3 sm:p-3.5 rounded-2xl border border-[#F2E9D8] shrink-0 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#1D3557] text-white flex items-center justify-center font-black text-lg shadow-sm">
                W
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-[#6C757D] uppercase tracking-widest leading-none">Procesador Oficial</p>
                <p className="text-xs sm:text-sm font-extrabold text-[#1D3557] leading-tight mt-0.5">Wompi El Salvador</p>
                <p className="text-[10px] text-[#2A9D8F] font-bold flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2A9D8F] inline-block animate-pulse"></span>
                  Conexión Certificada Activa
                </p>
              </div>
            </div>

          </div>

          {/* Contenedor del Widget Wompi con marco en Azul Claro & Beige */}
          <div className="py-6 sm:py-8 my-4 flex flex-col items-center justify-center text-center bg-gradient-to-b from-[#D6EAF8]/25 via-[#FAF8F5] to-[#F2E9D8]/30 rounded-2xl border border-[#D6EAF8] p-4 sm:p-6">
            
            <div className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-[#1D3557] bg-white px-3.5 py-1.5 rounded-full shadow-xs border border-[#F2E9D8]">
              <CreditCard className="w-4 h-4 text-[#2A9D8F]" />
              <span>Acepta Visa, Mastercard y Cuentas Bancarias</span>
            </div>

            {/* Elemento oficial de Wompi Button Widget solicitado */}
            <div className="w-full max-w-sm sm:max-w-md my-3 flex flex-col items-center justify-center min-h-[56px]">
              <div 
                ref={wompiContainerRef}
                className="wompi_button_widget min-h-[48px] flex items-center justify-center w-full" 
                data-url-pago={wompiPaymentUrl} 
                data-render="widget"
              ></div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-3 text-[11px] sm:text-xs text-[#6C757D] font-medium">
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#1D3557]" /> Transacción encriptada
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2A9D8F]" /> Recibo con validez bancaria
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1D3557]" /> Respaldo Banco Agrícola
              </span>
            </div>

          </div>

          {/* Botón para compartir causa */}
          <div className="mt-4 pt-5 sm:pt-6 border-t border-[#F2E9D8] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#6C757D] font-medium text-center sm:text-left">
              ¿Deseas multiplicar el impacto? Comparte esta causa con familiares o compatriotas en el exterior.
            </p>
            <button
              type="button"
              onClick={handleShare}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#FAF8F5] hover:bg-[#F2E9D8] text-[#1D3557] font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-[#F2E9D8] transition cursor-pointer shrink-0 active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 text-[#2A9D8F]" />
              <span>{copiedLink ? '¡Enlace Copiado!' : 'Compartir Causa'}</span>
            </button>
          </div>

        </div>

        {/* ========================================================
            CARD "NUESTRO COMPROMISO" (Inspirado en la paleta oficial)
            ======================================================== */}
        <div className="bg-[#F2E9D8]/50 rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-[#F2E9D8] mb-10 sm:mb-14 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#2A9D8F] text-white flex items-center justify-center shrink-0 shadow-md">
              <Heart className="w-6 h-6 fill-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#1D3557]">
                Nuestro Compromiso con la Tercera Edad
              </h3>
              <p className="text-xs sm:text-sm text-[#6C757D] mt-0.5">
                Brindamos atención, respeto, salud y amor a nuestros mayores con total transparencia.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white rounded-xl border border-[#A8C5A0] text-xs font-bold text-[#2A9D8F] shadow-2xs shrink-0">
            <Sparkles className="w-4 h-4 text-[#F4A261]" />
            <span>Solidaridad Salvadoreña</span>
          </div>
        </div>

        {/* ========================================================
            NIVELES DE IMPACTO / DESTINO DE FONDOS
            ======================================================== */}
        <div className="mb-12 sm:mb-16">
          <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#2A9D8F] bg-[#2A9D8F]/10 px-3 py-1 rounded-lg border border-[#2A9D8F]/20">
              Transparencia y Destino de Fondos
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[#1D3557] tracking-tight mt-2">
              ¿Cómo transforma vidas tu donación?
            </h2>
            <p className="text-xs sm:text-sm text-[#6C757D] mt-1">
              Cada aporte se convierte directamente en bienestar, salud y atención para los abuelitos más necesitados.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {impactTiers.map((tier, idx) => (
              <div 
                key={idx}
                className={`relative rounded-2xl sm:rounded-3xl p-4 sm:p-5 border transition-all duration-200 flex flex-col justify-between overflow-hidden group ${
                  tier.popular 
                    ? 'bg-gradient-to-b from-[#F0F8F6] to-white border-2 border-[#2A9D8F] shadow-lg shadow-[#2A9D8F]/10' 
                    : `${tier.bgColor} ${tier.borderColor} shadow-xs hover:shadow-md`
                }`}
              >
                {tier.popular && (
                  <span className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-10 bg-[#2A9D8F] text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-xs">
                    Más Frecuente
                  </span>
                )}

                <div>
                  {/* Imagen de Referencia del Nivel de Impacto */}
                  <div className="w-full h-36 sm:h-40 rounded-xl overflow-hidden mb-3 relative bg-slate-100 border border-black/5 shadow-2xs">
                    <img 
                      src={tier.image} 
                      alt={tier.imageAlt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 left-2 w-8 h-8 rounded-lg bg-white/90 backdrop-blur-xs flex items-center justify-center text-lg shadow-xs border border-white/40">
                      {tier.icon}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl sm:text-2xl font-black text-[#1D3557]">
                      ${tier.amount} <span className="text-xs font-bold text-[#6C757D]">USD</span>
                    </span>
                  </div>

                  <h3 className="font-black text-[#1D3557] text-sm sm:text-base mb-1.5 leading-snug">
                    {tier.title}
                  </h3>
                  <p className="text-xs text-[#6C757D] leading-relaxed mb-4">
                    {tier.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-black/5 flex items-center gap-1.5 text-[11px] font-bold text-[#1D3557] bg-white/85 p-2.5 rounded-xl border border-black/5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#2A9D8F]" />
                  <span className="truncate">{tier.beneficiaries}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================
            PROGRAMAS DE ASISTENCIA INTEGRAL (Paleta de Colores Oficial)
            ======================================================== */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-xl border border-[#F2E9D8] mb-12 sm:mb-16">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8 border-b border-[#F2E9D8] pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#6C757D]">
                Iniciativa Comunitaria
              </span>
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-[#1D3557] tracking-tight">
                Programas de Asistencia Integral
              </h2>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2A9D8F] bg-[#2A9D8F]/10 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-[#F4A261]" />
              <span>El Salvador Solidario</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            
            {/* 1. Nutrición (Coral Suave / Beige) */}
            <div className="space-y-3 p-5 rounded-2xl bg-[#FDF7F2] border border-[#F4A261]/30">
              <div className="w-10 h-10 rounded-xl bg-[#F4A261]/20 border border-[#F4A261]/40 flex items-center justify-center text-[#1D3557]">
                <HeartHandshake className="w-5 h-5 text-[#F4A261]" />
              </div>
              <h3 className="font-extrabold text-sm text-[#1D3557]">1. Nutrición & Alimentación Caliente</h3>
              <p className="text-xs text-[#6C757D] leading-relaxed">
                Entrega de raciones balanceadas diarias y paquetes de víveres para ancianos que no cuentan con un sustento familiar o pensión.
              </p>
            </div>

            {/* 2. Salud (Azul Claro / Verde Azulado) */}
            <div className="space-y-3 p-5 rounded-2xl bg-[#F0F8FA] border border-[#D6EAF8]">
              <div className="w-10 h-10 rounded-xl bg-[#2A9D8F]/20 border border-[#2A9D8F]/40 flex items-center justify-center text-[#2A9D8F]">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-sm text-[#1D3557]">2. Salud Geriátrica & Medicinas</h3>
              <p className="text-xs text-[#6C757D] leading-relaxed">
                Jornadas médicas, suministro continuo de medicamentos para enfermedades crónicas y entrega de ayudas técnicas (bastones, andaderas).
              </p>
            </div>

            {/* 3. Centros de Día (Verde Suave / Beige) */}
            <div className="space-y-3 p-5 rounded-2xl bg-[#F4F8F3] border border-[#A8C5A0]/50">
              <div className="w-10 h-10 rounded-xl bg-[#A8C5A0]/30 border border-[#A8C5A0] flex items-center justify-center text-[#1D3557]">
                <Smile className="w-5 h-5 text-[#2A9D8F]" />
              </div>
              <h3 className="font-extrabold text-sm text-[#1D3557]">3. Centros de Día & Compañía</h3>
              <p className="text-xs text-[#6C757D] leading-relaxed">
                Espacios de convivencia donde los abuelitos realizan terapias ocupacionales, dinámicas artísticas y reciben calor humano para evitar la soledad.
              </p>
            </div>

          </div>
        </div>

        {/* ========================================================
            GARANTÍAS DE TRANSPARENCIA (Azul Profundo #1D3557)
            ======================================================== */}
        <div className="bg-[#1D3557] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl mb-12 sm:mb-16 border border-[#2A9D8F]/30">
          
          <div className="text-center max-w-xl mx-auto mb-6 sm:mb-8 px-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#F4A261] bg-[#F4A261]/15 px-3 py-1 rounded-lg border border-[#F4A261]/30">
              Compromiso Ético
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight mt-2 text-white">
              Tu confianza es nuestra prioridad
            </h2>
            <p className="text-xs sm:text-sm text-[#D6EAF8]/90 mt-1">
              Operamos con absoluta claridad y respeto hacia cada donante y beneficiario.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 text-left">
            
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <ShieldCheck className="w-5 h-5 text-[#2A9D8F] mb-2" />
              <h4 className="font-extrabold text-xs mb-1 text-white">Cero Comisiones Ocultas</h4>
              <p className="text-[11px] text-[#D6EAF8]/80 leading-relaxed">El 100% de tu aporte llega íntegro a las labores de ayuda y compras de víveres.</p>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <Building className="w-5 h-5 text-[#D6EAF8] mb-2" />
              <h4 className="font-extrabold text-xs mb-1 text-white">Entidad Bancaria Líder</h4>
              <p className="text-[11px] text-[#D6EAF8]/80 leading-relaxed">Pagos procesados por Wompi (Banco Agrícola El Salvador), institución líder y regulada.</p>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <Award className="w-5 h-5 text-[#F4A261] mb-2" />
              <h4 className="font-extrabold text-xs mb-1 text-white">Rendición Periódica</h4>
              <p className="text-[11px] text-[#D6EAF8]/80 leading-relaxed">Fotografías y reportes de entrega de víveres y medicamentos compartidos en comunidad.</p>
            </div>

            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <Lock className="w-5 h-5 text-[#A8C5A0] mb-2" />
              <h4 className="font-extrabold text-xs mb-1 text-white">Privacidad Total</h4>
              <p className="text-[11px] text-[#D6EAF8]/80 leading-relaxed">Tus datos personales y de pago están protegidos bajo estrictas leyes de protección de datos.</p>
            </div>

          </div>
        </div>

        {/* ========================================================
            PREGUNTAS FRECUENTES (FAQ)
            ======================================================== */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-xl border border-[#F2E9D8] mb-10">
          
          <div className="text-center max-w-xl mx-auto mb-6 sm:mb-8 px-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#2A9D8F] bg-[#2A9D8F]/10 px-3 py-1 rounded-lg border border-[#2A9D8F]/20">
              Resolviendo tus dudas
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#1D3557] tracking-tight mt-2">
              Preguntas Frecuentes sobre las Donaciones
            </h2>
          </div>

          <div className="space-y-3 max-w-3xl mx-auto">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div 
                  key={index}
                  className="rounded-2xl border border-[#F2E9D8] overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between gap-3 bg-[#FAF8F5] hover:bg-[#F2E9D8]/50 transition cursor-pointer"
                  >
                    <span className="font-bold text-xs sm:text-sm text-[#1D3557]">
                      {faq.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#2A9D8F] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#6C757D] shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="p-3.5 sm:p-4 bg-white text-xs text-[#6C757D] leading-relaxed border-t border-[#F2E9D8]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* ========================================================
            CINTILLO INSPIRACIONAL FINAL (Inspirado en el footer de la paleta)
            ======================================================== */}
        <div className="text-center py-4 px-3 bg-[#F2E9D8]/40 rounded-2xl border border-[#F2E9D8] flex items-center justify-center gap-2 text-xs text-[#1D3557] font-semibold">
          <Heart className="w-4 h-4 text-[#2A9D8F] fill-[#2A9D8F]/30 shrink-0" />
          <span>
            Esta iniciativa está diseñada para generar empatía, confianza y seguridad, creando un ambiente cálido, humano y profesional para nuestros adultos mayores.
          </span>
        </div>

      </div>
    </div>
  );
};

export default DonacionesAncianos;

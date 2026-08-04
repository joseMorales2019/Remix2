import React from 'react';

const Terms: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 pb-32">
      <div className="bg-white p-8 sm:p-16 rounded-[2.5rem] shadow-2xl border border-slate-100">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Términos y Condiciones de Uso de NewBank</h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Última actualización: 9 de febrero de 2026</p>
        
        <div className="space-y-8 text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
          <p>
            Al acceder, registrarte o usar la plataforma NewBank (la "Plataforma", la "App" o el "Servicio"), ya sea a través de la aplicación móvil, sitio web o cualquier medio relacionado, aceptas estos Términos y Condiciones ("Términos") en su totalidad. Si no estás de acuerdo, no uses el Servicio. NewBank es operado por [Nombre de la Entidad Legal / Razón Social], con domicilio en Santa Tecla, La Libertad, El Salvador ("NewBank", "nosotros", "nuestro").
          </p>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">1. Descripción del Servicio</h2>
            <p className="mb-3 font-bold text-blue-600 italic">NewBank es una plataforma comunitaria que facilita:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Registro de identidad con verificación (DUI, entrevista IA, validación comunitaria).</li>
              <li>Ahorros (depósitos verificados por vouchers).</li>
              <li>Préstamos (microcréditos con aprobación basada en score de confianza).</li>
              <li>Compra de acciones en proyectos comunitarios/bancarios.</li>
              <li>Sistema de score de confianza (inicial máximo 300 puntos, ajustado por comportamiento).</li>
              <li>Interacciones comunitarias (calificaciones, avales, reportes, regalos de puntos vía flechas ↑ ↓).</li>
              <li>Indicadores dinámicos (score personal, score comunitario promedio).</li>
            </ul>
            <p className="mt-3">El Servicio promueve inclusión financiera mediante confianza mutua, sin ser una entidad bancaria regulada tradicional (opera como cooperativa o fintech comunitaria bajo normativas aplicables de la SSF y BCR).</p>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">2. Elegibilidad y Registro</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Debes ser mayor de 18 años, residente en El Salvador y tener DUI válido.</li>
              <li>El registro requiere verificación de identidad (DUI + entrevista IA + validación comunitaria opcional).</li>
              <li>Aceptas que tu score de confianza se calcule según el Algoritmo de Confianza (detallado en la App y en estos Términos).</li>
              <li>NewBank puede rechazar o suspender cuentas por incumplimiento o bajo score.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">3. Sistema de Score de Confianza</h2>
            <p>El score mide confianza individual y comunitaria. Se calcula como se describe en el Algoritmo de Confianza (sección integrada en la App):</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Inicial:</strong> hasta 300 puntos (DUI + Entrevista IA + Validación Comunitaria).</li>
              <li><strong>Aumentos:</strong> por ahorros (+50 máx. +100), compras de acciones (+75 máx. +100), pagos a tiempo (+100 por préstamo), calificaciones (+25), avales positivos (hasta +100 por ciclo).</li>
              <li><strong>Disminuciones:</strong> por incumplimientos, devoluciones, reportes negativos, moras de avalados (hasta -100%).</li>
              <li><strong>Score comunitario promedio:</strong> visible en la parte inferior de la pantalla (S_total - S_penalizados, mínimo 0).</li>
            </ul>
            <p className="mt-4 font-black uppercase text-[10px] text-red-600">Consecuencias:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2 text-xs">
              <li><strong>Score &lt;50:</strong> Bloqueo total (no préstamos, ahorros ni acciones).</li>
              <li><strong>Score &lt;100:</strong> Restricciones parciales (no préstamos en la mayoría de casos).</li>
              <li><strong>Score &gt;150:</strong> Límites ampliados (+20% en préstamos, bonos en intereses).</li>
              <li><strong>Score &gt;200:</strong> Prioridad, descuentos, liderazgo comunitario.</li>
            </ul>
            <p className="mt-4">NewBank no garantiza aprobaciones; el score es orientativo y puede ajustarse por eventos.</p>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">4. Ahorros y Depósitos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Los ahorros se realizan mediante transferencias verificadas (vouchers subidos).</li>
              <li>No generamos intereses bancarios tradicionales; posibles bonos comunitarios basados en score.</li>
              <li>Devoluciones de ahorro: penalizan score (-100%) y bloquean funciones.</li>
              <li>Saldos visibles en la App; movimientos reflejados inmediatamente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">5. Préstamos y Créditos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Montos desde $25 (ajustables por score).</li>
              <li>Aprobación basada en score, análisis y garantías comunitarias.</li>
              <li>Tasas y plazos definidos al solicitar (sin intereses usurarios; regulados por leyes salvadoreñas).</li>
              <li>Mora o default: penaliza score (-100% si avalado) y reporta a burós si aplica.</li>
              <li>Pagos a tiempo: aumentan score (+100 + bonos).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">6. Compra de Acciones en Proyectos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Inversiones en proyectos comunitarios/bancarios.</li>
              <li>Devoluciones: penalizan score (-100%) y bloquean funciones.</li>
              <li>Prioridad y descuentos para scores altos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">7. Interacciones Comunitarias y Regalos de Puntos</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Puedes calificar/avaluar a otros usuarios (confiable/no confiable).</li>
              <li><strong>Botones de flecha ↑ ↓ (como en Reddit) sobre el indicador de score de cualquier usuario:</strong>
                <ul className="list-circle pl-5 mt-1">
                  <li><strong>↑ (arriba):</strong> Regalas puntos de confianza equivalentes a $1 por cada $1 que tengas ahorrado en tu cuenta NewBank.</li>
                  <li><strong>↓ (abajo):</strong> No aplica regalo (solo visual o reporte negativo si se implementa).</li>
                </ul>
              </li>
              <li><strong>Límite:</strong> Solo puedes regalar hasta el saldo ahorrado disponible.</li>
              <li><strong>Movimiento:</strong> Al regalar, se deduce inmediatamente de tus ahorros y se suma al score del receptor (actualización inmediata en ambos perfiles).</li>
              <li><strong>Abuso (regalos fraudulentos o masivos):</strong> Penaliza score y posible suspensión.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">8. Responsabilidades del Usuario</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Proporcionar información veraz (DUI, datos personales).</li>
              <li>No realizar actividades ilícitas (lavado, fraude).</li>
              <li>Cumplir pagos y no solicitar devoluciones injustificadas.</li>
              <li>Reportar irregularidades comunitarias de buena fe.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">9. Limitación de Responsabilidad</h2>
            <p>NewBank no es banco tradicional; no garantiza recuperación de fondos en caso de default comunitario. Riesgos: Pérdida total de inversión/ahorros/préstamos. No somos responsables por decisiones basadas en score o validaciones comunitarias.</p>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">10. Privacidad y Datos</h2>
            <p>Tratamos datos conforme a Ley de Acceso a la Información Pública y normativas SSF. Ver Política de Privacidad separada.</p>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">11. Terminación y Suspensión</h2>
            <p>Podemos suspender/bloquear cuentas por bajo score, incumplimiento o riesgo.</p>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">12. Ley Aplicable y Jurisdicción</h2>
            <p>Estos Términos se rigen por las leyes de la República de El Salvador. Cualquier disputa se resuelve en tribunales de Santa Tecla o San Salvador.</p>
          </section>

          <section>
            <h2 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-3">13. Modificaciones</h2>
            <p>Podemos actualizar estos Términos; notificación en App. Continuar uso = aceptación.</p>
          </section>

          <div className="pt-10 border-t border-slate-100 text-center">
            <p className="font-black text-slate-900 uppercase italic">NewBank – Construyendo confianza comunitaria en Santa Tecla y El Salvador.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
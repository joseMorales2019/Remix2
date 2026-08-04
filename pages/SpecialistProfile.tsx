import React from 'react';

const SpecialistProfile: React.FC<{ user: any }> = ({ user }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 sm:py-20">
      <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden font-sans text-slate-800 leading-relaxed">
        
        {/* 1. Datos de contacto */}
        <header className="bg-slate-900 p-8 sm:p-12 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight uppercase">
              Dr. Carlos Roberto Méndez <br />
              <span className="text-blue-400 text-lg sm:text-xl normal-case font-bold italic">Cardiólogo Intervencionista y Especialista en Hemodinamia</span>
            </h1>
            <div className="flex flex-wrap gap-4 text-sm font-medium opacity-80 pt-4">
              <span className="flex items-center gap-2">📍 San Salvador, El Salvador</span>
              <span className="flex items-center gap-2">📧 contacto@drmendez.sv</span>
              <span className="flex items-center gap-2">📱 +503 7788-9900 (WhatsApp Business)</span>
            </div>
          </div>
          <div className="flex gap-4">
            <a href="#" className="bg-white/10 p-3 rounded-xl hover:bg-blue-600 transition shadow-lg border border-white/20">
              <span className="text-xs font-black uppercase tracking-widest">LinkedIn</span>
            </a>
            <a href="#" className="bg-white/10 p-3 rounded-xl hover:bg-blue-600 transition shadow-lg border border-white/20">
              <span className="text-xs font-black uppercase tracking-widest">Website</span>
            </a>
          </div>
        </header>

        <div className="p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Columna Lateral (Foto e Info Rápida) */}
          <aside className="lg:col-span-1 space-y-10">
            {/* 2. Foto profesional (Descripción e Imagen Placeholder) */}
            <div className="space-y-4">
              <div className="aspect-[4/5] bg-slate-100 rounded-[2.5rem] border-4 border-white shadow-xl overflow-hidden relative group">
                <img 
                  src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=2070&auto=format&fit=crop" 
                  alt="Perfil Profesional" 
                  className="w-full h-full object-cover grayscale-25 group-hover:scale-105 transition duration-700" 
                />
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Recomendación Visual</h4>
                <p className="text-[10px] text-blue-900 font-bold leading-tight">
                  Se recomienda una fotografía con fondo neutro, vestimenta formal-profesional (bata blanca o traje ejecutivo) y expresión que denote empatía y seguridad. La iluminación debe ser suave para generar un entorno de máxima confianza.
                </p>
              </div>
            </div>

            {/* 6. Áreas de especialización */}
            <section className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] border-b pb-2 border-slate-200">Especialidades</h3>
              <div className="flex flex-wrap gap-2">
                {['Cardiología Clínica', 'Intervencionismo Coronario', 'Ecocardiografía Transesofágica', 'Hemodinamia Avanzada', 'Prevención de Riesgo'].map(tag => (
                  <span key={tag} className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-tighter">
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            {/* 8. Membresías */}
            <section className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] border-b pb-2 border-slate-200">Afiliaciones</h3>
              <ul className="space-y-3">
                <li className="text-xs font-bold text-slate-600 flex gap-2">
                  <span className="text-blue-600">✔</span> Colegio Médico de El Salvador
                </li>
                <li className="text-xs font-bold text-slate-600 flex gap-2">
                  <span className="text-blue-600">✔</span> Sociedad Salvadoreña de Cardiología
                </li>
                <li className="text-xs font-bold text-slate-600 flex gap-2">
                  <span className="text-blue-600">✔</span> American College of Cardiology (FACC)
                </li>
              </ul>
            </section>
          </aside>

          {/* Columna Principal */}
          <main className="lg:col-span-2 space-y-12">
            
            {/* 3. Extracto profesional */}
            <section className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
              <h3 className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] mb-4">Extracto Profesional</h3>
              <p className="text-lg sm:text-xl font-medium text-slate-700 leading-relaxed italic">
                "Médico especialista con más de 15 años de trayectoria en el diagnóstico y tratamiento mínimamente invasivo de patologías cardiovasculares complejas. He liderado más de 2,000 procedimientos de cateterismo cardíaco con una tasa de éxito superior al 98%, integrando tecnología de vanguardia y un enfoque humano centrado en la recuperación integral del paciente. Mi compromiso es transformar la salud cardíaca de mi comunidad mediante excelencia clínica y prevención estratégica."
              </p>
            </section>

            {/* 4. Credenciales y formación */}
            <section className="space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Formación Académica</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-600 pl-6 space-y-1">
                  <h4 className="text-sm font-black text-slate-900 uppercase">Doctorado en Medicina</h4>
                  <p className="text-xs font-bold text-slate-500">Universidad de El Salvador (UES) | 2005</p>
                </div>
                <div className="border-l-4 border-indigo-600 pl-6 space-y-1">
                  <h4 className="text-sm font-black text-slate-900 uppercase">Especialidad en Cardiología e Intervencionismo</h4>
                  <p className="text-xs font-bold text-slate-500">Instituto Nacional de Cardiología Ignacio Chávez (México) | 2010</p>
                </div>
                <div className="border-l-4 border-slate-900 pl-6 space-y-1">
                  <h4 className="text-sm font-black text-slate-900 uppercase">Maestría en Gestión Hospitalaria</h4>
                  <p className="text-xs font-bold text-slate-500">Universidad Politécnica de Madrid | 2014</p>
                </div>
              </div>
            </section>

            {/* 5. Experiencia profesional */}
            <section className="space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Experiencia Relevante</h3>
              <div className="space-y-8">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-black text-slate-900 uppercase">Jefe de la Unidad de Hemodinamia</h4>
                    <span className="bg-slate-100 px-3 py-1 rounded text-[10px] font-black">2016 – ACTUAL</span>
                  </div>
                  <p className="text-xs font-bold text-blue-600">Hospital de Diagnóstico, San Salvador</p>
                  <ul className="list-disc pl-5 text-xs font-medium text-slate-600 space-y-1 pt-2">
                    <li>Dirección de un equipo multidisciplinario de 12 especialistas.</li>
                    <li>Reducción del 20% en tiempos de respuesta para angioplastias de emergencia.</li>
                    <li>Implementación de protocolos de seguridad del paciente bajo estándares internacionales.</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-black text-slate-900 uppercase">Cardiólogo de Staff</h4>
                    <span className="bg-slate-100 px-3 py-1 rounded text-[10px] font-black">2011 – 2015</span>
                  </div>
                  <p className="text-xs font-bold text-blue-600">Instituto Salvadoreño del Seguro Social (ISSS)</p>
                  <ul className="list-disc pl-5 text-xs font-medium text-slate-600 space-y-1 pt-2">
                    <li>Atención de consulta externa y hospitalaria para pacientes críticos.</li>
                    <li>Docente del programa de residencia médica en medicina interna.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 7. Publicaciones y Ponencias */}
            <section className="space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Investigaciones y Ponencias</h3>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-700 italic leading-tight">
                    "Avances en el tratamiento percutáneo del infarto agudo al miocardio en El Salvador." 
                  </p>
                  <p className="text-[10px] font-black text-blue-600 uppercase mt-2">Revista Médica de Centroamérica | 2021</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-700 italic leading-tight">
                    "Ponente Internacional: Nuevas fronteras en Hemodinamia Avanzada." 
                  </p>
                  <p className="text-[10px] font-black text-blue-600 uppercase mt-2">Congreso Interamericano de Cardiología, Argentina | 2023</p>
                </div>
              </div>
            </section>

            {/* 9. Habilidades y Competencias */}
            <section className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Habilidades y Competencias</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase mb-2">Técnicas</h5>
                  <p className="text-xs font-bold text-slate-700">Ecografía Doppler • Stent Coronario • Marcapasos • Soporte Vital Avanzado (ACLS)</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase mb-2">Idiomas</h5>
                  <p className="text-xs font-bold text-slate-700">Español (Nativo) • Inglés (C1 - Avanzado Médico)</p>
                </div>
              </div>
            </section>

            {/* 10. Testimonios */}
            <section className="space-y-6 pt-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Opiniones Destacadas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 relative">
                  <span className="text-4xl absolute -top-4 -left-2 opacity-20">“</span>
                  <p className="text-xs font-bold text-indigo-900 italic mb-4">"El Dr. Méndez salvó mi vida con una intervención rápida y precisa. Su trato humano es inmejorable."</p>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 text-xs">★★★★★</span>
                    <span className="text-[10px] font-black text-indigo-400 uppercase">Paciente Recuperado</span>
                  </div>
                </div>
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 relative">
                  <span className="text-4xl absolute -top-4 -left-2 opacity-20">“</span>
                  <p className="text-xs font-bold text-blue-900 italic mb-4">"Calificación promedio de 5.0 ★ en directorios médicos. Reconocido por su excelencia técnica y ética."</p>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 text-xs">★★★★★</span>
                    <span className="text-[10px] font-black text-blue-400 uppercase">Google My Business</span>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>

        <footer className="bg-slate-50 p-8 text-center border-t border-slate-100">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Perfil Verificado por NewBank AI Specialist Directory</p>
        </footer>
      </div>
    </div>
  );
};

export default SpecialistProfile;
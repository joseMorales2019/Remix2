import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { supabase } from './supabase';
import Dashboard from './pages/Dashboard';
import PublicDefaulters from './pages/PublicDefaulters';
import LoanApplication from './pages/LoanApplication';
import Payments from './pages/Payments';
import Admin from './pages/Admin';
import Register from './pages/Register';
import CommunityActivity from './pages/CommunityActivity';
import Profile from './pages/Profile';
import Savings from './pages/Savings';
import Terms from './pages/Terms';
import Store from './pages/Store';
import ProjectsView from './pages/ProjectsView';
import Gallery from './pages/Gallery';
import SpecialistProfile from './pages/SpecialistProfile';
import FeedbackRequests from './pages/FeedbackRequests';
import Games from './pages/Games';
import PaymentRequests from './pages/PaymentRequests';
import HelpRequests from './pages/HelpRequests';
import AliadoOrders from './pages/AliadoOrders';
import UserOrders from './pages/UserOrders';
import ITTools from './pages/ITTools';
import ADomicilio from './pages/ADomicilio';


const CommunityScoreIndicator: React.FC = () => {
  const [score, setScore] = useState(0);

  const calculateCommunityScore = async () => {
    const { data: users } = await supabase.from('profiles').select('reliability_score, id');
    const { data: loans } = await supabase.from('loans').select('user_id, status');
    const { data: savings } = await supabase.from('savings').select('user_id, status');

    if (!users || users.length === 0) return;

    const penalizedUserIds = new Set([
      ...(loans?.filter(l => l.status === 'DEFAULTED').map(l => l.user_id) || []),
      ...(savings?.filter(s => s.status === 'RETURN_REQUESTED' || s.status === 'RETURNED').map(s => s.user_id) || [])
    ]);

    const sTotal = users.reduce((acc, u) => acc + (u.reliability_score || 0), 0) / users.length;
    
    let sPenalizados = 0;
    const penalizedUsers = users.filter(u => penalizedUserIds.has(u.id));
    if (penalizedUsers.length > 0) {
      sPenalizados = penalizedUsers.reduce((acc, u) => acc + (u.reliability_score || 0), 0) / penalizedUsers.length;
    }

    const finalScore = Math.max(0, sTotal - sPenalizados);
    setScore(Math.round(finalScore));
  };

  useEffect(() => {
    calculateCommunityScore();
    const interval = setInterval(calculateCommunityScore, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-md text-white px-6 py-2 rounded-full border border-white/20 shadow-2xl flex items-center gap-3">
      <div className="flex flex-col items-center">
        <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Confianza Comunidad</span>
        <span className="text-sm font-black text-blue-400">{score} pts</span>
      </div>
      <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(score / 300) * 100}%` }}></div>
      </div>
    </div>
  );
};

const SmartSlideMenu: React.FC<{ user: any; onSignOut: () => void }> = ({ user, onSignOut }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  // Definición de enlaces con lógica de roles basada en el prompt
  const navLinks = [
    { to: "/", label: "Realizar Pedidos", icon: "🛵", category: 'Navegación', roles: ['admin', 'especialista', 'estudiante', 'invitado', 'inversionista', 'MYPE', 'aliado', 'jugador', 'ayudame', 'creditos'] },
    { to: "/dashboard", label: "Tienda en linea", icon: "📊", category: 'Navegación', roles: ['admin', 'especialista', 'estudiante', 'invitado', 'inversionista', 'MYPE', 'aliado', 'jugador', 'ayudame', 'creditos'] },
    { to: "/gallery", label: "Galería", icon: "🖼️", category: 'Comunidad', roles: ['admin', 'especialista', 'estudiante', 'inversionista', 'MYPE'] },

    { to: "/feedback-requests", label: "Feedback", icon: "📝", category: 'Comunidad', roles: ['admin', 'especialista'] },
    { to: "/help-requests", label: "Ayúdame", icon: "📄", category: 'Comunidad', roles: ['admin', 'ayudame', 'especialista'] },
    { to: "/store", label: "Tienda", icon: "💎", category: 'Navegación', roles: ['admin', 'especialista', 'estudiante', 'invitado', 'inversionista', 'MYPE', 'jugador', 'ayudame', 'aliado'] },
    { to: "/it-tools", label: "Herramientas TI", icon: "🛠️", category: 'Navegación', roles: ['admin', 'invitado', 'estudiante', 'especialista', 'aliado'] },
    { to: "/games", label: "Juegos", icon: "🎰", category: 'Navegación', roles: ['admin', 'especialista', 'estudiante', 'invitado', 'inversionista', 'MYPE', 'jugador', 'ayudame', 'creditos'] },
    { to: "/morosos", label: "Lista pública", icon: "📋", category: 'Gestión', roles: ['admin'] },
    { to: "/comunidad", label: "Validaciones", icon: "🤝", category: 'Gestión', roles: ['admin', 'especialista', 'estudiante', 'inversionista', 'MYPE'] },
    { to: "/mis-pedidos", label: "Mis Pedidos", icon: "🎁", category: 'Operaciones', roles: ['admin', 'especialista', 'estudiante', 'invitado', 'inversionista', 'MYPE', 'jugador', 'ayudame', 'aliado'] },
    { to: "/aliado-pedidos", label: "Pedidos", icon: "📦", category: 'Operaciones', roles: ['aliado', 'admin'] },
    { to: "/projects", label: "mis proyectos", icon: "🚀", category: 'Comunidad', roles: ['admin', 'estudiante'] },
    { to: "/apply", label: "Pedido", icon: "💸", category: 'Operaciones', roles: ['admin', 'creditos'] },
    { to: "/ahorros", label: "Mis Ahorros", icon: "💰", category: 'Operaciones', roles: ['admin', 'MYPE', 'creditos'] },
    { to: "/payments", label: "Mis Pagos", icon: "💳", category: 'Operaciones', roles: ['admin', 'especialista', 'estudiante', 'inversionista', 'MYPE', 'creditos'] },
    { to: "/profile", label: "Mi Perfil", icon: "👤", category: 'Navegación', roles: ['admin', 'especialista', 'estudiante', 'invitado', 'inversionista', 'MYPE', 'jugador', 'creditos', 'aliado', 'ayudame'] },
    { to: "/payment-requests", label: "Cobros", icon: "💸", category: 'Operaciones', roles: ['admin', 'especialista', 'estudiante', 'inversionista', 'MYPE', 'jugador'] },
    { to: "/admin", label: "Gestión", icon: "⚙️", category: 'Gestión', roles: ['admin', 'aliado'] }
  ].filter(link => {
    if (link.to === "/games") return false;
    if (!user) return link.to === "/" || link.to === "/dashboard" || link.to === "/profile";
    // Si es administrador, tiene acceso a todas las rutas relevantes
    if (user.is_admin) return true;
    const type = user.profile_type;
    // Always show Home, Dashboard and Profile for everyone.
    if (link.to === "/") return true;
    if (link.to === "/dashboard") return true;
    if (link.to === "/profile") return true;
    if (link.to === "/games" && type === 'aliado') return false;
    if (link.to === "/games") return true;
    return link.roles.includes(type);
  });

  const groupedLinks = navLinks.reduce((acc: any, link: any) => {
    const cat = link.category || 'Otros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(link);
    return acc;
  }, {});

  return (
    <>
      <nav className={`bg-white border-b border-slate-200 sticky top-0 z-40 h-[50px] flex items-center px-4 sm:px-6 lg:px-8 ${location.pathname === '/games' ? 'hidden md:flex' : ''}`}>
        <div className="flex justify-between w-full max-w-7xl mx-auto items-center">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">N</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 leading-none">
                  NewBank.
                </span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5" style={{ marginTop: '-3px' }}>
                  Store
                </span>
                <span className="text-[10px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 leading-none" style={{ marginLeft: '0px', marginTop: '3px' }}>
                  El Salvador
                </span>
              </div>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.filter(l => l.category === 'Navegación' || (user?.is_admin && l.category === 'Gestión' && l.label === 'Gestión')).map((link) => (
              <Link 
                key={link.to} 
                to={link.to}
                className={`px-3 py-2 rounded-xl text-xs lg:text-sm font-bold transition-all ${
                  location.pathname === link.to 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            
            {!isStandalone && (
              <button 
                onClick={handleInstallClick}
                className="bg-blue-600 text-white px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-sm border border-blue-600 flex items-center gap-1.5 cursor-pointer ml-2"
                title="Instalar App en tu dispositivo"
              >
                <span>📲</span> Instalar App
              </button>
            )}
            
            <div className="h-6 w-px bg-slate-200 mx-2 lg:mx-4"></div>
            
            {user ? (
              <div className="flex items-center space-x-3 lg:space-x-4 pl-2">
                <div className="hidden lg:flex flex-col items-end mr-2">
                   <span className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Tu Score</span>
                   <span className="text-xs font-black text-blue-600">{user.reliability_score || 0}/300</span>
                </div>
                <Link to="/profile" className="flex items-center space-x-2 group" aria-label={`Perfil de ${user.full_name}`}>
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center font-bold text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all overflow-hidden relative">
                    {user.profile_image_url ? (
                      <img src={user.profile_image_url} alt={`Imagen de perfil de ${user.full_name}`} className="w-full h-full object-cover" />
                    ) : (
                      user.full_name[0]
                    )}
                    {user.is_verified && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center border border-white">
                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-black text-slate-700 hidden lg:block truncate max-w-[100px]">{user.full_name.split(' ')[0]}</span>
                </Link>
                <button 
                  onClick={onSignOut}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition shadow-md"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link 
                to="/register"
                className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition"
              >
                Acceder
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isStandalone && (
              <button 
                onClick={handleInstallClick}
                className="md:hidden bg-blue-600 text-white px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 transition shadow-sm flex items-center gap-1 cursor-pointer"
                title="Instalar App"
              >
                <span>📲</span> App
              </button>
            )}
            <button 
              onClick={() => setIsOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors group flex items-center gap-2"
              aria-label="Abrir menú"
            >
              <span className="hidden md:block text-[10px] font-black uppercase text-slate-400 tracking-widest group-hover:text-blue-600 transition-colors">Menú</span>
              <div className="space-y-1.5">
                <div className="w-6 h-0.5 bg-slate-600 group-hover:bg-blue-600 transition-all"></div>
                <div className="w-4 h-0.5 bg-slate-600 group-hover:bg-blue-600 transition-all ml-auto"></div>
                <div className="w-6 h-0.5 bg-slate-600 group-hover:bg-blue-600 transition-all"></div>
              </div>
            </button>
          </div>
        </div>
      </nav>

      {location.pathname === '/games' && (
        <button 
          onClick={() => setIsOpen(true)}
          className="md:hidden fixed top-4 right-4 z-40 p-3 bg-white/10 backdrop-blur-md border border-white/20 shadow-lg rounded-xl transition-colors group"
          aria-label="Abrir menú"
        >
          <div className="space-y-1.5">
            <div className="w-6 h-0.5 bg-white group-hover:bg-blue-400 transition-all"></div>
            <div className="w-4 h-0.5 bg-white group-hover:bg-blue-400 transition-all ml-auto"></div>
            <div className="w-6 h-0.5 bg-white group-hover:bg-blue-400 transition-all"></div>
          </div>
        </button>
      )}

      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      ></div>

      <aside 
        className={`fixed top-0 right-0 h-full w-[280px] bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">N</span>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-slate-900 uppercase tracking-tighter leading-none">NewBank.</span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5">Store</span>
              <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest leading-none mt-0.5">El Salvador</span>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
          {Object.entries(groupedLinks).map(([category, links]: [string, any]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1">
                {category}
              </h3>
              <div className="space-y-1">
                {links.map((link: any) => (
                  <Link 
                    key={link.to} 
                    to={link.to}
                    className={`flex items-center space-x-4 p-4 rounded-2xl transition-all font-bold text-sm ${
                      location.pathname === link.to 
                      ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100' 
                      : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xl">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          
          <a 
            href="https://wa.me/50370914941?text=Hola,%20me%20gustar%C3%ADa%20registrarme%20como%20aliado%20en%20NewBank"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-4 p-4 rounded-2xl transition-all font-bold text-xs text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100"
          >
            <span className="text-xl">🤝</span>
            <span>Vende con nosotros en El Salvador</span>
          </a>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-3">
          {!isStandalone && (
            <button 
              onClick={handleInstallClick}
              className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition shadow-sm border border-blue-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>📲</span> Instalar / Descargar App
            </button>
          )}

          {user ? (
            <div className="space-y-4">
              <Link 
                to="/profile"
                className="flex items-center space-x-3 p-2 -m-2 rounded-2xl hover:bg-slate-100/80 transition-colors group cursor-pointer"
                title="Ir a Mi Perfil"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center font-bold text-blue-600 overflow-hidden relative group-hover:ring-2 group-hover:ring-blue-500 transition-all">
                  {user.profile_image_url ? (
                    <img src={user.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    user.full_name[0]
                  )}
                  {user.is_verified && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border border-white">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    </div>
                  )}
                </div>
                <div className="overflow-hidden flex-grow">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 truncate text-sm group-hover:text-blue-600 transition-colors">{user.full_name}</p>
                    <span className="text-[10px] text-blue-600 font-bold uppercase ml-1">Ver ›</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest truncate">{user.reliability_score}/300 pts</p>
                </div>
              </Link>
              <button 
                onClick={onSignOut}
                className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition shadow-lg cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <Link 
              to="/register"
              className="block w-full bg-blue-600 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest text-center shadow-xl shadow-blue-100 hover:bg-blue-700 transition"
            >
              Acceder
            </Link>
          )}
        </div>
      </aside>

      {showInstallModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-blue-100 text-center relative">
            <button 
              onClick={() => setShowInstallModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 text-xl font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
              <span className="text-white font-black text-2xl">N</span>
            </div>

            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-2">Instalar NewBank App</h3>
            <p className="text-xs text-slate-500 font-medium mb-5 leading-relaxed">
              Descarga la aplicación en tu pantalla de inicio para un acceso directo, más rápido y sin barra de navegador.
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-3 mb-6 border border-slate-100">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">📱</span>
                <div className="text-[11px]">
                  <strong className="block text-slate-900 font-bold">En Android (Chrome):</strong>
                  <span className="text-slate-600">Toca el menú de 3 puntos (⋮) arriba a la derecha y selecciona <b>"Instalar aplicación"</b> o <b>"Agregar a la pantalla principal"</b>.</span>
                </div>
              </div>
              <div className="h-px bg-slate-200/60" />
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">🍏</span>
                <div className="text-[11px]">
                  <strong className="block text-slate-900 font-bold">En iPhone / iPad (Safari):</strong>
                  <span className="text-slate-600">Toca el botón <b>Compartir</b> (cuadro con flecha ⎘) en la barra inferior y elige <b>"Agregar al inicio"</b>.</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-100 cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const GlobalAudioPlayer: React.FC<{ user: any }> = ({ user }) => {
  const location = useLocation();
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('newbank_sound_enabled');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    const audio = new Audio('https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/newBankSonidoCasinoUno/mfcc-lottery-casino-pause-intro-background-music-120443.mp3');
    audio.loop = true;
    bgMusicRef.current = audio;

    const handleStorageChange = () => {
      const saved = localStorage.getItem('newbank_sound_enabled');
      setSoundEnabled(saved === null ? true : saved === 'true');
    };

    window.addEventListener('storage', handleStorageChange);
    // Custom event for same-window updates
    window.addEventListener('soundStateChanged', handleStorageChange);

    return () => {
      audio.pause();
      bgMusicRef.current = null;
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('soundStateChanged', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!bgMusicRef.current || !user || user.profile_type !== 'jugador') {
      bgMusicRef.current?.pause();
      return;
    }

    const allowedPaths = ['/store', '/games', '/payment-requests', '/profile'];
    const isAllowedPath = allowedPaths.includes(location.pathname);

    if (soundEnabled && isAllowedPath) {
      bgMusicRef.current.play().catch(err => console.log("Audio play failed:", err));
    } else {
      bgMusicRef.current.pause();
    }
  }, [location.pathname, soundEnabled, user]);

  if (!user || user.profile_type !== 'jugador') return null;

  const allowedPaths = ['/store', '/games', '/payment-requests', '/profile'];
  const isAllowedPath = allowedPaths.includes(location.pathname);

  if (!isAllowedPath) return null;

  return null;
};

const NotificationHandler: React.FC<{ user: any }> = ({ user }) => {
  const [notification, setNotification] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!user) return;

    const socket = io();

    socket.on('connect', () => {
      socket.emit('identify', user.id);
    });

    socket.on('notification', (data) => {
      setNotification(data);
      
      // Try Browser Notification
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification(data.title, { body: data.body });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then(permission => {
            if (permission === "granted") {
              new Notification(data.title, { body: data.body });
            }
          });
        }
      }

      // Auto-hide in-app notification after 10 seconds
      setTimeout(() => setNotification(null), 10000);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  if (!notification) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] animate-bounce-in">
      <div className="bg-white border-l-4 border-blue-600 p-4 rounded-2xl shadow-2xl max-w-sm flex items-start gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl shrink-0">
          🔔
        </div>
        <div className="flex-grow">
          <h4 className="font-black text-slate-900 uppercase text-xs tracking-tight">{notification.title}</h4>
          <p className="text-[10px] text-slate-500 font-medium mt-1 leading-relaxed">{notification.body}</p>
          <button 
            onClick={() => setNotification(null)}
            className="mt-2 text-[9px] font-black text-blue-600 uppercase hover:underline"
          >
            Entendido
          </button>
        </div>
        <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-900">×</button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      try {
        const storedId = localStorage.getItem('newbank_profile_id');
        if (storedId) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', storedId)
            .single();
          
          if (error) {
            console.error("Error in initApp session:", error);
            localStorage.removeItem('newbank_profile_id');
          } else if (data) {
            setUserProfile(data);
          } else {
            localStorage.removeItem('newbank_profile_id');
          }
        }
      } catch (err) {
        console.error("Critical error in initApp:", err);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('newbank_profile_id');
    setUserProfile(null);
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold animate-pulse">Cargando NewBank...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col relative pb-20">
        <NotificationHandler user={userProfile} />
        <GlobalAudioPlayer user={userProfile} />
        <SmartSlideMenu user={userProfile} onSignOut={handleSignOut} />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<ADomicilio user={userProfile} />} />
            <Route path="/domicilio" element={<ADomicilio user={userProfile} />} />
            <Route path="/dashboard" element={<Dashboard user={userProfile} />} />
            <Route path="/store" element={userProfile ? <Store user={userProfile} /> : <Navigate to="/register" />} />

            <Route path="/gallery" element={userProfile && (userProfile.is_admin || (userProfile.profile_type !== 'jugador' && userProfile.profile_type !== 'invitado' && userProfile.profile_type !== 'aliado')) ? <Gallery user={userProfile} /> : <Navigate to="/" />} />
            <Route path="/projects" element={userProfile && (userProfile.is_admin || (userProfile.profile_type !== 'jugador' && userProfile.profile_type !== 'invitado')) ? <ProjectsView user={userProfile} /> : <Navigate to="/register" />} />
            <Route path="/morosos" element={userProfile && (userProfile.profile_type !== 'invitado' && userProfile.profile_type !== 'jugador' || userProfile.is_admin) ? <PublicDefaulters user={userProfile} /> : <Navigate to="/" />} />
            <Route path="/register" element={<Register onRegistered={(p) => setUserProfile(p)} />} />
            <Route path="/comunidad" element={userProfile && (userProfile.profile_type !== 'invitado' && userProfile.profile_type !== 'jugador' && userProfile.profile_type !== 'aliado' || userProfile.is_admin) ? <CommunityActivity user={userProfile} /> : <Navigate to="/register" />} />
            <Route path="/apply" element={userProfile && (userProfile.profile_type !== 'jugador' && userProfile.profile_type !== 'invitado') ? <LoanApplication user={userProfile} /> : <Navigate to="/" />} />
            <Route path="/ahorros" element={userProfile && (userProfile.profile_type !== 'invitado' && userProfile.profile_type !== 'jugador' || userProfile.is_admin || userProfile.profile_type === 'creditos') ? <Savings user={userProfile} /> : <Navigate to="/register" />} />
            <Route path="/payments" element={userProfile && (userProfile.profile_type !== 'jugador' && userProfile.profile_type !== 'invitado') ? <Payments user={userProfile} /> : <Navigate to="/register" />} />
            <Route path="/profile" element={userProfile ? <Profile user={userProfile} /> : <Navigate to="/register" />} />
            <Route path="/payment-requests" element={userProfile && (userProfile.profile_type !== 'invitado' && userProfile.profile_type !== 'aliado') ? <PaymentRequests user={userProfile} /> : <Navigate to="/register" />} />
            <Route path="/admin" element={userProfile?.is_admin || userProfile?.profile_type === 'aliado' ? <Admin user={userProfile} /> : <Navigate to="/" />} />
            <Route path="/games" element={userProfile?.profile_type === 'aliado' ? <Navigate to="/" /> : <Games user={userProfile} />} />
            <Route path="/specialist" element={userProfile && (userProfile.profile_type !== 'invitado' && userProfile.profile_type !== 'jugador' || userProfile.is_admin) ? <SpecialistProfile user={userProfile} /> : <Navigate to="/register" />} />
            <Route path="/feedback-requests" element={userProfile && (userProfile.profile_type !== 'invitado' && userProfile.profile_type !== 'jugador' || userProfile.is_admin) ? <FeedbackRequests user={userProfile} /> : <Navigate to="/register" />} />
            <Route path="/help-requests" element={userProfile && (userProfile.profile_type !== 'invitado') ? <HelpRequests user={userProfile} /> : <Navigate to="/register" />} />
            <Route path="/aliado-pedidos" element={userProfile && (userProfile.profile_type === 'aliado' || userProfile.is_admin) ? <AliadoOrders user={userProfile} /> : <Navigate to="/" />} />
            <Route path="/it-tools" element={userProfile && (userProfile.is_admin || ['invitado', 'estudiante', 'especialista', 'aliado'].includes(userProfile.profile_type)) ? <ITTools user={userProfile} /> : <Navigate to="/register" />} />
            <Route path="/mis-pedidos" element={userProfile ? <UserOrders user={userProfile} /> : <Navigate to="/register" />} />
            <Route path="/terms" element={<Terms />} />
          </Routes>
        </main>
        <footer className="bg-white border-t border-slate-200 py-6 sm:py-8">
          <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-[10px] sm:text-sm">
            <p>© 2024 NewBank AI. Cumpliendo con la Ley de Protección de Datos de El Salvador.</p>
            <Link to="/terms" className="mt-2 inline-block text-blue-600 hover:underline font-bold uppercase text-[10px]">Términos y Condiciones</Link>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
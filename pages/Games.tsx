import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Environment, Float, Text, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';
import { supabase } from '../supabase';
import { VideoChat } from '../components/VideoChat';

const safeJSONParse = (str: any, fallback: any = null) => { try { return JSON.parse(str); } catch(e) { return fallback; } };

const WompiWidget = React.memo(({ urlPago }: { urlPago: string }) => {
  const handlePay = () => {
    const width = 600;
    const height = 800;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    const paymentWindow = window.open(
      urlPago,
      'WompiPayment',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
    );

    if (!paymentWindow) {
      alert("Por favor, permite las ventanas emergentes en tu navegador para continuar con el pago.");
    }
  };

  return (
    <div className="w-full flex justify-center py-2">
      <button 
        onClick={handlePay}
        className="bg-[#592c82] hover:bg-[#4a246d] text-white font-black py-3 px-8 rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 uppercase tracking-tight text-[10px] sm:text-xs"
      >
        <span className="text-base sm:text-xl">💳</span> Recargar
      </button>
    </div>
  );
});

const SYMBOLS = ['🪙', '🧪', '🍓', '🎁', '💎', '🍀', '🧲', '7️⃣', '🍇', '🏆', '💣', '🍒'];
const REEL_LENGTH = 20;

const PAYTABLE: Record<string, Record<number, number>> = {
  '🪙': { 3: 5, 4: 20, 5: 100 },
  '🍒': { 3: 8, 4: 30, 5: 150 },
  '🍇': { 3: 10, 4: 40, 5: 200 },
  '7️⃣': { 3: 15, 4: 60, 5: 300 },
  '🧪': { 3: 20, 4: 80, 5: 400 },
  '🎁': { 3: 25, 4: 100, 5: 500 },
  '🧲': { 3: 30, 4: 120, 5: 600 },
  '🍀': { 3: 40, 4: 150, 5: 0 }, // Scatter
  '🍓': { 3: 50, 4: 200, 5: 800 },
  '🏆': { 3: 100, 4: 500, 5: 5000 },
};

const PAYLINES = [
  [1, 1, 1, 1, 1], // 1
  [0, 0, 0, 0, 0], // 2
  [2, 2, 2, 2, 2], // 3
  [0, 1, 2, 1, 0], // 4
  [2, 1, 0, 1, 2], // 5
  [0, 0, 1, 2, 2], // 6
  [2, 2, 1, 0, 0], // 7
  [1, 2, 2, 2, 1], // 8
  [1, 0, 0, 0, 1], // 9
  [0, 1, 1, 1, 0], // 10
  [2, 1, 1, 1, 2], // 11
  [0, 1, 0, 1, 0], // 12
  [2, 1, 2, 1, 2], // 13
  [1, 0, 1, 0, 1], // 14
  [1, 2, 1, 2, 1], // 15
  [0, 0, 1, 0, 0], // 16
  [2, 2, 1, 2, 2], // 17
  [0, 2, 0, 2, 0], // 18
  [2, 0, 2, 0, 2], // 19
  [1, 1, 0, 1, 1], // 20
];

const CheckersGame: React.FC<{ roomId: string; user: any; onLoginRequired: () => void }> = ({ roomId, user, onLoginRequired }) => {
  const [board, setBoard] = useState<(string | null)[][]>(() => {
    const b = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) b[r][c] = 'black';
      }
    }
    for (let r = 5; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) b[r][c] = 'red';
      }
    }
    return b;
  });
  const [turn, setTurn] = useState<'red' | 'black'>('red');
  const [playerColor, setPlayerColor] = useState<'red' | 'black' | null>(null);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playersCount, setPlayersCount] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.emit('join-room', roomId);

    newSocket.on('room-joined', ({ playerColor, board: savedBoard, turn: savedTurn, playersCount }) => {
      setPlayerColor(playerColor);
      setPlayersCount(playersCount);
      if (savedBoard) setBoard(savedBoard);
      if (savedTurn) setTurn(savedTurn);
    });

    newSocket.on('player-count-update', (count: number) => {
      setPlayersCount(count);
    });

    newSocket.on('opponent-move', ({ newBoard, nextTurn }: { newBoard: (string | null)[][], nextTurn: 'red' | 'black' }) => {
      setBoard(newBoard);
      setTurn(nextTurn);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId]);

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?checkersRoom=${roomId}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSquareClick = (r: number, c: number) => {
    if (!user) {
      onLoginRequired();
      return;
    }
    if (turn !== playerColor) return;
    if (playersCount < 2) return;

    const piece = board[r][c];
    if (piece && piece.startsWith(playerColor)) {
      setSelected({ r, c });
    } else if (selected && (r + c) % 2 === 1) {
      const newBoard = board.map(row => [...row]);
      const movingPiece = newBoard[selected.r][selected.c];
      if (!movingPiece) return;

      const dr = r - selected.r;
      const dc = Math.abs(c - selected.c);
      const isForward = playerColor === 'red' ? dr < 0 : dr > 0;
      const isKing = movingPiece.endsWith('_king');

      if (Math.abs(dr) === 1 && dc === 1 && (isForward || isKing) && !piece) {
        newBoard[r][c] = movingPiece;
        newBoard[selected.r][selected.c] = null;
        if (playerColor === 'red' && r === 0) newBoard[r][c] = 'red_king';
        if (playerColor === 'black' && r === 7) newBoard[r][c] = 'black_king';

        const nextTurn = playerColor === 'red' ? 'black' : 'red';
        setBoard(newBoard);
        setTurn(nextTurn);
        setSelected(null);
        socket?.emit('move', { roomId, move: { newBoard, nextTurn } });
      } else if (Math.abs(dr) === 2 && dc === 2 && (isForward || isKing)) {
        const midR = (r + selected.r) / 2;
        const midC = (c + selected.c) / 2;
        const midPiece = board[midR][midC];
        const opponentColor = playerColor === 'red' ? 'black' : 'red';

        if (midPiece && midPiece.startsWith(opponentColor) && !piece) {
          newBoard[r][c] = movingPiece;
          newBoard[selected.r][selected.c] = null;
          newBoard[midR][midC] = null;
          if (playerColor === 'red' && r === 0) newBoard[r][c] = 'red_king';
          if (playerColor === 'black' && r === 7) newBoard[r][c] = 'black_king';

          const nextTurn = playerColor === 'red' ? 'black' : 'red';
          setBoard(newBoard);
          setTurn(nextTurn);
          setSelected(null);
          socket?.emit('move', { roomId, move: { newBoard, nextTurn } });
        }
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-orange-500/30 shadow-2xl">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-white uppercase italic tracking-tight">Damas Multiplayer</h2>
        <p className="text-orange-400 font-bold uppercase tracking-widest text-[10px]">Desafía a un amigo en tiempo real</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${playersCount >= 2 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-yellow-500 animate-pulse'}`} />
          <span className="text-white font-bold text-xs uppercase tracking-wider">
            {playersCount >= 2 ? 'Oponente Conectado' : 'Esperando Oponente...'}
          </span>
        </div>
        
        <button 
          onClick={copyLink}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all transform active:scale-95 shadow-lg"
        >
          {isCopied ? '✅ ¡Copiado!' : '🔗 Copiar Link de Invitación'}
        </button>
      </div>

      <div className="grid grid-cols-8 gap-1 bg-slate-800 p-2 rounded-xl border-4 border-slate-700 shadow-inner aspect-square w-full max-w-[500px]">
        {board.map((row, r) => row.map((piece, c) => (
          <div 
            key={`${r}-${c}`}
            onClick={() => handleSquareClick(r, c)}
            className={`
              aspect-square flex items-center justify-center cursor-pointer relative
              ${(r + c) % 2 === 1 ? 'bg-slate-700' : 'bg-slate-200'}
              ${selected?.r === r && selected?.c === c ? 'ring-4 ring-orange-500 ring-inset z-10' : ''}
              transition-all duration-200 hover:opacity-80
            `}
          >
            {piece && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`
                  w-[80%] h-[80%] rounded-full shadow-lg flex items-center justify-center
                  ${piece.startsWith('red') ? 'bg-red-600 border-4 border-red-800' : 'bg-slate-900 border-4 border-slate-950'}
                `}
              >
                {piece.endsWith('_king') && (
                  <span className="text-yellow-400 text-lg">👑</span>
                )}
              </motion.div>
            )}
          </div>
        )))}
      </div>

      <div className="flex justify-between w-full px-4">
        <div className={`flex flex-col items-center gap-1 ${turn === 'red' ? 'opacity-100 scale-110' : 'opacity-40'} transition-all`}>
          <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-red-800" />
          <span className="text-[10px] font-black text-white uppercase">Rojas {playerColor === 'red' ? '(Tú)' : ''}</span>
        </div>
        <div className="flex flex-col items-center justify-center">
            <span className="text-orange-500 font-black text-xl uppercase italic">Turno de {turn === 'red' ? 'Rojas' : 'Negras'}</span>
        </div>
        <div className={`flex flex-col items-center gap-1 ${turn === 'black' ? 'opacity-100 scale-110' : 'opacity-40'} transition-all`}>
          <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-950" />
          <span className="text-[10px] font-black text-white uppercase">Negras {playerColor === 'black' ? '(Tú)' : ''}</span>
        </div>
      </div>
    </div>
  );
};

const Games: React.FC<{ user: any }> = ({ user }) => {
  const [profile, setProfile] = useState<any>(null);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<string[][]>([
    ['🪙', '🍓', '💎'],
    ['🧪', '🎁', '🍀'],
    ['🍓', '💎', '🧲'],
    ['🎁', '🍀', '7️⃣'],
    ['💎', '🧲', '🍇']
  ]);
  const [winAmount, setWinAmount] = useState(0);
  const [message, setMessage] = useState('');
  const [totalBet, setTotalBet] = useState(5);
  const [autoSpins, setAutoSpins] = useState(0);
  const [freeSpins, setFreeSpins] = useState(0);
  const [showPaytable, setShowPaytable] = useState(false);
  const [winningLines, setWinningLines] = useState<number[]>([]);
  const [winningPositions, setWinningPositions] = useState<{col: number, row: number, amount?: number, isBomb?: boolean, text?: string}[]>([]);
  const [machineBalance, setMachineBalance] = useState(100000);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('newbank_sound_enabled');
    return saved === null ? true : saved === 'true';
  });
  const [showWinEffect, setShowWinEffect] = useState(false);
  const [showLossEffect, setShowLossEffect] = useState(false);
  const [showQuickRecharge, setShowQuickRecharge] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [currentGame, setCurrentGame] = useState<'slots' | 'battle' | 'unity-spec' | 'nexus' | 'checkers' | 'competitive-sums'>('competitive-sums');
  const [battleRoomId, setBattleRoomId] = useState<string | null>(null);
  const [checkersRoomId, setCheckersRoomId] = useState<string | null>(null);
  const [diamondFrame, setDiamondFrame] = useState(0);
  const [showBurst, setShowBurst] = useState(false);
  const [burstFrame, setBurstFrame] = useState(0);
  const [displayDiamonds, setDisplayDiamonds] = useState(0);
  const displayDiamondsRef = useRef(0);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);

  const [isMachineBusy, setIsMachineBusy] = useState(false);
  const [busyUserName, setBusyUserName] = useState('');

  const [isSlotsFullScreen, setIsSlotsFullScreen] = useState(false);
  const containerRefSlots = useRef<HTMLDivElement>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    const handleFullScreenChange = () => setIsSlotsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreenSlots = () => {
    if (!containerRefSlots.current) return;
    if (!document.fullscreenElement) {
      containerRefSlots.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cRoomId = params.get('checkersRoom');
    if (cRoomId) {
      setCheckersRoomId(cRoomId);
      // setCurrentGame('checkers'); // Bloqueado
    }
  }, []);

  const betPerLine = totalBet / 20;

  // Heartbeat to keep the machine locked
  useEffect(() => {
    if (!user) return;

    const updateHeartbeat = async () => {
      // Try to claim or update heartbeat
      const now = new Date().toISOString();
      
      // First, check if someone else has it
      const { data: currentState } = await supabase
        .from('game_machine_state')
        .select('active_user_id, last_heartbeat_at, profiles(full_name)')
        .eq('id', 1)
        .single();

      const fifteenSecondsAgo = new Date(Date.now() - 15000);
      const isLockedByOther = currentState?.active_user_id && 
                             currentState.active_user_id !== user.id && 
                             new Date(currentState.last_heartbeat_at) > fifteenSecondsAgo;

      if (isLockedByOther) {
        setIsMachineBusy(true);
        setBusyUserName((currentState.profiles as any)?.[0]?.full_name || 'Otro jugador');
        return;
      }

      setIsMachineBusy(false);
      // Claim or refresh
      await supabase
        .from('game_machine_state')
        .update({ 
          active_user_id: user.id, 
          last_heartbeat_at: now 
        })
        .eq('id', 1);
    };

    updateHeartbeat();
    const interval = setInterval(updateHeartbeat, 5000);

    return () => {
      clearInterval(interval);
      // Release machine on unmount
      supabase
        .from('game_machine_state')
        .update({ active_user_id: null })
        .eq('id', 1)
        .then();
    };
  }, [user?.id]);

  useEffect(() => {
    if (profile?.store_diamonds !== undefined) {
      if (!showBurst) {
        setDisplayDiamonds(profile.store_diamonds);
      }
    }
  }, [profile?.store_diamonds, showBurst]);

  useEffect(() => {
    displayDiamondsRef.current = displayDiamonds;
  }, [displayDiamonds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDiamondFrame(prev => (prev >= 61 ? 0 : prev + 1));
    }, 40);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let timer: any;
    if (showBurst) {
      timer = setInterval(() => {
        setBurstFrame(prev => (prev >= 61 ? 0 : prev + 1));
      }, 20);
    }
    return () => clearInterval(timer);
  }, [showBurst]);

  useEffect(() => {
    const hash = window.location.hash;
    const search = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(search);
    const room = params.get('room');
    if (room) {
      setBattleRoomId(room);
      // setCurrentGame('battle'); // Bloqueado
    }
  }, []);

  useEffect(() => {
    // Listener for Wompi notifications
    const handleWompiMessage = async (event: MessageEvent) => {
      if (event.origin !== "https://pagos.wompi.sv") return;

      const data = event.data;
      const diamondId = "0c791599-d163-4cde-b410-1865c1d7e04b";
      const diamond20Id = "bcc4870c-7acc-40f6-ac40-b27b782e64a5";
      
      if (data && (data.IdIntentoPago === diamondId || data.IdIntentoPago === diamond20Id)) {
        if (data.ResultadoTransaccion === "ExitosaAprobada") {
          setShowBurst(true);
          setNotification({ msg: `¡Recarga Exitosa! Diamantes acreditados.`, type: 'success' });
          setShowQuickRecharge(false);
          
          const amount = data.IdIntentoPago === diamondId ? 100 : 20;
          const startValue = displayDiamondsRef.current;
          const endValue = startValue + amount;
          const duration = 3000;
          const startTime = performance.now();

          const animateCounter = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(startValue + (endValue - startValue) * ease);
            setDisplayDiamonds(current);

            if (progress < 1) {
              requestAnimationFrame(animateCounter);
            } else {
              setTimeout(() => {
                setShowBurst(false);
                setNotification(null);
              }, 2000);
            }
          };
          requestAnimationFrame(animateCounter);
        } else if (data.ResultadoTransaccion === "Rechazada" || data.ResultadoTransaccion === "Denegada" || data.ResultadoTransaccion === "Error") {
          setNotification({ msg: "La transacción ha sido denegada o ha ocurrido un error.", type: 'error' });
          setTimeout(() => setNotification(null), 5000);
        }
      }
    };

    window.addEventListener('message', handleWompiMessage);
    return () => window.removeEventListener('message', handleWompiMessage);
  }, []);

  useEffect(() => {
    // Initialize win sound
    const winAudio = new Audio('https://stqthrzbvuqcavtsonba.supabase.co/storage/v1/object/public/NewBankSonidoCasinoDos/mixkit-casino-winning-reward-1983.wav');
    winSoundRef.current = winAudio;

    return () => {
      if (winSoundRef.current) {
        winSoundRef.current.pause();
      }
      winSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!soundEnabled) {
      if (winSoundRef.current) {
        winSoundRef.current.pause();
        winSoundRef.current.currentTime = 0;
      }
    }
  }, [soundEnabled]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data);
    };
    fetchProfile();

    const fetchMachineBalance = async () => {
      const { data } = await supabase.from('game_machine_state').select('available_diamonds').eq('id', 1).single();
      if (data) setMachineBalance(data.available_diamonds);
    };
    fetchMachineBalance();

    const channel = supabase.channel('machine_balance_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_machine_state' }, (payload) => {
        setMachineBalance(payload.new.available_diamonds);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (autoSpins > 0 && !spinning) {
      const timer = setTimeout(() => {
        spin();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoSpins, spinning]);

  const changeBet = (delta: number) => {
    if (spinning) return;
    const steps = [5, 10, 20, 40, 100, 200];
    const currentIndex = steps.indexOf(totalBet);
    let nextIndex = currentIndex + delta;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= steps.length) nextIndex = steps.length - 1;
    
    const nextBet = steps[nextIndex];
    if (nextBet > (profile?.store_diamonds || 0)) {
      setShowQuickRecharge(true);
      return;
    }
    setTotalBet(nextBet);
  };

  const spin = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!profile || spinning) return;
    
    const isFreeSpin = freeSpins > 0;
    if (!isFreeSpin && profile.store_diamonds < totalBet) {
      setMessage('¡Saldo insuficiente!');
      setAutoSpins(0);
      setShowQuickRecharge(true);
      return;
    }

    setSpinning(true);
    setWinAmount(0);
    setMessage('');
    setWinningLines([]);
    setWinningPositions([]);

    const initialBalance = profile.store_diamonds;
    let newDiamonds = profile.store_diamonds;
    if (!isFreeSpin) {
      newDiamonds -= totalBet;
      setProfile({ ...profile, store_diamonds: newDiamonds });
      await supabase.from('profiles').update({ store_diamonds: newDiamonds }).eq('id', user.id);
      
      const newMachineBalance = machineBalance + totalBet;
      setMachineBalance(newMachineBalance);
      await supabase.from('game_machine_state').update({ available_diamonds: newMachineBalance }).eq('id', 1);
    } else {
      setFreeSpins(prev => prev - 1);
    }

    if (autoSpins > 0 && !isFreeSpin) {
      setAutoSpins(prev => prev - 1);
    }

    let newReels = Array(5).fill(null).map(() => 
      Array(3).fill(null).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
    );

    // Si es admin, 90% de probabilidad de forzar una línea ganadora
    if (user.is_admin && Math.random() < 0.90) {
      const winningSymbol = SYMBOLS[Math.floor(Math.random() * (SYMBOLS.length - 2))]; // Evitar bomba o scatter como símbolo principal
      const lineToWin = PAYLINES[Math.floor(Math.random() * PAYLINES.length)];
      
      for (let i = 0; i < 5; i++) {
        newReels[i][lineToWin[i]] = winningSymbol;
      }
    }

    const spinDuration = 2000;
    
    let spinInterval = setInterval(() => {
      setReels(Array(5).fill(null).map(() => 
        Array(3).fill(null).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
      ));
    }, 100);

    setTimeout(() => {
      clearInterval(spinInterval);
      setReels(newReels);
      checkWin(newReels, newDiamonds, initialBalance);
      setSpinning(false);
    }, spinDuration);
  };

  const checkWin = async (finalReels: string[][], currentDiamonds: number, initialBalance: number) => {
    // Check for bomb
    let hasBomb = false;
    let scatterCount = 0;
    const newWinningPositions: { col: number, row: number, amount?: number, isBomb?: boolean, text?: string }[] = [];

    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 3; row++) {
        if (finalReels[col][row] === '💣') hasBomb = true;
        if (finalReels[col][row] === '🍀') scatterCount++;
      }
    }

    if (hasBomb) {
      setMessage('¡BOMBA! Perdiste las ganancias del giro.');
      for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 3; row++) {
          if (finalReels[col][row] === '💣') {
            newWinningPositions.push({ col, row, isBomb: true, text: 'BOMBA' });
          }
        }
      }
      setWinningPositions(newWinningPositions);
      return;
    }

    if (scatterCount >= 3) {
      const newFreeSpins = 10 + (scatterCount - 3);
      setFreeSpins(prev => prev + newFreeSpins);
      setMessage(`¡${newFreeSpins} GIROS GRATIS!`);
      
      // Highlight scatters
      for (let col = 0; col < 5; col++) {
        for (let row = 0; row < 3; row++) {
          if (finalReels[col][row] === '🍀') {
            newWinningPositions.push({ col, row, text: 'GRATIS' });
          }
        }
      }
    }

    let totalWin = 0;
    const linesWon: number[] = [];

    PAYLINES.forEach((line, lineIdx) => {
      const lineSymbols = line.map((row, col) => finalReels[col][row]);
      
      let matchCount = 1;
      let firstSymbol = lineSymbols[0];
      
      // Handle wildcard at start
      if (firstSymbol === '💎') {
        const nextNonWild = lineSymbols.find(s => s !== '💎');
        firstSymbol = nextNonWild || '🏆'; // If all wilds, treat as top symbol
      }

      for (let i = 1; i < 5; i++) {
        if (lineSymbols[i] === firstSymbol || lineSymbols[i] === '💎') {
          matchCount++;
        } else {
          break;
        }
      }

      if (matchCount >= 3 && PAYTABLE[firstSymbol]) {
        const multiplier = PAYTABLE[firstSymbol][matchCount] || 0;
        if (multiplier > 0) {
          const lineWin = multiplier * betPerLine;
          totalWin += lineWin;
          linesWon.push(lineIdx);
          
          for (let i = 0; i < matchCount; i++) {
            const existing = newWinningPositions.find(p => p.col === i && p.row === line[i]);
            if (existing) {
              existing.amount = (existing.amount || 0) + lineWin;
            } else {
              newWinningPositions.push({ col: i, row: line[i], amount: lineWin });
            }
          }
        }
      }
    });

    // CAP WINNINGS TO 25% OF MACHINE BALANCE (50% for admins)
    const maxAllowedWin = user.is_admin ? machineBalance * 0.50 : machineBalance * 0.25;
    if (totalWin > maxAllowedWin) {
      totalWin = Math.floor(maxAllowedWin);
    }

    // NEW CAP: Win <= 25% of User's starting balance for this spin (Admins bypass this cap)
    if (!user.is_admin) {
      const userBalanceCap = initialBalance * 0.25;
      if (totalWin > userBalanceCap) {
        totalWin = Math.floor(userBalanceCap);
      }
    }

    if (totalWin > 0 || scatterCount >= 3 || hasBomb) {
      setWinningPositions(newWinningPositions);
    }

    if (totalWin > 0) {
      setWinAmount(totalWin);
      setWinningLines(linesWon);
      setShowWinEffect(true);
      
      if (soundEnabled && winSoundRef.current) {
        winSoundRef.current.currentTime = 0;
        winSoundRef.current.play().catch(err => console.log("Win sound failed:", err));
      }

      setTimeout(() => {
        setShowWinEffect(false);
        if (winSoundRef.current) {
          winSoundRef.current.pause();
          winSoundRef.current.currentTime = 0;
        }
      }, 3000);
      
      if (totalWin >= totalBet * 50) {
        setMessage(`¡GRAN GANANCIA! Ganaste ${totalWin} 💎`);
      } else {
        setMessage(`¡Ganaste ${totalWin} 💎!`);
      }
      
      const newTotal = currentDiamonds + totalWin;
      setProfile(prev => ({ ...prev, store_diamonds: newTotal }));
      await supabase.from('profiles').update({ store_diamonds: newTotal }).eq('id', user.id);
      
      const newMachineBalance = machineBalance - totalWin;
      setMachineBalance(newMachineBalance);
      await supabase.from('game_machine_state').update({ available_diamonds: newMachineBalance }).eq('id', 1);
    } else if (hasBomb) {
      setShowLossEffect(true);
      setTimeout(() => setShowLossEffect(false), 2000);
    } else if (scatterCount < 3) {
      // Analyze why it lost
      let almostWin = false;
      const almostPositions: { col: number, row: number, text: string }[] = [];
      
      PAYLINES.forEach((line) => {
        const lineSymbols = line.map((row, col) => finalReels[col][row]);
        let matchCount = 1;
        let firstSymbol = lineSymbols[0];
        
        if (firstSymbol === '💎') {
          const nextNonWild = lineSymbols.find(s => s !== '💎');
          firstSymbol = nextNonWild || '🏆';
        }

        for (let i = 1; i < 5; i++) {
          if (lineSymbols[i] === firstSymbol || lineSymbols[i] === '💎') {
            matchCount++;
          } else {
            break;
          }
        }

        if (matchCount === 2) {
          almostWin = true;
          for (let i = 0; i < 2; i++) {
            almostPositions.push({ col: i, row: line[i], text: 'CASI' });
          }
        }
      });

      if (almostWin) {
        setMessage('¡Sigue intentando! Te faltó un símbolo para completar la línea.');
        setWinningPositions(almostPositions);
      } else {
        setMessage('¡Sigue intentando! No se formaron combinaciones ganadoras.');
      }
      setShowLossEffect(true);
      setTimeout(() => setShowLossEffect(false), 2000);
    }
  };

  if (user && !profile) return (
    <div className="min-h-screen bg-[#0a235c] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-white font-black uppercase tracking-widest animate-pulse">Cargando Perfil...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a235c] p-2 sm:p-8 flex flex-col items-center justify-center font-sans overflow-hidden relative">
      {/* Background rays */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: 'repeating-conic-gradient(from 0deg, transparent 0deg 15deg, #1e40af 15deg 30deg)' }}></div>

      <div className="w-full max-w-5xl relative z-10 flex flex-col gap-0 sm:gap-4">
        {/* Game Selector */}
        <div className="flex flex-wrap justify-center gap-2 mb-0 sm:mb-4 relative z-50 px-2">
          <button 
            onClick={() => setCurrentGame('competitive-sums')}
            className={`flex-1 sm:flex-none min-w-[100px] px-4 py-2 rounded-xl font-bold uppercase tracking-wider transition-all text-[10px] sm:text-xs ${currentGame === 'competitive-sums' ? 'bg-orange-500 text-white shadow-lg' : 'bg-blue-900/40 text-blue-300 hover:bg-blue-800/40'}`}
          >
            ➕ Sumas Pro
          </button>
        </div>

        {currentGame === 'competitive-sums' && (
          <CompetitiveSumsGame user={user} profile={profile} setProfile={setProfile} setNotification={setNotification} setShowLoginModal={setShowLoginModal} />
        )}
      </div>

      {/* Login Required Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 sm:p-12 max-w-md w-full relative overflow-hidden shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                <span className="text-4xl">👤</span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-black text-white uppercase italic tracking-tighter mb-4">
                ¡Inicia Sesión!
              </h2>
              <p className="text-slate-400 font-bold text-sm mb-8 leading-relaxed">
                Para realizar esta acción debes crear una cuenta o iniciar sesión como jugador en NewBank AI.
              </p>

              <div className="space-y-4">
                <button 
                  onClick={() => window.location.hash = "/register"}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-900/20 active:scale-95"
                >
                  Ir a Registro
                </button>
                <button 
                  onClick={() => setShowLoginModal(false)}
                  className="w-full bg-white/5 hover:bg-white/10 text-slate-400 py-4 rounded-2xl font-black uppercase tracking-[0.2em] transition-all active:scale-95"
                >
                  Tal vez luego
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AINeuralNexus: React.FC<{ user: any; profile: any; setProfile: any; onLoginRequired: () => void }> = ({ user, profile, setProfile, onLoginRequired }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [diamondsEarned, setDiamondsEarned] = useState(0);

  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const startGame = async () => {
    if (!user) {
      onLoginRequired();
      return;
    }
    if ((profile?.store_diamonds || 0) < 15) {
      alert("Necesitas 15 diamantes para entrar al Neural Nexus.");
      return;
    }

    const newDiamonds = (profile?.store_diamonds || 0) - 15;
    setProfile({ ...profile, store_diamonds: newDiamonds });
    await supabase.from('profiles').update({ store_diamonds: newDiamonds }).eq('id', user.id);
    
    setGameState('playing');
    setScore(0);
    setDiamondsEarned(0);
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let screenShake = 0;
    
    const player = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      radius: 12,
      color: '#06b6d4',
      speed: 4.5,
      health: 100,
      maxHealth: 100,
      angle: 0,
      fireRate: 150,
      lastFire: 0
    };

    const keys: Record<string, boolean> = {};
    const bullets: any[] = [];
    const enemies: any[] = [];
    const particles: any[] = [];
    const powerUps: any[] = [];
    let enemySpawnTimer = 0;
    let difficulty = 1;

    const handleKeyDown = (e: KeyboardEvent) => keys[e.key.toLowerCase()] = true;
    const handleKeyUp = (e: KeyboardEvent) => keys[e.key.toLowerCase()] = false;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      player.angle = Math.atan2((e.clientY - rect.top) * scaleY - player.y, (e.clientX - rect.left) * scaleX - player.x);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    const spawnEnemy = () => {
      const type = Math.random();
      let enemy: any = {
        x: 0, y: 0, radius: 15, color: '#f43f5e', speed: 2 * difficulty, health: 1, type: 'basic'
      };

      if (type > 0.8) {
        enemy = { ...enemy, radius: 25, color: '#a855f7', speed: 1 * difficulty, health: 5, type: 'tank' };
      } else if (type > 0.6) {
        enemy = { ...enemy, radius: 10, color: '#fbbf24', speed: 4 * difficulty, health: 1, type: 'fast' };
      }

      const side = Math.floor(Math.random() * 4);
      if (side === 0) { enemy.x = Math.random() * canvas.width; enemy.y = -enemy.radius; }
      else if (side === 1) { enemy.x = canvas.width + enemy.radius; enemy.y = Math.random() * canvas.height; }
      else if (side === 2) { enemy.x = Math.random() * canvas.width; enemy.y = canvas.height + enemy.radius; }
      else { enemy.x = -enemy.radius; enemy.y = Math.random() * canvas.height; }

      enemies.push(enemy);
    };

    const createParticles = (x: number, y: number, color: string, count = 10) => {
      for (let i = 0; i < count; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          radius: Math.random() * 3,
          color,
          life: 1.0,
          decay: 0.02 + Math.random() * 0.02
        });
      }
    };

    const update = (deltaTime: number, time: number) => {
      difficulty = 1 + time / 60000; // Increase difficulty over time

      // Movement
      let dx = 0, dy = 0;
      if (keys['w']) dy -= 1;
      if (keys['s']) dy += 1;
      if (keys['a']) dx -= 1;
      if (keys['d']) dx += 1;
      
      if (dx !== 0 || dy !== 0) {
        const mag = Math.sqrt(dx * dx + dy * dy);
        player.x += (dx / mag) * player.speed;
        player.y += (dy / mag) * player.speed;
      }

      player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
      player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

      // Shooting
      if (time - player.lastFire > player.fireRate) {
        bullets.push({
          x: player.x, y: player.y,
          vx: Math.cos(player.angle) * 12,
          vy: Math.sin(player.angle) * 12,
          radius: 4,
          color: '#22d3ee'
        });
        player.lastFire = time;
      }

      // Update Bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
          bullets.splice(i, 1);
        }
      }

      // Update Enemies
      enemySpawnTimer += deltaTime;
      if (enemySpawnTimer > 1000 / difficulty) {
        spawnEnemy();
        enemySpawnTimer = 0;
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(angle) * e.speed;
        e.y += Math.sin(angle) * e.speed;

        // Collision with player
        const dist = Math.hypot(player.x - e.x, player.y - e.y);
        if (dist < player.radius + e.radius) {
          player.health -= 1;
          screenShake = 10;
          if (player.health <= 0) {
            setGameState('gameover');
            handleGameOver();
          }
        }

        // Collision with bullets
        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          const bDist = Math.hypot(b.x - e.x, b.y - e.y);
          if (bDist < b.radius + e.radius) {
            e.health -= 1;
            bullets.splice(j, 1);
            if (e.health <= 0) {
              createParticles(e.x, e.y, e.color);
              enemies.splice(i, 1);
              setScore(s => s + 100);
              break;
            }
          }
        }
      }

      // Update Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
      }

      if (screenShake > 0) screenShake *= 0.9;
    };

    const draw = () => {
      ctx.save();
      if (screenShake > 1) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
      }

      // Background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Particles
      particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Bullets
      bullets.forEach(b => {
        ctx.shadowBlur = 15;
        ctx.shadowColor = b.color;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Enemies
      enemies.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        if (e.type === 'tank') {
          ctx.rect(e.x - e.radius, e.y - e.radius, e.radius * 2, e.radius * 2);
        } else if (e.type === 'fast') {
          ctx.moveTo(e.x, e.y - e.radius);
          ctx.lineTo(e.x + e.radius, e.y + e.radius);
          ctx.lineTo(e.x - e.radius, e.y + e.radius);
          ctx.closePath();
        } else {
          ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        }
        ctx.fill();
      });

      // Player
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      ctx.shadowBlur = 20;
      ctx.shadowColor = player.color;
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.moveTo(player.radius * 1.5, 0);
      ctx.lineTo(-player.radius, player.radius);
      ctx.lineTo(-player.radius, -player.radius);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(20, 20, 200, 10);
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(20, 20, (player.health / player.maxHealth) * 200, 10);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(20, 20, 200, 10);

      ctx.restore();
    };

    const loop = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;
      update(deltaTime, time);
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    const handleGameOver = async () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      
      // Calculate rewards
      // Use current score from state (it's updated in update loop via setScore)
      // But we need the final score. Let's use a local variable for score too.
    };

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gameState]);

  // Handle rewards when game over
  useEffect(() => {
    if (gameState === 'gameover') {
      const reward = Math.floor(score / 1000) * 2;
      setDiamondsEarned(reward);
      if (reward > 0) {
        const updateDiamonds = async () => {
          const newDiamonds = profile.store_diamonds + reward;
          setProfile({ ...profile, store_diamonds: newDiamonds });
          await supabase.from('profiles').update({ store_diamonds: newDiamonds }).eq('id', user.id);
        };
        updateDiamonds();
      }
      if (score > highScore) setHighScore(score);
    }
  }, [gameState]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl mx-auto">
      <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-cyan-500/30 shadow-lg w-full text-center relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-center px-2 gap-4">
          <div className="text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tight leading-none">AI Neural Nexus</h2>
            <p className="text-cyan-400 text-[8px] sm:text-[9px] font-bold uppercase tracking-widest">Cyber-Arena Survival</p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-center sm:items-end">
              <span className="text-[8px] sm:text-[9px] font-bold text-cyan-500 uppercase">Score</span>
              <span className="text-base sm:text-xl font-black text-white tabular-nums">{score}</span>
            </div>
            <div className="flex flex-col items-center sm:items-end">
              <span className="text-[8px] sm:text-[9px] font-bold text-yellow-500 uppercase">Best</span>
              <span className="text-base sm:text-xl font-black text-white tabular-nums">{highScore}</span>
            </div>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full aspect-video bg-[#020617] rounded-[3rem] border-8 border-slate-900 shadow-2xl overflow-hidden flex items-center justify-center group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent pointer-events-none"></div>
        
        {gameState === 'idle' && (
          <div className="flex flex-col items-center gap-4 z-10 p-6 bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl w-[90%] sm:w-auto">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto border border-cyan-500">
                <span className="text-xl sm:text-3xl">🧠</span>
              </div>
              <h3 className="text-2xl sm:text-4xl font-black text-white uppercase italic tracking-tight">Neural Nexus</h3>
              <div className="flex items-center justify-center gap-2 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                <span className="text-yellow-400 text-base sm:text-lg">💎</span>
                <span className="text-white font-black text-sm sm:text-base">15</span>
                <span className="text-cyan-300 text-[8px] sm:text-[10px] font-bold uppercase ml-1">Costo</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 w-full">
              {[
                { label: 'WASD', desc: 'Mover' },
                { label: 'MOUSE', desc: 'Apuntar' },
                { label: 'AUTO', desc: 'Disparo' }
              ].map((ctrl, i) => (
                <div key={i} className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
                  <div className="text-cyan-400 font-bold text-[8px] sm:text-[10px] mb-0.5">{ctrl.label}</div>
                  <div className="text-white/40 text-[6px] sm:text-[8px] font-bold uppercase">{ctrl.desc}</div>
                </div>
              ))}
            </div>

            <button 
              onClick={startGame}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-8 py-3 rounded-xl font-black text-base sm:text-xl uppercase tracking-tight transition-all shadow-md w-full sm:w-auto touch-manipulation"
            >
              Iniciar Nexus
            </button>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="flex flex-col items-center gap-8 z-10 p-12 bg-black/80 backdrop-blur-2xl rounded-[3rem] border-4 border-red-500/50 shadow-2xl animate-in zoom-in duration-300">
            <div className="text-center space-y-2">
              <h3 className="text-6xl font-black text-red-500 uppercase italic tracking-tighter drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">Sistema Caído</h3>
              <p className="text-white/70 font-bold uppercase tracking-widest text-sm">Nexo Neural Comprometido</p>
            </div>

            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-slate-400 text-[10px] font-black uppercase mb-1">Puntaje Final</div>
                <div className="text-4xl font-black text-white">{score}</div>
              </div>
              <div className="w-px h-12 bg-white/10"></div>
              <div className="text-center">
                <div className="text-yellow-500 text-[10px] font-black uppercase mb-1">Diamantes Ganados</div>
                <div className="text-4xl font-black text-yellow-400">+{diamondsEarned}</div>
              </div>
            </div>

            <button 
              onClick={startGame}
              className="bg-white text-slate-950 px-16 py-5 rounded-2xl font-black text-2xl uppercase tracking-tighter hover:bg-cyan-400 transition-all hover:scale-105 active:scale-95 touch-manipulation"
            >
              Reiniciar Nexus (15 💎)
            </button>
          </div>
        )}

        <canvas 
          ref={canvasRef} 
          width={800} 
          height={450} 
          className={`absolute inset-0 w-full h-full object-contain ${gameState !== 'playing' ? 'opacity-20 blur-md' : ''} transition-all duration-1000`}
        />

        <button 
          onClick={toggleFullScreen}
          className="absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-white transition-all opacity-0 group-hover:opacity-100"
        >
          {isFullScreen ? '↙️' : '↗️'}
        </button>
      </div>

      <div className="w-full bg-slate-900/50 backdrop-blur-md p-6 rounded-[2rem] border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/30">
            <span className="text-2xl">🛡️</span>
          </div>
          <div>
            <h4 className="text-white font-black uppercase text-xs">Protocolo de Recompensa</h4>
            <p className="text-slate-400 text-[10px] font-medium">Gana 2 diamantes por cada 1000 puntos de procesamiento.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="bg-white/5 px-4 py-2 rounded-lg text-white text-[10px] font-black uppercase border border-white/5">V1.0.0 AI-CORE</span>
          <span className="bg-cyan-500/10 px-4 py-2 rounded-lg text-cyan-400 text-[10px] font-black uppercase border border-cyan-500/20">STABLE BUILD</span>
        </div>
      </div>
    </div>
  );
};

const Player3D: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.2 + 1;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <group>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh ref={meshRef} castShadow position={[0, 1, 0]}>
          <capsuleGeometry args={[0.5, 1.5, 4, 16]} />
          <meshStandardMaterial color="#3b82f6" emissive="#1e40af" emissiveIntensity={0.5} />
        </mesh>
      </Float>
      <Text
        position={[0, 3.5, 0]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        PLAYER_01 (YOU)
      </Text>
    </group>
  );
};

const Enemy3D: React.FC<{ position: [number, number, number]; color: string }> = ({ position, color }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = Math.cos(state.clock.elapsedTime * 3 + position[0]) * 0.1 + 1;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} castShadow>
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text
        position={[0, 2.5, 0]}
        fontSize={0.4}
        color="#ef4444"
        anchorX="center"
        anchorY="middle"
      >
        BOT_ENEMY
      </Text>
    </group>
  );
};

const UnityProjectSpec: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'blueprint' | 'scripts' | 'backend' | 'deploy' | 'live'>('live');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div ref={containerRef} className={`flex flex-col gap-6 w-full max-w-4xl mx-auto bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-purple-500/30 shadow-lg overflow-hidden relative ${isFullScreen ? 'h-screen overflow-y-auto bg-[#0a235c]' : ''}`}>
      <div className="text-center space-y-2">
        <div className="absolute top-4 right-4 z-50">
          <button 
            onClick={toggleFullScreen}
            className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-colors"
            title="Pantalla Completa"
          >
            {isFullScreen ? '↙️' : '↗️'}
          </button>
        </div>
        <h2 className="text-xl sm:text-3xl font-black text-white uppercase italic tracking-tight">Unity Battle Royale: Full Project Kit</h2>
        <p className="text-purple-300 font-bold uppercase tracking-widest text-[8px] sm:text-[10px]">Código Fuente Completo, Backend y Guía de Despliegue</p>
      </div>

      {/* Tab Selector */}
      <div className="flex overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap justify-start sm:justify-center gap-2 sm:gap-4 mb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {[
          { id: 'live', label: '🕹️ Live Preview', color: 'red' },
          { id: 'blueprint', label: '📋 Blueprint', color: 'purple' },
          { id: 'scripts', label: '⌨️ C# Scripts', color: 'emerald' },
          { id: 'backend', label: '🖥️ Backend', color: 'blue' },
          { id: 'deploy', label: '🚀 Despliegue', color: 'orange' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 sm:px-6 py-2 rounded-xl font-black uppercase text-[10px] sm:text-xs tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? `bg-${tab.color}-600 text-white shadow-[0_0_15px_rgba(var(--${tab.color}-rgb),0.5)] scale-105` 
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-12 text-white font-sans min-h-[400px]">
        {activeTab === 'live' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border-4 border-purple-500/30">
            <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md p-4 rounded-2xl border border-white/10 pointer-events-none">
              <h4 className="text-red-400 font-black uppercase text-xs">Unity WebGL Simulation</h4>
              <p className="text-[10px] text-white/70">Renderizado en tiempo real (Three.js)</p>
            </div>
            <Suspense fallback={<div className="flex items-center justify-center h-full text-white font-black uppercase tracking-widest">Cargando Arena 3D...</div>}>
              <Canvas shadows>
                <PerspectiveCamera makeDefault position={[0, 15, 30]} fov={50} />
                <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.1} />
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                <spotLight position={[-10, 20, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
                
                {/* Arena Floor */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                  <planeGeometry args={[100, 100]} />
                  <meshStandardMaterial color="#051130" roughness={0.8} metalness={0.2} />
                </mesh>
                <gridHelper args={[100, 50, "#1e3a8a", "#0a235c"]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} />

                {/* Player Simulation */}
                <Player3D />

                {/* Enemies Simulation */}
                <Enemy3D position={[10, 0, -10]} color="#ef4444" />
                <Enemy3D position={[-15, 0, 5]} color="#ef4444" />
                <Enemy3D position={[5, 0, 15]} color="#ef4444" />

                <Environment preset="city" />
                <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
              </Canvas>
            </Suspense>
            <div className="absolute bottom-4 right-4 z-10 flex gap-2">
              <div className="bg-red-600/80 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white animate-pulse">Live Server: 120ms</div>
              <div className="bg-blue-600/80 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white">Players: 156/200</div>
            </div>
          </motion.div>
        )}

        {activeTab === 'blueprint' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            {/* 1. Descripción General */}
            <section className="space-y-4">
              <h3 className="text-2xl font-black text-purple-400 uppercase border-b-2 border-purple-500/30 pb-2">1) Descripción General</h3>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4 text-sm leading-relaxed">
                <p>Este proyecto es un clon de alto rendimiento de Garena Free Fire diseñado específicamente para navegadores modernos. Utiliza Unity con exportación a WebGL y WebAssembly para garantizar una ejecución fluida de gráficos 3D complejos en el browser.</p>
                <ul className="list-disc pl-6 space-y-2 text-slate-300">
                  <li><span className="text-white font-bold">Capacidad:</span> Optimizado para 50-200 jugadores simultáneos por instancia.</li>
                  <li><span className="text-white font-bold">Networking:</span> Integración con Photon Fusion (Topología Client-Hosted o Server-Authoritative) o Colyseus para baja latencia.</li>
                  <li><span className="text-white font-bold">Gráficos:</span> URP (Universal Render Pipeline) con LODs agresivos y Progressive Loading de assets.</li>
                  <li><span className="text-white font-bold">Seguridad:</span> Anti-cheat server-authoritative para validación de posición, daño y moneda.</li>
                </ul>
              </div>
            </section>

            {/* 2. Integración de Diamantes */}
            <section className="space-y-4">
              <h3 className="text-2xl font-black text-purple-400 uppercase border-b-2 border-purple-500/30 pb-2">2) Integración de Diamantes</h3>
              <div className="bg-purple-900/20 p-6 rounded-3xl border border-purple-500/30 space-y-4">
                <p className="text-sm">El juego utiliza el contador persistente de diamantes del sistema central. La comunicación se realiza mediante una API segura con validación de tokens JWT.</p>
                <pre className="bg-black/40 p-4 rounded-2xl text-xs font-mono text-blue-300 overflow-x-auto">
{`// Ejemplo de integración con el backend de diamantes
async function updateDiamonds(userId, amount) {
    const response = await fetch('/api/diamonds/update', {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${token}\` },
        body: JSON.stringify({ userId, delta: amount })
    });
    return await response.json();
}`}
                </pre>
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'scripts' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-xl font-black text-emerald-400 uppercase">PlayerController.cs</h3>
              <pre className="bg-black/60 p-6 rounded-3xl border border-emerald-500/20 overflow-x-auto text-xs font-mono text-emerald-400">
{`using Fusion;
using UnityEngine;

public class PlayerController : NetworkBehaviour 
{
    [Networked] public int Health { get; set; } = 100;
    [Networked] public Vector3 NetworkPos { get; set; }
    
    public float Speed = 5f;
    private CharacterController _controller;

    public override void Spawned() {
        _controller = GetComponent<CharacterController>();
    }

    public override void FixedUpdateNetwork() {
        if (GetInput(out NetworkInputData data)) {
            Vector3 move = new Vector3(data.direction.x, 0, data.direction.y);
            _controller.Move(move * Speed * Runner.DeltaTime);
            
            if (Object.HasStateAuthority) {
                NetworkPos = transform.position;
            }
        }
    }

    [Rpc(RpcSources.All, RpcTargets.StateAuthority)]
    public void Rpc_TakeDamage(int amount) {
        Health -= amount;
        if (Health <= 0) Die();
    }

    private void Die() {
        // Award diamonds to attacker via API call
        Runner.Despawn(Object);
    }
}`}
              </pre>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-black text-emerald-400 uppercase">WeaponSystem.cs</h3>
              <pre className="bg-black/60 p-6 rounded-3xl border border-emerald-500/20 overflow-x-auto text-xs font-mono text-emerald-400">
{`using UnityEngine;
using Fusion;

public class WeaponSystem : NetworkBehaviour {
    public GameObject BulletPrefab;
    public Transform FirePoint;
    public float FireRate = 0.1f;
    private float _lastFireTime;

    public override void FixedUpdateNetwork() {
        if (GetInput(out NetworkInputData data)) {
            if (data.buttons.IsSet(NetworkInputData.BUTTON_FIRE) && Time.time > _lastFireTime + FireRate) {
                _lastFireTime = Time.time;
                Fire();
            }
        }
    }

    void Fire() {
        Runner.Spawn(BulletPrefab, FirePoint.position, FirePoint.rotation, Object.InputAuthority);
    }
}`}
              </pre>
            </div>
          </motion.div>
        )}

        {activeTab === 'backend' && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-xl font-black text-blue-400 uppercase">Server.js (Node.js + Express)</h3>
              <pre className="bg-black/60 p-6 rounded-3xl border border-blue-500/20 overflow-x-auto text-xs font-mono text-blue-300">
{`const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.post('/api/matchmaking/join', (req, res) => {
    // Logic to find best region based on latency
    res.json({ serverUrl: 'wss://region-us-west.game.com' });
});

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    socket.on('player:move', (data) => {
        socket.broadcast.emit('player:moved', data);
    });
});

httpServer.listen(3000, () => {
    console.log('Game Server running on port 3000');
});`}
              </pre>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-black text-blue-400 uppercase">DiamondSync.js</h3>
              <pre className="bg-black/60 p-6 rounded-3xl border border-blue-500/20 overflow-x-auto text-xs font-mono text-blue-300">
{`const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function awardKillDiamonds(userId) {
    const { data, error } = await supabase.rpc('increment_diamonds', { 
        user_id: userId, 
        amount: 1 
    });
    if (error) console.error('Error awarding diamonds:', error);
    return data;
}`}
              </pre>
            </div>
          </motion.div>
        )}

        {activeTab === 'deploy' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-6">
              <h3 className="text-xl font-black text-orange-400 uppercase">Guía de Despliegue en AWS</h3>
              <div className="space-y-4 text-sm text-slate-300">
                <div className="flex gap-4">
                  <div className="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0">1</div>
                  <p><span className="text-white font-bold">AWS S3 + CloudFront:</span> Sube el build de WebGL (archivos .wasm, .data, .js) a un bucket de S3 y configura CloudFront para distribución global con baja latencia.</p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0">2</div>
                  <p><span className="text-white font-bold">AWS GameLift:</span> Configura un Fleet de GameLift para alojar los servidores dedicados de Unity. GameLift manejará el escalado automático y el matchmaking por latencia.</p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0">3</div>
                  <p><span className="text-white font-bold">CI/CD:</span> Utiliza GitHub Actions para automatizar el build de Unity y el despliegue a AWS cada vez que hagas push a la rama principal.</p>
                </div>
              </div>
            </div>

            <div className="bg-emerald-900/20 p-6 rounded-3xl border border-emerald-500/30 text-center">
              <h4 className="text-emerald-400 font-black uppercase mb-2">Optimización WebGL</h4>
              <p className="text-xs text-slate-300">Asegúrate de habilitar "Brotli Compression" en Unity Build Settings y configurar los headers de respuesta en tu servidor (Content-Encoding: br) para reducir el tiempo de carga inicial en un 60%.</p>
            </div>
          </motion.div>
        )}
      </div>

      <div className="bg-purple-600/20 p-6 rounded-3xl border border-purple-500/30 text-center">
        <p className="text-purple-200 text-xs font-bold italic">
          "Este kit contiene el 100% de la lógica necesaria para desplegar un clon funcional de Free Fire en la web."
        </p>
      </div>
    </div>
  );
};

const DiamondBattleRoyale: React.FC<{ user: any; profile: any; setProfile: any; roomId: string | null; onLoginRequired: () => void }> = ({ user, profile, setProfile, roomId, onLoginRequired }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [score, setScore] = useState(0);
  const [kills, setKills] = useState(0);
  const [survivalTime, setSurvivalTime] = useState(0);
  const [roomUrl, setRoomUrl] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    if (roomId) {
      setRoomUrl(`${window.location.origin}/#/games?room=${roomId}`);
    }
  }, [roomId]);

  const copyLink = () => {
    navigator.clipboard.writeText(roomUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const startGame = async () => {
    if (!user) {
      onLoginRequired();
      return;
    }
    if (profile.store_diamonds < 10) {
      alert("Necesitas 10 diamantes para entrar a la arena.");
      return;
    }

    const newDiamonds = profile.store_diamonds - 10;
    setProfile({ ...profile, store_diamonds: newDiamonds });
    await supabase.from('profiles').update({ store_diamonds: newDiamonds }).eq('id', user.id);
    
    setGameState('playing');
    setScore(0);
    setKills(0);
    setSurvivalTime(0);
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    
    const player = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      radius: 15,
      color: '#3b82f6',
      speed: 5,
      health: 100,
      angle: 0
    };

    const keys: Record<string, boolean> = {};
    const bullets: any[] = [];
    const enemies: any[] = [];
    const particles: any[] = [];
    let enemySpawnTimer = 0;

    const handleKeyDown = (e: KeyboardEvent) => keys[e.key.toLowerCase()] = true;
    const handleKeyUp = (e: KeyboardEvent) => keys[e.key.toLowerCase()] = false;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Scale coordinates if in full screen
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      player.angle = Math.atan2((mouseY * scaleY) - player.y, (mouseX * scaleX) - player.x);
    };
    const handleMouseDown = () => {
      bullets.push({
        x: player.x,
        y: player.y,
        radius: 4,
        color: '#fbbf24',
        velocity: {
          x: Math.cos(player.angle) * 10,
          y: Math.sin(player.angle) * 10
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    const spawnEnemy = () => {
      const radius = 20;
      let x, y;
      if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius;
        y = Math.random() * canvas.height;
      } else {
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius;
      }
      
      const angle = Math.atan2(player.y - y, player.x - x);
      enemies.push({
        x, y, radius,
        color: '#ef4444',
        velocity: {
          x: Math.cos(angle) * 2,
          y: Math.sin(angle) * 2
        },
        health: 2
      });
    };

    const update = (deltaTime: number) => {
      setSurvivalTime(prev => prev + deltaTime / 1000);

      // Player movement
      if (keys['w'] && player.y > player.radius) player.y -= player.speed;
      if (keys['s'] && player.y < canvas.height - player.radius) player.y += player.speed;
      if (keys['a'] && player.x > player.radius) player.x -= player.speed;
      if (keys['d'] && player.x < canvas.width - player.radius) player.x += player.speed;

      // Bullets
      bullets.forEach((bullet, index) => {
        bullet.x += bullet.velocity.x;
        bullet.y += bullet.velocity.y;
        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
          bullets.splice(index, 1);
        }
      });

      // Enemies
      enemySpawnTimer += deltaTime;
      if (enemySpawnTimer > 1000) {
        spawnEnemy();
        enemySpawnTimer = 0;
      }

      enemies.forEach((enemy, eIndex) => {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        enemy.velocity.x = Math.cos(angle) * 2;
        enemy.velocity.y = Math.sin(angle) * 2;
        enemy.x += enemy.velocity.x;
        enemy.y += enemy.velocity.y;

        // Collision with player
        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (dist < player.radius + enemy.radius) {
          player.health -= 0.5;
          if (player.health <= 0) {
            setGameState('gameover');
            handleGameOver();
          }
        }

        // Collision with bullets
        bullets.forEach((bullet, bIndex) => {
          const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
          if (dist < bullet.radius + enemy.radius) {
            enemy.health--;
            bullets.splice(bIndex, 1);
            if (enemy.health <= 0) {
              enemies.splice(eIndex, 1);
              setKills(prev => prev + 1);
              setScore(prev => prev + 100);
              // Particles
              for (let i = 0; i < 8; i++) {
                particles.push({
                  x: enemy.x, y: enemy.y,
                  radius: Math.random() * 3,
                  color: enemy.color,
                  velocity: {
                    x: (Math.random() - 0.5) * 5,
                    y: (Math.random() - 0.5) * 5
                  },
                  alpha: 1
                });
              }
            }
          }
        });
      });

      // Particles
      particles.forEach((particle, index) => {
        particle.x += particle.velocity.x;
        particle.y += particle.velocity.y;
        particle.alpha -= 0.02;
        if (particle.alpha <= 0) particles.splice(index, 1);
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Particles
      particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Bullets
      bullets.forEach(b => {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Enemies
      enemies.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        // Health bar
        ctx.fillStyle = '#000';
        ctx.fillRect(e.x - 15, e.y - 30, 30, 5);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.x - 15, e.y - 30, (e.health / 2) * 30, 5);
      });

      // Player
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
      ctx.fill();
      // Gun
      ctx.fillStyle = '#64748b';
      ctx.fillRect(10, -5, 20, 10);
      ctx.restore();

      // Health Bar
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(20, 20, 200, 20);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(20, 20, (player.health / 100) * 200, 20);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(20, 20, 200, 20);
    };

    const loop = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;
      update(deltaTime);
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    const handleGameOver = async () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      
      const reward = Math.floor(kills * 1); // 1 diamond per kill
      if (reward > 0) {
        const newDiamonds = profile.store_diamonds + reward;
        setProfile({ ...profile, store_diamonds: newDiamonds });
        await supabase.from('profiles').update({ store_diamonds: newDiamonds }).eq('id', user.id);
      }
    };

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [gameState]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl mx-auto">
      <div className="bg-blue-900/40 backdrop-blur-md p-4 rounded-2xl border border-blue-400/30 shadow-lg w-full text-center relative overflow-hidden">
        <h2 className="text-xl sm:text-2xl font-black text-white mb-1 tracking-tight uppercase italic">Diamond Battle Royale</h2>
        <p className="text-blue-300 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">Sobrevive y gana diamantes</p>
        
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex flex-col items-center">
            <span className="text-[8px] sm:text-[9px] font-bold text-blue-400 uppercase">Kills</span>
            <span className="text-base sm:text-xl font-black text-white">{kills}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[8px] sm:text-[9px] font-bold text-blue-400 uppercase">Tiempo</span>
            <span className="text-base sm:text-xl font-black text-white">{Math.floor(survivalTime)}s</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[8px] sm:text-[9px] font-bold text-blue-400 uppercase">Diamantes</span>
            <span className="text-base sm:text-xl font-black text-yellow-400">+{kills}</span>
          </div>
        </div>

        <div className="absolute top-4 right-4 flex gap-2">
          <button 
            onClick={() => setShowInstructions(true)}
            className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-colors"
            title="Instrucciones"
          >
            ❓
          </button>
          <button 
            onClick={toggleFullScreen}
            className="bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-colors"
            title="Pantalla Completa"
          >
            {isFullScreen ? '↙️' : '↗️'}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full aspect-video bg-[#051130] rounded-3xl border-8 border-blue-900 shadow-inner overflow-hidden flex items-center justify-center">
        {gameState === 'idle' && (
          <div className="flex flex-col items-center gap-4 z-10 p-6 w-[90%] sm:w-auto bg-black/60 backdrop-blur-md rounded-2xl border border-white/10">
            <div className="text-center space-y-1">
              <h3 className="text-2xl sm:text-4xl font-black text-white uppercase italic">¿Listo para la Arena?</h3>
              <p className="text-blue-300 text-[10px] sm:text-sm font-bold uppercase tracking-widest">Costo: 10 💎</p>
            </div>
            <button 
              onClick={startGame}
              className="bg-green-500 text-white px-8 py-3 rounded-xl font-black text-lg sm:text-2xl border border-green-300 shadow-md hover:bg-green-400 active:translate-y-0.5 transition-all w-full sm:w-auto touch-manipulation"
            >
              ENTRAR A LA BATALLA
            </button>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-white text-[8px] sm:text-[10px] font-bold uppercase tracking-widest space-y-1 w-full sm:w-auto">
              <p>🎮 WASD: Moverse</p>
              <p>🖱️ Mouse: Apuntar y Disparar</p>
              <p>💎 +1 diamante por enemigo abatido</p>
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="flex flex-col items-center gap-6 z-10 animate-in fade-in zoom-in duration-300">
            <div className="text-center space-y-2">
              <h3 className="text-6xl font-black text-red-500 uppercase italic drop-shadow-lg">¡FIN DE LA PARTIDA!</h3>
              <p className="text-white text-xl font-bold uppercase tracking-widest">Has abatido a {kills} enemigos</p>
              <p className="text-yellow-400 text-2xl font-black uppercase tracking-widest">Ganaste {kills} diamantes</p>
            </div>
            <button 
              onClick={startGame}
              className="bg-gradient-to-b from-blue-400 to-blue-600 text-white px-12 py-4 rounded-full font-black text-3xl border-4 border-blue-200 shadow-[0_8px_0_#1e40af] hover:scale-105 active:translate-y-1 active:shadow-none transition-all touch-manipulation"
            >
              REINTENTAR (10 💎)
            </button>
          </div>
        )}

        <canvas 
          ref={canvasRef} 
          width={800} 
          height={450} 
          className={`absolute inset-0 w-full h-full object-contain ${gameState !== 'playing' ? 'opacity-30 blur-sm' : ''}`}
        />

        {/* In-game HUD for full screen */}
        {isFullScreen && gameState === 'playing' && (
          <div className="absolute top-4 left-4 flex gap-4 pointer-events-none">
            <div className="bg-black/50 px-4 py-2 rounded-xl border border-white/20">
              <span className="text-xs font-black text-blue-400 uppercase block">Kills</span>
              <span className="text-xl font-black text-white">{kills}</span>
            </div>
            <div className="bg-black/50 px-4 py-2 rounded-xl border border-white/20">
              <span className="text-xs font-black text-blue-400 uppercase block">Tiempo</span>
              <span className="text-xl font-black text-white">{Math.floor(survivalTime)}s</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border-2 border-white/10 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invita a tus amigos</span>
          <span className="text-white font-bold text-sm truncate max-w-[300px]">{roomUrl}</span>
        </div>
        <button 
          onClick={copyLink}
          className={`px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${isCopied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {isCopied ? '¡COPIADO!' : 'COPIAR LINK DE SALA'}
        </button>
      </div>

      {/* Instructions Modal */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border-4 border-blue-500 rounded-[2.5rem] p-8 max-w-2xl w-full relative overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>
              <button 
                onClick={() => setShowInstructions(false)}
                className="absolute top-6 right-6 text-white bg-red-500 w-10 h-10 rounded-full font-black text-xl hover:scale-110 transition-transform"
              >
                X
              </button>
              
              <h2 className="text-3xl font-black text-white uppercase italic mb-6 text-center tracking-tighter">
                Diamond Battle Royale <br/>
                <span className="text-blue-400 text-sm not-italic tracking-widest">GUÍA DE SUPERVIVENCIA</span>
              </h2>

              <div className="space-y-6">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <h3 className="text-yellow-400 font-black uppercase text-sm mb-3">🎮 Controles</h3>
                  <div className="grid grid-cols-2 gap-4 text-white text-xs font-bold">
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-600 px-3 py-1 rounded-lg">W A S D</span>
                      <span>Moverse</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-600 px-3 py-1 rounded-lg">MOUSE</span>
                      <span>Apuntar</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-600 px-3 py-1 rounded-lg">CLICK</span>
                      <span>Disparar</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-600 px-3 py-1 rounded-lg">ESC</span>
                      <span>Salir Fullscreen</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <h3 className="text-green-400 font-black uppercase text-sm mb-3">💎 Recompensas</h3>
                  <ul className="text-white text-xs space-y-2 list-disc pl-4 font-medium">
                    <li>Costo de entrada: <span className="text-yellow-400 font-black">10 Diamantes</span>.</li>
                    <li>Por cada enemigo eliminado: <span className="text-yellow-400 font-black">+1 Diamante</span>.</li>
                    <li>Los diamantes se acreditan al finalizar la partida.</li>
                    <li>¡Sobrevive el mayor tiempo posible para acumular una fortuna!</li>
                  </ul>
                </div>

                <div className="bg-blue-600/20 p-4 rounded-2xl border border-blue-500/30 text-center">
                  <p className="text-blue-200 text-xs font-bold italic">
                    "En la arena, solo los más rápidos prosperan. ¡Buena suerte, soldado!"
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowInstructions(false)}
                className="w-full mt-8 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg"
              >
                ¡ENTENDIDO!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CompetitiveSumsGame: React.FC<{ user: any; profile: any; setProfile: any; setNotification: any; setShowLoginModal: (show: boolean) => void }> = ({ user: authUser, profile: authProfile, setProfile: authSetProfile, setNotification, setShowLoginModal }) => {
  const [guestUser, setGuestUser] = useState<any>(null);
  const [guestProfile, setGuestProfile] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('sums_pro_guest_user');
    const savedProfile = localStorage.getItem('sums_pro_guest_profile');
    if (savedUser && savedProfile) {
      try {
        setGuestUser(safeJSONParse(savedUser));
        setGuestProfile(safeJSONParse(savedProfile));
      } catch (e) {
        console.error('Error parsing guest profile from localStorage:', e);
      }
    }
  }, []);

  const user = authUser || guestUser;
  const profile = authProfile || guestProfile;

  const setProfile = (newProfile: any) => {
    if (authUser) {
      authSetProfile(newProfile);
    } else {
      setGuestProfile(newProfile);
    }
  };

  const [rooms, setRooms] = useState<any[]>([]);
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [gameState, setGameState] = useState<'lobby' | 'waiting' | 'playing' | 'results'>('lobby');
  const [betAmount, setBetAmount] = useState(10);
  const [countdown, setCountdown] = useState(10);
  const [questions, setQuestions] = useState<{ a: number; b: number; answer: number; options?: number[] }[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [incorrectAnswers, setIncorrectAnswers] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [preGameCountdown, setPreGameCountdown] = useState<number | null>(null);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [gameStartTime, setGameStartTime] = useState(0);
  const [gameEndTime, setGameEndTime] = useState(0);
  const [ranking, setRanking] = useState<any[]>([]);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({ 
    fullName: profile?.full_name || '', 
    dui: profile?.dui || '',
    bankName: profile?.bank_name || '',
    bankAccount: profile?.bank_account || '', 
    phone: profile?.phone || '',
    email: profile?.email || '',
    amount: 0 
  });
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);

  useEffect(() => {
    const savedRoom = localStorage.getItem('sums_pro_active_room');
    const savedState = localStorage.getItem('sums_pro_game_state');
    if (savedRoom && savedState && user?.id) {
      try {
        const room = safeJSONParse(savedRoom);
        // Verify room still exists and user is in it
        supabase.from('game_rooms').select('*').eq('id', room.id).single().then(({ data: roomData }) => {
          if (roomData) {
            supabase.from('game_players').select('*').eq('room_id', room.id).eq('user_id', user.id).single().then(({ data: playerData }) => {
              if (playerData) {
                setActiveRoom(roomData);
                setGameState(savedState as any);
                
                // Restore game progress if playing
                if (savedState === 'playing') {
                  const savedQuestions = localStorage.getItem('sums_pro_questions');
                  const savedIndex = localStorage.getItem('sums_pro_current_index');
                  const savedCorrect = localStorage.getItem('sums_pro_correct');
                  const savedIncorrect = localStorage.getItem('sums_pro_incorrect');
                  const savedResults = localStorage.getItem('sums_pro_results');
                  const savedStartTime = localStorage.getItem('sums_pro_start_time');
                  
                  if (savedQuestions) setQuestions(safeJSONParse(savedQuestions));
                  if (savedIndex) setCurrentQuestionIndex(parseInt(savedIndex));
                  if (savedCorrect) setCorrectAnswers(parseInt(savedCorrect));
                  if (savedIncorrect) setIncorrectAnswers(parseInt(savedIncorrect));
                  if (savedResults) setResults(safeJSONParse(savedResults));
                  if (savedStartTime) setGameStartTime(parseInt(savedStartTime));
                }
              } else {
                localStorage.removeItem('sums_pro_active_room');
                localStorage.removeItem('sums_pro_game_state');
              }
            });
          } else {
            localStorage.removeItem('sums_pro_active_room');
            localStorage.removeItem('sums_pro_game_state');
          }
        });
      } catch (e) {
        console.error('Error restoring game state:', e);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeRoom) {
      localStorage.setItem('sums_pro_active_room', JSON.stringify(activeRoom));
    } else {
      localStorage.removeItem('sums_pro_active_room');
    }
  }, [activeRoom]);

  useEffect(() => {
    localStorage.setItem('sums_pro_game_state', gameState);
    if (gameState !== 'playing') {
      localStorage.removeItem('sums_pro_questions');
      localStorage.removeItem('sums_pro_current_index');
      localStorage.removeItem('sums_pro_correct');
      localStorage.removeItem('sums_pro_incorrect');
      localStorage.removeItem('sums_pro_results');
      localStorage.removeItem('sums_pro_start_time');
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'playing') {
      localStorage.setItem('sums_pro_questions', JSON.stringify(questions));
      localStorage.setItem('sums_pro_current_index', currentQuestionIndex.toString());
      localStorage.setItem('sums_pro_correct', correctAnswers.toString());
      localStorage.setItem('sums_pro_incorrect', incorrectAnswers.toString());
      localStorage.setItem('sums_pro_results', JSON.stringify(results));
      localStorage.setItem('sums_pro_start_time', gameStartTime.toString());
    }
  }, [gameState, questions, currentQuestionIndex, correctAnswers, incorrectAnswers, results, gameStartTime]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowWithdrawal(false);
      }
    };
    if (showWithdrawal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showWithdrawal]);
  const [fallingSums, setFallingSums] = useState<{ id: number; x: number; text: string; duration: number; size: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isIdCopied, setIsIdCopied] = useState(false);
  
  const [createBotLevel, setCreateBotLevel] = useState<string | null>(null);
  const [activeBotLevel, setActiveBotLevel] = useState<string | null>(null);
  const [botState, setBotState] = useState<{ score: number, results: boolean[], finished: boolean, timeTaken: number } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now() + Math.random();
      // Pick from three lanes: left (15%), center (50%), right (85%) with some variance
      const lanes = [15, 50, 85];
      const x = lanes[Math.floor(Math.random() * lanes.length)] + (Math.random() * 10 - 5);
      const a = Math.floor(Math.random() * 50) + 1;
      const b = Math.floor(Math.random() * 50) + 1;
      const text = `${a} + ${b}`;
      const duration = 3 + Math.random() * 4; // 3s to 7s
      const size = 0.5 + Math.random() * 1; // 0.5 to 1.5 scale
      
      setFallingSums(prev => [...prev.slice(-30), { id, x, text, duration, size }]);
      
      // Remove after animation
      setTimeout(() => {
        setFallingSums(prev => prev.filter(s => s.id !== id));
      }, duration * 1000);
    }, 400); // Frequent for "rain" feel

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchRanking();
    const roomsSubscription = supabase
      .channel('game_rooms_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms' }, fetchRooms)
      .subscribe();

    return () => {
      supabase.removeChannel(roomsSubscription);
    };
  }, []);

  useEffect(() => {
    if (activeRoom) {
      fetchPlayers();
      const playersSubscription = supabase
        .channel(`room_players_${activeRoom.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `room_id=eq.${activeRoom.id}` }, (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.user_id !== user?.id) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification("¡Nuevo Jugador!", {
                body: "Un nuevo jugador se ha unido a la sala de Sumas Pro.",
              });
            }
          }
          fetchPlayers();
        })
        .subscribe();

      const roomStateSubscription = supabase
        .channel(`room_state_${activeRoom.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${activeRoom.id}` }, (payload) => {
          if (payload.new.status === 'playing' && gameState !== 'playing') {
            setPreGameCountdown(3);
          } else if (payload.new.status === 'finished' && gameState !== 'results') {
            setGameState('results');
            if (gameEndTime === 0) setGameEndTime(Date.now());
            setNotification({ msg: "¡Un jugador ha terminado la partida!", type: 'success' });
            checkWinner();
          } else if (payload.new.status === 'waiting' && gameState === 'results') {
            setGameState('waiting');
            setResults([]);
            setCorrectAnswers(0);
            setIncorrectAnswers(0);
            setCurrentQuestionIndex(0);
            setWinnerName(null);
            setGameEndTime(0);
            if (activeBotLevel) {
              setBotState({ score: 0, results: [], finished: false, timeTaken: 0 });
            }
            supabase.from('game_players').update({
              score: 0,
              time_taken: 0,
              results: [],
              finished: false
            }).eq('room_id', activeRoom.id).eq('user_id', user?.id).then();
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_rooms', filter: `id=eq.${activeRoom.id}` }, () => {
          setNotification({ msg: "La sala ha sido eliminada", type: 'error' });
          setActiveRoom(null);
          setGameState('lobby');
        })
        .subscribe();

      return () => {
        supabase.removeChannel(playersSubscription);
        supabase.removeChannel(roomStateSubscription);
      };
    }
  }, [activeRoom, gameState]);

  useEffect(() => {
    if (preGameCountdown === null) return;
    if (preGameCountdown > 0) {
      const timer = setTimeout(() => setPreGameCountdown(preGameCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (preGameCountdown === 0) {
      const timer = setTimeout(() => {
        setPreGameCountdown(null);
        startQuiz();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [preGameCountdown]);

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('game_rooms')
      .select('*, game_players(user_id, profiles(full_name))')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });
    if (data) setRooms(data);
  };

  const fetchPlayers = async () => {
    if (!activeRoom) return;
    const { data } = await supabase
      .from('game_players')
      .select('*, profiles(full_name)')
      .eq('room_id', activeRoom.id);
    if (data) setPlayers(data);
  };

  const fetchRanking = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, sums_wins')
      .gt('sums_wins', 0)
      .order('sums_wins', { ascending: false })
      .limit(10);
    if (data) setRanking(data || []);
  };

  const createDemoRoom = async () => {
    if (!authUser) {
      setShowLoginModal(true);
      return;
    }
    if (!profile) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const { data: room, error: roomError } = await supabase
      .from('game_rooms')
      .insert([{ 
        creator_id: authUser.id, 
        bet_amount: 0, 
        total_pot: 0,
        status: 'waiting' 
      }])
      .select()
      .single();

    if (roomError) {
      console.error(roomError);
      return;
    }

    await supabase.from('game_players').insert([{
      room_id: room.id,
      user_id: authUser.id,
      bet_amount: 0
    }]);

    setActiveRoom(room);
    setPlayers([{ user_id: authUser.id, profiles: { full_name: profile.full_name }, bet_amount: 0 }]);
    setGameState('waiting');
    
    if (createBotLevel) {
      setActiveBotLevel(createBotLevel);
      setBotState({ score: 0, results: [], finished: false, timeTaken: 0 });
    } else {
      setActiveBotLevel(null);
      setBotState(null);
    }
  };

  const createRoom = async () => {
    if (!authUser) {
      setShowLoginModal(true);
      return;
    }
    if (!profile) return;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    if (betAmount < 0) {
      alert("La apuesta no puede ser negativa.");
      return;
    }
    if ((profile?.store_diamonds || 0) < betAmount) {
      alert("No tienes suficientes diamantes. Ve a la tienda para recargar.");
      return;
    }

    const { data: room, error: roomError } = await supabase
      .from('game_rooms')
      .insert([{ 
        creator_id: authUser.id, 
        bet_amount: betAmount, 
        total_pot: betAmount,
        status: 'waiting' 
      }])
      .select()
      .single();

    if (roomError) {
      console.error(roomError);
      return;
    }

    await supabase.from('game_players').insert([{
      room_id: room.id,
      user_id: authUser.id,
      bet_amount: betAmount
    }]);

    if (betAmount > 0) {
      const newDiamonds = profile.store_diamonds - betAmount;
      setProfile({ ...profile, store_diamonds: newDiamonds });
      await supabase.from('profiles').update({ store_diamonds: newDiamonds }).eq('id', authUser.id);
    }

    setActiveRoom(room);
    setPlayers([{ user_id: authUser.id, profiles: { full_name: profile.full_name }, bet_amount: betAmount }]);
    setGameState('waiting');
  };

  const copyRoomId = (id: string) => {
    navigator.clipboard.writeText(id);
    setIsIdCopied(true);
    setTimeout(() => setIsIdCopied(false), 2000);
  };

  const deleteRoom = async (roomId: string, betToRefund: number) => {
    if (!authUser || !profile) return;
    try {
      const { error } = await supabase.from('game_rooms').delete().eq('id', roomId).eq('creator_id', authUser.id);
      if (error) throw error;

      const newDiamonds = profile.store_diamonds + betToRefund;
      setProfile({ ...profile, store_diamonds: newDiamonds });
      await supabase.from('profiles').update({ store_diamonds: newDiamonds }).eq('id', authUser.id);
      
      setActiveRoom(null);
      setGameState('lobby');
      fetchRooms();
      setNotification({ msg: "Sala eliminada y apuesta devuelta", type: 'success' });
    } catch (err) {
      console.error(err);
      setNotification({ msg: "Error al eliminar la sala", type: 'error' });
    }
  };

  const leaveRoom = async () => {
    if (!activeRoom || !user || !profile) return;

    if (activeRoom.creator_id === user.id) {
      // If creator, delete the room (refunds creator)
      await deleteRoom(activeRoom.id, activeRoom.bet_amount);
      return;
    }

    try {
      // Find the player's bet to refund
      const { data: playerData, error: fetchError } = await supabase
        .from('game_players')
        .select('bet_amount')
        .eq('room_id', activeRoom.id)
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;

      const betToRefund = playerData.bet_amount;

      // Remove player from room
      const { error: deleteError } = await supabase
        .from('game_players')
        .delete()
        .eq('room_id', activeRoom.id)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Update room total pot
      const newPot = Math.max(0, activeRoom.total_pot - betToRefund);
      await supabase.from('game_rooms').update({ total_pot: newPot }).eq('id', activeRoom.id);

      // Refund player
      if (betToRefund > 0) {
        const newDiamonds = profile.store_diamonds + betToRefund;
        setProfile({ ...profile, store_diamonds: newDiamonds });
        await supabase.from('profiles').update({ store_diamonds: newDiamonds }).eq('id', user.id);
      }

      setActiveRoom(null);
      setGameState('lobby');
      fetchRooms();
      setNotification({ msg: "Has salido de la sala", type: 'success' });
    } catch (err) {
      console.error(err);
      setNotification({ msg: "Error al salir de la sala", type: 'error' });
    }
  };

  const restartGame = async () => {
    if (!activeRoom || activeRoom.creator_id !== user?.id) return;
    
    try {
      // Reset all players in the room
      await supabase.from('game_players').update({
        score: 0,
        results: [],
        time_taken: 0,
        finished: false
      }).eq('room_id', activeRoom.id);

      // Reset room status
      await supabase.from('game_rooms').update({ status: 'waiting' }).eq('id', activeRoom.id);
      
      setGameState('waiting');
      setCorrectAnswers(0);
      setIncorrectAnswers(0);
      setCurrentQuestionIndex(0);
      setResults([]);
      setGameStartTime(0);
      setGameEndTime(0);
      setWinnerName(null);
      setNotification({ msg: "Juego reiniciado", type: 'success' });
    } catch (err) {
      console.error(err);
      setNotification({ msg: "Error al reiniciar el juego", type: 'error' });
    }
  };

  const joinRoom = async (room: any) => {
    let currentUser = user;
    let currentProfile = profile;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (room.bet_amount === 0) {
      if (!currentUser) {
        const guestId = crypto.randomUUID();
        const newGuestProfile = {
          id: guestId,
          full_name: 'Invitado ' + Math.floor(Math.random() * 1000),
          email: `guest_${guestId}@demo.com`,
          store_diamonds: 0
        };
        
        const { error: profileError } = await supabase.from('profiles').insert([newGuestProfile]);
        if (profileError) {
          console.error('Error creating guest profile:', profileError);
          setShowLoginModal(true);
          return;
        }
        
        currentUser = { id: guestId };
        currentProfile = newGuestProfile;
        setGuestUser(currentUser);
        setGuestProfile(currentProfile);
        localStorage.setItem('sums_pro_guest_user', JSON.stringify(currentUser));
        localStorage.setItem('sums_pro_guest_profile', JSON.stringify(currentProfile));
      }
    } else {
      if (!authUser) {
        setShowLoginModal(true);
        return;
      }
      currentUser = authUser;
      currentProfile = profile;
    }

    if (!currentProfile) return;

    if (room.game_players?.some((p: any) => p.user_id === currentUser.id)) {
      setActiveRoom(room);
      setGameState('waiting');
      fetchPlayers();
      return;
    }

    let betAmount = 0;
    if (room.bet_amount > 0) {
      const betAmountStr = prompt(`¿Cuántos diamantes quieres apostar? (Tienes ${currentProfile?.store_diamonds || 0} 💎)`, room.bet_amount.toString());
      if (betAmountStr === null) return; // Usuario canceló

      betAmount = parseInt(betAmountStr);
      if (isNaN(betAmount) || betAmount <= 0) {
        alert("Por favor ingresa una cantidad válida.");
        return;
      }

      if ((currentProfile?.store_diamonds || 0) < betAmount) {
        alert("No tienes suficientes diamantes para esta apuesta.");
        return;
      }
    }

    // Delete existing player record for this user in this room to avoid duplicates
    await supabase.from('game_players').delete().eq('room_id', room.id).eq('user_id', currentUser.id);

    const { error: joinError } = await supabase
      .from('game_players')
      .insert([{
        room_id: room.id,
        user_id: currentUser.id,
        bet_amount: betAmount
      }]);

    if (joinError) {
      console.error(joinError);
      return;
    }

    if (betAmount > 0) {
      const newPot = room.total_pot + betAmount;
      await supabase.from('game_rooms').update({ total_pot: newPot }).eq('id', room.id);

      const newDiamonds = currentProfile.store_diamonds - betAmount;
      setProfile({ ...currentProfile, store_diamonds: newDiamonds });
      await supabase.from('profiles').update({ store_diamonds: newDiamonds }).eq('id', currentUser.id);
      setActiveRoom({ ...room, total_pot: newPot });
    } else {
      setActiveRoom(room);
    }

    setGameState('waiting');
    fetchPlayers();
  };

  const triggerStart = async () => {
    if (!activeRoom) return;
    setPreGameCountdown(3);
    await supabase.from('game_rooms').update({ status: 'playing' }).eq('id', activeRoom.id);
  };

  useEffect(() => {
    if (gameState === 'playing' && activeBotLevel && botState && !botState.finished) {
      const botConfig = {
        easy: { delay: 5000, accuracy: 0.6 },
        intermediate: { delay: 3000, accuracy: 0.8 },
        advanced: { delay: 1500, accuracy: 0.95 }
      }[activeBotLevel];

      if (!botConfig) return;

      const timer = setTimeout(() => {
        const isCorrect = Math.random() < botConfig.accuracy;
        const newResults = [...botState.results, isCorrect];
        const newScore = isCorrect ? botState.score + 1 : botState.score;
        const isFinished = newResults.length === 10;
        
        setBotState({
          score: newScore,
          results: newResults,
          finished: isFinished,
          timeTaken: isFinished ? (Date.now() - gameStartTime) / 1000 : 0
        });

        if (isFinished) {
          supabase.from('game_rooms').update({ status: 'finished' }).eq('id', activeRoom?.id).then();
        }
      }, botConfig.delay + (Math.random() * 1000 - 500));

      return () => clearTimeout(timer);
    }
  }, [gameState, activeBotLevel, botState, gameStartTime, activeRoom]);

  const startQuiz = () => {
    const newQuestions = Array.from({ length: 10 }, () => {
      const a = Math.floor(Math.random() * 50) + 1;
      const b = Math.floor(Math.random() * 50) + 1;
      const answer = a + b;
      
      let wrong1 = answer + Math.floor(Math.random() * 10) + 1;
      let wrong2 = answer - Math.floor(Math.random() * 10) - 1;
      if (wrong2 <= 0) wrong2 = answer + Math.floor(Math.random() * 10) + 11;
      
      const options = [answer, wrong1, wrong2].sort(() => Math.random() - 0.5);

      return { a, b, answer, options };
    });
    setQuestions(newQuestions);
    setGameState('playing');
    setCurrentQuestionIndex(0);
    setCorrectAnswers(0);
    setIncorrectAnswers(0);
    setResults([]);
    setWinnerName(null);
    setGameStartTime(Date.now());
  };

  const handleShare = async () => {
    const shareData = {
      title: '➕ Sumas Pro - NewBank AI',
      text: '¡Ven a jugar Sumas Competitivas conmigo en NewBank AI y gana diamantes!',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setNotification({ msg: "¡Enlace copiado al portapapeles!", type: 'success' });
      }
    } catch (err) {
      console.error('Error al compartir:', err);
    }
  };

  const handleOptionClick = async (selectedAnswer: number) => {
    const currentQuestion = questions[currentQuestionIndex];
    let isCorrect = false;
    if (selectedAnswer === currentQuestion.answer) {
      setCorrectAnswers(prev => prev + 1);
      isCorrect = true;
    } else {
      setIncorrectAnswers(prev => prev + 1);
    }

    const newResults = [...results, isCorrect];
    setResults(newResults);

    // Update progress in DB for live tracking
    await supabase.from('game_players').update({
      score: isCorrect ? correctAnswers + 1 : correctAnswers,
      results: newResults
    }).eq('room_id', activeRoom.id).eq('user_id', user.id);

    if (currentQuestionIndex < 9) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishGame(isCorrect ? correctAnswers + 1 : correctAnswers, newResults);
    }
  };

  const finishGame = async (finalScore?: number, finalResults?: boolean[]) => {
    const endTime = Date.now();
    setGameEndTime(endTime);
    const totalTime = (endTime - gameStartTime) / 1000;
    setGameState('results');

    await supabase.from('game_players').update({
      score: finalScore !== undefined ? finalScore : correctAnswers,
      time_taken: totalTime,
      results: finalResults !== undefined ? finalResults : results,
      finished: true
    }).eq('room_id', activeRoom.id).eq('user_id', user.id);

    // Immediately mark room as finished to notify others
    await supabase.from('game_rooms').update({ status: 'finished' }).eq('id', activeRoom.id);
  };

  const checkWinner = async () => {
    const { data: allPlayers } = await supabase
      .from('game_players')
      .select('*, profiles(full_name)')
      .eq('room_id', activeRoom.id);

    if (!allPlayers) return;

    let playersToCompare = [...allPlayers];

    if (activeBotLevel && botState) {
      playersToCompare.push({
        user_id: 'bot',
        score: botState.score,
        time_taken: botState.timeTaken || ((Date.now() - gameStartTime) / 1000),
        profiles: { full_name: `Bot ${activeBotLevel.charAt(0).toUpperCase() + activeBotLevel.slice(1)}` }
      } as any);
    }

    const sorted = playersToCompare.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = a.time_taken || Infinity;
      const timeB = b.time_taken || Infinity;
      return timeA - timeB;
    });

    const winner = sorted[0];
    setWinnerName(winner.profiles.full_name);
    if (winner.user_id === user?.id) {
      const winAmount = activeRoom.total_pot;
      const newDiamonds = (profile?.store_diamonds || 0) + winAmount;
      setProfile({ ...profile, store_diamonds: newDiamonds });
      
      // Only update diamonds if it's not a demo room
      if (winAmount > 0) {
        await supabase.from('profiles').update({ 
          store_diamonds: newDiamonds,
          sums_wins: (profile?.sums_wins || 0) + 1
        }).eq('id', user.id);
        alert(`¡FELICIDADES! Ganaste el pozo de ${winAmount} 💎`);
      } else {
        await supabase.from('profiles').update({ 
          sums_wins: (profile?.sums_wins || 0) + 1
        }).eq('id', user.id);
        alert(`¡FELICIDADES! Ganaste la partida DEMO`);
      }
    } else if (winner.user_id === 'bot') {
      alert(`¡El Bot ha ganado la partida!`);
    }
  };

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawalForm.amount < 40) {
      alert("El monto mínimo para canjear es de 40 diamantes.");
      return;
    }
    if (withdrawalForm.amount > (profile?.store_diamonds || 0)) {
      alert("Cantidad inválida.");
      return;
    }

    setIsSubmittingWithdrawal(true);
    try {
      // 1. Create the payment request for the admin
      const { error: requestError } = await supabase.from('payment_requests').insert([{
        user_id: user.id,
        full_name: withdrawalForm.fullName,
        dui: withdrawalForm.dui,
        diamonds_amount: withdrawalForm.amount,
        total_amount: (withdrawalForm.amount * 0.25) * 0.70, // 30% admin fee deduction
        bank_name: withdrawalForm.bankName,
        account_number: withdrawalForm.bankAccount,
        phone: withdrawalForm.phone,
        email: withdrawalForm.email,
        status: 'PENDING'
      }]);

      if (requestError) throw requestError;

      // 2. Deduct diamonds from user profile
      const newDiamonds = profile.store_diamonds - withdrawalForm.amount;
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ store_diamonds: newDiamonds })
        .eq('id', user.id);
      
      if (updateError) throw updateError;

      // 3. Update local state
      setProfile({ ...profile, store_diamonds: newDiamonds });
      
      alert("Solicitud de retiro enviada con éxito. Los diamantes han sido descontados de tu saldo.");
      setShowWithdrawal(false);
    } catch (error) {
      alert("Error al procesar el retiro.");
      console.error(error);
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  const allDisplayPlayers = [...players];
  if (activeBotLevel && botState) {
    allDisplayPlayers.push({
      user_id: 'bot',
      score: botState.score,
      results: botState.results,
      bet_amount: 0,
      profiles: { full_name: `Bot ${activeBotLevel.charAt(0).toUpperCase() + activeBotLevel.slice(1)}` }
    } as any);
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 p-3 sm:p-4 relative overflow-hidden">
      {/* Falling Sums Animation Overlay */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <AnimatePresence>
          {fallingSums.map((sum) => (
            <motion.div
              key={sum.id}
              initial={{ y: -100, opacity: 0, scale: sum.size * 0.5, rotate: -20 }}
              animate={{ 
                y: [null, 600, 1200],
                opacity: [0, 0.4, 0.4, 0],
                scale: [sum.size * 0.5, sum.size * 1.2, sum.size, sum.size * 1.5],
                rotate: [ -20, 20, -20, 40]
              }}
              exit={{ 
                scale: [sum.size * 1.5, sum.size * 3],
                opacity: 0,
                filter: "blur(10px)",
                transition: { duration: 0.5 }
              }}
              transition={{ duration: sum.duration, ease: "linear" }}
              style={{ left: `${sum.x}%`, translateX: '-50%' }}
              className="absolute text-orange-500/30 font-black text-4xl italic select-none whitespace-nowrap"
            >
              {sum.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="bg-slate-900/80 backdrop-blur-xl p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[3rem] border border-orange-500/20 shadow-2xl relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 sm:mb-8">
          <div className="text-center sm:text-left">
            <h2 className="text-xl sm:text-4xl font-black text-white uppercase italic tracking-tighter">Sumas Pro</h2>
            <p className="text-orange-400 font-bold uppercase tracking-[0.2em] text-[7px] sm:text-[10px] opacity-80">Agilidad mental competitiva</p>
            <div className="mt-1 flex flex-col sm:flex-row sm:gap-3 items-center sm:items-start">
              <p className="text-white font-black text-[9px] sm:text-[10px] uppercase tracking-widest">Tus Diamantes: <span className="text-orange-500">{profile?.store_diamonds || 0} 💎</span></p>
              <p className="text-slate-400 font-bold text-[8px] sm:text-[9px] uppercase tracking-widest">Equivalente: <span className="text-green-500">${((profile?.store_diamonds || 0) * 0.25).toFixed(2)} USD</span></p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={handleShare}
              className="flex-1 sm:flex-none bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all border border-blue-600/30 flex items-center justify-center gap-2"
            >
              <span>🔗</span> <span className="xs:inline">Compartir</span>
            </button>
            <button 
              onClick={() => {
                if (!authUser) {
                  setShowLoginModal(true);
                } else {
                  setShowWithdrawal(true);
                }
              }}
              className="flex-1 sm:flex-none bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all border border-green-600/30 flex items-center justify-center gap-2"
            >
              <span>💸</span> <span className="xs:inline">Retirar</span>
            </button>
          </div>
        </div>

        {gameState === 'lobby' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="text-center mb-1 sm:mb-2">
              <span className="text-slate-500 font-black uppercase text-[8px] sm:text-[9px] tracking-[0.4em] opacity-40">Área: Lobby y Selección de Sala</span>
            </div>
            <div className="bg-white/5 p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/5">
              <h3 className="text-white font-black uppercase text-[10px] sm:text-sm mb-4 sm:mb-6 tracking-widest opacity-60">Crear Nueva Sala</h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4">
                <div className="flex-grow">
                  <label className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase block mb-1.5 sm:mb-2 ml-1">Apuesta (Diamantes)</label>
                  <input 
                    type="number" 
                    value={betAmount}
                    onChange={(e) => setBetAmount((e.target.value === '' ? '' as any : parseInt(e.target.value)))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3.5 text-white font-black text-base sm:text-lg focus:border-orange-500/50 transition-all outline-none"
                  />
                </div>
                <button 
                  onClick={createRoom}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.15em] transition-all shadow-lg shadow-orange-900/20 active:scale-95 text-xs sm:text-base"
                >
                  Crear Sala
                </button>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={createDemoRoom}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.15em] transition-all shadow-lg shadow-blue-900/20 active:scale-95 text-xs sm:text-base"
                  >
                    Crear Demo
                  </button>
                  <div className="flex gap-1 justify-center">
                    <button 
                      onClick={() => setCreateBotLevel(createBotLevel === 'easy' ? null : 'easy')}
                      className={`px-2 py-1 rounded text-[7px] sm:text-[8px] font-black uppercase transition-colors ${createBotLevel === 'easy' ? 'bg-green-500 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                    >
                      Bot Fácil
                    </button>
                    <button 
                      onClick={() => setCreateBotLevel(createBotLevel === 'intermediate' ? null : 'intermediate')}
                      className={`px-2 py-1 rounded text-[7px] sm:text-[8px] font-black uppercase transition-colors ${createBotLevel === 'intermediate' ? 'bg-yellow-500 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                    >
                      Bot Medio
                    </button>
                    <button 
                      onClick={() => setCreateBotLevel(createBotLevel === 'advanced' ? null : 'advanced')}
                      className={`px-2 py-1 rounded text-[7px] sm:text-[8px] font-black uppercase transition-colors ${createBotLevel === 'advanced' ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                    >
                      Bot Difícil
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
                <h3 className="text-white font-black uppercase text-[10px] sm:text-sm tracking-widest opacity-60 ml-1">Salas Disponibles</h3>
                <div className="relative w-full sm:w-64">
                  <input 
                    type="text"
                    placeholder="Buscar por ID de sala..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-[9px] sm:text-[10px] focus:border-orange-500/50 outline-none transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 text-xs">🔍</span>
                </div>
              </div>
              {rooms.filter(r => r.id.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                <div className="bg-white/5 rounded-2xl sm:rounded-3xl py-8 sm:py-12 border border-dashed border-white/10">
                  <p className="text-slate-500 text-center font-bold uppercase text-[9px] sm:text-[10px] tracking-widest">No hay salas que coincidan</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {rooms.filter(r => r.id.toLowerCase().includes(searchTerm.toLowerCase())).map(room => (
                    <div key={room.id} className="bg-white/5 hover:bg-white/[0.08] p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-6 transition-all group">
                      <div className="flex-grow text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                          <p className="text-white font-black uppercase text-xs sm:text-sm tracking-tight">{room.bet_amount === 0 ? 'DEMO' : `${room.bet_amount} 💎`}</p>
                          <span className="w-1 h-1 rounded-full bg-white/20" />
                          <p className="text-orange-400 font-black text-[10px] sm:text-xs uppercase">
                            {room.total_pot === 0 ? 'Pozo: DEMO' : `Pozo: ${room.total_pot} 💎`}
                            {room.total_pot > 0 && <span className="text-green-500 ml-1">≈ ${(room.total_pot * 0.25).toFixed(2)} USD</span>}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-center sm:justify-start gap-1">
                          {room.game_players?.map((p: any, idx: number) => (
                            <span key={idx} className="text-[6px] sm:text-[7px] bg-white/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-slate-400 font-black uppercase tracking-tighter">
                              {p.profiles?.full_name?.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        {room.creator_id === user?.id && (
                          <button 
                            onClick={() => deleteRoom(room.id, room.bet_amount)}
                            className="flex-1 sm:flex-none bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-black text-[8px] sm:text-[9px] uppercase tracking-widest border border-red-500/20 transition-all"
                          >
                            Eliminar
                          </button>
                        )}
                        <button 
                          onClick={() => joinRoom(room)}
                          className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-black text-[8px] sm:text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                        >
                          {room.game_players?.some((p: any) => p.user_id === user?.id) ? 'Entrar' : 'Unirse'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white/5 p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/5">
              <h3 className="text-yellow-400 font-black uppercase text-[10px] sm:text-sm mb-4 sm:mb-6 text-center tracking-[0.2em] opacity-80">🏆 Ranking Global</h3>
              <div className="space-y-2 sm:space-y-3">
                {ranking.map((player, i) => (
                  <div key={i} className="flex justify-between items-center bg-black/20 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/[0.02] hover:bg-black/30 transition-all">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full font-black text-[10px] sm:text-xs ${i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-orange-400 text-black' : 'text-slate-500'}`}>
                        {i + 1}
                      </span>
                      <span className="text-white font-black text-[10px] sm:text-xs uppercase tracking-tight">{player.full_name}</span>
                    </div>
                    <span className="text-yellow-400/80 font-black text-[8px] sm:text-[10px] uppercase tracking-widest">{player.sums_wins} Wins</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {gameState !== 'lobby' && gameState !== 'playing' && user && activeRoom && (
          <div className="w-full flex justify-center mb-4">
            <VideoChat roomId={activeRoom.id} userId={user.id} />
          </div>
        )}

        {gameState === 'waiting' && (
          <div className="flex flex-col items-center gap-6 sm:gap-8 py-6 sm:py-12 w-full">
            <div className="text-center">
              <span className="text-slate-500 font-black uppercase text-[8px] sm:text-[9px] tracking-[0.4em] opacity-40">Área: Sala de Espera y Preparación</span>
            </div>
            <div className="text-center space-y-2 sm:space-y-3">
              <h3 className="text-2xl sm:text-5xl font-black text-white uppercase italic tracking-tighter">Preparados</h3>
              <p className="text-orange-400 font-bold uppercase tracking-[0.3em] text-[8px] sm:text-[11px] opacity-80">Esperando el inicio del desafío</p>
            </div>

            <div className="w-full max-w-md bg-white/5 p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-white/5 space-y-4 sm:space-y-6">
              <div className="flex justify-between items-center border-b border-white/10 pb-4 sm:pb-5">
                <div className="flex flex-col">
                  <span className="text-slate-500 font-black uppercase text-[8px] sm:text-[9px] tracking-widest">ID de Sala</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-[9px] sm:text-[10px] opacity-60">{activeRoom?.id}</span>
                    <button 
                      onClick={() => copyRoomId(activeRoom?.id)}
                      className="text-orange-500 hover:text-orange-400 transition-colors text-[9px] sm:text-[10px] font-black uppercase tracking-tighter"
                    >
                      {isIdCopied ? '¡Copiado!' : 'Copiar ID'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-slate-500 font-black uppercase text-[8px] sm:text-[9px] tracking-widest">Jugadores</span>
                  <span className="text-white font-black text-lg sm:text-xl">{players.length}</span>
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {players.map((p, i) => (
                  <div key={i} className="flex justify-between items-center bg-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/[0.02]">
                    <span className="text-white font-black text-[10px] sm:text-xs uppercase tracking-tight">{p.profiles?.full_name}</span>
                    <span className="text-orange-500 font-black text-[10px] sm:text-xs">{p.bet_amount === 0 ? 'DEMO' : `${p.bet_amount} 💎`}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 sm:pt-4 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-yellow-400/80 font-black uppercase text-[9px] sm:text-[10px] tracking-widest">Pozo Total</span>
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter">{activeRoom?.total_pot === 0 ? 'DEMO' : `${activeRoom?.total_pot} 💎`}</span>
                </div>
                {activeRoom?.total_pot > 0 && (
                  <div className="flex justify-end">
                    <span className="text-green-500 font-black text-[10px] sm:text-xs tracking-widest uppercase">≈ ${((activeRoom?.total_pot || 0) * 0.25).toFixed(2)} USD</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:gap-6 items-center w-full max-w-md">
              {activeRoom.creator_id === user?.id && (
                <button 
                  onClick={triggerStart}
                  disabled={allDisplayPlayers.length < 2}
                  className={`w-full bg-green-600 hover:bg-green-500 text-white py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl uppercase tracking-[0.15em] shadow-xl shadow-green-900/20 transition-all active:scale-95 touch-manipulation ${allDisplayPlayers.length >= 2 ? 'animate-pulse' : 'opacity-40 cursor-not-allowed'}`}
                >
                  ¡Comenzar!
                </button>
              )}
              
              {activeRoom.creator_id === user?.id ? (
                <button 
                  onClick={() => deleteRoom(activeRoom.id, activeRoom.bet_amount)}
                  className="text-red-500/60 font-black uppercase text-[8px] sm:text-[9px] tracking-widest hover:text-red-500 transition-colors"
                >
                  Cancelar Sala
                </button>
              ) : (
                <button 
                  onClick={leaveRoom}
                  className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-500 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-lg sm:text-xl uppercase tracking-[0.15em] transition-all active:scale-95 touch-manipulation"
                >
                  Salir de la Sala
                </button>
              )}

              {allDisplayPlayers.length < 2 && (
                <div className="flex flex-col items-center gap-3 sm:gap-4 mt-2 sm:mt-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  <p className="text-slate-500 font-black uppercase text-[8px] sm:text-[9px] tracking-[0.2em]">Buscando oponentes</p>
                </div>
              )}
            </div>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="flex flex-col items-center gap-6 sm:gap-8 py-4 sm:py-8 w-full relative">
            <VideoChat roomId={activeRoom.id} userId={user.id} isBackground={true} />
            <div className="relative z-10 flex flex-col items-center gap-4 sm:gap-8 w-full">
              <div className="text-center">
                <span className="text-slate-500 font-black uppercase text-[8px] sm:text-[9px] tracking-[0.4em] opacity-40">Área: Campo de Batalla Mental</span>
              </div>
              {/* Live Scoreboard */}
            <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-2 sm:mb-4">
              {allDisplayPlayers.map((p, i) => {
                const isWinner = winnerName === p.profiles?.full_name;
                return (
                  <div key={i} className="flex flex-col items-center">
                    {/* Progress Column */}
                    <div className="w-full max-w-[40px] sm:max-w-[60px] flex flex-col-reverse gap-0.5 sm:gap-1 mb-2 sm:mb-3 relative">
                      {isWinner && (
                        <motion.div 
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="absolute -top-8 sm:-top-10 left-1/2 -translate-x-1/2 text-2xl sm:text-3xl z-20"
                        >
                          🏆
                        </motion.div>
                      )}
                      {[...Array(10)].map((_, idx) => {
                        const res = p.results?.[idx];
                        return (
                          <div 
                            key={idx}
                            className={`w-full h-3 sm:h-4 rounded-sm sm:rounded-md border border-white/5 flex items-center justify-center text-[6px] sm:text-[8px] font-black transition-all duration-500 ${
                              res === true ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] text-white' :
                              res === false ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)] text-white' :
                              'bg-slate-900/90 text-slate-700'
                            }`}
                          >
                            {idx + 1}
                          </div>
                        );
                      })}
                    </div>

                    <div className={`w-full p-2 sm:p-3 rounded-lg sm:rounded-xl border transition-all duration-300 ${p.user_id === user?.id ? 'bg-orange-500/20 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-slate-800/50 border-white/10'}`}>
                      <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase truncate">{p.profiles?.full_name}</p>
                      <p className="text-base sm:text-xl font-black text-white tabular-nums">{p.score || 0} <span className="text-[8px] sm:text-[10px] text-green-400">CORRECTAS</span></p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="w-full max-w-md bg-white/5 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] shadow-[0_0_30px_rgba(249,115,22,0.15)] relative overflow-hidden">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <span className="text-slate-500 font-black uppercase text-[8px] sm:text-[9px] tracking-widest">Pregunta {currentQuestionIndex + 1}/10</span>
                <span className="text-green-500 font-black uppercase text-[8px] sm:text-[9px] tracking-widest">Aciertos: {correctAnswers}</span>
              </div>

              <div className="text-center space-y-4 sm:space-y-6">
                <div className="text-4xl sm:text-6xl font-black text-white tabular-nums tracking-tighter">
                  {questions[currentQuestionIndex]?.a} <span className="text-orange-500">+</span> {questions[currentQuestionIndex]?.b}
                </div>
                
                <div className="flex flex-row-reverse justify-center gap-2 sm:gap-3">
                  {questions[currentQuestionIndex]?.options?.map((option: number, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleOptionClick(option)}
                      className="flex-1 max-w-[70px] sm:max-w-[100px] bg-white/5 hover:bg-white/10 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xl sm:text-2xl transition-all border border-white/10 hover:border-orange-500/50 shadow-sm active:scale-95 touch-manipulation"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button 
                onClick={leaveRoom}
                className="text-red-500/60 font-black uppercase text-[8px] sm:text-[9px] tracking-widest hover:text-red-500 transition-colors"
              >
                Salir de la Sala
              </button>
            </div>
          </div>
        </div>
      )}

        {gameState === 'results' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 sm:gap-6 py-8 sm:py-10 w-full max-w-sm bg-slate-900/95 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2rem] border border-orange-500/20 shadow-2xl relative overflow-hidden"
            >
              <div className="text-center">
                <span className="text-slate-500 font-black uppercase text-[7px] sm:text-[8px] tracking-[0.4em] opacity-40">Resultados Finales</span>
              </div>

              {winnerName && (
                <motion.div 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-yellow-400/10 rounded-full border border-yellow-400/20 mb-2 sm:mb-3">
                    <span className="text-2xl sm:text-3xl">🏆</span>
                  </div>
                  <h3 className="text-[10px] font-black text-yellow-400 uppercase tracking-[0.3em] mb-1">¡GANADOR!</h3>
                  <p className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">{winnerName}</p>
                </motion.div>
              )}

              <div className="w-full px-6 sm:px-8 space-y-3 sm:space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 text-center">
                    <span className="text-slate-500 font-bold uppercase text-[6px] sm:text-[7px] tracking-widest block mb-1">Aciertos</span>
                    <span className="text-xl sm:text-2xl font-black text-white">{correctAnswers}</span>
                  </div>
                  <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5 text-center">
                    <span className="text-slate-500 font-bold uppercase text-[6px] sm:text-[7px] tracking-widest block mb-1">Tiempo</span>
                    <span className="text-xl sm:text-2xl font-black text-white">{((gameEndTime - gameStartTime) / 1000).toFixed(1)}s</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {(activeRoom?.creator_id === user?.id || activeBotLevel !== null) && (
                    <button 
                      onClick={async () => {
                        if (activeBotLevel) {
                          setGameState('waiting');
                          setBotState({ score: 0, results: [], finished: false, timeTaken: 0 });
                        } else if (activeRoom) {
                          await restartGame();
                        }
                      }}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[9px] sm:text-[10px] transition-all active:scale-[0.98]"
                    >
                      Reiniciar Juego
                    </button>
                  )}
                  <button 
                    onClick={async () => {
                      if (activeRoom) {
                        await leaveRoom();
                      } else {
                        setGameState('lobby');
                        setActiveRoom(null);
                        setActiveBotLevel(null);
                        setBotState(null);
                      }
                    }}
                    className="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[9px] sm:text-[10px] transition-all border border-white/5 active:scale-[0.98]"
                  >
                    Salir de la Sala
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {preGameCountdown !== null && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-xl">
            <motion.div 
              key={preGameCountdown}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="text-center"
            >
              <span className="text-[8rem] sm:text-[12rem] font-black text-orange-500 italic drop-shadow-[0_0_50px_rgba(249,115,22,0.5)]">
                {preGameCountdown === 0 ? '¡LISTO!' : preGameCountdown}
              </span>
            </motion.div>
          </div>
        )}
      </div>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {showWithdrawal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
            onClick={() => setShowWithdrawal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-10 max-w-lg w-full relative shadow-2xl my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowWithdrawal(false)}
                className="absolute top-3 right-3 sm:top-6 sm:right-6 text-slate-500 hover:text-white w-8 h-8 sm:w-10 sm:h-10 rounded-full font-black text-base sm:text-xl transition-colors flex items-center justify-center bg-white/5 z-10"
              >
                ✕
              </button>
              
                <div className="text-center mb-6 sm:mb-8">
                  <h2 className="text-xl sm:text-3xl font-black text-white uppercase italic tracking-tighter mb-1 sm:mb-2">
                    Retiro de Diamantes
                  </h2>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-green-400 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                      Cambio: 1 💎 = $0.25 USD
                    </p>
                    <div className="bg-white/5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-white/10 mt-1 sm:mt-2">
                      <p className="text-white font-black text-[8px] sm:text-[10px] uppercase tracking-widest">
                        Disponibles: <span className="text-orange-500">{profile?.store_diamonds || 0} 💎</span>
                      </p>
                      <p className="text-slate-400 font-bold text-[7px] sm:text-[9px] uppercase tracking-widest">
                        Equivalente: <span className="text-green-500">${((profile?.store_diamonds || 0) * 0.25).toFixed(2)} USD</span>
                      </p>
                    </div>
                  </div>
                </div>

              <form onSubmit={handleWithdrawal} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Nombre Completo</label>
                    <input 
                      required
                      type="text" 
                      value={withdrawalForm.fullName}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, fullName: e.target.value })}
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-3 text-white font-bold text-sm focus:border-green-500/50 transition-all outline-none"
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">DUI</label>
                    <input 
                      required
                      type="text" 
                      value={withdrawalForm.dui}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, dui: e.target.value })}
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-3 text-white font-bold text-sm focus:border-green-500/50 transition-all outline-none"
                      placeholder="DUI"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Banco</label>
                    <input 
                      required
                      type="text" 
                      value={withdrawalForm.bankName}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, bankName: e.target.value })}
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-3 text-white font-bold text-sm focus:border-green-500/50 transition-all outline-none"
                      placeholder="Nombre del banco"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Número de Cuenta</label>
                    <input 
                      required
                      type="text" 
                      value={withdrawalForm.bankAccount}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, bankAccount: e.target.value })}
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-3 text-white font-bold text-sm focus:border-green-500/50 transition-all outline-none"
                      placeholder="Cuenta bancaria"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Teléfono</label>
                    <input 
                      required
                      type="text" 
                      value={withdrawalForm.phone}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-3 text-white font-bold text-sm focus:border-green-500/50 transition-all outline-none"
                      placeholder="Teléfono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Email</label>
                    <input 
                      required
                      type="email" 
                      value={withdrawalForm.email}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, email: e.target.value })}
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-3 text-white font-bold text-sm focus:border-green-500/50 transition-all outline-none"
                      placeholder="Email"
                    />
                  </div>
                </div>

                <div className="bg-black/20 p-6 rounded-3xl border border-white/5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Cantidad de Diamantes</label>
                    <input 
                      required
                      type="number" 
                      value={withdrawalForm.amount}
                      onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: (e.target.value === '' ? '' as any : parseInt(e.target.value)) })}
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-white font-black text-2xl focus:border-green-500/50 transition-all outline-none"
                      max={profile?.store_diamonds || 0}
                    />
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Monto Bruto</span>
                      <span className="text-white font-black text-sm">${(withdrawalForm.amount * 0.25).toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-red-500/70 font-black uppercase tracking-widest">Comisión (30%)</span>
                      <span className="text-red-500/70 font-black text-sm">-${(withdrawalForm.amount * 0.25 * 0.30).toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/5">
                      <span className="text-[11px] text-green-500 font-black uppercase tracking-[0.2em]">Total a Recibir</span>
                      <span className="text-green-500 font-black text-xl tracking-tighter">${(withdrawalForm.amount * 0.25 * 0.70).toFixed(2)} USD</span>
                    </div>
                    
                    {profile?.store_diamonds < 40 && (
                      <p className="text-center text-red-500 font-bold text-[10px] uppercase mt-4">
                        {profile?.store_diamonds <= 0 
                          ? "No tienes diamantes disponibles para canjear." 
                          : `El monto mínimo para canjear es de 40 diamantes (Tienes ${profile?.store_diamonds}).`}
                      </p>
                    )}
                  </div>
                </div>

                <button 
                  disabled={isSubmittingWithdrawal}
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-500 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-green-900/20 disabled:opacity-40 active:scale-95"
                >
                  {isSubmittingWithdrawal ? 'Procesando...' : 'Solicitar Retiro'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Games;


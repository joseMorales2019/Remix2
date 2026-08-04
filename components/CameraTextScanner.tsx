import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, Scan, Check, RefreshCw, Type, ExternalLink, Move, Minimize2 } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { motion, AnimatePresence } from 'motion/react';

interface CameraTextScannerProps {
  onTextFound?: (text: string) => void;
  onClose: () => void;
  onNameDetected?: (name: string, isJoining: boolean) => void;
  isHidden?: boolean;
}

export const CameraTextScanner: React.FC<CameraTextScannerProps> = ({ onTextFound, onClose, onNameDetected, isHidden }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutoScanning, setIsAutoScanning] = useState(true);
  const [scanArea, setScanArea] = useState({ x: 10, y: 30, width: 80, height: 40 }); // percentages
  const [error, setError] = useState<string | null>(null);

  const [isPipActive, setIsPipActive] = useState(false);
  const [hasMatch, setHasMatch] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Update PiP Canvas animation
  useEffect(() => {
    let animationFrameId: number;
    const canvas = pipCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        // Draw real camera feed in PiP
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#0f172a'; // Slate 900
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw dashed border
      ctx.setLineDash([10, 5]);
      ctx.strokeStyle = '#6366f1'; // Indigo 500
      ctx.lineWidth = 4;
      
      const x = (scanArea.x * canvas.width) / 100;
      const y = (scanArea.y * canvas.height) / 100;
      const w = (scanArea.width * canvas.width) / 100;
      const h = (scanArea.height * canvas.height) / 100;

      ctx.strokeRect(x, y, w, h);
      
      // Draw label
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
      ctx.fillRect(x, y - 25, 80, 25);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('ÁREA ACTIVA', x + 5, y - 8);

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationFrameId);
  }, [scanArea]);

  const togglePip = async () => {
    try {
      if (!pipVideoRef.current || !pipCanvasRef.current) return;
      
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else if (document.pictureInPictureEnabled) {
        // Create stream from canvas if not already doing so
        if (!pipVideoRef.current.srcObject) {
          const stream = pipCanvasRef.current.captureStream(30);
          pipVideoRef.current.srcObject = stream;
        }
        await pipVideoRef.current.play();
        await pipVideoRef.current.requestPictureInPicture();
        setIsPipActive(true);
      }
    } catch (err) {
      console.error('PiP Error:', err);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('No se pudo acceder a la cámara. Por favor asegúrate de dar los permisos necesarios.');
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [stopCamera]);

  // Re-bind the active stream to the video element whenever it is remounted / shown again
  useEffect(() => {
    if (!isHidden && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isHidden, stream]);

  // Reset match and scanned text states when scanner is restored to view
  useEffect(() => {
    if (!isHidden) {
      setRecognizedText('');
      setHasMatch(false);
    }
  }, [isHidden]);

  // Automatic scanning logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoScanning && !isProcessing && stream && !isHidden) {
      interval = setInterval(() => {
        recognizeText();
      }, 3000); // Scan every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isAutoScanning, isProcessing, stream, isHidden]);

  const recognizeText = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Ensure the video stream actually has valid, non-zero dimensions before capturing
      if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
        return;
      }

      // Calculate pixel coordinates
      const scaleX = video.videoWidth / 100;
      const scaleY = video.videoHeight / 100;
      
      const sourceX = scanArea.x * scaleX;
      const sourceY = scanArea.y * scaleY;
      const sourceWidth = scanArea.width * scaleX;
      const sourceHeight = scanArea.height * scaleY;

      // Increase resolution for better OCR precision (oversampling)
      const oversample = 3; 
      canvas.width = sourceWidth * oversample;
      canvas.height = sourceHeight * oversample;

      // Apply image processing for better contrast and sharpness
      ctx.imageSmoothingEnabled = false; // Preserve edges
      ctx.filter = 'contrast(1.5) grayscale(1) brightness(1.1)';
      
      ctx.drawImage(
        video,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, canvas.width, canvas.height
      );

      // Convert canvas to a real native Blob so Tesseract receives an actual Blob object, with robust fallback
      let inputData: Blob | string | null = null;
      try {
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
        });
        inputData = blob;
      } catch (blobErr) {
        console.warn('canvas.toBlob failed, trying fallback toDataURL:', blobErr);
      }

      if (!inputData) {
        try {
          inputData = canvas.toDataURL('image/jpeg', 0.95);
        } catch (dataUrlErr) {
          console.error('Failed to get data URL as fallback:', dataUrlErr);
        }
      }

      if (!inputData) {
        throw new Error('No se pudo obtener la imagen o Blob de la captura');
      }

      const worker = await createWorker('spa');
      // Set parameters for better accuracy
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHYJKLMNOPQRSTUVWXYZabcdefghyjklmnopqrstuvwxyz0123456789áéíóúÁÉÍÓÚñÑ.,:;-_/()[]{}!¡ ',
      });
      
      const { data: { text } } = await worker.recognize(inputData);
      setRecognizedText(text);
      if (onTextFound) onTextFound(text);
      
      // Auto-detect names from the recognized text
      const fullTextCleaned = text.replace(/\s+/g, ' ').trim();
      const lowerText = fullTextCleaned.toLowerCase();
      
      // Normalize accentuation so that accented characters (e.g., "unído", "uníd") match standard regex
      const normalizeAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normalizedLowerText = normalizeAccents(lowerText);
      
      // Robust detection of "se ha unido" with flexibility for OCR errors
      const joinRegex = /(se\s*ha\s*unid[aoe]|se\s*ha\s*unid|ha\s*unid[aoe]|ha\s*unid|se\s*ha\s*un|se\s*ha|se\s*ha\s*undo)/i;
      const joinMatch = normalizedLowerText.match(joinRegex);
      const isJoining = !!joinMatch;
      const joinedIndex = joinMatch?.index ?? -1;

      // Extract text before join phrase and clean it
      let textToAnalyze = isJoining 
        ? lowerText.substring(0, joinedIndex).replace(/[^a-z0-9áéíóúñ\s]/gi, ' ').replace(/\s+/g, ' ').trim() 
        : lowerText.replace(/[^a-z0-9áéíóúñ\s]/gi, ' ').replace(/\s+/g, ' ').trim();

      // Ensure textToAnalyze isn't just symbols or noise
      if (textToAnalyze.length < 2 && lowerText.length > 2) {
        const words = lowerText.split(' ');
        if (words.length > 0) textToAnalyze = words[0];
      }

      let foundName = (/9999/i.test(textToAnalyze) ? "9999" : null);

      // Fallback: Use raw text before phrase, but capitalize it nicely
      const capitalize = (s: string) => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const finalName = foundName || (isJoining && textToAnalyze.length > 2 ? capitalize(textToAnalyze) : null);

      if (finalName && onNameDetected) {
        setHasMatch(true);
        onNameDetected(finalName, isJoining);
        setTimeout(() => setHasMatch(false), 3000);
      }

      await worker.terminate();
    } catch (err) {
      console.error('OCR Error:', err);
      setError('Error al procesar el texto.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isMinimized && !isHidden && (
          <motion.button
            key="minimized-tab"
            onClick={() => setIsMinimized(false)}
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[110] bg-indigo-600 hover:bg-indigo-700 text-white pl-3 pr-4 py-4 rounded-r-[1.5rem] shadow-[5px_5px_20px_rgba(30,27,75,0.4)] flex flex-col items-center gap-3 border-y border-r border-indigo-400/30 cursor-pointer pointer-events-auto active:scale-95 transition-all"
            title="Tocar para restaurar Escáner"
          >
            <div className="p-1.5 bg-white/20 rounded-lg animate-pulse">
              <Scan size={18} />
            </div>
            <span className="text-[9px] font-black tracking-widest uppercase [writing-mode:vertical-lr] select-none text-indigo-50">
              ESCÁNER ACTIVO
            </span>
            {isProcessing && (
              <RefreshCw size={11} className="animate-spin text-indigo-300" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.9 }}
        animate={{ 
          opacity: isHidden ? 0 : (isMinimized ? 0 : 1), 
          x: isHidden ? 1000 : (isMinimized ? -2000 : 0), 
          scale: isHidden ? 0.8 : (isMinimized ? 0.8 : 1) 
        }}
        drag={!isMinimized && !isHidden}
        dragMomentum={false}
        className={`fixed bottom-6 right-6 z-[100] w-full max-w-md cursor-default transition-all duration-300 ${
          (isMinimized || isHidden) ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
      >
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-[2rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col max-h-[85vh]">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white/50 cursor-move" title="Arrastra para mover">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
          <Move size={16} />
        </div>
        <div>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-tighter">Escáner de Texto IA</h3>
          <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest leading-none">Flotante y en tiempo real</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setIsAutoScanning(!isAutoScanning)}
          className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-[8px] font-black uppercase tracking-widest ${
            isAutoScanning ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:text-indigo-600'
          }`}
          title="Escaneo automático de nombres"
        >
          <RefreshCw size={12} className={isAutoScanning ? 'animate-spin' : ''} />
          {isAutoScanning ? 'Auto: ON' : 'Auto: OFF'}
        </button>
        {isAutoScanning && (
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600 flex items-center justify-center"
            title="Minimizar al costado izquierdo"
          >
            <Minimize2 size={16} />
          </button>
        )}
        <button
          onClick={togglePip}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
          title="Ver sobre otras aplicaciones (Picture-in-Picture)"
        >
          <ExternalLink size={16} />
        </button>
        <button 
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500"
        >
          <X size={16} />
        </button>
      </div>
    </div>

    <div className="relative bg-transparent h-48 overflow-hidden flex items-center justify-center">

      {error ? (
        <div className="p-8 text-center text-slate-500">
          <p className="font-bold mb-4">{error}</p>
          <button 
            onClick={startCamera}
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold uppercase text-xs"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="max-h-full max-w-full invisible absolute"
          />
          
          {/* Overlay for selection area */}
          <div 
            className={`absolute border-2 border-dashed ${hasMatch ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'border-indigo-500'} transition-colors duration-300 pointer-events-none`}
            style={{
              left: `${scanArea.x}%`,
              top: `${scanArea.y}%`,
              width: `${scanArea.width}%`,
              height: `${scanArea.height}%`
            }}
          >
            <div className={`absolute -top-6 left-0 ${hasMatch ? 'bg-green-500' : 'bg-indigo-500'} text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-t-lg transition-colors duration-300`}>
              {hasMatch ? 'Nombre Detectado!' : 'Área activa'}
            </div>
          </div>
          
          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={pipCanvasRef} width={640} height={480} className="hidden" />
          <video ref={pipVideoRef} muted className="hidden" />
        </>
      )}
    </div>

    <div className="p-5 bg-slate-50 border-t border-slate-100">
      <div className="mb-3">
        <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
          Contenido Escaneado:
        </label>
        <textarea
          value={recognizedText}
          onChange={(e) => setRecognizedText(e.target.value)}
          className="w-full h-24 bg-white border border-slate-200 rounded-xl p-3 text-[13px] font-medium text-slate-700 focus:border-indigo-500 outline-none transition-all resize-none elegant-scrollbar shadow-inner"
          placeholder="Captura texto desde tu cámara..."
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={recognizeText}
          disabled={isProcessing || !stream}
          className={`flex-grow py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm ${
            isProcessing 
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
          }`}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="animate-spin" size={14} />
              Mapeando...
            </>
          ) : (
            <>
              <Camera size={14} />
              Escanear
            </>
          )}
        </button>
        <button
          onClick={() => {
            const blob = new Blob([recognizedText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scan-${Date.now()}.txt`;
            a.click();
          }}
          disabled={!recognizedText}
          className={`px-4 rounded-xl border border-slate-200 bg-white transition-all transition-colors flex items-center justify-center ${
            !recognizedText ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 text-indigo-600'
          }`}
        >
          <Check size={16} />
        </button>
      </div>
      
      <div className="mt-3 pt-3 border-t border-slate-200/50 flex items-center justify-between">
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Ajustes:</p>
        <div className="flex gap-1.5">
          <button 
            onClick={() => setScanArea(prev => ({ ...prev, height: Math.max(10, prev.height - 5) }))}
            className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[8px] font-bold hover:bg-slate-50"
          >
            - Altura
          </button>
          <button 
            onClick={() => setScanArea(prev => ({ ...prev, height: Math.min(80, prev.height + 5) }))}
            className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[8px] font-bold hover:bg-slate-50"
          >
            + Altura
          </button>
        </div>
      </div>
      </div>
    </div>
  </motion.div>
</>
);
};

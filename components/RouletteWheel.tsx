import React, { useRef, useEffect, useState } from 'react';

export interface RouletteSlice {
  id: string;
  type: 'gift' | 'extra_attempt' | 'no_prize';
  name: string;
  image_url?: string;
  probability: number;
}

interface RouletteWheelProps {
  slices: RouletteSlice[];
  isSpinning: boolean;
  targetIndex: number | null;
  onSpinEnd: () => void;
  onSpinClick: () => void;
  disabled?: boolean;
  buttonLabel?: string;
}

// Slice color palettes designed for high contrast, elegance, and visual separation
const SLICE_COLORS_GIFTS = [
  { bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' }, // Royal Blue
  { bg: '#7c3aed', text: '#ffffff', border: '#6d28d9' }, // Purple
  { bg: '#0891b2', text: '#ffffff', border: '#0e7490' }, // Cyan
  { bg: '#059669', text: '#ffffff', border: '#047857' }, // Emerald
  { bg: '#d97706', text: '#ffffff', border: '#b45309' }, // Amber
  { bg: '#db2777', text: '#ffffff', border: '#be185d' }, // Rose Pink
];

const SLICE_COLOR_EXTRA = { bg: '#4f46e5', text: '#ffffff', border: '#4338ca' }; // Indigo
const SLICE_COLOR_NO_PRIZE = { bg: '#475569', text: '#ffffff', border: '#334155' }; // Slate

// Format and cleanly split slice text into 1 or 2 readable lines
function formatSliceText(
  name: string,
  type: 'gift' | 'extra_attempt' | 'no_prize'
): { line1: string; line2?: string } {
  if (type === 'extra_attempt') {
    return { line1: '+1 INTENTO', line2: '¡GIRA GRATIS!' };
  }
  if (type === 'no_prize') {
    return { line1: 'GRACIAS', line2: 'Por participar' };
  }

  // Clean raw product name
  const cleanName = name.replace(/^🎁\s*/, '').trim();

  // If short enough (12 chars or fewer), fit into a single bold line
  if (cleanName.length <= 12) {
    return { line1: cleanName.toUpperCase() };
  }

  const words = cleanName.split(' ');
  if (words.length === 1) {
    return { line1: cleanName.slice(0, 13).toUpperCase() + (cleanName.length > 13 ? '…' : '') };
  }

  // Find the most balanced split point between words
  let bestLine1 = words[0];
  let bestLine2 = words.slice(1).join(' ');

  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ');
    const l2 = words.slice(i).join(' ');
    if (Math.abs(l1.length - l2.length) < Math.abs(bestLine1.length - bestLine2.length)) {
      bestLine1 = l1;
      bestLine2 = l2;
    }
  }

  // Limit line lengths
  if (bestLine1.length > 14) bestLine1 = bestLine1.slice(0, 13) + '…';
  if (bestLine2.length > 14) bestLine2 = bestLine2.slice(0, 13) + '…';

  return { line1: bestLine1.toUpperCase(), line2: bestLine2.toUpperCase() };
}

export const RouletteWheel: React.FC<RouletteWheelProps> = ({
  slices,
  isSpinning,
  targetIndex,
  onSpinEnd,
  onSpinClick,
  disabled = false,
  buttonLabel = 'GIRAR'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentRotationRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const imagesCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imagesLoaded, setImagesLoaded] = useState(0);

  // Preload slice images with CORS handling and fallback for crisp canvas rendering
  useEffect(() => {
    slices.forEach((slice) => {
      if (slice.image_url && !imagesCacheRef.current.has(slice.image_url)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = slice.image_url;

        img.onload = () => {
          imagesCacheRef.current.set(slice.image_url!, img);
          setImagesLoaded((c) => c + 1);
        };

        img.onerror = () => {
          // If anonymous CORS failed, retry without crossOrigin attribute
          const retryImg = new Image();
          retryImg.src = slice.image_url!;
          retryImg.onload = () => {
            imagesCacheRef.current.set(slice.image_url!, retryImg);
            setImagesLoaded((c) => c + 1);
          };
        };
      }
    });
  }, [slices]);

  // Audio tick helper with Web Audio API (gentle clicking feel)
  const playTickSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  // Render the circular wheel on canvas with maximized space utilization and dynamic image zoom
  const drawWheel = (rotationDegrees: number, animTime: number = performance.now()) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = width / 2 - 22; // 378px on an 800px canvas

    ctx.clearRect(0, 0, width, height);

    if (slices.length === 0) return;

    const numSlices = slices.length;
    const arcSize = (2 * Math.PI) / numSlices;
    const rotationRad = (rotationDegrees * Math.PI) / 180;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationRad);

    // Outer luxury rim shadow and base
    ctx.beginPath();
    ctx.arc(0, 0, radius + 12, 0, 2 * Math.PI);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Metallic gold / silver border stroke
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fde68a';
    ctx.stroke();

    // Dynamic base sizing based on slice count
    const badgeRadius =
      numSlices <= 6 ? 42 : numSlices <= 8 ? 38 : numSlices <= 10 ? 34 : 30;
    const badgeX = radius * 0.74; // Position in the wide outer sector (~280px)
    const textCenterX = (100 + (badgeX - badgeRadius)) / 2; // Midpoint of inner text zone (~168px)

    const fontSize =
      numSlices <= 6 ? 19 : numSlices <= 8 ? 17 : numSlices <= 10 ? 15 : 13;

    // Draw individual slices
    slices.forEach((slice, i) => {
      const startAngle = i * arcSize;
      const endAngle = startAngle + arcSize;

      let style = SLICE_COLORS_GIFTS[i % SLICE_COLORS_GIFTS.length];
      if (slice.type === 'extra_attempt') {
        style = SLICE_COLOR_EXTRA;
      } else if (slice.type === 'no_prize') {
        style = SLICE_COLOR_NO_PRIZE;
      }

      // Slice background
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = style.bg;
      ctx.fill();

      // Slice divider border with clean highlight
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff55';
      ctx.stroke();

      // Rotate to slice bisector axis
      ctx.save();
      const midAngle = startAngle + arcSize / 2;
      ctx.rotate(midAngle);

      // ==========================================
      // 1. TEXT RENDERING (Maximized legibility)
      // ==========================================
      const { line1, line2 } = formatSliceText(slice.name, slice.type);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${fontSize}px Inter, -apple-system, sans-serif`;

      // Text stroke outline for 100% contrast on any color
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';

      if (line2) {
        // Double-line layout
        ctx.strokeText(line1, textCenterX, -11);
        ctx.fillText(line1, textCenterX, -11);

        ctx.font = `700 ${Math.max(11, fontSize - 2)}px Inter, -apple-system, sans-serif`;
        ctx.strokeText(line2, textCenterX, 11);
        ctx.fillText(line2, textCenterX, 11);
      } else {
        // Single-line layout
        ctx.font = `800 ${fontSize + 1}px Inter, -apple-system, sans-serif`;
        ctx.strokeText(line1, textCenterX, 0);
        ctx.fillText(line1, textCenterX, 0);
      }
      ctx.restore();

      // ==========================================
      // 2. DYNAMIC IMAGE / BADGE RENDERING
      // (Randomized Pulsating Zoom Animation for Gifts)
      // ==========================================
      const cachedImg =
        slice.image_url ? imagesCacheRef.current.get(slice.image_url) : null;
      const hasImage = Boolean(cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0);

      if (slice.type === 'gift') {
        // Random phase offset per slice to create asynchronous pulsing zoom animation
        const pulseVal = Math.sin((animTime / 350) + i * 2.39);
        const zoomFactor = 1.0 + Math.max(0, pulseVal) * 0.35; // Pulsate up to +35% size
        const currentBadgeRadius = badgeRadius * zoomFactor;

        // Pure white high-contrast circular card disc
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.arc(badgeX, 0, currentBadgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();

        // Elegant gold rim around image badge
        ctx.beginPath();
        ctx.arc(badgeX, 0, currentBadgeRadius, 0, Math.PI * 2);
        ctx.lineWidth = pulseVal > 0.3 ? 3.5 : 2.5;
        ctx.strokeStyle = pulseVal > 0.3 ? '#fbbf24' : '#fef08a';
        ctx.stroke();

        if (hasImage && cachedImg) {
          // Render product photo clipped to circle with aspect ratio preservation
          ctx.save();
          ctx.beginPath();
          ctx.arc(badgeX, 0, currentBadgeRadius - 2, 0, Math.PI * 2);
          ctx.clip();

          const targetSize = (currentBadgeRadius - 2) * 2;
          const nw = cachedImg.naturalWidth;
          const nh = cachedImg.naturalHeight;
          const scale = Math.max(targetSize / nw, targetSize / nh);
          const dw = nw * scale;
          const dh = nh * scale;

          try {
            ctx.drawImage(
              cachedImg,
              badgeX - dw / 2,
              -dh / 2,
              dw,
              dh
            );
          } catch {
            // Safe fallback if cross-origin image triggers canvas security
            ctx.font = `${Math.round(currentBadgeRadius * 1.1)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🎁', badgeX, 2);
          }
          ctx.restore();
        } else {
          // Fallback gift box emoji when image is not loaded
          ctx.save();
          ctx.font = `${Math.round(currentBadgeRadius * 1.1)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🎁', badgeX, 2);
          ctx.restore();
        }
      } else if (slice.type === 'extra_attempt') {
        // Glowing gold/amber badge for extra spin attempt
        ctx.save();
        ctx.shadowColor = 'rgba(251, 191, 36, 0.7)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(badgeX, 0, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.font = `900 ${Math.round(badgeRadius * 0.85)}px Inter, sans-serif`;
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡+1', badgeX, 1);
        ctx.restore();
      } else {
        // Sleek silver/slate badge for "Gracias por participar"
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(badgeX, 0, badgeRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.font = `${Math.round(badgeRadius * 1.05)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍀', badgeX, 2);
        ctx.restore();
      }

      ctx.restore(); // Restore slice rotation
    });

    // Decorative bulb pegs around the outer rim
    const pegCount = Math.max(16, numSlices * 2);
    for (let p = 0; p < pegCount; p++) {
      const pegAngle = (p * 2 * Math.PI) / pegCount;
      const px = (radius + 5) * Math.cos(pegAngle);
      const py = (radius + 5) * Math.sin(pegAngle);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, 2 * Math.PI);
      ctx.fillStyle = p % 2 === 0 ? '#fde047' : '#ffffff';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.fill();
    }

    ctx.restore(); // Restore wheel rotation
  };

  // Continuous animation frame loop for dynamic pulsing gift zoom when idle
  useEffect(() => {
    if (isSpinning) return;

    let animId: number;
    const loop = (time: number) => {
      drawWheel(currentRotationRef.current, time);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isSpinning, slices, imagesLoaded]);

  // Execute smooth rotation animation when isSpinning and targetIndex are ready
  useEffect(() => {
    if (!isSpinning || targetIndex === null || slices.length === 0) return;

    const numSlices = slices.length;
    const arcDegrees = 360 / numSlices;

    // Pointer is located at top (12 o'clock, 270 degrees in canvas coordinates)
    const targetSliceMid = targetIndex * arcDegrees + arcDegrees / 2;
    const desiredModulo = (270 - targetSliceMid + 720) % 360;

    const startRotation = currentRotationRef.current;
    const currentModulo = ((startRotation % 360) + 360) % 360;

    // 7 full revolutions for suspense and excitement
    const fullRevolutions = 360 * 7;
    let distance = (desiredModulo - currentModulo + 360) % 360;
    if (distance < 180) distance += 360;

    const totalDistance = fullRevolutions + distance;
    const finalRotation = startRotation + totalDistance;

    const duration = 5200; // 5.2 seconds
    const startTime = performance.now();
    let lastSliceIdx = -1;

    // Quintic ease-out deceleration curve for natural slowing down
    const easeOutQuint = (t: number): number => {
      return 1 - Math.pow(1 - t, 5);
    };

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = easeOutQuint(progress);

      const currentAngle = startRotation + totalDistance * easedProgress;
      currentRotationRef.current = currentAngle;
      drawWheel(currentAngle, currentTime);

      // Sound tick check
      const normalizedAngle = (currentAngle % 360 + 360) % 360;
      const currentPassedSlice = Math.floor(normalizedAngle / arcDegrees);
      if (currentPassedSlice !== lastSliceIdx) {
        lastSliceIdx = currentPassedSlice;
        if (progress < 0.95) {
          playTickSound();
        }
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        currentRotationRef.current = finalRotation;
        drawWheel(finalRotation, currentTime);
        onSpinEnd();
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isSpinning, targetIndex, slices.length]);

  return (
    <div className="relative flex flex-col items-center justify-center select-none w-full max-w-[540px] mx-auto p-2">
      {/* Container with shadow glow */}
      <div className="relative w-full aspect-square max-w-[480px] sm:max-w-[520px] flex items-center justify-center">
        {/* Top Fixed Needle Pointer */}
        <div className="absolute -top-3 sm:-top-4 z-30 flex flex-col items-center filter drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)] pointer-events-none">
          <div className="w-9 h-12 sm:w-10 sm:h-14 relative">
            <svg viewBox="0 0 32 44" className="w-full h-full">
              <path
                d="M 16 42 L 3 12 C 1 5, 31 5, 29 12 Z"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="14" r="5" fill="#ffffff" />
            </svg>
          </div>
        </div>

        {/* Canvas Wheel */}
        <canvas
          ref={canvasRef}
          width={800}
          height={800}
          className="w-full h-full object-contain filter drop-shadow-2xl transition-transform"
        />

        {/* Center Spin Button */}
        <button
          type="button"
          disabled={disabled || isSpinning}
          onClick={onSpinClick}
          className={`absolute z-20 w-24 h-24 sm:w-28 sm:h-28 rounded-full font-black uppercase text-xs sm:text-sm tracking-widest flex flex-col items-center justify-center shadow-2xl transition-all border-4 ${
            disabled || isSpinning
              ? 'bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed opacity-90'
              : 'bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-slate-900 border-white hover:scale-105 active:scale-95 shadow-amber-500/50 cursor-pointer animate-pulse'
          }`}
        >
          <span className="text-xl sm:text-2xl mb-0.5">{isSpinning ? '🎡' : '🎲'}</span>
          <span className="leading-none text-[11px] sm:text-xs font-black">{buttonLabel}</span>
        </button>
      </div>
    </div>
  );
};

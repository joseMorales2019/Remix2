import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';

interface VideoChatProps {
  roomId: string;
  userId: string;
  isBackground?: boolean;
}

export const VideoChat: React.FC<VideoChatProps> = ({ roomId, userId, isBackground }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [peers, setPeers] = useState<{ [key: string]: MediaStream }>({});
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const localStream = useRef<MediaStream | null>(null);
  const channel = useRef<any>(null);

  const [error, setError] = useState<string | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [remoteVolume, setRemoteVolume] = useState(1);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [focusedStreamIndex, setFocusedStreamIndex] = useState(0);

  const allStreams = [
    { id: userId, stream: localStream.current, isLocal: true },
    ...Object.entries(peers).map(([id, stream]) => ({ id, stream, isLocal: false }))
  ].filter(s => s.stream);

  const currentStream = allStreams[focusedStreamIndex % allStreams.length];

  const toggleVideo = () => {
    if (localStream.current) {
      const track = localStream.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoEnabled(track.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream.current) {
      const track = localStream.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsAudioEnabled(track.enabled);
      }
    }
  };

  useEffect(() => {
    const initWebRTC = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Tu navegador no soporta el acceso a la cámara o micrófono.");
        return;
      }

      try {
        // Try with ideal constraints first
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
          }, 
          audio: true 
        }).catch(async (err) => {
          console.warn("Falló acceso con parámetros ideales, intentando básicos...", err);
          // Fallback to basic constraints
          return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        });

        localStream.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        channel.current = supabase.channel(`webrtc-${roomId}`);

        channel.current.on('broadcast', { event: 'webrtc' }, async (payload: any) => {
          const { type, senderId, data } = payload.payload;
          if (senderId === userId) return;

          if (type === 'join') {
            if (userId > senderId) {
              if (!peerConnections.current[senderId]) {
                const pc = createPeerConnection(senderId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                channel.current.send({
                  type: 'broadcast',
                  event: 'webrtc',
                  payload: { type: 'offer', senderId: userId, targetId: senderId, data: offer }
                });
              }
            } else {
              channel.current.send({
                type: 'broadcast',
                event: 'webrtc',
                payload: { type: 'presence', senderId: userId, targetId: senderId }
              });
            }
          } else if (type === 'presence' && payload.payload.targetId === userId) {
            if (userId > senderId) {
              if (!peerConnections.current[senderId]) {
                const pc = createPeerConnection(senderId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                channel.current.send({
                  type: 'broadcast',
                  event: 'webrtc',
                  payload: { type: 'offer', senderId: userId, targetId: senderId, data: offer }
                });
              }
            }
          } else if (type === 'offer' && payload.payload.targetId === userId) {
            let pc = peerConnections.current[senderId];
            if (!pc) {
              pc = createPeerConnection(senderId);
            }
            if (pc.signalingState === 'stable' || pc.signalingState === 'have-remote-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(data));
              const answer = await pc.createAnswer();
              if (['have-remote-offer', 'have-local-pranswer'].includes(pc.signalingState)) {
                await pc.setLocalDescription(answer);
                channel.current.send({
                  type: 'broadcast',
                  event: 'webrtc',
                  payload: { type: 'answer', senderId: userId, targetId: senderId, data: answer }
                });
              } else {
                console.warn('Skipping setLocalDescription due to signaling state:', pc.signalingState);
              }
            } else {
              console.warn('Skipping setRemoteDescription (offer) due to signaling state:', pc.signalingState);
            }
          } else if (type === 'answer' && payload.payload.targetId === userId) {
            const pc = peerConnections.current[senderId];
            if (pc) {
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
              } else {
                console.warn('Skipping setRemoteDescription (answer) due to signaling state:', pc.signalingState);
              }
            }
          } else if (type === 'ice-candidate' && payload.payload.targetId === userId) {
            const pc = peerConnections.current[senderId];
            if (pc) {
              await pc.addIceCandidate(new RTCIceCandidate(data));
            }
          } else if (type === 'leave') {
             if (peerConnections.current[senderId]) {
               peerConnections.current[senderId].close();
               delete peerConnections.current[senderId];
             }
             setPeers(prev => {
               const newPeers = { ...prev };
               delete newPeers[senderId];
               return newPeers;
             });
          }
        });

        channel.current.subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            // Announce presence
            channel.current.send({
              type: 'broadcast',
              event: 'webrtc',
              payload: { type: 'join', senderId: userId }
            });
          }
        });

      } catch (err) {
        console.error("Error accessing media devices.", err);
        setError("No se pudo acceder a la cámara o micrófono.");
      }
    };

    initWebRTC();

    return () => {
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnections.current).forEach(pc => pc.close());
      if (channel.current) {
        channel.current.send({
          type: 'broadcast',
          event: 'webrtc',
          payload: { type: 'leave', senderId: userId }
        });
        supabase.removeChannel(channel.current);
      }
    };
  }, [roomId, userId]);

  const createPeerConnection = (targetId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun.services.mozilla.com' }
      ]
    });

    peerConnections.current[targetId] = pc;

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.current.send({
          type: 'broadcast',
          event: 'webrtc',
          payload: { type: 'ice-candidate', senderId: userId, targetId, data: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      setPeers(prev => ({
        ...prev,
        [targetId]: event.streams[0]
      }));
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        setPeers(prev => {
          const newPeers = { ...prev };
          delete newPeers[targetId];
          return newPeers;
        });
      }
    };

    return pc;
  };

  if (error) {
    return (
      <div className="text-red-500 text-xs font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/20">
        {error}
      </div>
    );
  }

  if (isBackground) {
    return (
      <>
        <div className="absolute inset-0 z-0 overflow-hidden rounded-[2rem] sm:rounded-[3rem] pointer-events-none">
          {currentStream && (
            <div className="w-full h-full relative">
              {currentStream.isLocal ? (
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              ) : (
                <VideoPeer stream={currentStream.stream} peerId={currentStream.id} volume={remoteVolume} isEnlarged={true} isBackground={true} />
              )}
              <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-full text-[8px] text-white font-black uppercase tracking-widest">
                Cámara: {currentStream.isLocal ? 'Tú' : 'Oponente'}
              </div>
            </div>
          )}
        </div>
        <div className="absolute bottom-4 right-4 flex gap-2 pointer-events-auto z-50">
          <button 
            onClick={() => setFocusedStreamIndex(prev => prev + 1)}
            className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
          >
            🔄 Intercambiar
          </button>
          <button 
            onClick={toggleVideo} 
            className={`px-3 py-2 rounded-xl text-[9px] font-black transition-colors ${isVideoEnabled ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
          >
            {isVideoEnabled ? '📷 On' : '📷 Off'}
          </button>
          <button 
            onClick={toggleAudio} 
            className={`px-3 py-2 rounded-xl text-[9px] font-black transition-colors ${isAudioEnabled ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
          >
            {isAudioEnabled ? '🎤 On' : '🎤 Off'}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 mt-4 w-full">
      <div className="flex flex-wrap gap-4 justify-center transition-all duration-300">
        <div className={`relative rounded-2xl overflow-hidden border-2 border-orange-500/50 bg-black transition-all duration-300 ${isEnlarged ? 'w-40 h-40 sm:w-56 sm:h-56' : 'w-24 h-24 sm:w-32 sm:h-32'}`}>
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <div className="absolute bottom-1 left-1 bg-black/50 px-1.5 py-0.5 rounded text-[8px] text-white font-bold">Tú</div>
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-[10px] font-bold text-center p-2">
              Cámara Apagada
            </div>
          )}
          {!isAudioEnabled && (
            <div className="absolute top-1 right-1 bg-red-500/80 px-1.5 py-0.5 rounded text-[10px] text-white font-bold">
              🔇
            </div>
          )}
        </div>
        {Object.entries(peers).map(([peerId, stream]) => (
          <VideoPeer key={peerId} stream={stream} peerId={peerId} volume={remoteVolume} isEnlarged={isEnlarged} />
        ))}
      </div>
      
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 bg-white/5 p-2 sm:p-3 rounded-2xl border border-white/10">
        <button 
          onClick={toggleVideo} 
          className={`px-3 py-2 rounded-xl text-xs font-black transition-colors ${isVideoEnabled ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
        >
          {isVideoEnabled ? '📷 On' : '📷 Off'}
        </button>
        <button 
          onClick={toggleAudio} 
          className={`px-3 py-2 rounded-xl text-xs font-black transition-colors ${isAudioEnabled ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
        >
          {isAudioEnabled ? '🎤 On' : '🎤 Off'}
        </button>
        <button 
          onClick={() => setIsEnlarged(!isEnlarged)} 
          className="px-3 py-2 rounded-xl text-xs font-black transition-colors bg-white/10 text-white hover:bg-white/20"
        >
          {isEnlarged ? '🔍 Reducir' : '🔍 Ampliar'}
        </button>
        <div className="flex items-center gap-2 px-3 py-2 bg-black/20 rounded-xl">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Volumen</span>
          <input 
            type="range" 
            min="0" max="1" step="0.1" 
            value={remoteVolume} 
            onChange={(e) => setRemoteVolume(parseFloat(e.target.value))}
            className="w-16 sm:w-24 accent-orange-500"
          />
        </div>
      </div>
    </div>
  );
};

const VideoPeer = ({ stream, peerId, volume, isEnlarged, isBackground }: { stream: MediaStream, peerId: string, volume: number, isEnlarged: boolean, isBackground?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  return (
    <div className={isBackground ? "w-full h-full" : `relative rounded-2xl overflow-hidden border-2 border-white/20 bg-black transition-all duration-300 ${isEnlarged ? 'w-40 h-40 sm:w-56 sm:h-56' : 'w-24 h-24 sm:w-32 sm:h-32'}`}>
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      {!isBackground && <div className="absolute bottom-1 left-1 bg-black/50 px-1.5 py-0.5 rounded text-[8px] text-white font-bold">Oponente</div>}
    </div>
  );
};

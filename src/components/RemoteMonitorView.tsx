import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Video, 
  VideoOff, 
  Volume2, 
  VolumeX, 
  Flashlight, 
  Maximize2, 
  RefreshCw, 
  Sliders, 
  ArrowLeft, 
  Download, 
  Radio, 
  HelpCircle,
  Headphones,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Sparkles,
  Power,
  PhoneCall,
  Smartphone
} from 'lucide-react';
import { StreamMode, VoiceFilterType } from '../types/camera';
import { RTC_CONFIG, getSignalingServerUrl } from '../utils/webrtc';
import { BatteryIndicator } from './BatteryIndicator';

interface RemoteMonitorViewProps {
  roomCode: string;
  onBack: () => void;
  onOpenGuide: () => void;
}

export const RemoteMonitorView: React.FC<RemoteMonitorViewProps> = ({
  roomCode,
  onBack,
  onOpenGuide,
}) => {
  const [streamMode, setStreamMode] = useState<StreamMode>('video');
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [remoteTorchActive, setRemoteTorchActive] = useState(false);
  const [remoteVoiceFilter, setRemoteVoiceFilter] = useState<VoiceFilterType>('normal');
  const [isHomeStreaming, setIsHomeStreaming] = useState(true);
  const [audioMeter, setAudioMeter] = useState(0);
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [isHomeInPhoneCall, setIsHomeInPhoneCall] = useState(false);
  const [homeCallReason, setHomeCallReason] = useState('');
  const [homeBatteryLevel, setHomeBatteryLevel] = useState<number | null>(null);
  const [homeIsCharging, setHomeIsCharging] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Send Remote Commands to home device
  const sendControl = (action: string, value?: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'control',
        code: roomCode,
        action,
        value,
      }));
    }
  };

  // Safe Exit: Notify Home Device so it immediately turns off Camera and Mic!
  const handleSafeDisconnect = () => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'disconnect-remote',
          code: roomCode,
        }));
        wsRef.current.send(JSON.stringify({
          type: 'control',
          code: roomCode,
          action: 'stop-stream',
        }));
        wsRef.current.close();
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    } catch (e) {
      console.error(e);
    }
    onBack();
  };

  // On window unload / close, automatically notify home device
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'disconnect-remote',
          code: roomCode,
        }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomCode]);

  useEffect(() => {
    const wsUrl = getSignalingServerUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'join-remote',
        code: roomCode,
      }));
      // Initial ping for latency check
      ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Pong handler to calculate round-trip latency
        if (msg.type === 'pong' && msg.timestamp) {
          setPingMs(Date.now() - msg.timestamp);
        }

        if (msg.type === 'joined') {
          if (msg.homeOnline || msg.homeConnected) {
            setConnectionStatus('connecting');
            // Request home device to start media
            sendControl('start-stream');
          } else {
            setConnectionStatus('disconnected');
          }
        }

        if (msg.type === 'home-online' || msg.type === 'home-joined') {
          setConnectionStatus('connecting');
          sendControl('start-stream');
        }

        if (msg.type === 'home-offline' || msg.type === 'home-left') {
          setConnectionStatus('disconnected');
          setIsHomeStreaming(false);
        }

        if (msg.type === 'signal' && msg.from === 'home') {
          handleHomeSignal(msg.payload);
        }

        if (msg.type === 'status-update') {
          if (msg.payload.isTorchOn !== undefined) {
            setRemoteTorchActive(msg.payload.isTorchOn);
          }
          if (msg.payload.voiceFilter) {
            setRemoteVoiceFilter(msg.payload.voiceFilter);
          }
          if (msg.payload.isStreaming !== undefined) {
            setIsHomeStreaming(msg.payload.isStreaming);
          }
          if (msg.payload.isPhoneCallActive !== undefined) {
            setIsHomeInPhoneCall(msg.payload.isPhoneCallActive);
            setHomeCallReason(msg.payload.callReason || '');
          }
          if (msg.payload.batteryLevel !== undefined) {
            setHomeBatteryLevel(msg.payload.batteryLevel);
          }
          if (msg.payload.isCharging !== undefined) {
            setHomeIsCharging(!!msg.payload.isCharging);
          }
        }
      } catch (err) {
        console.error('Error handling WS message on remote:', err);
      }
    };

    // Keepalive ping every 15s to keep mobile carriers from cutting idle TCP connection
    const pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 15000);

    return () => {
      clearInterval(pingTimer);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (analyserCtxRef.current && analyserCtxRef.current.state !== 'closed') {
        analyserCtxRef.current.close().catch(() => {});
        analyserCtxRef.current = null;
      }
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'disconnect-remote',
            code: roomCode,
          }));
          ws.close();
        }
      } catch (e) {}
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [roomCode]);

  const handleHomeSignal = async (payload: any) => {
    if (payload.type === 'offer') {
      try {
        if (pcRef.current) {
          pcRef.current.close();
        }
        pendingCandidatesRef.current = [];

        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        pc.oniceconnectionstatechange = () => {
          console.log('Remote ICE State:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setConnectionStatus('connected');
            setIsHomeStreaming(true);
          } else if (pc.iceConnectionState === 'failed') {
            console.warn('Remote ICE failed, requesting stream restart from home...');
            sendControl('start-stream');
          }
        };

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            const stream = event.streams[0];
            mediaStreamRef.current = stream;

            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch((e) => console.warn('Video auto-play handled:', e));
            }
            if (audioRef.current) {
              audioRef.current.srcObject = stream;
              audioRef.current.play().catch((e) => console.warn('Audio auto-play handled:', e));
            }

            setConnectionStatus('connected');
            setIsHomeStreaming(true);
            setupAudioAnalyser(stream);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'signal',
              code: roomCode,
              payload: {
                type: 'candidate',
                candidate: event.candidate,
              },
            }));
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        
        // Flush any queued candidates that arrived before setRemoteDescription
        while (pendingCandidatesRef.current.length > 0) {
          const cand = pendingCandidatesRef.current.shift();
          if (cand) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('Error adding queued candidate on remote:', e);
            }
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'signal',
            code: roomCode,
            payload: {
              type: 'answer',
              sdp: pc.localDescription,
            },
          }));
        }
      } catch (err) {
        console.error('Error handling WebRTC offer on remote:', err);
      }
    } else if (payload.type === 'candidate' && payload.candidate) {
      if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {
          console.warn('Remote ICE error:', e);
        }
      } else {
        pendingCandidatesRef.current.push(payload.candidate);
      }
    }
  };

  // Audio Visualizer Meter
  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (!stream || stream.getAudioTracks().length === 0) return;
      if (analyserCtxRef.current && analyserCtxRef.current.state !== 'closed') {
        analyserCtxRef.current.close().catch(() => {});
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      analyserCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (!analyserCtxRef.current || analyserCtxRef.current.state === 'closed') return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setAudioMeter(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      // ignore
    }
  };

  // Remote Controls
  const handleToggleRemoteTorch = () => {
    sendControl('toggle-torch');
    setRemoteTorchActive(!remoteTorchActive);
  };

  const handleSwitchRemoteCamera = () => {
    sendControl('switch-camera');
  };

  const handleSetVoiceFilter = (filter: VoiceFilterType) => {
    setRemoteVoiceFilter(filter);
    sendControl('set-voice-filter', filter);
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `home-cam-snapshot-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSnapshotSuccess(true);
      setTimeout(() => setSnapshotSuccess(false), 2000);
    }
  };

  const handleFullscreen = () => {
    const el = document.getElementById('remote-monitor-viewport');
    if (el) {
      if (!document.fullscreenElement) {
        el.requestFullscreen().catch(err => console.warn(err));
      } else {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-white overflow-hidden">
      {/* Hidden audio element for audio playback */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="hidden"
      />

      {/* Top Header */}
      <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            id="btn-remote-back"
            type="button"
            onClick={handleSafeDisconnect}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30 transition cursor-pointer flex items-center gap-1.5 font-semibold"
            title="डिस्कनेक्ट करें और बाहर निकलें"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>बाहर निकलें (बंद करें)</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}></span>
              <h2 className="text-xs sm:text-sm font-bold text-slate-100">
                बाहर वाला मोबाइल (Remote Monitor)
              </h2>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
              घर का कोड: <span className="text-emerald-400 font-bold">{roomCode}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Home Phone Battery Status */}
          <BatteryIndicator 
            level={homeBatteryLevel} 
            isCharging={homeIsCharging} 
            size="sm"
            label="घर का फ़ोन"
            className="hidden sm:inline-flex"
          />

          {/* Audio Only Mode Toggle */}
          <button
            id="btn-stream-mode-toggle"
            type="button"
            onClick={() => setStreamMode(streamMode === 'video' ? 'audio-only' : 'video')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
              streamMode === 'audio-only'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="कम इंटरनेट में केवल आवाज़ सुनें"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {streamMode === 'audio-only' ? 'केवल आवाज़' : 'वीडियो मोड'}
            </span>
          </button>

          <button
            id="btn-guide-modal-remote"
            type="button"
            onClick={onOpenGuide}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition cursor-pointer"
            title="गाइड"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left / Center Viewport */}
        <div 
          id="remote-monitor-viewport"
          className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-[300px]"
        >
          {/* Video Feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            className={`w-full h-full object-contain ${
              streamMode === 'audio-only' ? 'hidden' : 'block'
            }`}
          />

          {/* Audio-Only Mode View */}
          {streamMode === 'audio-only' && (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-20 h-20 rounded-full bg-blue-950 border-2 border-blue-500 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/10">
                <Headphones className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100">
                  केवल आवाज़ मोड सक्रिय (Audio Only)
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  वीडियो बंद कर दिया गया है ताकि कम इंटरनेट पर भी घर की आवाज़ साफ़ सुनाई दे
                </p>
              </div>

              {/* Sound Wave Animation */}
              <div className="flex items-center gap-1.5 h-10 py-1">
                {[12, 28, 44, 20, 36, 16, 48, 24, 40, 18, 32].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-emerald-400 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(8, (audioMeter / 100) * h)}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Connection Overlay when not connected */}
          {connectionStatus !== 'connected' && !isHomeInPhoneCall && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="w-12 h-12 rounded-full border-3 border-blue-500 border-t-transparent animate-spin mb-4"></div>
              <h3 className="text-base font-bold text-slate-200">
                घर वाले मोबाइल से कनेक्ट हो रहा है...
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                घर वाले फ़ोन में कोड <b className="text-emerald-400 font-mono">{roomCode}</b> चालू रखें। जुड़ते ही कैमरा व माइक स्वतः ऑन हो जाएँगे।
              </p>
            </div>
          )}

          {/* Call / WhatsApp Protection Active Overlay */}
          {isHomeInPhoneCall && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <PhoneCall className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-amber-200">
                घर वाले मोबाइल पर कॉल / व्हाट्सएप चालू है
              </h3>
              <p className="text-xs text-slate-300 max-w-sm mt-1.5 leading-relaxed">
                फोन पर बात करने या व्हाट्सएप/इमो के दौरान माइक व कैमरा पूरी तरह सुरक्षित व फ्री रखा गया है। जैसे ही वहां बातचीत समाप्त होगी, लाइव वीडियो स्वतः पुनः शुरू हो जाएगा।
              </p>
            </div>
          )}

          {/* Overlaid Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 z-10">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase flex items-center gap-1 ${
              connectionStatus === 'connected' ? 'bg-emerald-600' : 'bg-amber-600'
            }`}>
              {connectionStatus === 'connected' ? 'लाइव कनेक्टेड' : 'कनेक्टिंग...'}
            </span>

            {isHomeInPhoneCall && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-500 text-[10px] text-amber-300 font-bold flex items-center gap-1">
                <PhoneCall className="w-3 h-3 animate-pulse" />
                कॉल / व्हाट्सएप जारी
              </span>
            )}

            {/* Global Network P2P / TURN Relay Badge */}
            <span className="px-2 py-0.5 rounded-full bg-slate-900/90 border border-slate-700 text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span>🌐 ग्लोबल रिले</span>
              {pingMs !== null && (
                <span className="text-slate-300">• {pingMs} ms</span>
              )}
            </span>

            {/* Home Device Battery Indicator Badge */}
            <BatteryIndicator 
              level={homeBatteryLevel} 
              isCharging={homeIsCharging} 
              size="sm"
            />

            {remoteTorchActive && (
              <span className="px-2 py-0.5 rounded bg-amber-500 text-[10px] text-slate-950 font-bold flex items-center gap-1">
                <Flashlight className="w-3 h-3" />
                टॉर्च ON
              </span>
            )}
            {remoteVoiceFilter !== 'normal' && (
              <span className="px-2 py-0.5 rounded bg-indigo-600 text-[10px] text-white font-medium">
                फ़िल्टर: {remoteVoiceFilter}
              </span>
            )}
          </div>

          {/* Floating Action Bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 bg-slate-900/85 backdrop-blur-md px-3 sm:px-4 py-2 rounded-full border border-slate-700 shadow-xl z-10">
            {/* Flashlight Button */}
            <button
              id="btn-remote-torch"
              type="button"
              onClick={handleToggleRemoteTorch}
              className={`p-2.5 rounded-full transition cursor-pointer ${
                remoteTorchActive
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="घर के फ़ोन की फ्लैशलाइट ऑन/ऑफ करें"
            >
              <Flashlight className="w-4 h-4" />
            </button>

            {/* Switch Camera */}
            <button
              id="btn-remote-switch-cam"
              type="button"
              onClick={handleSwitchRemoteCamera}
              className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="कैमरा बदलें (Front / Back)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Voice Mute/Unmute */}
            <button
              id="btn-remote-mute"
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2.5 rounded-full transition cursor-pointer ${
                isMuted
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title={isMuted ? 'अनम्यूट करें' : 'म्यूट करें'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Snapshot */}
            <button
              id="btn-remote-snapshot"
              type="button"
              onClick={handleTakeSnapshot}
              className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="फोटो लें (Snapshot)"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Fullscreen */}
            <button
              id="btn-remote-fullscreen"
              type="button"
              onClick={handleFullscreen}
              className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="फुल स्क्रीन"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Controls Panel: कैमरा, फ्लैशलाइट, वॉइस व वॉइस फ़िल्टर */}
        <div className="w-full md:w-88 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
          
          {/* Section 0: Home Device Battery & Health Monitor */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                घर के फ़ोन की बैटरी
              </span>
              <BatteryIndicator 
                level={homeBatteryLevel} 
                isCharging={homeIsCharging} 
                size="sm" 
              />
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              {homeBatteryLevel !== null ? (
                <>
                  बैटरी: <b className="text-white">{homeBatteryLevel}%</b>{' '}
                  {homeIsCharging ? (
                    <span className="text-emerald-400 font-medium">(चार्जर लगा है ⚡)</span>
                  ) : (
                    <span>(बैटरी बैकअप पर)</span>
                  )}
                  {homeBatteryLevel <= 20 && !homeIsCharging && (
                    <div className="mt-1.5 p-2 rounded-lg bg-red-950/40 border border-red-800/60 text-red-400 text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>चेतावनी: बैटरी 20% से कम है! कृपया घर के फ़ोन को चार्जिंग पर लगाएँ।</span>
                    </div>
                  )}
                </>
              ) : (
                <span>घर वाले मोबाइल से बैटरी स्तर लोड हो रहा है...</span>
              )}
            </div>
          </div>

          {/* Section 1: Flashlight Button */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Flashlight className="w-4 h-4 text-amber-400" />
                फ्लैशलाइट (टॉर्च बटन)
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                remoteTorchActive ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-slate-300'
              }`}>
                {remoteTorchActive ? 'चालू (ON)' : 'बंद (OFF)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              घर वाले मोबाइल की फ्लैशलाइट यहाँ से ऑन या ऑफ करें:
            </p>
            <button
              id="btn-toggle-torch-panel"
              type="button"
              onClick={handleToggleRemoteTorch}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm ${
                remoteTorchActive
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}
            >
              <Flashlight className="w-4 h-4" />
              <span>{remoteTorchActive ? 'टॉर्च बंद करें' : 'टॉर्च चालू करें'}</span>
            </button>
          </div>

          {/* Section 2: Camera Controls */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-400" />
                कैमरा विकल्प
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              कैमरा आगे या पीछे का स्विच करें या स्क्रीनशॉट लें:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-panel-switch-cam"
                type="button"
                onClick={handleSwitchRemoteCamera}
                className="py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>कैमरा बदलें</span>
              </button>
              <button
                id="btn-panel-snapshot"
                type="button"
                onClick={handleTakeSnapshot}
                className="py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>फोटो खींचें</span>
              </button>
            </div>
            {snapshotSuccess && (
              <p className="text-[11px] text-emerald-400 font-semibold mt-2 text-center">
                स्क्रीनशॉट डाउनलोड हो गया!
              </p>
            )}
          </div>

          {/* Section 3: Voice Controls (शुद्ध माइक आवाज़) */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                वॉइस (आवाज़ बटन व वॉल्यूम)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              घर के फ़ोन से केवल साफ़ माइक आवाज़ आ रही है (बिना किसी गाड़ी, डीजे या शोर के):
            </p>

            <div className="flex items-center gap-3 mb-3">
              <button
                id="btn-panel-mute-toggle"
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isMuted ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                }`}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{isMuted ? 'म्यूट है (अनम्यूट करें)' : 'आवाज़ चालू है'}</span>
              </button>

              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v;
                    if (videoRef.current) videoRef.current.volume = v;
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-[11px] font-mono text-slate-300 w-8 text-right">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>

            {/* Live Audio Meter */}
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>माइक सिग्नल लेवल:</span>
              <div className="w-28 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${audioMeter}%` }}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Voice Filter Button */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-400" />
                वॉइस फ़िल्टर का बटन (Voice Filter)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              घर से आने वाली आवाज़ का टोन / पिच फ़िल्टर बदलें:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'normal', label: 'सामान्य आवाज़', desc: 'Original Clear Voice' },
                { id: 'deep', label: 'भारी बेस', desc: 'Deep Voice' },
                { id: 'high', label: 'पतली आवाज़', desc: 'High Pitch' },
                { id: 'robot', label: 'रोबोट', desc: 'Robotic Effect' },
                { id: 'radio', label: 'वॉकी-टॉकी', desc: 'Walkie-Talkie' },
                { id: 'echo', label: 'इको (Echo)', desc: 'Reverb Voice' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  id={`btn-filter-${filter.id}`}
                  type="button"
                  onClick={() => handleSetVoiceFilter(filter.id as VoiceFilterType)}
                  className={`p-2 rounded-lg text-left transition cursor-pointer border ${
                    remoteVoiceFilter === filter.id
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <div className="text-xs flex items-center justify-between">
                    <span>{filter.label}</span>
                    {remoteVoiceFilter === filter.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-normal">{filter.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Safe Exit Info */}
          <div className="p-3 rounded-xl bg-red-950/20 border border-red-900/40 text-[11px] text-red-300 flex items-center gap-2">
            <Power className="w-4 h-4 shrink-0 text-red-400" />
            <span>
              जैसे ही आप 'बाहर निकलें' दबाएँगे या ऐप बंद करेंगे, घर का कैमरा व माइक तुरंत स्वतः बंद हो जाएगा।
            </span>
          </div>

        </div>
      </div>
    </div>
  );
};

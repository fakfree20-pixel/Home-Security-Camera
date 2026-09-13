import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  VideoOff, 
  Mic, 
  MicOff, 
  Flashlight, 
  FlashlightOff, 
  RefreshCw, 
  Moon, 
  Copy, 
  Check, 
  ShieldCheck, 
  Users, 
  AlertCircle,
  HelpCircle,
  Lock,
  Power,
  Sliders,
  CheckCircle2,
  PhoneCall,
  PhoneOff,
  Smartphone
} from 'lucide-react';
import { VoiceFilterType } from '../types/camera';
import { VoiceFilterProcessor } from '../utils/audioFilter';
import { RTC_CONFIG, toggleTorch, optimizeVideoSender, getSignalingServerUrl } from '../utils/webrtc';
import { BatteryIndicator } from './BatteryIndicator';
import { useBatteryStatus } from '../hooks/useBatteryStatus';

interface HomeCameraViewProps {
  roomCode: string;
  onBack: () => void;
  onOpenGuide: () => void;
}

export const HomeCameraView: React.FC<HomeCameraViewProps> = ({
  roomCode,
  onBack,
  onOpenGuide,
}) => {
  // Streaming state (DEFAULT: FALSE / STANDBY - Camera & Mic are completely OFF until remote requests)
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectedRemotes, setConnectedRemotes] = useState(0);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [permissionStatus, setPermissionStatus] = useState<'requesting' | 'granted' | 'denied' | 'idle'>('idle');

  // Camera & Device Controls
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [voiceFilter, setVoiceFilter] = useState<VoiceFilterType>('normal');

  // WhatsApp / IMO & Phone Call Priority Coexistence Mode
  const [isCallSafeActive, setIsCallSafeActive] = useState(true);
  const [isPhoneCallActive, setIsPhoneCallActive] = useState(false);
  const [callReason, setCallReason] = useState('');

  // Screen Saver / Stealth Return Mode
  const [isScreenSaver, setIsScreenSaver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [statusMessage, setStatusMessage] = useState('रिटर्न स्टैंडबाय मोड: बाहर वाले के जुड़ने पर कैमरा-माइक स्वतः चालू होगा');

  // Battery Level & Charging Status Hook (Web Battery API)
  const { batteryLevel, isCharging } = useBatteryStatus();

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const filterProcessorRef = useRef<VoiceFilterProcessor>(new VoiceFilterProcessor());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const startMediaRef = useRef<(() => Promise<void>) | null>(null);

  // Update clock for screensaver
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Stop Media & Release Hardware (Camera, Mic, Torch) completely
  const stopMedia = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop(); // Turn off camera light & microphone completely
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsTorchOn(false);
    setIsStreaming(false);
    setAudioLevel(0);

    // Clean WebRTC connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    filterProcessorRef.current.cleanup();

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setStatusMessage('बाहर वाला डिस्कनेक्ट हुआ: कैमरा व माइक पूरी तरह बंद हैं (रिटर्न स्टैंडबाय मोड)');
  }, []);

  // Gracefully yield Camera & Microphone for WhatsApp / IMO / Phone Calls
  const yieldMediaForCall = useCallback((reason: string) => {
    console.log('Yielding camera and mic for phone/WhatsApp/IMO call:', reason);
    setIsPhoneCallActive(true);
    setCallReason(reason);
    stopMedia();
    setStatusMessage(`📞 व्हाट्सएप/इमो कॉल प्राथमिकता: कैमरा व माइक फ्री किया गया (${reason})`);

    // Broadcast status to remote monitor so viewer understands
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'status-update',
        code: roomCode,
        payload: {
          isStreaming: false,
          isPhoneCallActive: true,
          callReason: reason,
        },
      }));
    }
  }, [stopMedia, roomCode]);

  // Resume Media after Call ends
  const resumeMediaAfterCall = useCallback(() => {
    console.log('Call ended: Resuming camera and mic standby');
    setIsPhoneCallActive(false);
    setCallReason('');
    setStatusMessage('कॉल समाप्त: कैमरा व माइक पुनः स्टैंडबाय / सक्रिय मोड में है।');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'status-update',
        code: roomCode,
        payload: {
          isPhoneCallActive: false,
          callReason: '',
        },
      }));
    }

    // Auto-restart stream if remote viewers are present
    if (connectedRemotes > 0) {
      setTimeout(() => {
        startMediaRef.current?.();
      }, 300);
    }
  }, [connectedRemotes, roomCode]);

  // Start Media & WebRTC Streaming on Request
  const startMedia = useCallback(async () => {
    try {
      setStatusMessage('बाहर वाला जुड़ा: कैमरा व माइक सक्रिय हो रहे हैं...');
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 25, max: 30 }, // Optimal for zero lag over international cellular hops
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, // Mono audio saves bandwidth and eliminates jitter
          sampleRate: 48000,
        },
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Check torch support and attach OS preemption listener to video track
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const cap = (videoTrack.getCapabilities && (videoTrack.getCapabilities() as any)) || {};
        setHasTorchSupport(!!cap.torch);

        // If OS interrupts video (e.g. WhatsApp video call received)
        videoTrack.onmute = () => {
          console.warn('Video track muted by OS (possible WhatsApp/IMO video call incoming)');
          if (isCallSafeActive) {
            yieldMediaForCall('वीडियो कॉल प्राथमिकता सक्रिय (व्हाट्सएप/इमो)');
          }
        };
        videoTrack.onended = () => {
          console.warn('Video track ended by OS');
          if (isCallSafeActive) {
            yieldMediaForCall('सिस्टम द्वारा कैमरा बंद किया गया');
          }
        };
      }

      // Attach OS preemption listener to audio track (WhatsApp / IMO audio call incoming)
      const rawAudioTrack = mediaStream.getAudioTracks()[0];
      if (rawAudioTrack) {
        rawAudioTrack.onmute = () => {
          console.warn('Audio track muted by OS (WhatsApp/IMO audio call or incoming phone call)');
          if (isCallSafeActive) {
            yieldMediaForCall('व्हाट्सएप/इमो कॉल सक्रिय (माइक स्वतः फ्री हुआ)');
          }
        };
        rawAudioTrack.onended = () => {
          console.warn('Audio track ended by OS');
          if (isCallSafeActive) {
            yieldMediaForCall('कॉल के कारण माइक ट्रैक सिस्टम द्वारा बंद किया गया');
          }
        };
      }

      // Initialize voice filter processor with clean mic audio
      const processedTrack = filterProcessorRef.current.init(mediaStream);

      // Setup audio meter using mixBus
      const ctx = filterProcessorRef.current.getAudioContext();
      const mixBus = filterProcessorRef.current.getMixBus();
      if (ctx && mixBus) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        mixBus.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkLevel = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          }
          animFrameRef.current = requestAnimationFrame(checkLevel);
        };
        checkLevel();
      }

      setIsStreaming(true);
      setStatusMessage('सक्रिय: बाहर वाले मोबाइल पर लाइव ट्रांसमिशन चालू है');

      // Create WebRTC Offer to remote
      await initiateWebRtcOffer(mediaStream, processedTrack);

    } catch (err: any) {
      console.error('Error starting media on demand:', err);
      setStatusMessage('कैमरा शुरू करने में त्रुटि या अनुमति अस्वीकृत');
    }
  }, [facingMode, isCallSafeActive, yieldMediaForCall]);

  useEffect(() => {
    startMediaRef.current = startMedia;
  }, [startMedia]);

  // Background & App-Switch Auto-Yield: When WhatsApp / IMO is opened or incoming call arrives
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User switched out of browser to answer WhatsApp/IMO call, send voice note, etc.
        if (isCallSafeActive && isStreaming) {
          yieldMediaForCall('व्हाट्सएप/इमो या अन्य ऐप खुला है');
        }
      } else if (document.visibilityState === 'visible') {
        // User returned to this app
        if (isPhoneCallActive) {
          resumeMediaAfterCall();
        }
      }
    };

    const handleWindowBlur = () => {
      // In some mobile browsers, an incoming call dialog causes window blur
      if (isCallSafeActive && isStreaming) {
        setTimeout(() => {
          if (document.visibilityState === 'hidden' && isStreaming) {
            yieldMediaForCall('कॉल स्क्रीन पॉप-अप / ऐप स्विच');
          }
        }, 600);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isCallSafeActive, isStreaming, isPhoneCallActive, yieldMediaForCall, resumeMediaAfterCall]);

  // Pre-grant Camera and Voice Permissions on mount as requested
  const requestPrePermissions = async () => {
    setPermissionStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Immediately stop all tracks to preserve privacy and return to standby!
      stream.getTracks().forEach((track) => track.stop());
      setPermissionStatus('granted');
      setStatusMessage('अनुमति स्वीकृत! घर का फ़ोन अब रिटर्न स्टैंडबाय मोड में है।');
    } catch (err: any) {
      console.warn('Pre-permission request denied or prompt closed:', err);
      setPermissionStatus('denied');
      setStatusMessage('कैमरा या माइक अनुमति नहीं मिली। कृपया अनुमति बटन दबाएँ।');
    }
  };

  useEffect(() => {
    requestPrePermissions();
  }, []);

  // WebRTC Offer Generation
  const initiateWebRtcOffer = async (mediaStream: MediaStream, processedAudioTrack: MediaStreamTrack | null) => {
    try {
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      pendingCandidatesRef.current = [];

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set('primary', pc);

      // Add Video Track
      mediaStream.getVideoTracks().forEach((track) => {
        pc.addTrack(track, mediaStream);
      });

      // Add Processed Clean Audio Track
      const audioTrack = processedAudioTrack || mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        pc.addTrack(audioTrack, mediaStream);
      }

      // Optimize sender bitrate & maintain framerate for zero lag
      optimizeVideoSender(pc, 1200000);

      pc.oniceconnectionstatechange = () => {
        console.log('Home ICE State:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setStatusMessage('🟢 ग्लोबल P2P/TURN लाइव ट्रांसमिशन सक्रिय (फास्ट व स्थिर)');
        } else if (pc.iceConnectionState === 'failed') {
          console.warn('Home ICE failed, attempting automatic restart...');
          setStatusMessage('नेटवर्क पुनः जोड़ा जा रहा है (ऑटो ICE रीस्टार्ट)...');
          try {
            pc.restartIce();
          } catch (e) {
            console.warn('ICE restart error:', e);
          }
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

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'signal',
          code: roomCode,
          payload: {
            type: 'offer',
            sdp: pc.localDescription,
          },
        }));
      }
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
    }
  };

  const handleRemoteSignal = async (payload: any) => {
    const pc = peerConnectionsRef.current.get('primary');
    if (!pc) return;

    if (payload.type === 'answer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        // Flush any queued candidates that arrived before remote description
        while (pendingCandidatesRef.current.length > 0) {
          const cand = pendingCandidatesRef.current.shift();
          if (cand) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('Error adding queued ICE candidate on home:', e);
            }
          }
        }
      } catch (err) {
        console.error('Error setting remote description on home:', err);
      }
    } else if (payload.type === 'candidate' && payload.candidate) {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {
          console.warn('ICE Candidate add error on home:', e);
        }
      } else {
        pendingCandidatesRef.current.push(payload.candidate);
      }
    }
  };

  // Torch Toggle
  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    const next = !isTorchOn;
    const success = await toggleTorch(videoTrack, next);
    if (success) {
      setIsTorchOn(next);
      broadcastStatus({ torchActive: next });
    }
  };

  // Switch Camera
  const handleSwitchCamera = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    if (isStreaming) {
      stopMedia();
      setTimeout(() => {
        startMedia();
      }, 250);
    }
  };

  // Voice Filter Change (Applied cleanly to outgoing microphone audio)
  const handleVoiceFilterChange = (filter: VoiceFilterType) => {
    setVoiceFilter(filter);
    filterProcessorRef.current.applyFilter(filter);
    broadcastStatus({ voiceFilter: filter });
  };

  // Broadcast device status to connected remotes
  const broadcastStatus = useCallback((partial: any = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'status-update',
        code: roomCode,
        payload: {
          isStreaming,
          isTorchOn,
          facingMode,
          voiceFilter,
          batteryLevel,
          isCharging,
          ...partial,
        },
      }));
    }
  }, [roomCode, isStreaming, isTorchOn, facingMode, voiceFilter, batteryLevel, isCharging]);

  // Automatically broadcast battery status changes to connected remotes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && connectedRemotes > 0) {
      broadcastStatus({ batteryLevel, isCharging });
    }
  }, [batteryLevel, isCharging, connectedRemotes, broadcastStatus]);

  // Setup WebSocket Signaling
  useEffect(() => {
    const wsUrl = getSignalingServerUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('connected');
      ws.send(JSON.stringify({
        type: 'register-home',
        code: roomCode,
      }));
    };

    ws.onclose = () => {
      setWsStatus('disconnected');
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'registered') {
          setConnectedRemotes(msg.remoteCount || 0);
          if (msg.remoteCount > 0) {
            startMedia();
          }
        }

        // AUTO-START CAMERA & MIC when remote connects!
        if (msg.type === 'remote-connected') {
          setConnectedRemotes((prev) => prev + 1);
          startMedia();
          // Send immediate battery status to newly joined remote viewer
          setTimeout(() => {
            broadcastStatus({ batteryLevel, isCharging });
          }, 200);
        }

        // AUTO-SHUTDOWN CAMERA & MIC when remote disconnects!
        if (msg.type === 'remote-disconnected') {
          const remaining = msg.remainingRemotes ?? 0;
          setConnectedRemotes(remaining);
          if (remaining <= 0) {
            stopMedia();
          }
        }

        if (msg.type === 'signal' && msg.from === 'remote') {
          handleRemoteSignal(msg.payload);
        }

        // Remote Controls sent by viewer
        if (msg.type === 'control') {
          if (msg.action === 'toggle-torch') {
            handleToggleTorch();
          } else if (msg.action === 'switch-camera') {
            handleSwitchCamera();
          } else if (msg.action === 'set-voice-filter') {
            handleVoiceFilterChange(msg.value);
          } else if (msg.action === 'stop-stream') {
            stopMedia();
          } else if (msg.action === 'start-stream') {
            startMedia();
          }
        }
      } catch (err) {
        console.error('Error handling WS message on home:', err);
      }
    };

    // Keepalive ping every 15s to prevent mobile carriers from dropping TCP connections
    const pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 15000);

    return () => {
      clearInterval(pingTimer);
      ws.close();
      stopMedia();
    };
  }, [roomCode, startMedia, stopMedia]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Screensaver Mode (Dark Screen with subtle clock to save battery & maintain stealth)
  if (isScreenSaver) {
    return (
      <div 
        id="home-screensaver-container"
        onClick={() => setIsScreenSaver(false)}
        className="fixed inset-0 z-50 bg-black text-slate-600 flex flex-col items-center justify-center cursor-pointer select-none p-6"
      >
        <div className="text-center space-y-4">
          <div className="font-mono text-5xl sm:text-7xl font-light tracking-wider text-slate-400/80">
            {currentTime}
          </div>
          
          <div className="flex items-center justify-center gap-2 text-xs font-mono">
            {isPhoneCallActive ? (
              <div className="flex items-center gap-2 text-amber-400 bg-amber-950/40 px-3 py-1.5 rounded-full border border-amber-800/60">
                <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
                <span>व्हाट्सएप / कॉल जारी है • माइक-कैमरा 100% फ्री है</span>
              </div>
            ) : isStreaming ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>बाहर वाला जुड़ा है • कैमरा व माइक लाइव चालू</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                <span>रिटर्न स्टैंडबाय मोड • कैमरा व माइक पूरी तरह बंद हैं</span>
              </div>
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-mono">
            <span>कोड: {roomCode}</span>
            <span>•</span>
            <Users className="w-3 h-3 text-blue-400" />
            <span>{connectedRemotes} जुड़े हैं</span>
          </div>

          {/* Battery Indicator in Screensaver Mode */}
          <div className="pt-1 flex justify-center">
            <BatteryIndicator 
              level={batteryLevel} 
              isCharging={isCharging} 
              size="md" 
              label="डिवाइस बैटरी" 
            />
          </div>

          <p className="text-[11px] text-slate-600 pt-6">
            स्क्रीन पर कहीं भी टच करके सामान्य स्क्रीन पर लौटें
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-white overflow-hidden">
      {/* Top Header */}
      <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            id="btn-home-back"
            type="button"
            onClick={() => {
              stopMedia();
              onBack();
            }}
            className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            ← बाहर आएँ
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'
              }`}></span>
              <h2 className="text-sm font-bold text-slate-100">
                घर वाला मोबाइल (रिटर्न स्टैंडबाय मोड)
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {isStreaming 
                ? '🟢 सक्रिय: बाहर वाला जुड़ा है (कैमरा व माइक लाइव)' 
                : '💤 रिटर्न स्टैंडबाय: कैमरा व माइक बंद हैं'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Battery Status in Header */}
          <BatteryIndicator 
            level={batteryLevel} 
            isCharging={isCharging} 
            size="sm"
            className="hidden sm:inline-flex"
          />

          {/* Stealth Clock Screen Saver Button */}
          <button
            id="btn-screensaver-toggle"
            type="button"
            onClick={() => setIsScreenSaver(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            title="स्क्रीन सेवर (ब्लैक स्क्रीन) चालू करें"
          >
            <Moon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ब्लैक स्क्रीन</span>
          </button>

          <button
            id="btn-guide-modal"
            type="button"
            onClick={onOpenGuide}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition cursor-pointer"
            title="गाइड"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-center max-w-2xl mx-auto w-full space-y-6">
        {/* Prominent Secret Room Code Card */}
        <div className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl text-center relative overflow-hidden">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
            घर वाले मोबाइल का सीक्रेट कोड (Connection Code)
          </div>
          <p className="text-xs text-slate-400 mb-4">
            इस कोड को बाहर वाले मोबाइल में दर्ज करें
          </p>

          <div className="inline-flex items-center justify-center gap-3 bg-slate-950 border border-slate-800 px-6 py-4 rounded-2xl mb-4 shadow-inner">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-wider">
              {roomCode}
            </span>
            <button
              id="btn-copy-code-card"
              type="button"
              onClick={handleCopyCode}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer border border-slate-700"
              title="कोड कॉपी करें"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          {copied && (
            <p className="text-xs text-emerald-400 font-semibold mb-2 animate-pulse">
              कोड कॉपी हो गया!
            </p>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Users className="w-4 h-4 text-blue-400" />
            <span>बाहर से जुड़े दर्शक: <b className="text-white">{connectedRemotes}</b></span>
          </div>

          {/* Global Network STUN + TURN Indicator */}
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/30 rounded-lg py-1.5 px-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ग्लोबल नेटवर्क सक्रिय (सऊदी ⇄ भारत 4G/5G/Wi-Fi फास्ट P2P + TURN रिले)</span>
          </div>
        </div>

        {/* Permission Status Card */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              permissionStatus === 'granted'
                ? 'bg-emerald-500/20 text-emerald-400'
                : permissionStatus === 'denied'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {permissionStatus === 'granted' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-200">
                कैमरा व वॉइस (माइक) परमिशन
              </div>
              <div className="text-[11px] text-slate-400">
                {permissionStatus === 'granted'
                  ? 'परमिशन स्वीकृत है ✓ (ऐप रिटर्न स्टैंडबाय मोड में है)'
                  : permissionStatus === 'requesting'
                  ? 'अनुमति जाँची जा रही है...'
                  : 'अनुमति नहीं मिली है'}
              </div>
            </div>
          </div>

          {permissionStatus !== 'granted' && (
            <button
              id="btn-grant-permission-now"
              type="button"
              onClick={requestPrePermissions}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer shrink-0"
            >
              अनुमति दें
            </button>
          )}
        </div>

        {/* Device Battery Level Card */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-800 text-slate-300 border border-slate-700/60">
              <Smartphone className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>डिवाइस बैटरी व पावर मॉनिटर</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {batteryLevel !== null
                  ? `बैटरी: ${batteryLevel}% ${isCharging ? '• चार्जर लगा है ⚡' : '• बैटरी बैकअप पर'}`
                  : 'डिवाइस बैटरी सेंसर लोड हो रहा है'}
                {' '}• बाहर वाले मोबाइल को लाइव दिखेगी
              </div>
            </div>
          </div>

          <div className="self-end sm:self-auto">
            <BatteryIndicator 
              level={batteryLevel} 
              isCharging={isCharging} 
              size="md"
            />
          </div>
        </div>

        {/* WhatsApp & IMO Call Protection Card */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isPhoneCallActive ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {isPhoneCallActive ? <PhoneCall className="w-5 h-5 animate-pulse" /> : <Smartphone className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>व्हाट्सएप व इमो कॉल सुरक्षा (100% सेफ)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-medium">
                    जीरो समस्या
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  व्हाट्सएप या इमो पर बात करते समय माइक-कैमरा अपने-आप फ्री रहेगा
                </div>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              id="toggle-call-safe-mode"
              type="button"
              onClick={() => setIsCallSafeActive(!isCallSafeActive)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer shrink-0 ${
                isCallSafeActive
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="कॉल प्राथमिकता टॉगल करें"
            >
              {isCallSafeActive ? 'चालू (सुरक्षित)' : 'बंद'}
            </button>
          </div>

          {/* Current Call Status Indicator */}
          <div className={`p-3 rounded-xl text-xs border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
            isPhoneCallActive 
              ? 'bg-amber-950/40 border-amber-800/80 text-amber-200' 
              : 'bg-slate-950/70 border-slate-800/90 text-slate-300'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isPhoneCallActive ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
              <span className="leading-snug">
                {isPhoneCallActive 
                  ? `कॉल/व्हाट्सएप सक्रिय है — कैमरा व माइक 100% फ्री है (${callReason || 'कॉल जारी'})`
                  : `तैयार — व्हाट्सएप, इमो या सामान्य कॉल आने पर माइक में कोई रुकावट नहीं आएगी`}
              </span>
            </div>

            {/* Manual Action Button */}
            {isPhoneCallActive ? (
              <button
                id="btn-resume-after-call"
                type="button"
                onClick={resumeMediaAfterCall}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition cursor-pointer shrink-0 self-start sm:self-auto"
              >
                कॉल समाप्त (रिज्यूम करें)
              </button>
            ) : (
              <button
                id="btn-yield-for-call"
                type="button"
                onClick={() => yieldMediaForCall('कॉल के लिए माइक फ्री किया गया')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer border border-slate-700 shrink-0 self-start sm:self-auto"
                title="कॉल आने पर माइक तुरंत छोड़ें"
              >
                कॉल आ रही है? (माइक फ्री करें)
              </button>
            )}
          </div>

          {/* Reassuring Guarantee Points */}
          <div className="text-[11px] text-slate-400 space-y-1.5 pt-1">
            <div className="flex items-start gap-1.5">
              <span className="text-emerald-400 font-bold shrink-0">✓</span>
              <span><b>व्हाट्सएप व इमो कॉलिंग गारंटी:</b> घर वाले मोबाइल पर व्हाट्सएप, इमो या सामान्य फोन पर बात करते समय न तो आवाज़ कटेगी और न ही &quot;माइक व्यस्त है&quot; का एरर आएगा।</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-emerald-400 font-bold shrink-0">✓</span>
              <span><b>ऑटोमैटिक फ्री हार्डवेयर:</b> जब भी कोई कॉल आएगी या आप व्हाट्सएप खोलेंगे, ऐप तुरंत कैमरा और माइक छोड़ देता है ताकि आपकी बातचीत निर्बाध हो सके।</span>
            </div>
          </div>
        </div>

        {/* Status Card: रिटर्न मोड की कार्यप्रणाली */}
        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-200">
            <span className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-emerald-400 animate-ping' : 'bg-blue-400'}`}></span>
            <span>
              {isStreaming 
                ? 'लाइव ट्रांसमिशन सक्रिय (कैमरा व माइक चालू)' 
                : 'रिटर्न स्टैंडबाय मोड सक्रिय (कैमरा-माइक बंद)'}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {isStreaming ? (
              <span className="text-emerald-300">
                बाहर वाला मोबाइल आपके फ़ोन से जुड़ चुका है। लाइव वीडियो और साफ़ माइक आवाज़ भेजी जा रही है। जैसे ही बाहर वाला ऐप से बाहर निकलेगा, कैमरा व माइक स्वतः तुरंत बंद हो जाएँगे।
              </span>
            ) : (
              <span>
                घर के फ़ोन पर आपको कुछ करने की ज़रूरत नहीं है। जब बाहर वाला कोड डालकर कनेक्ट करेगा तभी कैमरा व आवाज़ चालू होगी, और बाहर वाले के ऐप से निकलते ही सब बंद हो जाएगा।
              </span>
            )}
          </p>

          {/* Hidden video element for WebRTC camera stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={isStreaming ? "w-full max-h-48 rounded-xl object-contain bg-black border border-slate-800" : "hidden"}
          />

          {isStreaming && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <span>माइक लेवल:</span>
                <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>

              {isTorchOn && (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Flashlight className="w-3.5 h-3.5" /> टॉर्च चालू
                </span>
              )}
            </div>
          )}
        </div>

        {/* Black Screen Stealth Button */}
        <button
          id="btn-enter-black-screen"
          type="button"
          onClick={() => setIsScreenSaver(true)}
          className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Moon className="w-4 h-4 text-indigo-400" />
          <span>ब्लैक स्क्रीन (घड़ी सेवर) चालू करें ताकि फ़ोन अंधेरा रहे</span>
        </button>
      </div>
    </div>
  );
};

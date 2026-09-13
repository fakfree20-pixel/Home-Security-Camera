export type DeviceRole = 'home' | 'remote';

export type StreamMode = 'video' | 'audio-only';

export type VoiceFilterType = 'normal' | 'deep' | 'high' | 'robot' | 'radio' | 'echo';

export interface SignalPayload {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface ControlPayload {
  action: 'toggle-torch' | 'switch-camera' | 'set-stream-mode' | 'set-voice-filter' | 'stop-stream' | 'start-stream';
  value?: any;
}

export interface DeviceStatus {
  isStreaming: boolean;
  torchActive: boolean;
  facingMode: 'user' | 'environment';
  voiceFilter: VoiceFilterType;
  streamMode: StreamMode;
  audioLevel: number;
  batteryLevel?: number | null;
  isCharging?: boolean;
}

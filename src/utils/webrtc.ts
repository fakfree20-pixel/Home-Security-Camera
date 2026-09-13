/**
 * Global WebRTC Configuration with STUN & TURN Relay Support.
 * Configured for seamless cross-border connectivity (e.g. Saudi Arabia to India,
 * global SIM/Cellular 4G/5G carriers, strict symmetric NATs, and Wi-Fi networks).
 */
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // Google Primary Global STUN
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },

    // Cloudflare Global Anycast STUN
    { urls: 'stun:stun.cloudflare.com:3478' },

    // OpenRelay Project Global TURN & TURNS Relays (Middle East, Asia, Europe, Americas)
    // Necessary for Symmetric NATs / Mobile Cellular Carriers (e.g. STC, Mobily, Zain, Jio, Airtel)
    {
      urls: 'stun:openrelay.metered.ca:80',
    },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:relay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:relay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turns:relay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all',
};

/**
 * Configure RTCRtpSender for ultra low-latency and zero-lag frame rate maintenance
 */
export function optimizeVideoSender(pc: RTCPeerConnection, maxBitrateBps: number = 1200000) {
  try {
    const senders = pc.getSenders();
    const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
    if (videoSender && typeof videoSender.getParameters === 'function') {
      const params = videoSender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = maxBitrateBps;
      params.encodings[0].networkPriority = 'high';
      params.degradationPreference = 'maintain-framerate'; // Avoids video lag and freezing
      videoSender.setParameters(params).catch((e) => {
        console.warn('Could not set video sender parameters:', e);
      });
    }
  } catch (err) {
    console.warn('Sender optimization error:', err);
  }
}

/**
 * Toggles torch/flashlight on a video track if hardware supports it
 */
export async function toggleTorch(videoTrack: MediaStreamTrack, enabled: boolean): Promise<boolean> {
  try {
    const capabilities = (videoTrack.getCapabilities && (videoTrack.getCapabilities() as any)) || {};
    if (capabilities.torch) {
      await (videoTrack as any).applyConstraints({
        advanced: [{ torch: enabled }],
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Torch constraint not supported or failed on this device:', err);
    return false;
  }
}

/**
 * Helper to generate random 6-character room code (e.g. 786-921)
 */
export function generateRoomCode(): string {
  const num1 = Math.floor(100 + Math.random() * 900);
  const num2 = Math.floor(100 + Math.random() * 900);
  return `${num1}-${num2}`;
}

/**
 * Resolves the WebSocket signaling URL.
 * Works seamlessly in web, PWA, and local offline APK bundles.
 */
export function getSignalingServerUrl(): string {
  try {
    const custom = localStorage.getItem('camera_custom_server');
    if (custom && custom.trim()) {
      return custom.trim();
    }
  } catch (e) {
    // Ignore storage errors
  }

  if (typeof window !== 'undefined' && window.location) {
    if (window.location.host && window.location.protocol !== 'file:') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}`;
    }
  }

  return 'wss://ais-dev-ptg3ppxsx7luo6vkbh5x5t-257389990740.europe-west2.run.app';
}

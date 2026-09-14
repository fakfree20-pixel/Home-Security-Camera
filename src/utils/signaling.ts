import mqtt, { MqttClient } from 'mqtt';

/**
 * Public, ultra-reliable global MQTT brokers over WebSocket.
 * No login, no session cookies, zero authentication required.
 * Works seamlessly inside Android APKs (file:// protocol) and mobile cellular networks worldwide.
 */
const PUBLIC_BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081',
];

export function normalizeRoomCode(code: string): string {
  return (code || '').replace(/[\s-_]/g, '').toUpperCase();
}

export interface SignalingClient {
  sendSignal: (payload: any) => void;
  sendControl: (action: string, value?: any) => void;
  sendStatusUpdate: (payload: any) => void;
  notifyJoined: () => void;
  notifyLeave: () => void;
  cleanup: () => void;
}

export function createSignalingClient(
  role: 'home' | 'remote',
  rawRoomCode: string,
  callbacks: {
    onMessage: (msg: any) => void;
    onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  }
): SignalingClient {
  const roomCode = normalizeRoomCode(rawRoomCode);
  const clientId = `cam_${role}_${Math.random().toString(36).substring(2, 9)}`;

  const toHomeTopic = `homecam/v3/${roomCode}/to-home`;
  const toRemoteTopic = `homecam/v3/${roomCode}/to-remote`;
  const presenceTopic = `homecam/v3/${roomCode}/presence`;

  let client: MqttClient | null = null;
  let brokerIndex = 0;
  let isCleanedUp = false;
  let heartbeatTimer: any = null;

  const connectToBroker = (index: number) => {
    if (isCleanedUp) return;

    const brokerUrl = PUBLIC_BROKERS[index % PUBLIC_BROKERS.length];
    callbacks.onStatusChange('connecting');

    try {
      if (client) {
        try {
          client.end(true);
        } catch (e) {}
      }

      client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 8000,
        keepalive: 15,
        reconnectPeriod: 4000,
      });

      client.on('connect', () => {
        if (isCleanedUp) return;
        callbacks.onStatusChange('connected');

        // Subscribe to relevant topics
        const topicsToSub = role === 'home' 
          ? [toHomeTopic, presenceTopic] 
          : [toRemoteTopic, presenceTopic];

        client?.subscribe(topicsToSub, { qos: 0 }, (err) => {
          if (!err) {
            if (role === 'home') {
              // Announce home device is ready and waiting
              publishMessage(presenceTopic, {
                type: 'home-online',
                code: roomCode,
              });
              // Send keepalive presence heartbeat every 4 seconds
              clearInterval(heartbeatTimer);
              heartbeatTimer = setInterval(() => {
                if (client?.connected) {
                  publishMessage(presenceTopic, {
                    type: 'home-heartbeat',
                    code: roomCode,
                  });
                }
              }, 4000);
            } else {
              // Remote sends join request
              publishMessage(presenceTopic, {
                type: 'join-remote',
                code: roomCode,
              });
            }
          }
        });
      });

      client.on('message', (_topic, payload) => {
        if (isCleanedUp) return;
        try {
          const text = payload.toString();
          const msg = JSON.parse(text);
          // Ignore own messages if reflected
          if (msg.senderId === clientId) return;
          callbacks.onMessage(msg);
        } catch (err) {
          console.warn('Signaling parse error:', err);
        }
      });

      client.on('error', (err) => {
        console.warn(`Signaling error on broker ${brokerUrl}:`, err);
        callbacks.onStatusChange('error');
        // Try fallback broker
        if (!isCleanedUp && brokerIndex < PUBLIC_BROKERS.length * 2) {
          brokerIndex++;
          setTimeout(() => connectToBroker(brokerIndex), 1500);
        }
      });

      client.on('close', () => {
        if (!isCleanedUp) {
          callbacks.onStatusChange('disconnected');
        }
      });
    } catch (e) {
      console.error('Signaling connection error:', e);
      callbacks.onStatusChange('error');
    }
  };

  const publishMessage = (topic: string, data: any) => {
    if (!client || !client.connected || isCleanedUp) return;
    try {
      const payload = JSON.stringify({
        ...data,
        senderId: clientId,
        timestamp: Date.now(),
      });
      client.publish(topic, payload, { qos: 0 });
    } catch (err) {
      console.warn('Publish error:', err);
    }
  };

  // Start connection to first broker
  connectToBroker(0);

  return {
    sendSignal: (payload: any) => {
      const topic = role === 'home' ? toRemoteTopic : toHomeTopic;
      publishMessage(topic, {
        type: 'signal',
        from: role,
        payload,
      });
    },

    sendControl: (action: string, value?: any) => {
      publishMessage(toHomeTopic, {
        type: 'control',
        from: 'remote',
        action,
        value,
      });
    },

    sendStatusUpdate: (payload: any) => {
      publishMessage(toRemoteTopic, {
        type: 'status-update',
        from: 'home',
        payload,
      });
    },

    notifyJoined: () => {
      publishMessage(presenceTopic, {
        type: 'join-remote',
        code: roomCode,
      });
    },

    notifyLeave: () => {
      if (role === 'remote') {
        publishMessage(presenceTopic, {
          type: 'remote-disconnected',
          code: roomCode,
        });
      } else {
        publishMessage(presenceTopic, {
          type: 'home-offline',
          code: roomCode,
        });
      }
    },

    cleanup: () => {
      isCleanedUp = true;
      clearInterval(heartbeatTimer);
      if (client) {
        try {
          if (role === 'remote') {
            publishMessage(presenceTopic, {
              type: 'remote-disconnected',
              code: roomCode,
            });
          } else {
            publishMessage(presenceTopic, {
              type: 'home-offline',
              code: roomCode,
            });
          }
          client.end(true);
        } catch (e) {}
        client = null;
      }
    },
  };
}

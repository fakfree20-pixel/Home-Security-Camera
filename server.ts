import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // Room management for WebRTC signaling
  // roomCode -> { homeSocket?: WebSocket, remoteSockets: Set<WebSocket> }
  interface Room {
    homeSocket?: WebSocket;
    remoteSockets: Set<WebSocket>;
    created: number;
    homeOnline: boolean;
  }

  const rooms = new Map<string, Room>();

  const wss = new WebSocketServer({ server });

  // Heartbeat interval to prevent mobile cellular gateways (4G/5G carriers) from closing idle sockets
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
      }
    });
  }, 20000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: WebSocket) => {
    let currentRoomCode: string | null = null;
    let clientRole: 'home' | 'remote' | null = null;

    ws.on('message', (messageRaw: string) => {
      try {
        const msg = JSON.parse(messageRaw.toString());
        const { type, code, payload } = msg;

        // Ping / Pong for keepalive & latency check
        if (type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp || Date.now() }));
          return;
        }

        if (type === 'register-home') {
          currentRoomCode = code;
          clientRole = 'home';

          let room = rooms.get(code);
          if (!room) {
            room = {
              homeSocket: ws,
              remoteSockets: new Set(),
              created: Date.now(),
              homeOnline: true,
            };
            rooms.set(code, room);
          } else {
            room.homeSocket = ws;
            room.homeOnline = true;
          }

          ws.send(JSON.stringify({
            type: 'registered',
            role: 'home',
            code,
            remoteCount: room.remoteSockets.size,
          }));

          // Notify any listening remote viewers
          room.remoteSockets.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'home-online', code }));
            }
          });
          return;
        }

        if (type === 'join-remote') {
          currentRoomCode = code;
          clientRole = 'remote';

          let room = rooms.get(code);
          if (!room) {
            room = {
              remoteSockets: new Set([ws]),
              created: Date.now(),
              homeOnline: false,
            };
            rooms.set(code, room);
          } else {
            room.remoteSockets.add(ws);
          }

          const isHomePresent = !!(room.homeSocket && room.homeSocket.readyState === WebSocket.OPEN);

          ws.send(JSON.stringify({
            type: 'joined',
            role: 'remote',
            code,
            homeOnline: isHomePresent,
          }));

          if (isHomePresent && room.homeSocket) {
            room.homeSocket.send(JSON.stringify({
              type: 'remote-connected',
              code,
            }));
          }
          return;
        }

        // WebRTC Signaling messages (offer, answer, candidate)
        if (type === 'signal') {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          if (clientRole === 'home') {
            // Forward signal to all remote viewers in this room
            room.remoteSockets.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'signal',
                  from: 'home',
                  payload,
                }));
              }
            });
          } else if (clientRole === 'remote') {
            // Forward signal to the home device
            if (room.homeSocket && room.homeSocket.readyState === WebSocket.OPEN) {
              room.homeSocket.send(JSON.stringify({
                type: 'signal',
                from: 'remote',
                payload,
              }));
            }
          }
          return;
        }

        // Remote Controls (e.g. torch, mic toggle, audio-only request, switch-cam)
        if (type === 'control') {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (room && room.homeSocket && room.homeSocket.readyState === WebSocket.OPEN) {
            room.homeSocket.send(JSON.stringify({
              type: 'control',
              action: msg.action,
              value: msg.value,
            }));
          }
          return;
        }

        // Status update from home to remotes
        if (type === 'status-update') {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (room) {
            room.remoteSockets.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'status-update',
                  payload,
                }));
              }
            });
          }
          return;
        }

        // Explicit remote disconnect/leave
        if (type === 'disconnect-remote') {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (room) {
            room.remoteSockets.delete(ws);
            if (room.homeSocket && room.homeSocket.readyState === WebSocket.OPEN) {
              room.homeSocket.send(JSON.stringify({
                type: 'remote-disconnected',
                remainingRemotes: room.remoteSockets.size,
              }));
            }
          }
          return;
        }

      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    });

    ws.on('close', () => {
      if (currentRoomCode) {
        const room = rooms.get(currentRoomCode);
        if (room) {
          if (clientRole === 'home') {
            room.homeOnline = false;
            room.homeSocket = undefined;
            room.remoteSockets.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'home-offline', code: currentRoomCode }));
              }
            });
          } else if (clientRole === 'remote') {
            room.remoteSockets.delete(ws);
            if (room.homeSocket && room.homeSocket.readyState === WebSocket.OPEN) {
              room.homeSocket.send(JSON.stringify({
                type: 'remote-disconnected',
                remainingRemotes: room.remoteSockets.size,
              }));
            }
          }

          if (!room.homeSocket && room.remoteSockets.size === 0) {
            rooms.delete(currentRoomCode);
          }
        }
      }
    });
  });

  // REST API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeRooms: rooms.size,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/check-room/:code', (req, res) => {
    const code = req.params.code;
    const room = rooms.get(code);
    res.json({
      exists: !!room,
      homeOnline: !!(room && room.homeOnline),
    });
  });

  // Vite Middleware in dev, Static in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

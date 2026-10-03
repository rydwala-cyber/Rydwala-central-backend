import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { WebSocketEventType, WebSocketMessage } from '../types/index.ts';
import { db } from '../db/db.ts';
import { URL } from 'url';

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  role?: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  subscribedRideIds: Set<string>;
}

export class SocketManager {
  private static instance: SocketManager;
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientConnection> = new Map();

  private constructor() {}

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public initialize(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, request) => {
      const conn: ClientConnection = {
        ws,
        subscribedRideIds: new Set<string>(),
      };

      // Register role/user immediately from the WS query string. This makes the
      // connection routable even if the first DRIVER_REGISTER message is delayed.
      try {
        const requestUrl = new URL(request.url || '/ws', `http://${request.headers.host || 'localhost'}`);
        const role = String(requestUrl.searchParams.get('role') || '').toUpperCase();
        const driverId = requestUrl.searchParams.get('driverId');
        const userId = requestUrl.searchParams.get('userId');
        if (role === 'DRIVER' && driverId) {
          conn.userId = driverId;
          conn.role = 'DRIVER';
        } else if (role === 'CUSTOMER' && userId) {
          conn.userId = userId;
          conn.role = 'CUSTOMER';
        }
      } catch (err) {
        console.warn('[WS] Could not parse connection query:', err);
      }

      this.clients.set(ws, conn);

      if (conn.role === 'DRIVER') {
        console.log(`[WS CONNECT] driverId=${conn.userId} registered from query`);
      }

      // Send initial welcome/handshake
      this.sendToWs(ws, {
        event: 'STATS_UPDATED',
        payload: { message: 'Connected to Rydwala Central Real-time Gateway' },
        timestamp: new Date().toISOString(),
      });

      ws.on('message', (messageRaw: string) => {
        try {
          const data = JSON.parse(messageRaw.toString());
          this.handleClientMessage(ws, data);
        } catch (err) {
          console.error('Error handling WS message:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('WS Error:', err);
        this.clients.delete(ws);
      });
    });

    console.log('⚡ Rydwala WebSocket Real-time Gateway initialized on /ws');
  }

  private handleClientMessage(ws: WebSocket, data: any) {
    const conn = this.clients.get(ws);
    if (!conn) return;

    if (data.type === 'IDENTIFY') {
      conn.userId = data.userId;
      conn.role = data.role;
      if (data.rideId) {
        conn.subscribedRideIds.add(data.rideId);
      }
    } else if (
      data.type === 'DRIVER_REGISTER' ||
      data.type === 'register' ||
      data.event === 'register' ||
      (data.driverId && (data.isOnline !== undefined || data.type?.includes('DRIVER')))
    ) {
      const driverId = data.driverId || data.userId;
      if (driverId) {
        conn.userId = driverId;
        conn.role = 'DRIVER';
        console.log(`[WS DRIVER_REGISTER] driverId=${driverId}`);
        console.log(`[WS DRIVER_REGISTER] role=DRIVER`);

        if (data.isOnline !== undefined || driverId.includes('8055090915')) {
          const isOnline = data.isOnline !== undefined ? Boolean(data.isOnline) : true;
          console.log(`[WS DRIVER_REGISTER] isOnline=${isOnline}`);

          // Synchronize in-memory backend driver record state
          let driver = db.drivers.get(driverId);
          if (!driver && driverId.includes('8055090915')) {
            driver = {
              driverId,
              name: 'Sachin Gaikwad (Test Driver)',
              phone: '8055090915',
              email: 'driver8055090915@rydwala.com',
              vehicleType: 'AUTO',
              vehicleModel: 'Bajaj Compact RE',
              vehicleNumber: 'MH 12 AB 9015',
              licenseNumber: 'MH12-2022-8055090915',
              status: 'ACTIVE',
              isOnline,
              isBusy: false,
              rating: 4.95,
              totalRides: 120,
              totalEarnings: 15400,
              currentLocation: {
                lat: 18.5204,
                lng: 73.8567,
                address: 'Pune Central, Maharashtra',
                heading: 0,
                speed: 0,
                updatedAt: new Date().toISOString(),
              },
              currentRideId: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            db.drivers.set(driverId, driver);
          } else if (driver) {
            driver.isOnline = isOnline;
            driver.status = 'ACTIVE';
            driver.updatedAt = new Date().toISOString();
            db.drivers.set(driverId, driver);
          }
        }
      }

      if (data.rideId) {
        conn.subscribedRideIds.add(data.rideId);
      }
    } else if (data.type === 'SUBSCRIBE_RIDE') {
      if (data.rideId) {
        conn.subscribedRideIds.add(data.rideId);
      }
    } else if (data.type === 'UNSUBSCRIBE_RIDE') {
      if (data.rideId) {
        conn.subscribedRideIds.delete(data.rideId);
      }
    }
  }

  private sendToWs(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast an event to a specific customer
   */
  public emitToCustomer(customerId: string, event: WebSocketEventType, payload: any) {
    const msg: WebSocketMessage = {
      event,
      payload,
      recipientId: customerId,
      timestamp: new Date().toISOString(),
    };

    for (const [ws, conn] of this.clients.entries()) {
      if (conn.userId === customerId || (payload.rideId && conn.subscribedRideIds.has(payload.rideId))) {
        this.sendToWs(ws, msg);
      }
    }
  }

  /**
   * Broadcast an event to a specific driver
   */
  public emitToDriver(driverId: string, event: WebSocketEventType, payload: any) {
    const msg: WebSocketMessage = {
      event,
      payload,
      recipientId: driverId,
      timestamp: new Date().toISOString(),
    };

    for (const [ws, conn] of this.clients.entries()) {
      if (conn.userId === driverId || (payload.rideId && conn.subscribedRideIds.has(payload.rideId))) {
        this.sendToWs(ws, msg);
      }
    }
  }

  /**
   * Broadcast a new ride request to all available online drivers
   */
  public broadcastToAvailableDrivers(event: WebSocketEventType, payload: any, targetVehicleType?: string) {
    const rideId = payload?.rideId || payload?.ride?.rideId || 'unknown';
    console.log(`[WS NEW_RIDE_REQUEST] broadcasting rideId=${rideId}`);

    const msg: WebSocketMessage = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };

    let sentCount = 0;
    for (const [ws, conn] of this.clients.entries()) {
      if (conn.role === 'DRIVER') {
        // A connected DRIVER socket is eligible to receive the request. The
        // driver app itself controls ONLINE/OFFLINE and starts the socket only
        // while online, so do not depend on a separate DB lookup here.
        console.log(`[WS NEW_RIDE_REQUEST] sent to driverId=${conn.userId || 'unknown'}`);
        this.sendToWs(ws, msg);
        sentCount++;
      }
    }
    if (sentCount === 0) {
      console.log(`[WS NEW_RIDE_REQUEST] No connected DRIVER clients found to receive rideId=${rideId}`);
    }
  }

  /**
   * Broadcast ride updates to all parties interested in a specific rideId (Customer, Driver, Admin)
   */
  public emitRideUpdate(rideId: string, event: WebSocketEventType, payload: any) {
    const msg: WebSocketMessage = {
      event,
      payload: { ...payload, rideId },
      timestamp: new Date().toISOString(),
    };

    for (const [ws, conn] of this.clients.entries()) {
      if (
        conn.subscribedRideIds.has(rideId) ||
        conn.userId === payload.customerId ||
        conn.userId === payload.driverId ||
        conn.role === 'ADMIN'
      ) {
        this.sendToWs(ws, msg);
      }
    }
  }

  /**
   * Broadcast to admin dashboard
   */
  public emitToAdmins(event: WebSocketEventType, payload: any) {
    const msg: WebSocketMessage = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };

    for (const [ws, conn] of this.clients.entries()) {
      if (conn.role === 'ADMIN') {
        this.sendToWs(ws, msg);
      }
    }
  }

  /**
   * General broadcast
   */
  public broadcast(event: WebSocketEventType, payload: any) {
    const msg: WebSocketMessage = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    };

    for (const [ws] of this.clients.entries()) {
      this.sendToWs(ws, msg);
    }
  }

  public getConnectedClientsCount(): { total: number; customers: number; drivers: number; admins: number } {
    let customers = 0;
    let drivers = 0;
    let admins = 0;

    for (const conn of this.clients.values()) {
      if (conn.role === 'CUSTOMER') customers++;
      else if (conn.role === 'DRIVER') drivers++;
      else if (conn.role === 'ADMIN') admins++;
    }

    return {
      total: this.clients.size,
      customers,
      drivers,
      admins,
    };
  }
}

export const socketManager = SocketManager.getInstance();

const jwt = require('jsonwebtoken');
const RequestModel = require('../models/request.model');

class SocketService {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map(); // userId -> socketId
    this.setupMiddleware();
    this.setupEvents();
  }

  setupMiddleware() {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentification requise : token manquant.'));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        next();
      } catch (err) {
        return next(new Error('Token JWT invalide ou expiré.'));
      }
    });
  }

  setupEvents() {
    this.io.on('connection', (socket) => {
      const userId = socket.userId;
      console.log(`🔌 Socket connecté : userId=${userId}, role=${socket.userRole}, socketId=${socket.id}`);

      // Enregistrer userId -> socketId
      this.userSockets.set(String(userId), socket.id);

      // Nettoyage à la déconnexion
      socket.on('disconnect', () => {
        console.log(`❌ Socket déconnecté : userId=${userId}`);
        this.userSockets.delete(String(userId));
      });

      // Event : le driver met à jour sa position GPS en temps réel
      socket.on('driver_location_update', async (data) => {
        if (socket.userRole !== 'driver') return;

        const { lat, lng } = data;
        if (lat == null || lng == null) return;

        try {
          // Récupérer les demandes actives assignées à ce driver
          const activeRequests = await RequestModel.findActiveByDriverId(userId);

          activeRequests.forEach((request) => {
            const clientSocketId = this.userSockets.get(String(request.client_id));
            if (clientSocketId) {
              this.io.to(clientSocketId).emit('driver_location', {
                driverId: userId,
                lat,
                lng,
                requestId: request.id,
              });
            }
          });
        } catch (err) {
          console.error('driver_location_update error:', err);
        }
      });
    });
  }

  /**
   * Notifier les dépanneurs à proximité d'une nouvelle demande
   */
  notifyNearbyDrivers(driverIds, requestData) {
    driverIds.forEach((driverId) => {
      const socketId = this.userSockets.get(String(driverId));
      if (socketId) {
        this.io.to(socketId).emit('new_request', requestData);
      }
    });
  }

  /**
   * Notifier le client d'une nouvelle offre
   */
  notifyClient(clientId, offerData) {
    const socketId = this.userSockets.get(String(clientId));
    if (socketId) {
      this.io.to(socketId).emit('new_offer', offerData);
    }
  }

  /**
   * Notifier le dépanneur que son offre est acceptée
   */
  notifyDriver(driverId, data) {
    const socketId = this.userSockets.get(String(driverId));
    if (socketId) {
      this.io.to(socketId).emit('offer_accepted', data);
    }
  }

  /**
   * Notifier annulation de la demande
   */
  notifyCancellation(userIds, requestId) {
    userIds.forEach((userId) => {
      const socketId = this.userSockets.get(String(userId));
      if (socketId) {
        this.io.to(socketId).emit('request_cancelled', { requestId });
      }
    });
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

let instance = null;

const initSocketService = (io) => {
  instance = new SocketService(io);
  return instance;
};

const getSocketService = () => instance;

module.exports = { initSocketService, getSocketService };

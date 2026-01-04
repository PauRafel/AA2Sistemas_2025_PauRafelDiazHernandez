// ============================================
// ROOMMANAGER - Gestiona todas las salas
// ============================================

const Room = require('./Room');

class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomId -> Room
        this.playerToRoom = new Map(); // userId -> roomId
        this.socketToPlayer = new Map(); // socketId -> userId
        this.nextRoomId = 1;
    }

    // Crear una nueva sala
    createRoom(player) {
        const roomId = `room_${this.nextRoomId++}`;
        const room = new Room(roomId, player);
        
        this.rooms.set(roomId, room);
        this.playerToRoom.set(player.userId, roomId);
        this.socketToPlayer.set(player.socketId, player.userId);

        console.log(`🚪 Sala creada: ${roomId} por ${player.username}`);
        
        return { success: true, roomId, room };
    }

    // Unirse a una sala existente
    joinRoom(roomId, player) {
        const room = this.rooms.get(roomId);
        
        if (!room) {
            return { success: false, message: 'Room not found' };
        }

        const result = room.addPlayer(player);
        
        if (result.success) {
            this.playerToRoom.set(player.userId, roomId);
            this.socketToPlayer.set(player.socketId, player.userId);
            console.log(`🚪 ${player.username} se unió a ${roomId}`);
        }

        return result;
    }

    // Salir de una sala
    leaveRoom(userId) {
        const roomId = this.playerToRoom.get(userId);
        
        if (!roomId) {
            return { success: false, message: 'Not in any room' };
        }

        const room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, message: 'Room not found' };
        }

        const result = room.removePlayer(userId);
        
        if (result.success) {
            this.playerToRoom.delete(userId);
            console.log(`🚪 Usuario ${userId} salió de ${roomId}`);
            
            // Si la sala debe cerrarse
            if (result.shouldClose || room.shouldClose()) {
                this.closeRoom(roomId);
            }
        }

        return result;
    }

    // Cerrar una sala
    closeRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.stopGame();
            
            // Limpiar referencias
            room.players.forEach(player => {
                this.playerToRoom.delete(player.userId);
                this.socketToPlayer.delete(player.socketId);
            });
            
            this.rooms.delete(roomId);
            console.log(`🚪 Sala cerrada: ${roomId}`);
        }
    }

    // Añadir espectador a una sala
    addSpectator(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.addSpectator(socketId);
            return { success: true, room };
        }
        return { success: false, message: 'Room not found' };
    }

    // Quitar espectador de una sala
    removeSpectator(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.removeSpectator(socketId);
            return { success: true };
        }
        return { success: false };
    }

    // Obtener sala por ID
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    // Obtener sala de un jugador
    getRoomByPlayer(userId) {
        const roomId = this.playerToRoom.get(userId);
        return roomId ? this.rooms.get(roomId) : null;
    }

    // Obtener sala por socketId
    getRoomBySocket(socketId) {
        const userId = this.socketToPlayer.get(socketId);
        return userId ? this.getRoomByPlayer(userId) : null;
    }

    // Listar todas las salas activas
    listActiveRooms() {
        const roomList = [];
        this.rooms.forEach(room => {
            if (room.status !== 'finished') {
                roomList.push(room.getRoomInfo());
            }
        });
        return roomList;
    }

    // Listar salas esperando jugadores
    listWaitingRooms() {
        const roomList = [];
        this.rooms.forEach(room => {
            if (room.status === 'waiting') {
                roomList.push(room.getRoomInfo());
            }
        });
        return roomList;
    }

    // Limpiar jugador al desconectarse
    cleanupPlayer(socketId) {
        const userId = this.socketToPlayer.get(socketId);
        if (userId) {
            this.leaveRoom(userId);
            this.socketToPlayer.delete(socketId);
        }
    }

    // Obtener estadísticas
    getStats() {
        return {
            totalRooms: this.rooms.size,
            waitingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'waiting').length,
            inProgressRooms: Array.from(this.rooms.values()).filter(r => r.status === 'in_progress').length,
            totalPlayers: this.playerToRoom.size,
            totalSpectators: Array.from(this.rooms.values()).reduce((sum, r) => sum + r.spectators.length, 0)
        };
    }
}

// Singleton: una sola instancia compartida
const roomManager = new RoomManager();

module.exports = roomManager;
// ============================================
// RUTAS HTTP - Gestión de salas
// ============================================

const { Router } = require("express");
const roomManager = require("../game/RoomManager");
const db = require("../database/db");

const router = Router();

// Obtener lista de salas activas
router.get("/active", (req, res) => {
    try {
        const rooms = roomManager.listActiveRooms();
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener lista de salas esperando jugadores
router.get("/waiting", (req, res) => {
    try {
        const rooms = roomManager.listWaitingRooms();
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener información de una sala específica
router.get("/:roomId", (req, res) => {
    try {
        const { roomId } = req.params;
        const room = roomManager.getRoom(roomId);
        
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json(room.getRoomInfo());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener estadísticas del servidor
router.get("/stats/summary", (req, res) => {
    try {
        const stats = roomManager.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener partidas finalizadas (replays disponibles)
router.get("/replays/list", async (req, res) => {
    try {
        const games = await db.callProcedure("sp_GetFinishedGames");
        res.json(games);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener replay de una partida
router.get("/replays/:gameId", async (req, res) => {
    try {
        const { gameId } = req.params;
        const replay = await db.callProcedure("sp_GetGameReplay", [gameId]);
        res.json(replay);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
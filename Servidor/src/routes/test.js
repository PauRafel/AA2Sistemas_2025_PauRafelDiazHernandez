const { Router } = require("express");
const db = require("../database/db");

const router = Router();

// Ruta de prueba: Obtener todos los usuarios
router.get("/users", async (req, res) => {
    try {
        const users = await db.query("SELECT user_id, username, email FROM Users");
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta de prueba: Obtener partidas activas usando SP
router.get("/active-games", async (req, res) => {
    try {
        const games = await db.callProcedure("sp_GetActiveGames");
        res.json(games);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
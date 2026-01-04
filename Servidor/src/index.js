// ============================================
// SERVIDOR NODE.JS - COLUMNS ONLINE
// ============================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const morgan = require("morgan");
const { networkInterfaces } = require("os");
const db = require("./database/db"); 
const setupSocketHandlers = require('./routes/socketHandler');


// Crear la aplicación Express
const app = express();

// Crear servidor HTTP y Socket.IO
const server = http.createServer(app);
const io = new Server(server);

// ============================================
// CONFIGURACIÓN (Settings)
// ============================================
app.set("port", process.env.PORT || 3000);
app.set("json spaces", 2);
app.set("io", io); // Guardamos io en app para usarlo en otros archivos

// ============================================
// MIDDLEWARES
// ============================================
app.use(morgan("dev")); // Logger de peticiones
app.use(express.urlencoded({ extended: false })); // Para procesar formularios
app.use(express.json()); // Para procesar JSON
app.use(express.static("src/public")); // Archivos estáticos (HTML, CSS, JS)

// ============================================
// RUTAS
// ============================================
app.get("/", (req, res) => {
    res.json({
        title: "Columns Online Server",
        status: "Running",
        version: "1.0.0"
    });
});

// Rutas de prueba
app.use("/api/test", require("./routes/test")); 

// Rutas de salas
app.use("/api/rooms", require("./routes/rooms"));

// ============================================
// SOCKET.IO - CONEXIONES EN TIEMPO REAL
// ============================================
setupSocketHandlers(io);

// ============================================
// INICIAR SERVIDOR
// ============================================
server.listen(app.get("port"), async () => {  // ← AGREGADO async
    const ip = getLocalIP();
    const port = app.get("port");
    console.log("╔════════════════════════════════════════╗");
    console.log("║   🎮 COLUMNS ONLINE SERVER 🎮         ║");
    console.log("╚════════════════════════════════════════╝");
    console.log(`🌐 Servidor en: http://${ip}:${port}/`);
    console.log(`📡 Socket.IO listo en el mismo puerto`);
    
    // ← AGREGADO: Probar conexión a la base de datos
    await db.testConnection();
    
    console.log("✨ Presiona Ctrl+C para detener");
    console.log("════════════════════════════════════════");
});

// ============================================
// FUNCIÓN AUXILIAR: Obtener IP local
// ============================================
function getLocalIP() {
    const nets = networkInterfaces();
    
    // Buscar la IP de la red local
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            const familyV4 = typeof net.family === "string" ? "IPv4" : 4;
            if (net.family === familyV4 && !net.internal) {
                return net.address;
            }
        }
    }
    return "localhost";
}
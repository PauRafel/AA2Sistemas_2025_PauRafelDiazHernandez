// ============================================
// CLASE ROOM - Gestiona una sala de juego
// ============================================

const ColumnsGame = require('./ColumnsGame');

class Room {
    constructor(roomId, creatorPlayer) {
        this.roomId = roomId;
        this.players = [creatorPlayer]; // Array de Player
        this.games = {}; // { userId: ColumnsGame }
        this.spectators = []; // Array de socketIds de espectadores (Unity)
        this.status = 'waiting'; // waiting, in_progress, finished
        this.isPaused = false;
        this.createdAt = new Date();
        this.gameLoopInterval = null;
        this.dbGameId = null; // ID de la partida en la base de datos
        this.moveCounter = {}; // Contador de movimientos por jugador
    }

    // Añadir jugador a la sala
    addPlayer(player) {
        if (this.players.length >= 2) {
            return { success: false, message: 'Room is full' };
        }
        
        if (this.status !== 'waiting') {
            return { success: false, message: 'Game already started' };
        }

        this.players.push(player);
        return { success: true };
    }

    // Quitar jugador de la sala
    removePlayer(userId) {
        const index = this.players.findIndex(p => p.userId === userId);
        if (index !== -1) {
            this.players.splice(index, 1);
            delete this.games[userId];
            delete this.moveCounter[userId];
            
            // Si se queda vacía, la sala debe cerrarse
            if (this.players.length === 0) {
                this.stopGame();
                return { success: true, shouldClose: true };
            }
            
            return { success: true, shouldClose: false };
        }
        return { success: false };
    }

    // Añadir espectador (cliente Unity)
    addSpectator(socketId) {
        if (!this.spectators.includes(socketId)) {
            this.spectators.push(socketId);
            console.log(`👁️  Espectador añadido a sala ${this.roomId}. Total: ${this.spectators.length}`);
            
            // Si el juego estaba pausado por falta de espectadores, reanudarlo
            if (this.isPaused && this.status === 'in_progress') {
                this.resumeGame();
            }
        }
    }

    // Quitar espectador
    removeSpectator(socketId) {
        const index = this.spectators.indexOf(socketId);
        if (index !== -1) {
            this.spectators.splice(index, 1);
            console.log(`👁️  Espectador removido de sala ${this.roomId}. Total: ${this.spectators.length}`);
            
            // Si no quedan espectadores y el juego está en progreso, pausar
            if (this.spectators.length === 0 && this.status === 'in_progress') {
                this.pauseGame();
            }
        }
    }

    // Iniciar el juego
    startGame() {
        if (this.players.length < 2) {
            return { success: false, message: 'Need 2 players to start' };
        }

        if (this.status !== 'waiting') {
            return { success: false, message: 'Game already started or finished' };
        }

        // Crear instancias de juego para cada jugador
        this.players.forEach(player => {
            this.games[player.userId] = new ColumnsGame(player);
            this.moveCounter[player.userId] = 0;
        });

        this.status = 'in_progress';
        
        // Si no hay espectadores, pausar inmediatamente
        if (this.spectators.length === 0) {
            this.isPaused = true;
            console.log(`⏸️  Juego en sala ${this.roomId} iniciado PAUSADO (sin espectadores)`);
        } else {
            this.startGameLoop();
        }

        return { success: true };
    }

    // Iniciar el loop del juego
    startGameLoop() {
        if (this.gameLoopInterval) return;

        console.log(`▶️  Game loop iniciado en sala ${this.roomId}`);
        this.gameLoopInterval = setInterval(() => {
            if (!this.isPaused) {
                this.updateGame();
            }
        }, 100); // Actualizar cada 100ms
    }

    // Pausar el juego
    pauseGame() {
        if (this.isPaused) return;
        
        this.isPaused = true;
        console.log(`⏸️  Juego pausado en sala ${this.roomId} (sin espectadores)`);
    }

    // Reanudar el juego
    resumeGame() {
        if (!this.isPaused) return;
        
        this.isPaused = false;
        console.log(`▶️  Juego reanudado en sala ${this.roomId}`);
        
        // Asegurarse de que el loop está corriendo
        if (!this.gameLoopInterval) {
            this.startGameLoop();
        }
    }

    // Detener el juego completamente
    stopGame() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
            console.log(`⏹️  Game loop detenido en sala ${this.roomId}`);
        }
    }

    // Actualizar estado del juego (llamado por el loop)
    updateGame() {
        let anyGameOver = false;

        // Actualizar cada juego
        for (const userId in this.games) {
            const game = this.games[userId];
            if (!game.isGameOver) {
                game.update();
            } else {
                anyGameOver = true;
            }
        }

        // Si algún juego terminó, finalizar la partida
        if (anyGameOver) {
            this.finishGame();
        }
    }

    // Procesar movimiento de jugador
    processPlayerMove(userId, moveType) {
        const game = this.games[userId];
        if (!game || game.isGameOver || this.isPaused) {
            return { success: false };
        }

        let moved = false;
        
        switch(moveType) {
            case 'move_left':
                moved = game.moveLeft();
                break;
            case 'move_right':
                moved = game.moveRight();
                break;
            case 'rotate':
                moved = game.rotate();
                break;
            case 'soft_drop':
                moved = game.softDrop();
                break;
            case 'hard_drop':
                moved = game.hardDrop();
                break;
        }

        if (moved) {
            // Incrementar contador de movimientos
            if (!this.moveCounter[userId]) {
                this.moveCounter[userId] = 0;
            }
            this.moveCounter[userId]++;
        }

        return { 
            success: true, 
            gameState: game.getGameState(),
            moveNumber: this.moveCounter[userId]
        };
    }

    // Finalizar el juego
    finishGame() {
        this.status = 'finished';
        this.stopGame();

        // Determinar ganador (mayor puntuación)
        let winner = null;
        let maxScore = -1;

        this.players.forEach(player => {
            if (player.score > maxScore) {
                maxScore = player.score;
                winner = player;
            }
        });

        console.log(`🏁 Juego finalizado en sala ${this.roomId}. Ganador: ${winner ? winner.username : 'Empate'}`);

        return {
            winner: winner,
            scores: this.players.map(p => ({
                userId: p.userId,
                username: p.username,
                score: p.score
            }))
        };
    }

    // Obtener información de la sala
    getRoomInfo() {
        return {
            roomId: this.roomId,
            status: this.status,
            isPaused: this.isPaused,
            playerCount: this.players.length,
            spectatorCount: this.spectators.length,
            players: this.players.map(p => p.getBasicInfo()),
            createdAt: this.createdAt
        };
    }

    // Obtener estado completo del juego para todos los jugadores
    getFullGameState() {
        const states = {};
        this.players.forEach(player => {
            const game = this.games[player.userId];
            if (game) {
                states[player.userId] = game.getGameState();
            }
        });
        return states;
    }

    // Verificar si la sala debe cerrarse
    shouldClose() {
        return this.players.length === 0 || 
               (this.status === 'finished' && this.spectators.length === 0);
    }
}

module.exports = Room;
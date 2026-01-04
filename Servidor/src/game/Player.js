// ============================================
// CLASE PLAYER - Representa un jugador
// ============================================

class Player {
    constructor(userId, username, socketId) {
        this.userId = userId;
        this.username = username;
        this.socketId = socketId;
        this.score = 0;
        this.isReady = false;
        this.grid = this.createEmptyGrid();
        this.currentPiece = null;
        this.nextPiece = null;
    }

    // Crear grid vacío 6x12
    createEmptyGrid() {
        const grid = [];
        for (let x = 0; x < 6; x++) {
            const column = [];
            for (let y = 0; y < 12; y++) {
                column.push({
                    x: x,
                    y: y,
                    type: 0 // 0 = vacío
                });
            }
            grid.push(column);
        }
        return grid;
    }

    // Obtener información básica del jugador
    getBasicInfo() {
        return {
            userId: this.userId,
            username: this.username,
            score: this.score,
            isReady: this.isReady
        };
    }

    // Obtener grid en formato para enviar
    getGridUpdate() {
        const updatedNodes = [];
        for (let x = 0; x < this.grid.length; x++) {
            for (let y = 0; y < this.grid[x].length; y++) {
                const node = this.grid[x][y];
                if (node.type !== 0) { // Solo enviar nodos no vacíos
                    updatedNodes.push({
                        x: node.x,
                        y: node.y,
                        type: node.type
                    });
                }
            }
        }
        return {
            playerId: this.userId,
            playerName: this.username,
            updatedNodes: updatedNodes
        };
    }

    // Resetear el grid
    resetGrid() {
        this.grid = this.createEmptyGrid();
        this.score = 0;
    }
}

module.exports = Player;
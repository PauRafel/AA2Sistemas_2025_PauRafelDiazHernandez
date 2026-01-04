// ============================================
// CLASE COLUMNSGAME - Lógica del juego Columns
// ============================================

const Piece = require('./Piece');

class ColumnsGame {
    constructor(player) {
        this.player = player;
        this.currentPiece = new Piece();
        this.nextPiece = new Piece();
        this.isGameOver = false;
        this.dropSpeed = 1000; // Milisegundos entre caídas automáticas
        this.lastDropTime = Date.now();
    }

    // Iniciar nueva pieza
    spawnNewPiece() {
        this.currentPiece = this.nextPiece;
        this.nextPiece = new Piece();
        
        // Verificar game over (si la nueva pieza colisiona al aparecer)
        if (this.checkCollision(this.currentPiece)) {
            this.isGameOver = true;
            return false;
        }
        return true;
    }

    // Verificar si una pieza colisiona con el grid
    checkCollision(piece, offsetX = 0, offsetY = 0) {
        const positions = piece.getPositions();
        
        for (const pos of positions) {
            const x = pos.x + offsetX;
            const y = pos.y + offsetY;
            
            // Fuera de límites
            if (x < 0 || x >= 6 || y < 0 || y >= 12) {
                return true;
            }
            
            // Colisión con gema existente
            if (this.player.grid[x] && this.player.grid[x][y] && this.player.grid[x][y].type !== 0) {
                return true;
            }
        }
        return false;
    }

    // Mover pieza a la izquierda
    moveLeft() {
        if (!this.checkCollision(this.currentPiece, -1, 0)) {
            this.currentPiece.moveLeft();
            return true;
        }
        return false;
    }

    // Mover pieza a la derecha
    moveRight() {
        if (!this.checkCollision(this.currentPiece, 1, 0)) {
            this.currentPiece.moveRight();
            return true;
        }
        return false;
    }

    // Rotar pieza
    rotate() {
        this.currentPiece.rotate();
        return true;
    }

    // Bajar pieza suavemente
    softDrop() {
        return this.drop();
    }

    // Bajar pieza hasta el fondo
    hardDrop() {
        let dropped = false;
        while (this.drop()) {
            dropped = true;
        }
        return dropped;
    }

    // Bajar pieza una posición
    drop() {
        if (!this.checkCollision(this.currentPiece, 0, 1)) {
            this.currentPiece.moveDown();
            this.lastDropTime = Date.now();
            return true;
        } else {
            // La pieza tocó fondo, fijarla al grid
            this.lockPiece();
            return false;
        }
    }

    // Fijar pieza al grid
    lockPiece() {
        const positions = this.currentPiece.getPositions();
        
        for (const pos of positions) {
            if (pos.y >= 0 && pos.y < 12) {
                this.player.grid[pos.x][pos.y].type = pos.type;
            }
        }

        // Verificar matches y eliminar gemas
        const matchesFound = this.checkAndRemoveMatches();
        
        // Aplicar gravedad
        if (matchesFound) {
            this.applyGravity();
        }

        // Generar nueva pieza
        this.spawnNewPiece();
    }

    // Verificar y eliminar matches (3 o más del mismo color)
    checkAndRemoveMatches() {
        const toRemove = new Set();
        
        // Verificar horizontal
        for (let y = 0; y < 12; y++) {
            for (let x = 0; x < 4; x++) {
                const type = this.player.grid[x][y].type;
                if (type !== 0) {
                    let count = 1;
                    const matches = [[x, y]];
                    
                    for (let i = x + 1; i < 6; i++) {
                        if (this.player.grid[i][y].type === type) {
                            count++;
                            matches.push([i, y]);
                        } else {
                            break;
                        }
                    }
                    
                    if (count >= 3) {
                        matches.forEach(([mx, my]) => toRemove.add(`${mx},${my}`));
                    }
                }
            }
        }

        // Verificar vertical
        for (let x = 0; x < 6; x++) {
            for (let y = 0; y < 10; y++) {
                const type = this.player.grid[x][y].type;
                if (type !== 0) {
                    let count = 1;
                    const matches = [[x, y]];
                    
                    for (let i = y + 1; i < 12; i++) {
                        if (this.player.grid[x][i].type === type) {
                            count++;
                            matches.push([x, i]);
                        } else {
                            break;
                        }
                    }
                    
                    if (count >= 3) {
                        matches.forEach(([mx, my]) => toRemove.add(`${mx},${my}`));
                    }
                }
            }
        }

        // Verificar diagonal (\)
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 10; y++) {
                const type = this.player.grid[x][y].type;
                if (type !== 0) {
                    let count = 1;
                    const matches = [[x, y]];
                    
                    for (let i = 1; x + i < 6 && y + i < 12; i++) {
                        if (this.player.grid[x + i][y + i].type === type) {
                            count++;
                            matches.push([x + i, y + i]);
                        } else {
                            break;
                        }
                    }
                    
                    if (count >= 3) {
                        matches.forEach(([mx, my]) => toRemove.add(`${mx},${my}`));
                    }
                }
            }
        }

        // Verificar diagonal (/)
        for (let x = 2; x < 6; x++) {
            for (let y = 0; y < 10; y++) {
                const type = this.player.grid[x][y].type;
                if (type !== 0) {
                    let count = 1;
                    const matches = [[x, y]];
                    
                    for (let i = 1; x - i >= 0 && y + i < 12; i++) {
                        if (this.player.grid[x - i][y + i].type === type) {
                            count++;
                            matches.push([x - i, y + i]);
                        } else {
                            break;
                        }
                    }
                    
                    if (count >= 3) {
                        matches.forEach(([mx, my]) => toRemove.add(`${mx},${my}`));
                    }
                }
            }
        }

        // Eliminar gemas marcadas
        if (toRemove.size > 0) {
            toRemove.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                this.player.grid[x][y].type = 0;
            });
            
            // Sumar puntos (10 puntos por gema)
            this.player.score += toRemove.size * 10;
            return true;
        }

        return false;
    }

    // Aplicar gravedad (hacer caer gemas flotantes)
    applyGravity() {
        for (let x = 0; x < 6; x++) {
            // Desde abajo hacia arriba
            for (let y = 11; y >= 0; y--) {
                if (this.player.grid[x][y].type === 0) {
                    // Buscar gema arriba para bajarla
                    for (let yy = y - 1; yy >= 0; yy--) {
                        if (this.player.grid[x][yy].type !== 0) {
                            this.player.grid[x][y].type = this.player.grid[x][yy].type;
                            this.player.grid[x][yy].type = 0;
                            break;
                        }
                    }
                }
            }
        }
    }

    // Actualizar juego (caída automática)
    update() {
        if (this.isGameOver) return false;

        const now = Date.now();
        if (now - this.lastDropTime >= this.dropSpeed) {
            this.drop();
        }

        return true;
    }

    // Obtener estado completo del juego
    getGameState() {
        return {
            grid: this.player.getGridUpdate(),
            currentPiece: this.currentPiece ? this.currentPiece.getPositions() : null,
            nextPiece: this.nextPiece ? this.nextPiece.gems : null,
            score: this.player.score,
            isGameOver: this.isGameOver
        };
    }
}

module.exports = ColumnsGame;
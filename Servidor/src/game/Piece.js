// ============================================
// CLASE PIECE - Representa una pieza (columna de 3 gemas)
// ============================================

class Piece {
    constructor() {
        // Tipos de gemas: 1=Red, 2=Green, 3=Blue, 4=Yellow, 5=Orange, 6=Purple
        this.gems = [
            this.randomGemType(),
            this.randomGemType(),
            this.randomGemType()
        ];
        this.x = 2; // Posición inicial (columna central)
        this.y = 0; // Posición inicial (arriba)
    }

    randomGemType() {
        return Math.floor(Math.random() * 6) + 1; // 1-6
    }

    // Rotar la pieza (la gema de abajo sube arriba)
    rotate() {
        const bottom = this.gems.pop();
        this.gems.unshift(bottom);
    }

    // Mover a la izquierda
    moveLeft() {
        if (this.x > 0) {
            this.x--;
            return true;
        }
        return false;
    }

    // Mover a la derecha
    moveRight(maxX = 5) {
        if (this.x < maxX) {
            this.x++;
            return true;
        }
        return false;
    }

    // Bajar una posición
    moveDown() {
        this.y++;
    }

    // Obtener posiciones de las 3 gemas
    getPositions() {
        return [
            { x: this.x, y: this.y, type: this.gems[0] },
            { x: this.x, y: this.y + 1, type: this.gems[1] },
            { x: this.x, y: this.y + 2, type: this.gems[2] }
        ];
    }

    // Clonar la pieza
    clone() {
        const newPiece = new Piece();
        newPiece.gems = [...this.gems];
        newPiece.x = this.x;
        newPiece.y = this.y;
        return newPiece;
    }
}

module.exports = Piece;
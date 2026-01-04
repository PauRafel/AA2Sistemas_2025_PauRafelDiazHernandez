-- ============================================
-- SCRIPT DE CREACIÓN DE BASE DE DATOS
-- Proyecto: Columns Online
-- ============================================

-- Crear la base de datos
DROP DATABASE IF EXISTS ColumnsOnlineDB;
CREATE DATABASE ColumnsOnlineDB;
USE ColumnsOnlineDB;

-- ============================================
-- TABLA: Users
-- Almacena información de los usuarios
-- ============================================
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- TABLA: Games
-- Almacena información de las partidas
-- ============================================
CREATE TABLE Games (
    game_id INT AUTO_INCREMENT PRIMARY KEY,
    player1_id INT NOT NULL,
    player2_id INT,
    player1_score INT DEFAULT 0,
    player2_score INT DEFAULT 0,
    winner_id INT,
    game_status ENUM('waiting', 'in_progress', 'finished') DEFAULT 'waiting',
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (player2_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES Users(user_id) ON DELETE SET NULL,
    INDEX idx_game_status (game_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- TABLA: GameplayHistory
-- Almacena el histórico de movimientos para replays
-- ============================================
CREATE TABLE GameplayHistory (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    player_id INT NOT NULL,
    move_number INT NOT NULL,
    move_type ENUM('move_left', 'move_right', 'rotate', 'drop', 'soft_drop') NOT NULL,
    grid_state JSON NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES Games(game_id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    INDEX idx_game_id (game_id),
    INDEX idx_move_number (move_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- INSERTAR DATOS DE PRUEBA
-- ============================================

-- Usuarios de prueba
INSERT INTO Users (username, password_hash, email) VALUES
('player1', SHA2('password123', 256), 'player1@test.com'),
('player2', SHA2('password123', 256), 'player2@test.com'),
('player3', SHA2('password123', 256), 'player3@test.com'),
('spectator1', SHA2('password123', 256), 'spectator@test.com');

-- Partida de prueba finalizada
INSERT INTO Games (player1_id, player2_id, player1_score, player2_score, winner_id, game_status, started_at, finished_at) VALUES
(1, 2, 1500, 1200, 1, 'finished', NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 30 MINUTE);

-- Partida en progreso
INSERT INTO Games (player1_id, player2_id, game_status, started_at) VALUES
(2, 3, 'in_progress', NOW() - INTERVAL 10 MINUTE);

-- Partida en espera
INSERT INTO Games (player1_id, game_status) VALUES
(1, 'waiting');

-- Histórico de ejemplo para la partida finalizada
INSERT INTO GameplayHistory (game_id, player_id, move_number, move_type, grid_state) VALUES
(1, 1, 1, 'move_left', '{"playerId":1,"playerName":"player1","updatedNodes":[]}'),
(1, 1, 2, 'rotate', '{"playerId":1,"playerName":"player1","updatedNodes":[]}'),
(1, 2, 1, 'move_right', '{"playerId":2,"playerName":"player2","updatedNodes":[]}'),
(1, 1, 3, 'drop', '{"playerId":1,"playerName":"player1","updatedNodes":[]}');

-- ============================================
-- VERIFICACIÓN
-- ============================================
SELECT 'Base de datos creada correctamente' AS Status;
SELECT COUNT(*) AS TotalUsers FROM Users;
SELECT COUNT(*) AS TotalGames FROM Games;
SELECT COUNT(*) AS TotalMoves FROM GameplayHistory;
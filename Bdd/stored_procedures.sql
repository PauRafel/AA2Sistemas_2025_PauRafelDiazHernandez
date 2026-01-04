-- ============================================
-- STORED PROCEDURES - Columns Online
-- ============================================

USE ColumnsOnlineDB;

-- Eliminar procedures si existen
DROP PROCEDURE IF EXISTS sp_CreateUser;
DROP PROCEDURE IF EXISTS sp_LoginUser;
DROP PROCEDURE IF EXISTS sp_GetUserInfo;
DROP PROCEDURE IF EXISTS sp_CreateGame;
DROP PROCEDURE IF EXISTS sp_GetActiveGames;
DROP PROCEDURE IF EXISTS sp_GetGameInfo;
DROP PROCEDURE IF EXISTS sp_UpdateGameStatus;
DROP PROCEDURE IF EXISTS sp_SaveGameMove;
DROP PROCEDURE IF EXISTS sp_GetGameReplay;
DROP PROCEDURE IF EXISTS sp_GetFinishedGames;

DELIMITER $$

-- ============================================
-- SP: Crear Usuario
-- ============================================
CREATE PROCEDURE sp_CreateUser(
    IN p_username VARCHAR(50),
    IN p_password VARCHAR(255),
    IN p_email VARCHAR(100)
)
BEGIN
    DECLARE v_user_id INT;
    
    -- Verificar si el usuario ya existe
    IF EXISTS (SELECT 1 FROM Users WHERE username = p_username) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Username already exists';
    END IF;
    
    -- Insertar usuario con password hasheada
    INSERT INTO Users (username, password_hash, email)
    VALUES (p_username, SHA2(p_password, 256), p_email);
    
    SET v_user_id = LAST_INSERT_ID();
    
    -- Retornar información del usuario creado
    SELECT user_id, username, email, created_at
    FROM Users
    WHERE user_id = v_user_id;
END$$

-- ============================================
-- SP: Login de Usuario
-- ============================================
CREATE PROCEDURE sp_LoginUser(
    IN p_username VARCHAR(50),
    IN p_password VARCHAR(255)
)
BEGIN
    DECLARE v_user_id INT;
    
    -- Verificar credenciales
    SELECT user_id INTO v_user_id
    FROM Users
    WHERE username = p_username
    AND password_hash = SHA2(p_password, 256);
    
    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid credentials';
    END IF;
    
    -- Actualizar último login
    UPDATE Users
    SET last_login = CURRENT_TIMESTAMP
    WHERE user_id = v_user_id;
    
    -- Retornar información del usuario
    SELECT user_id, username, email, last_login
    FROM Users
    WHERE user_id = v_user_id;
END$$

-- ============================================
-- SP: Obtener información de usuario
-- ============================================
CREATE PROCEDURE sp_GetUserInfo(
    IN p_user_id INT
)
BEGIN
    SELECT user_id, username, email, created_at, last_login
    FROM Users
    WHERE user_id = p_user_id;
END$$

-- ============================================
-- SP: Crear una partida
-- ============================================
CREATE PROCEDURE sp_CreateGame(
    IN p_player1_id INT
)
BEGIN
    DECLARE v_game_id INT;
    
    INSERT INTO Games (player1_id, game_status)
    VALUES (p_player1_id, 'waiting');
    
    SET v_game_id = LAST_INSERT_ID();
    
    SELECT game_id, player1_id, game_status, created_at
    FROM Games
    WHERE game_id = v_game_id;
END$$

-- ============================================
-- SP: Obtener partidas activas (en espera o en progreso)
-- ============================================
CREATE PROCEDURE sp_GetActiveGames()
BEGIN
    SELECT 
        g.game_id,
        g.game_status,
        u1.username AS player1_name,
        u2.username AS player2_name,
        g.player1_score,
        g.player2_score,
        g.started_at,
        g.created_at
    FROM Games g
    INNER JOIN Users u1 ON g.player1_id = u1.user_id
    LEFT JOIN Users u2 ON g.player2_id = u2.user_id
    WHERE g.game_status IN ('waiting', 'in_progress')
    ORDER BY g.created_at DESC;
END$$

-- ============================================
-- SP: Obtener información de una partida
-- ============================================
CREATE PROCEDURE sp_GetGameInfo(
    IN p_game_id INT
)
BEGIN
    SELECT 
        g.game_id,
        g.game_status,
        g.player1_id,
        u1.username AS player1_name,
        g.player2_id,
        u2.username AS player2_name,
        g.player1_score,
        g.player2_score,
        g.winner_id,
        u3.username AS winner_name,
        g.started_at,
        g.finished_at,
        g.created_at
    FROM Games g
    INNER JOIN Users u1 ON g.player1_id = u1.user_id
    LEFT JOIN Users u2 ON g.player2_id = u2.user_id
    LEFT JOIN Users u3 ON g.winner_id = u3.user_id
    WHERE g.game_id = p_game_id;
END$$

-- ============================================
-- SP: Actualizar estado de la partida
-- ============================================
CREATE PROCEDURE sp_UpdateGameStatus(
    IN p_game_id INT,
    IN p_player2_id INT,
    IN p_status ENUM('waiting', 'in_progress', 'finished'),
    IN p_winner_id INT,
    IN p_player1_score INT,
    IN p_player2_score INT
)
BEGIN
    UPDATE Games
    SET 
        player2_id = COALESCE(p_player2_id, player2_id),
        game_status = p_status,
        winner_id = p_winner_id,
        player1_score = COALESCE(p_player1_score, player1_score),
        player2_score = COALESCE(p_player2_score, player2_score),
        started_at = CASE 
            WHEN p_status = 'in_progress' AND started_at IS NULL 
            THEN CURRENT_TIMESTAMP 
            ELSE started_at 
        END,
        finished_at = CASE 
            WHEN p_status = 'finished' 
            THEN CURRENT_TIMESTAMP 
            ELSE finished_at 
        END
    WHERE game_id = p_game_id;
    
    -- Retornar la partida actualizada
    CALL sp_GetGameInfo(p_game_id);
END$$

-- ============================================
-- SP: Guardar movimiento del juego
-- ============================================
CREATE PROCEDURE sp_SaveGameMove(
    IN p_game_id INT,
    IN p_player_id INT,
    IN p_move_number INT,
    IN p_move_type ENUM('move_left', 'move_right', 'rotate', 'drop', 'soft_drop'),
    IN p_grid_state JSON
)
BEGIN
    INSERT INTO GameplayHistory (game_id, player_id, move_number, move_type, grid_state)
    VALUES (p_game_id, p_player_id, p_move_number, p_move_type, p_grid_state);
    
    SELECT LAST_INSERT_ID() AS history_id;
END$$

-- ============================================
-- SP: Obtener replay de una partida
-- ============================================
CREATE PROCEDURE sp_GetGameReplay(
    IN p_game_id INT
)
BEGIN
    SELECT 
        gh.history_id,
        gh.game_id,
        gh.player_id,
        u.username AS player_name,
        gh.move_number,
        gh.move_type,
        gh.grid_state,
        gh.timestamp
    FROM GameplayHistory gh
    INNER JOIN Users u ON gh.player_id = u.user_id
    WHERE gh.game_id = p_game_id
    ORDER BY gh.move_number ASC;
END$$

-- ============================================
-- SP: Obtener partidas finalizadas
-- ============================================
CREATE PROCEDURE sp_GetFinishedGames()
BEGIN
    SELECT 
        g.game_id,
        u1.username AS player1_name,
        u2.username AS player2_name,
        g.player1_score,
        g.player2_score,
        u3.username AS winner_name,
        g.started_at,
        g.finished_at,
        TIMESTAMPDIFF(MINUTE, g.started_at, g.finished_at) AS duration_minutes
    FROM Games g
    INNER JOIN Users u1 ON g.player1_id = u1.user_id
    LEFT JOIN Users u2 ON g.player2_id = u2.user_id
    LEFT JOIN Users u3 ON g.winner_id = u3.user_id
    WHERE g.game_status = 'finished'
    ORDER BY g.finished_at DESC
    LIMIT 50;
END$$

DELIMITER ;

-- ============================================
-- VERIFICACIÓN
-- ============================================
SELECT 'Stored Procedures creados correctamente' AS Status;

-- Mostrar todos los procedures
SHOW PROCEDURE STATUS WHERE Db = 'ColumnsOnlineDB';
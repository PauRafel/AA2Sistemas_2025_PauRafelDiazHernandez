// ============================================
// SOCKET HANDLER - Maneja eventos de Socket.IO
// ============================================

const Player = require('../game/Player');
const roomManager = require('../game/RoomManager');
const db = require('../database/db');

function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        const address = socket.request.connection;
        console.log(`✅ Socket conectado: ${socket.id} [${address.remoteAddress}:${address.remotePort}]`);

        // ==========================================
        // EVENTOS DE SALA
        // ==========================================

        // Crear una nueva sala
        socket.on('create_room', async (data) => {
            try {
                const { userId, username } = data;
                
                if (!userId || !username) {
                    socket.emit('error', { message: 'userId and username are required' });
                    return;
                }

                // Verificar que el usuario no esté ya en una sala
                const existingRoom = roomManager.getRoomByPlayer(userId);
                if (existingRoom) {
                    socket.emit('error', { message: 'Already in a room' });
                    return;
                }

                const player = new Player(userId, username, socket.id);
                const result = roomManager.createRoom(player);

                if (result.success) {
                    socket.join(result.roomId);
                    socket.emit('room_created', {
                        roomId: result.roomId,
                        roomInfo: result.room.getRoomInfo()
                    });

                    // Notificar a todos que hay una nueva sala
                    io.emit('room_list_updated', roomManager.listActiveRooms());
                }
            } catch (error) {
                console.error('Error en create_room:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // Unirse a una sala existente
        socket.on('join_room', async (data) => {
            try {
                const { roomId, userId, username } = data;

                if (!roomId || !userId || !username) {
                    socket.emit('error', { message: 'roomId, userId and username are required' });
                    return;
                }

                const player = new Player(userId, username, socket.id);
                const result = roomManager.joinRoom(roomId, player);

                if (result.success) {
                    socket.join(roomId);
                    
                    const room = roomManager.getRoom(roomId);
                    const roomInfo = room.getRoomInfo();

                    socket.emit('room_joined', { roomInfo });
                    
                    // Notificar a todos en la sala
                    io.to(roomId).emit('player_joined', {
                        player: player.getBasicInfo(),
                        roomInfo
                    });

                    // Actualizar lista global
                    io.emit('room_list_updated', roomManager.listActiveRooms());

                    // Si ya hay 2 jugadores, iniciar el juego automáticamente
                    if (room.players.length === 2) {
                        startGameInRoom(room, io);
                    }
                } else {
                    socket.emit('error', { message: result.message });
                }
            } catch (error) {
                console.error('Error en join_room:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // Salir de una sala
        socket.on('leave_room', (data) => {
            try {
                const { userId } = data;
                const room = roomManager.getRoomByPlayer(userId);

                if (room) {
                    const roomId = room.roomId;
                    roomManager.leaveRoom(userId);
                    
                    socket.leave(roomId);
                    socket.emit('room_left', { roomId });
                    
                    // Notificar a los demás
                    io.to(roomId).emit('player_left', { 
                        userId,
                        roomInfo: roomManager.getRoom(roomId)?.getRoomInfo()
                    });

                    // Actualizar lista global
                    io.emit('room_list_updated', roomManager.listActiveRooms());
                }
            } catch (error) {
                console.error('Error en leave_room:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // Listar salas disponibles
        socket.on('list_rooms', () => {
            try {
                const rooms = roomManager.listActiveRooms();
                socket.emit('room_list', rooms);
            } catch (error) {
                console.error('Error en list_rooms:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // ==========================================
        // EVENTOS DE JUEGO
        // ==========================================

        // Enviar comando de juego
        socket.on('game_command', async (data) => {
            try {
                const { userId, command } = data;
                // command: 'move_left', 'move_right', 'rotate', 'soft_drop', 'hard_drop'

                const room = roomManager.getRoomByPlayer(userId);
                if (!room) {
                    socket.emit('error', { message: 'Not in a room' });
                    return;
                }

                if (room.status !== 'in_progress') {
                    socket.emit('error', { message: 'Game not in progress' });
                    return;
                }

                // Procesar el movimiento
                const result = room.processPlayerMove(userId, command);

                if (result.success) {
                    // Enviar actualización a todos (jugadores y espectadores)
                    io.to(room.roomId).emit('game_update', {
                        userId,
                        gameState: result.gameState,
                        moveNumber: result.moveNumber
                    });

                    // Guardar movimiento en la base de datos (async, no bloqueante)
                    if (room.dbGameId) {
                        saveGameMove(room.dbGameId, userId, result.moveNumber, command, result.gameState)
                            .catch(err => console.error('Error guardando movimiento:', err));
                    }
                }
            } catch (error) {
                console.error('Error en game_command:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // ==========================================
        // EVENTOS DE ESPECTADOR (Cliente Unity)
        // ==========================================

        // Unirse como espectador
        socket.on('spectate_room', (data) => {
            try {
                const { roomId } = data;

                const result = roomManager.addSpectator(roomId, socket.id);

                if (result.success) {
                    socket.join(roomId);
                    
                    const room = result.room;
                    socket.emit('spectate_started', {
                        roomInfo: room.getRoomInfo(),
                        gameStates: room.getFullGameState()
                    });

                    // Si el juego estaba pausado, notificar que se reanudó
                    if (!room.isPaused) {
                        io.to(roomId).emit('game_resumed');
                    }
                } else {
                    socket.emit('error', { message: result.message });
                }
            } catch (error) {
                console.error('Error en spectate_room:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // Dejar de espectador
        socket.on('stop_spectating', (data) => {
            try {
                const { roomId } = data;
                
                roomManager.removeSpectator(roomId, socket.id);
                socket.leave(roomId);
                
                const room = roomManager.getRoom(roomId);
                if (room && room.isPaused) {
                    // Notificar a los jugadores que el juego está pausado
                    io.to(roomId).emit('game_paused', { 
                        reason: 'No spectators watching' 
                    });
                }
            } catch (error) {
                console.error('Error en stop_spectating:', error);
            }
        });

        // ==========================================
        // EVENTOS DE DESCONEXIÓN
        // ==========================================

        socket.on('disconnect', () => {
            console.log(`❌ Socket desconectado: ${socket.id}`);
            
            // Limpiar jugador si estaba en una sala
            const room = roomManager.getRoomBySocket(socket.id);
            if (room) {
                roomManager.cleanupPlayer(socket.id);
                
                // Notificar a la sala
                io.to(room.roomId).emit('player_disconnected', {
                    roomInfo: roomManager.getRoom(room.roomId)?.getRoomInfo()
                });

                // Actualizar lista global
                io.emit('room_list_updated', roomManager.listActiveRooms());
            }

            // Limpiar espectador
            roomManager.rooms.forEach(room => {
                if (room.spectators.includes(socket.id)) {
                    room.removeSpectator(socket.id);
                }
            });
        });

        // ==========================================
        // EVENTOS DE PRUEBA
        // ==========================================

        socket.on('test_message', (msg) => {
            console.log('📨 Test message:', msg);
            socket.emit('test_response', { message: 'Server received: ' + msg });
        });

        socket.on('get_stats', () => {
            socket.emit('stats', roomManager.getStats());
        });
    });
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

// Iniciar juego en una sala
async function startGameInRoom(room, io) {
    try {
        const result = room.startGame();

        if (result.success) {
            // Crear partida en la base de datos
            const player1 = room.players[0];
            const player2 = room.players[1];

            try {
                const dbResult = await db.callProcedure('sp_CreateGame', [player1.userId]);
                const gameId = dbResult[0].game_id;

                // Actualizar con el segundo jugador e iniciar
                await db.callProcedure('sp_UpdateGameStatus', [
                    gameId,
                    player2.userId,
                    'in_progress',
                    null, // winner_id
                    0,    // player1_score
                    0     // player2_score
                ]);

                room.dbGameId = gameId;
                console.log(`🎮 Partida iniciada en BD: game_id=${gameId}`);
            } catch (dbError) {
                console.error('Error creando partida en BD:', dbError);
            }

            // Notificar a todos en la sala
            io.to(room.roomId).emit('game_started', {
                roomInfo: room.getRoomInfo(),
                gameStates: room.getFullGameState()
            });

            // Si no hay espectadores, notificar pausa
            if (room.isPaused) {
                io.to(room.roomId).emit('game_paused', {
                    reason: 'No spectators watching'
                });
            }

            // Actualizar lista global
            io.emit('room_list_updated', roomManager.listActiveRooms());
        }
    } catch (error) {
        console.error('Error iniciando juego:', error);
    }
}

// Guardar movimiento en la base de datos
async function saveGameMove(gameId, userId, moveNumber, moveType, gameState) {
    try {
        const gridStateJson = JSON.stringify(gameState.grid);
        
        await db.callProcedure('sp_SaveGameMove', [
            gameId,
            userId,
            moveNumber,
            moveType,
            gridStateJson
        ]);
    } catch (error) {
        console.error('Error guardando movimiento:', error);
    }
}

module.exports = setupSocketHandlers;
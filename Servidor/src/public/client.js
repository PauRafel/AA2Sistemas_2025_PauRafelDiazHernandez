// ============================================
// CLIENTE WEB - COLUMNS ONLINE
// ============================================

let socket = null;
let currentUser = null;
let currentRoom = null;

// ==========================================
// INICIALIZACIÓN
// ==========================================

// Conectar socket cuando se haga login
function initSocket() {
    socket = io();

    // Eventos de conexión
    socket.on('connect', () => {
        console.log('✅ Conectado al servidor');
    });

    socket.on('disconnect', () => {
        console.log('❌ Desconectado del servidor');
        showAlert('Desconectado del servidor', 'error');
    });

    // Eventos de error
    socket.on('error', (data) => {
        console.error('❌ Error:', data.message);
        showAlert(data.message, 'error');
    });

    // Eventos de sala
    socket.on('room_created', (data) => {
        console.log('🚪 Sala creada:', data);
        currentRoom = data.roomInfo;
        showRoomSection();
        showAlert('Sala creada exitosamente', 'success');
    });

    socket.on('room_joined', (data) => {
        console.log('🚪 Unido a sala:', data);
        currentRoom = data.roomInfo;
        showRoomSection();
        showAlert('Te uniste a la sala', 'success');
    });

    socket.on('room_left', (data) => {
        console.log('🚪 Saliste de la sala:', data);
        currentRoom = null;
        showLobbySection();
        refreshRooms();
    });

    socket.on('player_joined', (data) => {
        console.log('👤 Jugador se unió:', data);
        currentRoom = data.roomInfo;
        updateRoomInfo();
        showAlert(`${data.player.username} se unió a la sala`, 'success');
    });

    socket.on('player_left', (data) => {
        console.log('👤 Jugador salió:', data);
        if (data.roomInfo) {
            currentRoom = data.roomInfo;
            updateRoomInfo();
        }
    });

    socket.on('player_disconnected', (data) => {
        console.log('👤 Jugador desconectado:', data);
        showAlert('Un jugador se desconectó', 'warning');
        if (data.roomInfo) {
            currentRoom = data.roomInfo;
            updateRoomInfo();
        }
    });

    // Eventos de juego
    socket.on('game_started', (data) => {
        console.log('🎮 Juego iniciado:', data);
        currentRoom = data.roomInfo;
        updateRoomInfo();
        showGameControls();
        showAlert('¡El juego ha comenzado!', 'success');
    });

    socket.on('game_update', (data) => {
        console.log('🎮 Actualización:', data);
        // Actualizar puntuación si es nuestro jugador
        if (data.userId === currentUser.userId) {
            updateScore(data.gameState.score);
        }
    });

    socket.on('game_paused', (data) => {
        console.log('⏸️ Juego pausado:', data);
        showAlert('Juego pausado: ' + data.reason, 'warning');
    });

    socket.on('game_resumed', () => {
        console.log('▶️ Juego reanudado');
        showAlert('Juego reanudado', 'success');
    });

    socket.on('room_list_updated', (rooms) => {
        console.log('📋 Lista de salas actualizada');
        if (document.getElementById('lobbySection').classList.contains('active')) {
            displayRooms(rooms);
        }
    });
}

// ==========================================
// FUNCIONES DE NAVEGACIÓN
// ==========================================

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

function showLoginSection() {
    showSection('loginSection');
}

function showLobbySection() {
    showSection('lobbySection');
    document.getElementById('currentUsername').textContent = currentUser.username;
    document.getElementById('currentUserId').textContent = currentUser.userId;
    refreshRooms();
}

function showRoomSection() {
    showSection('roomSection');
    updateRoomInfo();
}

// ==========================================
// AUTENTICACIÓN
// ==========================================

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        showAlert('Por favor ingresa usuario y contraseña', 'error');
        return;
    }

    try {
        const response = await fetch('/api/test/users');
        const users = await response.json();
        
        // Buscar usuario (simulación simple)
        const user = users.find(u => u.username === username);
        
        if (user) {
            currentUser = {
                userId: user.user_id,
                username: user.username
            };
            
            // Inicializar socket
            initSocket();
            
            showLobbySection();
            showAlert('Bienvenido ' + username, 'success');
        } else {
            showAlert('Usuario no encontrado', 'error');
        }
    } catch (error) {
        console.error('Error en login:', error);
        showAlert('Error al iniciar sesión', 'error');
    }
}

function logout() {
    if (currentRoom) {
        leaveRoom();
    }
    
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    currentUser = null;
    showLoginSection();
    showAlert('Sesión cerrada', 'success');
}

// ==========================================
// GESTIÓN DE SALAS
// ==========================================

async function refreshRooms() {
    try {
        const response = await fetch('/api/rooms/active');
        const rooms = await response.json();
        displayRooms(rooms);
    } catch (error) {
        console.error('Error cargando salas:', error);
        showAlert('Error al cargar las salas', 'error');
    }
}

function displayRooms(rooms) {
    const roomList = document.getElementById('roomList');
    
    if (rooms.length === 0) {
        roomList.innerHTML = '<div class="loading">No hay salas disponibles. ¡Crea una!</div>';
        return;
    }

    roomList.innerHTML = rooms.map(room => `
        <div class="room-item" onclick="joinRoom('${room.roomId}')">
            <h3>${room.roomId}</h3>
            <p>👥 Jugadores: ${room.playerCount}/2</p>
            <p>👁️ Espectadores: ${room.spectatorCount}</p>
            <span class="status ${room.status}">${getStatusText(room.status)}</span>
            ${room.isPaused ? '<span class="status waiting">⏸️ Pausado</span>' : ''}
        </div>
    `).join('');
}

function getStatusText(status) {
    const statusMap = {
        'waiting': '⏳ Esperando',
        'in_progress': '🎮 En juego',
        'finished': '✅ Finalizada'
    };
    return statusMap[status] || status;
}

function createRoom() {
    if (!socket) return;
    
    socket.emit('create_room', {
        userId: currentUser.userId,
        username: currentUser.username
    });
}

function joinRoom(roomId) {
    if (!socket) return;
    
    socket.emit('join_room', {
        roomId: roomId,
        userId: currentUser.userId,
        username: currentUser.username
    });
}

function leaveRoom() {
    if (!socket || !currentRoom) return;
    
    socket.emit('leave_room', {
        userId: currentUser.userId
    });
}

function updateRoomInfo() {
    if (!currentRoom) return;
    
    document.getElementById('roomId').textContent = currentRoom.roomId;
    document.getElementById('roomStatus').textContent = getStatusText(currentRoom.status);
    document.getElementById('playerCount').textContent = `${currentRoom.playerCount}/2`;

    // Si el juego está en progreso, mostrar controles
    if (currentRoom.status === 'in_progress') {
        showGameControls();
    }
}

function showGameControls() {
    document.getElementById('gameControls').style.display = 'block';
    document.getElementById('scoreDisplay').style.display = 'block';
}

function updateScore(score) {
    document.getElementById('playerScore').textContent = score;
}

// ==========================================
// CONTROLES DEL JUEGO
// ==========================================

function sendCommand(command) {
    if (!socket || !currentRoom) return;
    
    socket.emit('game_command', {
        userId: currentUser.userId,
        command: command
    });
}

// Controles de teclado
document.addEventListener('keydown', (event) => {
    // Solo si estamos en una sala y el juego está activo
    if (!currentRoom || currentRoom.status !== 'in_progress') return;
    
    switch(event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            sendCommand('move_left');
            break;
        case 'ArrowRight':
            event.preventDefault();
            sendCommand('move_right');
            break;
        case 'ArrowUp':
            event.preventDefault();
            sendCommand('rotate');
            break;
        case 'ArrowDown':
            event.preventDefault();
            sendCommand('soft_drop');
            break;
        case ' ':
            event.preventDefault();
            sendCommand('hard_drop');
            break;
    }
});

// ==========================================
// UTILIDADES
// ==========================================

function showAlert(message, type) {
    const alert = document.getElementById('alert');
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
    
    setTimeout(() => {
        alert.classList.remove('show');
    }, 3000);
}
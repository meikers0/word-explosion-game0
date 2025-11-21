
const socket = io();

// --- Elementos DOM ---
const screens = {
    login: document.getElementById('login-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen')
};

const inputs = {
    username: document.getElementById('username-input'),
    roomCode: document.getElementById('room-code-input'),
    word: document.getElementById('word-input'),
    customWordsToggle: document.getElementById('allow-custom-words-toggle')
};

const btns = {
    create: document.getElementById('create-room-btn'),
    join: document.getElementById('join-room-btn'),
    start: document.getElementById('start-btn'),
    surrender: document.getElementById('surrender-btn'),
    back: document.getElementById('back-to-lobby')
};

const displays = {
    loginError: document.getElementById('login-error'),
    roomCode: document.getElementById('display-room-code'),
    waitingPlayers: document.getElementById('players-list-waiting'),
    waitingStatus: document.getElementById('waiting-status'),
    syllable: document.getElementById('current-syllable'),
    bombTimer: document.getElementById('bomb-timer'),
    feedback: document.getElementById('feedback-msg'),
    activePlayers: document.getElementById('active-players-list'),
    bombGraphic: document.querySelector('.bomb-graphic'),
    winnerName: document.getElementById('winner-name'),
    gameOverOverlay: document.getElementById('game-over-overlay')
};

// --- Estado Local ---
let myPlayerId = null;
let isLeader = false;
let currentRoomState = null;
let timerInterval = null;
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- Sonidos (Sintetizados) ---
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    
    if (type === 'tick') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 1);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
        osc.start(now);
        osc.stop(now + 1);
    } else if (type === 'valid') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

// --- Funciones de Navegación ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// --- Event Listeners ---

// Login / Crear Sala
btns.create.addEventListener('click', () => {
    const name = inputs.username.value;
    if (name) {
        socket.emit('create_room', name);
    } else {
        displays.loginError.textContent = 'Ingresa un nombre';
    }
});

// Unirse a Sala
btns.join.addEventListener('click', () => {
    const name = inputs.username.value;
    const code = inputs.roomCode.value.toUpperCase();
    if (name && code.length === 4) {
        socket.emit('join_room', { playerName: name, roomId: code });
    } else {
        displays.loginError.textContent = 'Nombre y Código (4 letras) requeridos';
    }
});

// Configuración de Sala (Toggle) - Opción Líder
inputs.customWordsToggle.addEventListener('change', (e) => {
    if (isLeader) {
        socket.emit('toggle_settings', { allowCustomWords: e.target.checked });
    } else {
        // Revertir visualmente si no es líder y trata de cambiarlo (backup)
        e.target.checked = !e.target.checked;
    }
});

// Iniciar Juego
btns.start.addEventListener('click', () => {
    if (isLeader) {
        displays.waitingStatus.textContent = 'Iniciando partida...';
        socket.emit('start_game');
    }
});

// Input de Palabra
inputs.word.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const word = inputs.word.value;
        if (word) {
            socket.emit('submit_word', word);
            inputs.word.value = '';
        }
    }
});

// Rendirse
btns.surrender.addEventListener('click', () => {
    socket.emit('surrender');
});

// Volver al Lobby
btns.back.addEventListener('click', () => {
    if (confirm("¿Seguro que quieres volver a la sala de espera?")) {
        displays.gameOverOverlay.classList.add('hidden');
        showScreen('waiting');
    }
});

// --- Socket Events ---

socket.on('room_joined', (data) => {
    myPlayerId = socket.id;
    isLeader = data.isLeader;
    displays.roomCode.textContent = data.roomId;
    showScreen('waiting');
    
    // Configurar UI para líder
    if (isLeader) {
        btns.start.classList.remove('hidden');
        inputs.customWordsToggle.disabled = false;
    } else {
        btns.start.classList.add('hidden');
        inputs.customWordsToggle.disabled = true;
    }
});

socket.on('error_msg', (msg) => {
    displays.loginError.textContent = msg;
});

socket.on('state_update', (state) => {
    currentRoomState = state;
    renderState(state);
});

socket.on('word_accepted', () => {
    playSound('valid');
    displays.feedback.textContent = '¡Correcto!';
    displays.feedback.style.color = 'var(--success)';
    
    // Animación de pase
    displays.bombGraphic.classList.add('passing');
    setTimeout(() => displays.bombGraphic.classList.remove('passing'), 500);
});

socket.on('word_rejected', (msg) => {
    displays.feedback.textContent = msg;
    displays.feedback.style.color = 'var(--accent)';
    inputs.word.classList.add('shake');
    setTimeout(() => inputs.word.classList.remove('shake'), 500);
});

socket.on('explosion', (data) => {
    playSound('explosion');
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 500);
    
    if (data.victimId === myPlayerId) {
        inputs.word.disabled = true;
        inputs.word.placeholder = "¡BOOM! Perdiste una vida";
    }
});

socket.on('game_over', (data) => {
    displays.winnerName.textContent = data.winner === 'Nadie' ? '¡Empate!' : `¡Ganador: ${data.winner}!`;
    displays.gameOverOverlay.classList.remove('hidden');
    clearInterval(timerInterval);
});

// --- Render Logic ---

function renderState(state) {
    // 1. Actualizar Configuración en UI (para todos)
    inputs.customWordsToggle.checked = state.allowCustomWords;

    // 2. Pantalla de Espera
    if (state.status === 'waiting') {
        displays.waitingPlayers.innerHTML = state.players.map(p => `
            <div class="player-card">
                <div class="player-avatar">${p.avatar}</div>
                <div class="player-name">${p.name}</div>
                ${p.isLeader ? '👑' : ''}
            </div>
        `).join('');
        
        // Si soy líder, actualizar estado del botón start
        if (isLeader) {
            btns.start.disabled = state.players.length < 2;
        }
        
        // Reset UI de juego
        displays.gameOverOverlay.classList.add('hidden');
    }

    // 3. Pantalla de Juego
    if (state.status === 'playing') {
        if (!screens.game.classList.contains('active')) {
            showScreen('game');
        }

        // Datos de ronda
        displays.syllable.textContent = state.currentSyllable;
        
        const currentPlayer = state.players[state.currentTurnIndex];
        const isMyTurn = currentPlayer.id === myPlayerId;

        inputs.word.disabled = !isMyTurn;
        btns.surrender.disabled = !isMyTurn;
        
        if (isMyTurn) {
            inputs.word.focus();
            inputs.word.placeholder = `Escribe una palabra con ${state.currentSyllable}...`;
            displays.feedback.textContent = '';
        } else {
            inputs.word.placeholder = `Turno de ${currentPlayer.name}`;
            inputs.word.value = '';
        }

        // Render Lista Jugadores (Footer)
        renderActivePlayers(state.players, state.currentTurnIndex);

        // Timer Visual
        handleTimer(state.bombEndTime);
    }
}

function renderActivePlayers(players, turnIndex) {
    displays.activePlayers.innerHTML = players.map((p, i) => {
        const isActive = i === turnIndex;
        const isDead = p.lives <= 0;
        const hearts = '❤️'.repeat(p.lives) + '🖤'.repeat(3 - p.lives);
        
        return `
            <div id="player-card-${i}" class="player-card ${isActive ? 'active-turn' : ''} ${isDead ? 'eliminated' : ''}">
                <div class="player-avatar">${p.avatar}</div>
                <div class="player-name">${p.name}</div>
                <div class="player-lives">${hearts}</div>
            </div>
        `;
    }).join('');

    // Scroll Suave para centrar al jugador activo
    const activeCard = document.getElementById(`player-card-${turnIndex}`);
    if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
}

function handleTimer(endTime) {
    if (timerInterval) clearInterval(timerInterval);

    const update = () => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        const seconds = (remaining / 1000).toFixed(2);
        
        displays.bombTimer.textContent = `${seconds}s`;

        // Efectos visuales del timer
        if (remaining < 5000) {
            displays.bombTimer.classList.add('urgent');
            displays.bombGraphic.classList.add('critical');
            if (Math.random() > 0.7) playSound('tick'); // Tick aleatorio acelerado
        } else {
            displays.bombTimer.classList.remove('urgent');
            displays.bombGraphic.classList.remove('critical');
            if (Math.floor(Date.now() / 1000) !== Math.floor((Date.now() - 100) / 1000)) {
                playSound('tick'); // Tick cada segundo
            }
        }

        if (remaining <= 0) {
            clearInterval(timerInterval);
            displays.bombTimer.textContent = "BOOM!";
        }
    };

    update(); // Ejecutar inmediatamente
    timerInterval = setInterval(update, 100);
}

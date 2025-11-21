const socket = io();

// Elementos DOM
const screens = {
    login: document.getElementById('login-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen')
};

const inputs = {
    username: document.getElementById('username-input'),
    roomCode: document.getElementById('room-code-input'),
    word: document.getElementById('word-input')
};

const btns = {
    create: document.getElementById('create-room-btn'),
    join: document.getElementById('join-room-btn'),
    start: document.getElementById('start-btn'),
    back: document.getElementById('back-to-lobby'),
    surrender: document.getElementById('surrender-btn')
};

const display = {
    roomCode: document.getElementById('display-room-code'),
    syllable: document.getElementById('current-syllable'),
    bomb: document.querySelector('.bomb-graphic'),
    timer: document.getElementById('bomb-timer'),
    feedback: document.getElementById('feedback-msg'),
    activePlayers: document.getElementById('active-players-list'),
    waitingPlayers: document.getElementById('players-list-waiting'),
    waitingStatus: document.getElementById('waiting-status'),
    gameOver: document.getElementById('game-over-overlay'),
    winnerName: document.getElementById('winner-name'),
    loginError: document.getElementById('login-error')
};

// Estado Local
let myId = null;
let isLeader = false;
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- Navegación ---
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

// --- Sonidos ---
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'tick') {
        osc.frequency.value = 800;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'explosion') {
        osc.frequency.value = 100;
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
        osc.start();
        osc.stop(audioCtx.currentTime + 1);
    } else if (type === 'success') {
        osc.frequency.value = 600;
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.2);
        osc.stop(audioCtx.currentTime + 0.2);
    }
}

// --- Event Listeners ---

btns.create.addEventListener('click', () => {
    const name = inputs.username.value;
    if (!name) {
        display.loginError.textContent = 'Ingresa tu nombre';
        return;
    }
    socket.emit('create_room', name);
});

btns.join.addEventListener('click', () => {
    const name = inputs.username.value;
    const code = inputs.roomCode.value.toUpperCase();
    
    if (!name) {
        display.loginError.textContent = 'Ingresa tu nombre';
        return;
    }
    if (code.length !== 4) {
        display.loginError.textContent = 'Código debe ser de 4 caracteres';
        return;
    }
    socket.emit('join_room', { playerName: name, roomId: code });
});

btns.start.addEventListener('click', () => {
    if (isLeader) {
        // Feedback inmediato al líder
        display.waitingStatus.textContent = 'Iniciando partida...';
        btns.start.disabled = true; 
        socket.emit('start_game');
    }
});

btns.surrender.addEventListener('click', () => {
    if (confirm("¿Seguro que quieres rendirte? Perderás una vida.")) {
        socket.emit('surrender');
    }
});

btns.back.addEventListener('click', () => {
    if (confirm("¿Volver a la sala y salir de la partida actual?")) {
        display.gameOver.classList.add('hidden');
        // Recargar la página es la forma más limpia de resetear todo el estado en esta arquitectura simple
        window.location.reload();
    }
});

inputs.word.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const word = inputs.word.value;
        if (word) {
            socket.emit('submit_word', word);
            inputs.word.value = '';
        }
    }
});

// --- Socket Events ---

socket.on('connect', () => {
    console.log('Conectado al servidor');
});

socket.on('room_joined', (data) => {
    myId = socket.id;
    isLeader = data.isLeader;
    display.roomCode.textContent = data.roomId;
    showScreen('waiting');
    display.loginError.textContent = '';
    btns.start.disabled = false; // Reset por si volvemos de otra partida
});

socket.on('error_msg', (msg) => {
    display.loginError.textContent = msg;
});

socket.on('word_rejected', (msg) => {
    display.feedback.textContent = msg;
    display.feedback.style.color = '#e94560';
    inputs.word.classList.add('shake');
    setTimeout(() => {
        display.feedback.textContent = '';
        inputs.word.classList.remove('shake');
    }, 1000);
});

socket.on('word_accepted', () => {
    playSound('success');
    display.feedback.textContent = '¡Bien!';
    display.feedback.style.color = '#4cc9f0';
    
    // Animación de pase de bomba
    display.bomb.classList.add('passing');
    setTimeout(() => {
        display.bomb.classList.remove('passing');
        display.feedback.textContent = '';
    }, 500);
});

socket.on('explosion', () => {
    playSound('explosion');
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 500);
});

socket.on('game_over', (data) => {
    display.winnerName.textContent = data.winner !== 'Nadie' ? `¡Ganador: ${data.winner}!` : '¡Juego Terminado!';
    display.gameOver.classList.remove('hidden');
});

socket.on('state_update', (state) => {
    // Verificar si cambió mi rol
    const me = state.players.find(p => p.id === myId);
    if (me) isLeader = me.isLeader;

    if (state.status === 'waiting') {
        showScreen('waiting');
        renderWaitingList(state.players);
    } else if (state.status === 'playing') {
        showScreen('game');
        renderGame(state);
    }
});

// --- Funciones de Renderizado ---

function renderWaitingList(players) {
    display.waitingPlayers.innerHTML = players.map(p => `
        <div class="player-card">
            <div class="player-avatar">${p.avatar}</div>
            <div class="player-name">
                ${p.name}
                ${p.isLeader ? '👑' : ''}
            </div>
        </div>
    `).join('');
    
    display.waitingStatus.textContent = `${players.length} Jugadores conectados`;

    // Mostrar botón SOLO si soy líder y hay suficientes jugadores
    if (isLeader && players.length >= 1) {
        btns.start.classList.remove('hidden');
    } else {
        btns.start.classList.add('hidden');
    }
}

let tickInterval = null;

function renderGame(state) {
    display.syllable.textContent = state.currentSyllable;

    display.activePlayers.innerHTML = state.players.map((p, index) => {
        const isActive = index === state.currentTurnIndex;
        const isDead = p.lives <= 0;
        const isMe = p.id === myId;
        
        let classes = 'player-card';
        if (isActive) classes += ' active-turn';
        if (isDead) classes += ' eliminated';

        return `
            <div class="${classes}" id="player-${p.id}">
                <div class="player-avatar">${p.avatar}</div>
                <div class="player-name">${p.name} ${isMe ? '(Tú)' : ''}</div>
                <div class="player-lives">${'❤️'.repeat(Math.max(0, p.lives))}</div>
            </div>
        `;
    }).join('');

    // Scroll Suave
    const activeCard = document.querySelector('.active-turn');
    if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    // Input Control
    const currentPlayer = state.players[state.currentTurnIndex];
    const isMyTurn = currentPlayer && currentPlayer.id === myId;

    inputs.word.disabled = !isMyTurn;
    btns.surrender.disabled = !isMyTurn; // Botón de rendirse

    if (isMyTurn) {
        inputs.word.focus();
        inputs.word.placeholder = `Palabra que contenga ${state.currentSyllable}`;
    } else {
        inputs.word.value = '';
        inputs.word.placeholder = `Turno de ${currentPlayer ? currentPlayer.name : '...'}`;
    }

    // Timer Visual
    clearInterval(tickInterval);
    
    let nextTickTime = 0;
    const updateBomb = () => {
        const now = Date.now();
        const remaining = state.bombEndTime - now;
        
        if (remaining > 0) {
            display.timer.textContent = (remaining / 1000).toFixed(1) + 's';
        } else {
            display.timer.textContent = '0.0s';
        }

        if (remaining <= 0) {
            display.bomb.style.transform = 'scale(1)';
            display.bomb.classList.remove('ticking', 'critical');
            display.timer.classList.remove('urgent');
        } else {
            if (remaining < 5000) {
                display.bomb.classList.add('critical');
                display.timer.classList.add('urgent');
                if (now >= nextTickTime) {
                    playSound('tick');
                    nextTickTime = now + 500;
                }
            } else {
                display.bomb.classList.remove('critical');
                display.bomb.classList.add('ticking');
                display.timer.classList.remove('urgent');
            }
        }
    };
    
    tickInterval = setInterval(updateBomb, 100);
    updateBomb();
}
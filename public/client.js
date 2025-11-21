const socket = io();

// Elementos DOM
const screens = {
    login: document.getElementById('login-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen')
};

const inputs = {
    username: document.getElementById('username-input'),
    word: document.getElementById('word-input')
};

const btns = {
    join: document.getElementById('join-btn'),
    start: document.getElementById('start-btn'),
    back: document.getElementById('back-to-lobby')
};

const display = {
    syllable: document.getElementById('current-syllable'),
    bomb: document.querySelector('.bomb-graphic'),
    timer: document.getElementById('bomb-timer'),
    feedback: document.getElementById('feedback-msg'),
    activePlayers: document.getElementById('active-players-list'),
    waitingPlayers: document.getElementById('players-list-waiting'),
    gameOver: document.getElementById('game-over-overlay'),
    winnerName: document.getElementById('winner-name'),
    loginLeaderboard: document.getElementById('login-leaderboard')
};

// Estado Local
let myId = null;
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- Navegación ---
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

// --- Sonidos (Sintetizados para no cargar archivos) ---
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

btns.join.addEventListener('click', () => {
    const name = inputs.username.value;
    if (name) {
        socket.emit('join_game', name);
    }
});

btns.start.addEventListener('click', () => {
    socket.emit('start_game');
});

btns.back.addEventListener('click', () => {
    display.gameOver.classList.add('hidden');
    showScreen('waiting'); // El servidor manejará el estado real
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

socket.on('joined', (data) => {
    myId = data.id;
    showScreen('waiting');
});

socket.on('word_rejected', (msg) => {
    display.feedback.textContent = msg;
    display.feedback.style.color = '#e94560'; // Rojo
    inputs.word.classList.add('shake'); // CSS anim
    setTimeout(() => {
        display.feedback.textContent = '';
        inputs.word.classList.remove('shake');
    }, 1000);
});

socket.on('word_accepted', () => {
    playSound('success');
    display.feedback.textContent = '¡Bien!';
    display.feedback.style.color = '#4cc9f0'; // Azul
    setTimeout(() => display.feedback.textContent = '', 1000);
});

socket.on('explosion', (data) => {
    playSound('explosion');
    document.body.classList.add('screen-shake');
    setTimeout(() => document.body.classList.remove('screen-shake'), 500);
});

socket.on('game_over', (data) => {
    display.winnerName.textContent = data.winner !== 'Nadie' ? `¡Ganador: ${data.winner}!` : '¡Juego Terminado!';
    display.gameOver.classList.remove('hidden');
});

socket.on('state_update', (state) => {
    renderLeaderboard(state.leaderboard);

    if (state.status === 'waiting') {
        showScreen('waiting');
        renderWaitingList(state.players);
        // Mostrar botón de inicio solo si hay jugadores
        if (state.players.length >= 1) { // 1 para debug, idealmente 2
            btns.start.classList.remove('hidden');
        } else {
            btns.start.classList.add('hidden');
        }
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
            <div class="player-name">${p.name}</div>
        </div>
    `).join('');
    document.getElementById('waiting-status').textContent = `Jugadores: ${players.length}`;
}

function renderLeaderboard(leaderboard) {
    if (!leaderboard) return;
    const sorted = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]).slice(0, 5);
    display.loginLeaderboard.innerHTML = sorted.map(([name, wins]) => `<li>${name}: ${wins} 🏆</li>`).join('');
}

let tickInterval = null;

function renderGame(state) {
    // 1. Sílaba
    display.syllable.textContent = state.currentSyllable;

    // 2. Lista de Jugadores (Footer)
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

    // Scroll suave hacia el jugador activo
    const activeCard = document.querySelector('.active-turn');
    if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    // 3. Control del Input
    const currentPlayer = state.players[state.currentTurnIndex];
    const isMyTurn = currentPlayer && currentPlayer.id === myId;

    inputs.word.disabled = !isMyTurn;
    if (isMyTurn) {
        inputs.word.focus();
        inputs.word.placeholder = `Escribe una palabra con ${state.currentSyllable}`;
    } else {
        inputs.word.value = '';
        inputs.word.placeholder = `Turno de ${currentPlayer ? currentPlayer.name : '...'}`;
    }

    // 4. Bomba Visual (Tick del cliente sincronizado)
    clearInterval(tickInterval);
    
    let nextTickTime = 0;

    const updateBomb = () => {
        const now = Date.now();
        const remaining = state.bombEndTime - now;
        
        // Actualizar Texto del Timer
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
            // Efectos visuales basados en urgencia
            if (remaining < 5000) {
                display.bomb.classList.add('critical');
                display.timer.classList.add('urgent');
                
                // Sonido tick rápido (throttled a ~500ms)
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

    // Actualizar UI más rápido para el timer (10fps = 100ms)
    tickInterval = setInterval(updateBomb, 100);
    updateBomb(); // Ejecutar inmediatamente
}
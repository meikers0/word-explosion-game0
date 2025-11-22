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
    customWordsToggle: document.getElementById('allow-custom-words-toggle'),
    gameModeSelect: document.getElementById('game-mode-select'),
    clue: document.getElementById('clue-input')
};

const btns = {
    create: document.getElementById('create-room-btn'),
    join: document.getElementById('join-room-btn'),
    start: document.getElementById('start-btn'),
    surrender: document.getElementById('surrender-btn'),
    back: document.getElementById('back-to-lobby'),
    rules: document.getElementById('rules-btn'),
    closeRules: document.getElementById('close-rules-btn'),
    sendClue: document.getElementById('send-clue-btn')
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
    gameOverOverlay: document.getElementById('game-over-overlay'),
    rulesModal: document.getElementById('rules-modal'),
    
    // Containers de modo
    bombArea: document.getElementById('bomb-game-area'),
    impostorArea: document.getElementById('impostor-game-area'),
    
    // Impostor Elements
    impostorRoleCard: document.getElementById('impostor-role-card'),
    secretWord: document.getElementById('my-secret-word'),
    roleDesc: document.getElementById('role-desc'),
    impostorPhase: document.getElementById('impostor-phase-display'),
    impostorInput: document.getElementById('impostor-input-area'),
    impostorVote: document.getElementById('impostor-vote-area'),
    cluesList: document.getElementById('clues-list')
};

// --- Estado Local ---
let myPlayerId = null;
let isLeader = false;
let currentRoomState = null;
let timerInterval = null;
let myImpostorRole = { isImpostor: false, secretWord: null }; // Estado privado

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
    } else if (type === 'reveal') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.5);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 1);
        osc.start(now);
        osc.stop(now + 1);
    }
}

// --- Funciones de Navegación ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// --- Event Listeners ---

// Rules
btns.rules.addEventListener('click', () => displays.rulesModal.classList.remove('hidden'));
btns.closeRules.addEventListener('click', () => displays.rulesModal.classList.add('hidden'));

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

// Configuración de Sala - Opción Líder
inputs.customWordsToggle.addEventListener('change', (e) => {
    if (isLeader) {
        socket.emit('toggle_settings', { allowCustomWords: e.target.checked });
    } else {
        e.target.checked = !e.target.checked;
    }
});

inputs.gameModeSelect.addEventListener('change', (e) => {
    if (isLeader) {
        socket.emit('change_mode', e.target.value);
    } else {
        // Revert to prev value if not leader (controlled by render)
    }
});

// Iniciar Juego
btns.start.addEventListener('click', () => {
    if (isLeader) {
        displays.waitingStatus.textContent = 'Iniciando partida...';
        socket.emit('start_game');
    }
});

// Input de Palabra (Explosion)
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

// Volver al Lobby (Post Game Over)
btns.back.addEventListener('click', () => {
    // Simplemente cerramos el overlay porque la pantalla subyacente ya es el Lobby
    displays.gameOverOverlay.classList.add('hidden');
});

// Impostor Actions
btns.sendClue.addEventListener('click', () => {
    const val = inputs.clue.value;
    if (val) {
        socket.emit('submit_clue', val);
        inputs.clue.value = '';
        displays.impostorInput.classList.add('hidden'); // Ocultar inmediato para feedback
    }
});

// --- Socket Events ---

socket.on('room_joined', (data) => {
    myPlayerId = socket.id;
    isLeader = data.isLeader;
    displays.roomCode.textContent = data.roomId;
    showScreen('waiting');
    
    if (isLeader) {
        btns.start.classList.remove('hidden');
        inputs.customWordsToggle.disabled = false;
        inputs.gameModeSelect.disabled = false;
    } else {
        btns.start.classList.add('hidden');
        inputs.customWordsToggle.disabled = true;
        inputs.gameModeSelect.disabled = true;
    }
});

socket.on('error_msg', (msg) => {
    // Si estamos en waiting, lo mostramos en el status o login error
    if (screens.login.classList.contains('active')) {
        displays.loginError.textContent = msg;
    } else {
        // Usar alert para errores criticos en lobby (ej: min jugadores)
        alert(msg);
        displays.waitingStatus.textContent = msg;
        setTimeout(() => {
             if(displays.waitingStatus.textContent === msg) displays.waitingStatus.textContent = 'Esperando jugadores...';
        }, 3000);
    }
});

socket.on('state_update', (state) => {
    currentRoomState = state;
    renderState(state);
});

socket.on('word_accepted', () => {
    playSound('valid');
    displays.feedback.textContent = '¡Correcto!';
    displays.feedback.style.color = 'var(--success)';
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
    displays.winnerName.textContent = `¡Ganador: ${data.winner}!`;
    displays.gameOverOverlay.classList.remove('hidden');
    clearInterval(timerInterval);
    // Nota: El servidor envía 'state_update' con status 'waiting' casi inmediatamente.
    // El renderState cambiará la vista de fondo a 'waiting-screen'.
});

// Impostor Events
socket.on('impostor_role', (data) => {
    myImpostorRole = data;
    playSound('reveal');
});
socket.on('impostor_ejected', (data) => {
    playSound('explosion');
    alert(`${data.name} fue expulsado. Era ${data.isImpostor ? 'EL IMPOSTOR' : 'INOCENTE'}.`);
});
socket.on('impostor_skipped', () => {
    alert("Empate en la votación. Nadie fue expulsado.");
});


// --- Render Logic ---

function renderState(state) {
    // 1. Settings Sync
    inputs.customWordsToggle.checked = state.allowCustomWords;
    inputs.gameModeSelect.value = state.gameMode;
    
    // Toggle visibility de options basado en modo
    document.getElementById('custom-words-container').style.display = 
        state.gameMode === 'explosion' ? 'flex' : 'none';

    // 2. Waiting Screen (LOBBY)
    if (state.status === 'waiting') {
        if (!screens.waiting.classList.contains('active')) {
            showScreen('waiting');
        }
        renderWaitingPlayers(state.players);
        // NOTA: NO ocultamos gameOverOverlay aquí automáticamente para permitir que el usuario vea el resultado.
        
        if (isLeader) {
             btns.start.disabled = false; // Rehabilitar botón
        }
    }

    // 3. Game Screen
    if (state.status === 'playing') {
        if (!screens.game.classList.contains('active')) {
            showScreen('game');
            // Asegurar que el overlay se cierre si empieza nueva partida
            displays.gameOverOverlay.classList.add('hidden');
        }

        // Switch Game UI
        if (state.gameMode === 'explosion') {
            displays.bombArea.classList.remove('hidden');
            displays.impostorArea.classList.add('hidden');
            renderExplosionGame(state);
        } else {
            displays.bombArea.classList.add('hidden');
            displays.impostorArea.classList.remove('hidden');
            renderImpostorGame(state);
        }
        
        // Footer is common
        renderActivePlayers(state.players, state.currentTurnIndex, state.gameMode);
    }
}

function renderWaitingPlayers(players) {
    displays.waitingPlayers.innerHTML = players.map(p => `
        <div class="player-card">
            <div class="player-avatar">${p.avatar}</div>
            <div class="player-name">${p.name}</div>
            ${p.isLeader ? '👑' : ''}
            <div style="font-size:0.8rem; margin-top:5px;">🏆 ${currentRoomState && currentRoomState.leaderboard[p.name] || 0}</div>
        </div>
    `).join('');
}

function renderExplosionGame(state) {
    displays.syllable.textContent = state.currentSyllable;
    const currentPlayer = state.players[state.currentTurnIndex];
    const isMyTurn = currentPlayer.id === myPlayerId;

    inputs.word.disabled = !isMyTurn;
    btns.surrender.disabled = !isMyTurn;
    
    if (isMyTurn) {
        inputs.word.focus();
        inputs.word.placeholder = `Escribe palabra con ${state.currentSyllable}...`;
    } else {
        inputs.word.placeholder = `Turno de ${currentPlayer.name}`;
        inputs.word.value = '';
    }

    handleTimer(state.bombEndTime);
}

function renderImpostorGame(state) {
    // Phase Banner
    const phasesES = { 'reveal': 'Revelación', 'clue': 'Pistas', 'vote': 'Votación', 'result': 'Resultado' };
    displays.impostorPhase.textContent = `Fase: ${phasesES[state.impostorPhase]}`;

    // Role Card
    if (state.impostorPhase === 'reveal') {
        displays.impostorRoleCard.style.display = 'block';
        if (myImpostorRole.isImpostor) {
            displays.impostorRoleCard.classList.add('impostor-reveal');
            displays.secretWord.textContent = "¡IMPOSTOR!";
            displays.roleDesc.textContent = "Nadie sabe que eres tú. Finge saber la palabra secreta.";
        } else {
            displays.impostorRoleCard.classList.remove('impostor-reveal');
            displays.secretWord.textContent = myImpostorRole.secretWord;
            displays.roleDesc.textContent = "Esta es la palabra secreta. Encuentra al mentiroso.";
        }
    } else {
        displays.impostorRoleCard.style.display = 'none';
    }

    // Input Clue
    const amIAlive = state.players.find(p => p.id === myPlayerId)?.lives > 0;
    const alreadyClued = !!state.clues[myPlayerId];
    
    if (state.impostorPhase === 'clue' && amIAlive && !alreadyClued) {
        displays.impostorInput.classList.remove('hidden');
    } else {
        displays.impostorInput.classList.add('hidden');
    }

    // Voting
    const meInState = state.players.find(p => p.id === myPlayerId);
    
    if (state.impostorPhase === 'vote' && amIAlive && !meInState.hasVoted) {
        displays.impostorVote.classList.remove('hidden');
        displays.impostorVote.innerHTML = state.players
            .filter(p => p.lives > 0 && p.id !== myPlayerId) // Don't vote self
            .map(p => `<button class="vote-btn" onclick="socket.emit('submit_vote', '${p.id}')">Votar a ${p.name} ${p.avatar}</button>`)
            .join('');
    } else {
        displays.impostorVote.classList.add('hidden');
    }

    // Clues List
    if (Object.keys(state.clues).length > 0) {
        displays.cluesList.innerHTML = state.players
            .filter(p => state.clues[p.id])
            .map(p => `<div class="clue-item">${p.avatar} ${p.name}: <span>${state.clues[p.id]}</span></div>`)
            .join('');
    } else {
        displays.cluesList.innerHTML = '';
    }
}

function renderActivePlayers(players, turnIndex, mode) {
    displays.activePlayers.innerHTML = players.map((p, i) => {
        const isActive = (mode === 'explosion' && i === turnIndex);
        const isDead = p.lives <= 0;
        let statusIcon = '';
        
        if (mode === 'explosion') {
            statusIcon = '❤️'.repeat(p.lives) + '🖤'.repeat(3 - p.lives);
        } else {
            statusIcon = isDead ? '👻' : '🙂';
        }
        
        return `
            <div id="player-card-${i}" class="player-card ${isActive ? 'active-turn' : ''} ${isDead ? 'eliminated' : ''}">
                <div class="player-avatar">${p.avatar}</div>
                <div class="player-name">${p.name}</div>
                <div class="player-lives">${statusIcon}</div>
            </div>
        `;
    }).join('');

    if (mode === 'explosion') {
        const activeCard = document.getElementById(`player-card-${turnIndex}`);
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }
}

function handleTimer(endTime) {
    if (timerInterval) clearInterval(timerInterval);
    const update = () => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        const seconds = (remaining / 1000).toFixed(2);
        displays.bombTimer.textContent = `${seconds}s`;
        
        if (remaining < 5000) {
            displays.bombTimer.classList.add('urgent');
        } else {
            displays.bombTimer.classList.remove('urgent');
        }
    };
    update();
    timerInterval = setInterval(update, 100);
}
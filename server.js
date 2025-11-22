const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

// --- Configuración del Servidor ---
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// --- Datos Estáticos ---
const SYLLABLES = [
  'AR', 'ER', 'IR', 'AN', 'EN', 'ON', 'AL', 'EL', 'AS', 'ES', 'OS',
  'TR', 'BL', 'BR', 'CL', 'CR', 'FL', 'FR', 'GL', 'GR', 'PL', 'PR',
  'CI', 'CE', 'ZA', 'ZO', 'ZU', 'QUE', 'QUI', 'GUE', 'GUI',
  'CON', 'COM', 'PRO', 'PER', 'TRA', 'DES', 'INT', 'EST'
];

// Diccionario de Respaldo (Fallback)
const FALLBACK_DICTIONARY = new Set([
  'CASA', 'PERRO', 'GATO', 'ARBOL', 'TIEMPO', 'AMIGO', 'JUEGO', 'MESA', 'SILLA', 'LIBRO',
  'PAPEL', 'LAPIZ', 'CIELO', 'TIERRA', 'FUEGO', 'AGUA', 'AIRE', 'VIDA', 'MUERTE', 'AMOR',
  'ODIO', 'FELIZ', 'TRISTE', 'RAPIDO', 'LENTO', 'GRANDE', 'PEQUEÑO', 'NUEVO', 'VIEJO',
  'BLANCO', 'NEGRO', 'ROJO', 'AZUL', 'VERDE', 'AMARILLO', 'NOCHE', 'DIA', 'TARDE', 'LUZ',
  'SOL', 'LUNA', 'ESTRELLA', 'MAR', 'RIO', 'MONTAÑA', 'BOSQUE', 'FLOR', 'FRUTA', 'COMIDA',
  'BEBIDA', 'HOMBRE', 'MUJER', 'NIÑO', 'NIÑA', 'PADRE', 'MADRE', 'HERMANO', 'HERMANA',
  'TRABAJO', 'DINERO', 'CIUDAD', 'PUEBLO', 'CALLE', 'COCHE', 'TREN', 'AVION', 'BARCO',
  'MUSICA', 'ARTE', 'CINE', 'LIBERTAD', 'PAZ', 'GUERRA', 'HISTORIA', 'CIENCIA', 'ESCUELA',
  'UNIVERSIDAD', 'COMPUTADORA', 'TELEFONO', 'INTERNET', 'RED', 'DATO', 'INFORMACION',
  'SISTEMA', 'PROGRAMA', 'CODIGO', 'LENGUAJE', 'PALABRA', 'LETRA', 'NUMERO', 'COLOR',
  'FORMA', 'ESPACIO', 'PUNTO', 'LINEA', 'CUERPO', 'MANO', 'PIE', 'CABEZA', 'OJOS', 'BOCA',
  'NARIZ', 'OREJA', 'PELO', 'SANGRE', 'CORAZON', 'MENTE', 'ALMA', 'DIOS', 'MUNDO', 'PAIS',
  'ESTADO', 'GOBIERNO', 'LEY', 'JUSTICIA', 'VERDAD', 'MENTIRA', 'MIEDO', 'VALOR', 'FUERZA',
  'PODER', 'ENERGIA', 'MATERIA', 'ESPIRITU', 'SENTIMIENTO', 'PENSAMIENTO', 'IDEA', 'RAZON',
  'CONOCIMIENTO', 'SABIDURIA', 'EXPERIENCIA', 'RECUERDO', 'OLVIDO', 'PRESENTE', 'PASADO',
  'FUTURO', 'AHORA', 'NUNCA', 'SIEMPRE', 'TODO', 'NADA', 'ALGO', 'ALGUIEN', 'NADIE',
  'CUALQUIERA', 'DONDE', 'CUANDO', 'COMO', 'PORQUE', 'PARA', 'CON', 'SIN', 'SOBRE', 'ENTRE',
  'BAJO', 'HASTA', 'DESDE', 'HACIA', 'CONTRA', 'DURANTE', 'MIENTRAS', 'AUNQUE', 'PERO',
  'SINO', 'TAMBIEN', 'TAMPOCO', 'ADEMAS', 'ENTONCES', 'LUEGO', 'ASI', 'BIEN', 'MAL',
  'MEJOR', 'PEOR', 'MAS', 'MENOS', 'MUY', 'MUCHO', 'POCO', 'BASTANTE', 'DEMASIADO',
  'CASI', 'APENAS', 'QUIZAS', 'TALVEZ', 'ACASO', 'SEGURO', 'CIERTO', 'CLARO', 'OBVIO',
  'POSIBLE', 'IMPOSIBLE', 'PROBABLE', 'DIFICIL', 'FACIL', 'DURO', 'SUAVE', 'FUERTE', 'DEBIL',
  'RICO', 'POBRE', 'CARO', 'BARATO', 'ALTO', 'BAJO', 'LARGO', 'CORTO', 'ANCHO', 'ESTRECHO',
  'GORDO', 'FLACO', 'BONITO', 'FEO', 'LIMPIO', 'SUCIO', 'LLENO', 'VACIO', 'ABIERTO', 'CERRADO',
  'LIBRE', 'OCUPADO', 'SOLO', 'JUNTOS', 'IGUAL', 'DIFERENTE', 'MISMO', 'OTRO', 'PROPIO', 'AJENO',
  'MOSCA', 'BOSQUE', 'COSTA', 'POSTRE', 'OSO', 'COSA', 'ROSA', 'TOSER', 'DOS'
]);

let GLOBAL_DICTIONARY = new Set();
let DICTIONARY_ARRAY = []; // Para seleccionar palabras aleatorias en modo Impostor

// Cargar Diccionario Externo (Optimizado)
function loadDictionary() {
  const dictPath = path.join(__dirname, 'data', 'dictionary.txt');
  console.log('Iniciando carga de diccionario desde:', dictPath);
  
  try {
    if (fs.existsSync(dictPath)) {
      const data = fs.readFileSync(dictPath, 'utf8');
      const lines = data.split(/\r?\n/);
      let count = 0;
      lines.forEach(line => {
        const word = line.trim().toUpperCase();
        if (word.length > 1) {
          GLOBAL_DICTIONARY.add(word);
          DICTIONARY_ARRAY.push(word);
          count++;
        }
      });
      console.log(`✅ Diccionario externo cargado: ${count} palabras.`);
    } else {
      throw new Error('Archivo dictionary.txt no encontrado');
    }
  } catch (error) {
    console.warn(`⚠️ Advertencia: ${error.message}. Usando diccionario de respaldo.`);
    GLOBAL_DICTIONARY = FALLBACK_DICTIONARY;
    DICTIONARY_ARRAY = Array.from(FALLBACK_DICTIONARY);
  }
}

loadDictionary();

// --- Gestión de Salas ---
const rooms = {};

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function createRoom(leaderId, leaderName, avatar) {
  let roomId = generateRoomId();
  while (rooms[roomId]) {
    roomId = generateRoomId();
  }

  rooms[roomId] = {
    id: roomId,
    status: 'waiting',
    gameMode: 'explosion', // 'explosion' | 'impostor'
    players: [{
      id: leaderId,
      name: leaderName,
      avatar: avatar,
      lives: 3,
      isLeader: true,
      isImpostor: false
    }],
    leaderboard: {}, 
    
    // WordExplosion State
    currentTurnIndex: 0,
    currentSyllable: '',
    usedWords: new Set(),
    bombEndTime: 0,
    bombDuration: 0,
    allowCustomWords: false,

    // Impostor State
    impostorPhase: 'idle', // 'reveal', 'clue', 'vote', 'result'
    secretWord: '',
    clues: {}, // { playerId: "pista" }
    votes: {}  // { voterId: targetId }
  };
  return roomId;
}

function generateSyllable() {
  return SYLLABLES[Math.floor(Math.random() * SYLLABLES.length)];
}

function resetBomb(room, min = 10000, max = 30000) {
  const duration = Math.floor(Math.random() * (max - min + 1) + min);
  room.bombDuration = duration;
  room.bombEndTime = Date.now() + duration;
}

function getPublicState(room) {
  if (!room) return null;
  
  // Sanitizar estado para Impostor
  const safePlayers = room.players.map(p => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    lives: p.lives,
    isLeader: p.isLeader,
    // NO enviar isImpostor
    hasVoted: !!room.votes[p.id],
    hasClue: !!room.clues[p.id]
  }));

  return {
    roomId: room.id,
    status: room.status,
    gameMode: room.gameMode,
    players: safePlayers,
    leaderboard: room.leaderboard,
    allowCustomWords: room.allowCustomWords,
    
    // Explosion
    currentTurnIndex: room.currentTurnIndex,
    currentSyllable: room.currentSyllable,
    bombEndTime: room.bombEndTime,

    // Impostor
    impostorPhase: room.impostorPhase,
    clues: room.impostorPhase === 'vote' || room.impostorPhase === 'result' ? room.clues : {}, // Ocultar pistas hasta votar
    secretWord: room.impostorPhase === 'result' ? room.secretWord : null // Solo revelar al final
  };
}

function switchTurn(room, passed = false) {
  let loops = 0;
  do {
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    loops++;
  } while (room.players[room.currentTurnIndex].lives <= 0 && loops < room.players.length);

  if (passed) {
    const now = Date.now();
    const remaining = room.bombEndTime - now;
    if (remaining < 5000) {
      room.bombEndTime = now + 5000;
    }
  }

  room.currentSyllable = generateSyllable();
  io.to(room.id).emit('state_update', getPublicState(room));
}

function handleExplosion(room) {
  const victim = room.players[room.currentTurnIndex];
  if (!victim) return;
  
  victim.lives -= 1;

  io.to(room.id).emit('explosion', { victimId: victim.id });

  const alivePlayers = room.players.filter(p => p.lives > 0);

  if (alivePlayers.length <= 1 && room.players.length > 1) {
    const winner = alivePlayers[0];
    if (winner) {
      room.leaderboard[winner.name] = (room.leaderboard[winner.name] || 0) + 1;
    }
    // Estado pasa a waiting para redireccionar a los clientes al Lobby
    room.status = 'waiting'; 
    io.to(room.id).emit('game_over', { winner: winner ? winner.name : 'Nadie' });
    io.to(room.id).emit('state_update', getPublicState(room));
  } else if (alivePlayers.length === 0 && room.players.length > 0) {
    room.status = 'waiting';
    io.to(room.id).emit('game_over', { winner: 'Nadie' });
    io.to(room.id).emit('state_update', getPublicState(room));
  } else {
    setTimeout(() => {
      if (rooms[room.id] && room.status === 'playing') {
        resetBomb(room);
        room.usedWords.clear();
        switchTurn(room, false);
      }
    }, 3000);
  }
}

// --- Lógica Impostor ---
function setupImpostorGame(room) {
  // Reset
  room.players.forEach(p => {
    p.lives = 1; // 1 vida = vivo en este modo
    p.isImpostor = false;
  });
  room.clues = {};
  room.votes = {};
  
  // Elegir palabra
  room.secretWord = DICTIONARY_ARRAY[Math.floor(Math.random() * DICTIONARY_ARRAY.length)];

  // Elegir Impostor
  const impostorIndex = Math.floor(Math.random() * room.players.length);
  room.players[impostorIndex].isImpostor = true;

  room.impostorPhase = 'reveal';
  
  // Notificar roles privados
  room.players.forEach(p => {
    const socket = io.sockets.sockets.get(p.id);
    if (socket) {
      socket.emit('impostor_role', {
        isImpostor: p.isImpostor,
        secretWord: p.isImpostor ? null : room.secretWord
      });
    }
  });

  io.to(room.id).emit('state_update', getPublicState(room));

  // Transición a Pistas después de 5s
  setTimeout(() => {
    if (rooms[room.id] && room.status === 'playing') {
      room.impostorPhase = 'clue';
      io.to(room.id).emit('state_update', getPublicState(room));
    }
  }, 5000);
}

function checkImpostorWinCondition(room) {
  const alivePlayers = room.players.filter(p => p.lives > 0);
  const impostor = alivePlayers.find(p => p.isImpostor);
  
  // Caso 1: Impostor Eliminado -> Gana el Pueblo
  if (!impostor) {
    room.status = 'waiting';
    io.to(room.id).emit('game_over', { winner: 'El Pueblo (Ciudadanos)' });
    io.to(room.id).emit('state_update', getPublicState(room));
    return true;
  }

  // Caso 2: Impostor + 1 Ciudadano -> Gana Impostor
  if (alivePlayers.length <= 2) {
    room.status = 'waiting';
    room.leaderboard[impostor.name] = (room.leaderboard[impostor.name] || 0) + 1;
    io.to(room.id).emit('game_over', { winner: `El Impostor (${impostor.name})` });
    io.to(room.id).emit('state_update', getPublicState(room));
    return true;
  }

  return false; // El juego sigue
}

// Game Loop Check (Solo para BombParty)
setInterval(() => {
  const now = Date.now();
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (room.status === 'playing' && room.gameMode === 'explosion') {
      if (now > room.bombEndTime) {
        handleExplosion(room);
        room.bombEndTime = now + 999999; 
      }
    }
  }
}, 200);

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

  const getRandomAvatar = () => {
    const avatars = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮'];
    return avatars[Math.floor(Math.random() * avatars.length)];
  };

  // --- CREAR SALA ---
  socket.on('create_room', (playerName) => {
    const name = (playerName || 'Jugador').trim().substring(0, 12);
    const roomId = createRoom(socket.id, name, getRandomAvatar());
    
    socket.join(roomId);
    socket.data.roomId = roomId;
    
    socket.emit('room_joined', { roomId: roomId, isLeader: true });
    io.to(roomId).emit('state_update', getPublicState(rooms[roomId]));
  });

  // --- UNIRSE A SALA ---
  socket.on('join_room', ({ playerName, roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('error_msg', 'Sala no encontrada');
      return;
    }
    if (room.status === 'playing') {
      socket.emit('error_msg', 'Partida en curso');
      return;
    }
    
    const name = (playerName || `Jugador ${room.players.length + 1}`).trim().substring(0, 12);
    const newPlayer = {
      id: socket.id,
      name: name,
      avatar: getRandomAvatar(),
      lives: 3,
      isLeader: false
    };

    room.players.push(newPlayer);
    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit('room_joined', { roomId: roomId, isLeader: false });
    io.to(roomId).emit('state_update', getPublicState(room));
  });

  // --- CONFIGURACIÓN ---
  socket.on('toggle_settings', (settings) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isLeader) return;

    if (typeof settings.allowCustomWords === 'boolean') {
      room.allowCustomWords = settings.allowCustomWords;
    }
    io.to(roomId).emit('state_update', getPublicState(room));
  });

  socket.on('change_mode', (mode) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isLeader) return;

    if (mode === 'explosion' || mode === 'impostor') {
      room.gameMode = mode;
      io.to(roomId).emit('state_update', getPublicState(room));
    }
  });

  // --- INICIAR PARTIDA ---
  socket.on('start_game', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.status === 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isLeader) return;
    
    // REGLA: Mínimo 2 jugadores para Explosion (Testeo)
    // REGLA: Mínimo 3 jugadores para Impostor (Estricto)
    if (room.gameMode === 'impostor' && room.players.length < 3) {
      socket.emit('error_msg', 'Se requieren al menos 3 jugadores para el Modo Impostor');
      return;
    }
    if (room.players.length < 2) {
       // Opcional: Permitir testing solitario para dev, pero normal 2
       // return; 
    }

    room.status = 'playing';
    room.usedWords.clear();

    if (room.gameMode === 'explosion') {
      room.players.forEach(p => p.lives = 3);
      room.currentSyllable = generateSyllable();
      resetBomb(room);
      io.to(roomId).emit('state_update', getPublicState(room));
    } else if (room.gameMode === 'impostor') {
      setupImpostorGame(room);
    }
  });

  // --- ENVIAR PALABRA (EXPLOSION - LÓGICA CORREGIDA) ---
  socket.on('submit_word', (wordInput) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.gameMode !== 'explosion') return;

    const player = room.players[room.currentTurnIndex];
    if (player.id !== socket.id) return;

    let word = wordInput.trim().toUpperCase();
    const syllable = room.currentSyllable;

    // 1. REGLA FÍSICA: Debe contener la sílaba (SIEMPRE)
    if (!word.includes(syllable)) {
      socket.emit('word_rejected', `Debe contener "${syllable}"`);
      return;
    }

    // 2. REGLA DE ESTADO: No debe haber sido usada (SIEMPRE)
    if (room.usedWords.has(word)) {
      socket.emit('word_rejected', '¡Palabra ya usada!');
      return;
    }

    // 3. REGLA DE LÉXICO: Diccionario O Palabras Inventadas
    const inDict = GLOBAL_DICTIONARY.has(word);
    
    // Si la palabra está en el diccionario, es válida.
    // Si NO está, SOLO es válida si se permiten palabras inventadas.
    if (inDict || room.allowCustomWords) {
      room.usedWords.add(word);
      socket.emit('word_accepted');
      switchTurn(room, true);
    } else {
      socket.emit('word_rejected', 'No está en el diccionario');
    }
  });

  // --- IMPOSTOR: ENVIAR PISTA ---
  socket.on('submit_clue', (clue) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.gameMode !== 'impostor' || room.impostorPhase !== 'clue') return;

    // Solo vivos
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.lives <= 0) return;

    room.clues[socket.id] = clue.substring(0, 20).toUpperCase();
    
    // Verificar si todos enviaron
    const alive = room.players.filter(p => p.lives > 0);
    const allSubmitted = alive.every(p => room.clues[p.id]);

    if (allSubmitted) {
      room.impostorPhase = 'vote';
    }
    io.to(roomId).emit('state_update', getPublicState(room));
  });

  // --- IMPOSTOR: VOTAR ---
  socket.on('submit_vote', (targetId) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.gameMode !== 'impostor' || room.impostorPhase !== 'vote') return;

    // Solo vivos votan
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.lives <= 0) return;

    room.votes[socket.id] = targetId;

    // Verificar si todos votaron
    const alive = room.players.filter(p => p.lives > 0);
    const allVoted = alive.every(p => room.votes[p.id]);

    if (allVoted) {
      // Calcular resultados
      const voteCounts = {};
      let maxVotes = 0;
      let ejectedId = null;

      Object.values(room.votes).forEach(tid => {
        voteCounts[tid] = (voteCounts[tid] || 0) + 1;
        if (voteCounts[tid] > maxVotes) {
          maxVotes = voteCounts[tid];
          ejectedId = tid;
        } else if (voteCounts[tid] === maxVotes) {
          ejectedId = null; // Empate, nadie muere (simplificado)
        }
      });

      const ejected = room.players.find(p => p.id === ejectedId);
      
      if (ejected) {
        ejected.lives = 0;
        
        // Puntos para quienes votaron correctamente al impostor
        if (ejected.isImpostor) {
          alive.forEach(p => {
            if (room.votes[p.id] === ejectedId) {
               // Bonus por cazar al impostor
               room.leaderboard[p.name] = (room.leaderboard[p.name] || 0) + 1;
            }
          });
        }
        io.to(roomId).emit('impostor_ejected', { name: ejected.name, isImpostor: ejected.isImpostor });
      } else {
        io.to(roomId).emit('impostor_skipped', {});
      }

      // Check Win
      if (!checkImpostorWinCondition(room)) {
        // Nueva Ronda
        room.impostorPhase = 'result'; // Breve pausa para ver resultados
        io.to(roomId).emit('state_update', getPublicState(room));
        
        setTimeout(() => {
          room.impostorPhase = 'clue';
          room.clues = {};
          room.votes = {};
          io.to(roomId).emit('state_update', getPublicState(room));
        }, 4000);
      }
    } else {
      io.to(roomId).emit('state_update', getPublicState(room));
    }
  });

  // --- RENDIRSE ---
  socket.on('surrender', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    
    if (room.gameMode === 'explosion') {
        const player = room.players[room.currentTurnIndex];
        if (player.id === socket.id) {
        handleExplosion(room);
        }
    }
  });

  // --- DESCONEXIÓN ---
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p.id !== socket.id);
      
      if (room.players.length === 0) {
        delete rooms[roomId];
      } else {
        if (!room.players.some(p => p.isLeader)) {
          room.players[0].isLeader = true;
        }
        
        // Si era Impostor y se fue en media partida
        if (room.status === 'playing' && room.gameMode === 'impostor') {
             checkImpostorWinCondition(room);
        }

        io.to(roomId).emit('state_update', getPublicState(room));
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
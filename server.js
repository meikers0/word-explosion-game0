const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

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

// Diccionario simplificado para demo.
const DICTIONARY = new Set([
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
  'MOSCA', 'BOSQUE', 'COSTA', 'POSTRE', 'OSO', 'COSA', 'ROSA'
]);

// --- Gestión de Salas ---
// rooms[roomCode] = { id, status, players, leaderboard, ... }
const rooms = {};

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin I, O, 0, 1 para evitar confusión
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
    status: 'waiting', // 'waiting', 'playing'
    players: [{
      id: leaderId,
      name: leaderName,
      avatar: avatar,
      lives: 3,
      isLeader: true
    }],
    leaderboard: {}, 
    currentTurnIndex: 0,
    currentSyllable: '',
    usedWords: new Set(),
    bombEndTime: 0,
    bombDuration: 0
  };
  return roomId;
}

// --- Lógica de Juego (Helper Functions) ---

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
  return {
    roomId: room.id,
    status: room.status,
    players: room.players,
    currentTurnIndex: room.currentTurnIndex,
    currentSyllable: room.currentSyllable,
    bombEndTime: room.bombEndTime,
    leaderboard: room.leaderboard
  };
}

function switchTurn(room, passed = false) {
  let loops = 0;
  // Avanzar al siguiente jugador vivo
  do {
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    loops++;
  } while (room.players[room.currentTurnIndex].lives <= 0 && loops < room.players.length);

  if (passed) {
    const now = Date.now();
    const remaining = room.bombEndTime - now;
    // Reinicio a 5s si queda poco tiempo y pasaron la bomba
    if (remaining < 5000) {
      room.bombEndTime = now + 5000;
    }
  }

  room.currentSyllable = generateSyllable();
  io.to(room.id).emit('state_update', getPublicState(room));
}

function handleExplosion(room) {
  const victim = room.players[room.currentTurnIndex];
  victim.lives -= 1;

  io.to(room.id).emit('explosion', { victimId: victim.id });

  const alivePlayers = room.players.filter(p => p.lives > 0);

  if (alivePlayers.length <= 1 && room.players.length > 1) {
    // Game Over (Ganador determinado o empate si todos murieron)
    const winner = alivePlayers[0];
    if (winner) {
      room.leaderboard[winner.name] = (room.leaderboard[winner.name] || 0) + 1;
    }
    room.status = 'waiting';
    io.to(room.id).emit('game_over', { winner: winner ? winner.name : 'Nadie' });
    io.to(room.id).emit('state_update', getPublicState(room));
  } else if (alivePlayers.length === 0 && room.players.length > 0) {
    // Caso raro: todos mueren
    room.status = 'waiting';
    io.to(room.id).emit('game_over', { winner: 'Nadie' });
    io.to(room.id).emit('state_update', getPublicState(room));
  } else {
    // Continuar: Nueva Ronda tras breve pausa
    // Detenemos la bomba temporalmente (status sigue playing pero esperamos)
    setTimeout(() => {
      // Verificar si la sala sigue existiendo y en juego
      if (rooms[room.id] && room.status === 'playing') {
        resetBomb(room);
        room.usedWords.clear();
        switchTurn(room, false);
      }
    }, 3000);
  }
}

// --- Game Loop Global ---
setInterval(() => {
  const now = Date.now();
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (room.status === 'playing') {
      // Si el tiempo se acabó
      if (now > room.bombEndTime) {
        handleExplosion(room);
        // Ajustamos bombEndTime al futuro lejano para no re-explotar inmediatamente durante el timeout
        room.bombEndTime = now + 999999; 
      }
    }
  }
}, 200);

// --- Socket.io Eventos ---

io.on('connection', (socket) => {
  console.log('Conexión:', socket.id);

  const getRandomAvatar = () => {
    const avatars = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮'];
    return avatars[Math.floor(Math.random() * avatars.length)];
  };

  // --- CREAR SALA ---
  socket.on('create_room', (playerName) => {
    const name = playerName.trim().substring(0, 12) || 'Jugador';
    const roomId = createRoom(socket.id, name, getRandomAvatar());
    
    socket.join(roomId);
    socket.data.roomId = roomId; // Referencia rápida
    
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
    // Evitar duplicados de nombre exacto podría ser una mejora, 
    // pero permitiremos nombres iguales por simplicidad.
    
    const name = playerName.trim().substring(0, 12) || `Jugador ${room.players.length + 1}`;
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

  // --- INICIAR JUEGO ---
  socket.on('start_game', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    
    if (!room) return;

    // Verificar si es líder
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isLeader) return;

    // Mínimo 2 jugadores para jugar de verdad, pero permitimos 1 para testeo si se desea
    if (room.status === 'waiting') {
      room.status = 'playing';
      room.players.forEach(p => p.lives = 3);
      room.currentTurnIndex = 0;
      room.usedWords.clear();
      room.currentSyllable = generateSyllable();
      resetBomb(room);
      io.to(roomId).emit('state_update', getPublicState(room));
    }
  });

  // --- RENDIRSE ---
  socket.on('surrender', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;

    const currentPlayer = room.players[room.currentTurnIndex];
    // Seguridad: Solo el turno actual puede rendirse
    if (!currentPlayer || currentPlayer.id !== socket.id) return;

    // Rendirse desencadena la misma lógica que una explosión (pierde vida y turno)
    handleExplosion(room);
    // Reseteamos el timer de la bomba para evitar doble explosión si estaba a punto de estallar
    const now = Date.now();
    room.bombEndTime = now + 999999;
  });

  // --- ENVIAR PALABRA ---
  socket.on('submit_word', (word) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;

    const currentPlayer = room.players[room.currentTurnIndex];
    // Seguridad: Solo el turno actual puede enviar
    if (!currentPlayer || currentPlayer.id !== socket.id) return;

    const upperWord = word.toUpperCase().trim();
    const syllable = room.currentSyllable;

    // --- VALIDACIÓN REQUERIDA ---
    let passed = false;
    let errorMsg = '';

    // 1. La palabra contiene la sílaba (ej: "OS" en "MOSCA")
    if (!upperWord.includes(syllable)) {
      errorMsg = `Debe contener "${syllable}"`;
    } 
    // 2. Palabra ya usada
    else if (room.usedWords.has(upperWord)) {
      errorMsg = 'Palabra ya usada';
    } 
    // 3. Diccionario (opcional/flexible para demo)
    else if (DICTIONARY.size > 0 && !DICTIONARY.has(upperWord) && DICTIONARY.size > 50) {
       // Si el diccionario es grande, lo aplicamos estrictamente.
       // Si es pequeño (demo), podríamos ser más laxos, pero el prompt pide corrección.
       // Usaremos el diccionario provisto.
       errorMsg = 'No está en el diccionario';
    } else {
      passed = true;
    }

    if (passed) {
      room.usedWords.add(upperWord);
      socket.emit('word_accepted');
      switchTurn(room, true); // true = 'passed' the bomb
    } else {
      socket.emit('word_rejected', errorMsg);
    }
  });

  // --- DESCONEXIÓN ---
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      
      // Identificar si era líder
      const wasLeader = room.players.find(p => p.id === socket.id)?.isLeader;
      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.players.length === 0) {
        delete rooms[roomId]; // Borrar sala vacía
      } else {
        // Reasignar líder si es necesario
        if (wasLeader && room.players.length > 0) {
          room.players[0].isLeader = true;
        }
        // Si queda 1 jugador en medio del juego, termina
        if (room.players.length < 2 && room.status === 'playing') {
          room.status = 'waiting';
          io.to(roomId).emit('game_over', { winner: 'Nadie (Falta de jugadores)' });
        }
        io.to(roomId).emit('state_update', getPublicState(room));
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Servidor WordExplosion en puerto ${PORT}`);
});
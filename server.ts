import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { GameState, Player, ClientToServerEvents, ServerToClientEvents, LeaderboardEntry } from './types';

// --- Configuration for Render ---
const PORT = process.env.PORT || 3000;

// --- Game Constants ---
const MIN_BOMB_TIME = 10;
const MAX_BOMB_TIME = 30;
const RESET_THRESHOLD = 5;

// --- SPANISH DICTIONARY (Mock) ---
// In a production Render app, this could be loaded from a JSON file.
const DICTIONARY_ES = new Set([
  "casa", "perro", "gato", "arbol", "tiempo", "vida", "juego", "mesa", "silla", "libro",
  "coche", "ciudad", "noche", "dia", "agua", "fuego", "tierra", "aire", "mar", "sol",
  "luna", "estrella", "musica", "arte", "papel", "lapiz", "color", "forma", "luz", "sombra",
  "amigo", "familia", "padre", "madre", "hijo", "hija", "amor", "paz", "guerra", "historia",
  "dinero", "trabajo", "escuela", "clase", "maestro", "alumno", "mente", "cuerpo", "mano", "pie",
  "ojo", "boca", "nariz", "oreja", "pelo", "cara", "brazo", "pierna", "dedo", "uñas",
  "camino", "calle", "viaje", "mundo", "pais", "lugar", "zona", "lado", "parte", "fin",
  "principio", "medio", "centro", "fondo", "arriba", "abajo", "dentro", "fuera", "cerca", "lejos",
  "grande", "pequeño", "bueno", "malo", "nuevo", "viejo", "alto", "bajo", "largo", "corto",
  "rapido", "lento", "fuerte", "debil", "caliente", "frio", "dulce", "salado", "rico", "pobre",
  "feliz", "triste", "listo", "tonto", "facil", "dificil", "claro", "oscuro", "lleno", "vacio",
  "abierto", "cerrado", "libre", "ocupado", "posible", "imposible", "cierto", "falso", "verdad", "mentira",
  "comer", "beber", "dormir", "despertar", "correr", "andar", "saltar", "volar", "nadar", "bailar",
  "cantar", "hablar", "escuchar", "leer", "escribir", "pensar", "sentir", "querer", "amar", "odiar",
  "dar", "recibir", "tener", "hacer", "estar", "ser", "ir", "venir", "ver", "mirar",
  "buscar", "encontrar", "perder", "ganar", "jugar", "empezar", "terminar", "abrir", "cerrar", "cambiar",
  "crear", "romper", "caer", "levantar", "subir", "bajar", "entrar", "salir", "pasar", "quedar",
  "esperar", "vivir", "morir", "nacer", "crecer", "aprender", "enseñar", "saber", "conocer", "entender",
  "recordar", "olvidar", "preguntar", "responder", "pedir", "pagar", "comprar", "vender", "ayudar", "servir",
  "computadora", "teclado", "pantalla", "raton", "internet", "red", "web", "codigo", "dato", "archivo",
  "carpeta", "programa", "sistema", "memoria", "disco", "usuario", "clave", "acceso", "error", "boton",
  "explosion", "bomba", "palabra", "silaba", "turno", "jugador", "equipo", "grupo", "nivel", "puntos",
  "manzana", "platano", "naranja", "limon", "fresa", "uva", "melon", "sandia", "pera", "piña",
  "tomate", "patata", "zanahoria", "cebolla", "ajo", "pan", "leche", "queso", "huevo", "carne",
  "pescado", "pollo", "arroz", "pasta", "sopa", "ensalada", "fruta", "verdura", "dulce", "pastel",
  "chocolate", "helado", "cafe", "te", "jugo", "vino", "cerveza", "alcohol", "fiesta", "baile",
  "cancion", "pelicula", "foto", "imagen", "video", "camara", "telefono", "radio", "television", "noticia",
  "carta", "mensaje", "nota", "texto", "letra", "numero", "cuenta", "valor", "precio", "costo",
  "banco", "bolsa", "mercado", "tienda", "negocio", "empresa", "fabrica", "oficina", "jefe", "empleado"
]);

const SYLLABLES_ES = [
  "ar", "er", "ir", "or", "ur", "an", "en", "in", "on", "un",
  "al", "el", "il", "ol", "ul", "as", "es", "is", "os", "us",
  "ad", "ed", "id", "od", "ud", "tr", "bl", "br", "cl", "cr",
  "fl", "fr", "gl", "gr", "pl", "pr", "ca", "co", "cu", "que",
  "qui", "ga", "go", "gu", "gue", "gui", "za", "ce", "ci", "zo",
  "zu", "ja", "je", "ji", "jo", "ju", "ya", "ye", "yi", "yo",
  "yu", "ñu", "ña", "ñe", "ño", "lla", "lle", "lli", "llo", "llu"
];

// --- Persistent Global State ---
// NOTE: In a free Render instance, this resets if the service spins down.
// For true persistence, connect a Database (Postgres/Mongo).
const GLOBAL_LEADERBOARD = new Map<string, number>();

// Initialize with some bot data for display
GLOBAL_LEADERBOARD.set("Bot_Alpha", 5);
GLOBAL_LEADERBOARD.set("Bot_Beta", 3);

// --- Server Setup ---
const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- Game Session State ---
let players: Player[] = [];
let currentTurnIndex = 0;
let bombTimer = 0;
let maxBombTime = 0;
let currentSyllable = "";
let usedWords = new Set<string>();
let isGameActive = false;
let timerInterval: NodeJS.Timeout | null = null;
let feedbackMessage: string | null = null;
let winner: Player | null = null;

// --- Helpers ---
const normalize = (str: string) => {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

const getRandomSyllable = () => SYLLABLES_ES[Math.floor(Math.random() * SYLLABLES_ES.length)];
const getRandomBombTime = () => Math.floor(Math.random() * (MAX_BOMB_TIME - MIN_BOMB_TIME + 1)) + MIN_BOMB_TIME;

const getLeaderboardArray = (): LeaderboardEntry[] => {
  return Array.from(GLOBAL_LEADERBOARD.entries())
    .map(([name, wins]) => ({ name, wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 10); // Top 10
};

const getNextAlivePlayerIndex = (startIndex: number): number | null => {
  let count = 0;
  let idx = startIndex;
  const totalPlayers = players.length;
  if (totalPlayers === 0) return null;

  do {
    idx = (idx + 1) % totalPlayers;
    if (!players[idx].isDead) return idx;
    count++;
  } while (count < totalPlayers);

  return null;
};

// --- Game Logic ---
const endGame = (winningPlayer: Player | null) => {
  if (timerInterval) clearInterval(timerInterval);
  
  winner = winningPlayer;
  
  if (winningPlayer) {
    // Update Player Session State
    winningPlayer.wins += 1;
    
    // Update Persistent Leaderboard
    const currentWins = GLOBAL_LEADERBOARD.get(winningPlayer.name) || 0;
    GLOBAL_LEADERBOARD.set(winningPlayer.name, currentWins + 1);
  }

  io.emit('gameState', formatState());

  // Auto-return to lobby
  setTimeout(() => {
    isGameActive = false;
    winner = null;
    feedbackMessage = null;
    
    // Reset lives
    players.forEach(p => {
      p.lives = 3;
      p.isDead = false;
    });
    
    io.emit('gameState', formatState());
  }, 6000);
};

const checkWinner = () => {
  const alivePlayers = players.filter(p => !p.isDead);
  if (alivePlayers.length <= 1 && players.length > 1) {
    endGame(alivePlayers[0] || null);
    return true;
  }
  return false;
};

const explodeBomb = () => {
  if (!isGameActive) return;

  const victimIndex = currentTurnIndex;
  const victim = players[victimIndex];
  
  if (victim && !victim.isDead) {
    victim.lives -= 1;
    io.emit('explosion', victim.id);
    
    if (victim.lives <= 0) {
      victim.isDead = true;
    }
  }

  if (checkWinner()) return;

  const nextIndex = getNextAlivePlayerIndex(currentTurnIndex);
  if (nextIndex !== null) {
    currentTurnIndex = nextIndex;
    currentSyllable = getRandomSyllable();
    bombTimer = getRandomBombTime();
    maxBombTime = bombTimer;
    feedbackMessage = `¡BOOM! ${victim.name} pierde una vida.`;
    io.emit('gameState', formatState());
  }
};

const startGame = () => {
  if (players.length < 2) {
    feedbackMessage = "¡Se necesitan min. 2 jugadores!";
    io.emit('gameState', formatState());
    setTimeout(() => { feedbackMessage = null; io.emit('gameState', formatState()); }, 2000);
    return;
  }

  players.forEach(p => { p.lives = 3; p.isDead = false; });
  isGameActive = true;
  winner = null;
  currentTurnIndex = 0;
  usedWords.clear();
  currentSyllable = getRandomSyllable();
  bombTimer = getRandomBombTime();
  maxBombTime = bombTimer;
  feedbackMessage = null;
  
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!isGameActive) return;
    bombTimer -= 0.1;
    if (bombTimer <= 0) {
      bombTimer = 0;
      explodeBomb();
    }
  }, 100);

  // Sync tick
  const syncInterval = setInterval(() => {
     if(isGameActive) io.emit('gameState', formatState());
     else clearInterval(syncInterval);
  }, 100);

  io.emit('gameState', formatState());
};

const formatState = (): GameState => ({
  players,
  currentTurnIndex,
  currentSyllable,
  bombTimer,
  maxBombTime,
  isGameActive,
  winner,
  lastUsedWord: null,
  feedbackMessage,
  leaderboard: getLeaderboardArray()
});

// --- Socket Handlers ---
io.on('connection', (socket: Socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on('joinGame', (name: string) => {
    const safeName = name.trim().substring(0, 12) || `Invitado ${players.length + 1}`;
    const savedWins = GLOBAL_LEADERBOARD.get(safeName) || 0;

    const newPlayer: Player = {
      id: socket.id,
      name: safeName,
      lives: 3,
      isDead: false,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${safeName}`, // Nice circular avatars
      wins: savedWins
    };
    
    players.push(newPlayer);
    io.emit('gameState', formatState());
  });

  socket.on('startGame', () => {
    if (!isGameActive) startGame();
  });

  socket.on('submitWord', (word: string) => {
    if (!isGameActive) return;
    const currentPlayer = players[currentTurnIndex];
    if (socket.id !== currentPlayer.id) return;

    const rawWord = word.trim().toLowerCase();
    const normWord = normalize(rawWord);
    const normSyllable = normalize(currentSyllable);

    // Validation
    if (!normWord.includes(normSyllable)) {
      feedbackMessage = `¡Debe contener "${currentSyllable.toUpperCase()}"!`;
      io.emit('gameState', formatState());
      return;
    }
    if (usedWords.has(normWord)) {
      feedbackMessage = "¡Palabra repetida!";
      io.emit('gameState', formatState());
      return;
    }
    if (!DICTIONARY_ES.has(normWord)) {
       feedbackMessage = "¡No existe en el diccionario!";
       io.emit('gameState', formatState());
       return;
    }

    // Success
    usedWords.add(normWord);
    if (bombTimer < RESET_THRESHOLD) bombTimer = RESET_THRESHOLD; // Bonus time
    
    const nextIndex = getNextAlivePlayerIndex(currentTurnIndex);
    if (nextIndex !== null) {
      currentTurnIndex = nextIndex;
      currentSyllable = getRandomSyllable();
      feedbackMessage = null;
      io.emit('gameState', formatState());
    }
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    
    // Handle active game disconnects
    if (isGameActive && players.length < 2) {
      endGame(null);
      feedbackMessage = "Jugador desconectado. Fin del juego.";
      io.emit('gameState', formatState());
    } else if (isGameActive) {
       // If it was their turn, pass it
       if (currentTurnIndex >= players.length) currentTurnIndex = 0;
       io.emit('gameState', formatState());
    } else {
      io.emit('gameState', formatState());
    }
  });
});

// --- Static Serving for Render ---
// Serve built frontend files from 'dist' directory
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all route for SPA (React)
app.get('*', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`Servidor WordExplosion corriendo en puerto ${PORT}`);
});
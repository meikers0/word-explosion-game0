export interface Player {
  id: string;
  name: string;
  lives: number;
  isDead: boolean;
  avatar: string;
  wins: number; // Tracks individual session wins
}

export interface LeaderboardEntry {
  name: string;
  wins: number;
}

export interface GameState {
  players: Player[];
  currentTurnIndex: number;
  currentSyllable: string;
  bombTimer: number;
  maxBombTime: number;
  isGameActive: boolean; // Determines if we are in Lobby or Game
  winner: Player | null;
  lastUsedWord: string | null;
  feedbackMessage: string | null;
  leaderboard: LeaderboardEntry[]; // Global leaderboard for the Lobby
}

export interface ClientToServerEvents {
  joinGame: (name: string) => void;
  submitWord: (word: string) => void;
  startGame: () => void;
  restartGame: () => void;
}

export interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  explosion: (victimId: string) => void;
  error: (msg: string) => void;
}
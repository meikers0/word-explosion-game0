import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Bomb, Heart, AlertCircle, Play, Skull, Trophy, Crown, Zap, User } from 'lucide-react';
import { GameState, Player, ClientToServerEvents, ServerToClientEvents } from './types';

// Automatically determine URL based on environment (dev vs prod)
const SOCKET_URL = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:3000';

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connected, setConnected] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);
  const [inputWord, setInputWord] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [shake, setShake] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const playerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // --- Socket Init ---
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5
    });
    
    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));
    newSocket.on('gameState', (state) => setGameState(state));
    newSocket.on('explosion', () => {
       setShake(true);
       setTimeout(() => setShake(false), 1000);
    });

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, []);

  // --- Auto Focus ---
  useEffect(() => {
    const currentPlayer = gameState?.players[gameState.currentTurnIndex];
    const isMyTurn = socket?.id === currentPlayer?.id;
    
    if (gameState?.isGameActive && isMyTurn && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameState?.currentTurnIndex, gameState?.isGameActive, socket?.id]);

  // --- Smooth Scroll to Active Player (Footer) ---
  useEffect(() => {
    if (gameState?.isGameActive && gameState.players.length > 0) {
      const currentPlayer = gameState.players[gameState.currentTurnIndex];
      if (currentPlayer) {
        const element = playerRefs.current.get(currentPlayer.id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }
  }, [gameState?.currentTurnIndex, gameState?.isGameActive]);

  // --- Handlers ---
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && socket) {
      socket.emit('joinGame', playerName);
      setJoined(true);
    }
  };

  const handleSubmitWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !inputWord.trim()) return;
    socket.emit('submitWord', inputWord);
    setInputWord('');
  };

  const handleStartGame = () => {
    if(socket) socket.emit('startGame');
  };

  // --- LOADING SCREEN ---
  if (!connected && !gameState) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4 text-center">
         <div className="animate-spin mb-4">
            <Bomb size={48} className="text-red-500" />
         </div>
         <h1 className="text-2xl font-mono">Conectando al Servidor...</h1>
      </div>
    );
  }

  // --- LOGIN SCREEN ---
  if (!joined) {
    return (
      <div className="h-screen w-full bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 -z-10"/>
         <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-700/50"
         >
            <div className="flex justify-center mb-6 text-red-500 animate-bounce">
              <Bomb size={64} />
            </div>
            <h1 className="text-4xl font-black text-center text-white mb-2 font-sans tracking-tighter">
              WORD<span className="text-red-500">EXPLOSION</span>
            </h1>
            <p className="text-slate-400 text-center mb-8 font-mono text-sm uppercase tracking-widest">
              Versión Española
            </p>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs uppercase tracking-widest font-bold mb-2">Nombre de Agente</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20}/>
                  <input 
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full bg-slate-900 border-2 border-slate-700 text-white pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:border-red-500 transition-colors font-mono text-lg"
                    placeholder="Tu Nombre"
                    maxLength={12}
                    required
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold py-4 rounded-lg shadow-lg transform transition hover:-translate-y-1 active:translate-y-0 flex justify-center items-center gap-2"
              >
                <Zap size={20} /> UNIRSE A LA SALA
              </button>
            </form>
         </motion.div>
      </div>
    );
  }

  if (!gameState) return null;

  const myPlayer = gameState.players.find(p => p.id === socket?.id);
  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const isMyTurn = socket?.id === currentPlayer?.id;
  const bombPercent = (gameState.bombTimer / gameState.maxBombTime) * 100;
  const isLeader = gameState.players[0]?.id === socket?.id;
  
  // Bomb visual logic
  const bombColor = bombPercent < 20 ? 'bg-red-600' : bombPercent < 50 ? 'bg-orange-500' : 'bg-green-500';

  // --- LOBBY VIEW (Waiting Room) ---
  if (!gameState.isGameActive && !gameState.winner) {
     return (
        <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center font-sans">
           <header className="w-full max-w-4xl flex justify-between items-center mb-8 border-b border-slate-800 pb-4 pt-2">
              <div className="flex items-center gap-2">
                 <Bomb className="text-red-500" />
                 <span className="font-black text-xl">WORD<span className="text-slate-500">EXPLOSION</span></span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-green-400 bg-green-900/20 px-3 py-1 rounded border border-green-900/50">
                 <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/> EN LÍNEA
              </div>
           </header>

           <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left: Player List & Actions */}
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl flex flex-col">
                 <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-200">
                    <Crown size={20} className="text-yellow-500"/> Jugadores en Sala ({gameState.players.length})
                 </h2>
                 
                 <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2 pr-1 custom-scrollbar mb-6">
                    {gameState.players.map(p => (
                       <div key={p.id} className="flex items-center gap-3 bg-slate-700/30 p-2 rounded-lg border border-slate-700/50">
                          <img src={p.avatar} alt="av" className="w-10 h-10 rounded-full bg-slate-600"/>
                          <div className="flex-1 min-w-0">
                             <div className="font-bold text-sm truncate">{p.name}</div>
                             <div className="text-xs text-slate-400 flex items-center gap-1">
                                <Trophy size={10} className="text-yellow-500"/> {p.wins} Victorias
                             </div>
                          </div>
                          {p.id === socket?.id && <span className="text-[10px] bg-slate-600 px-2 py-0.5 rounded text-slate-300">TÚ</span>}
                       </div>
                    ))}
                 </div>
                 
                 <div className="mt-auto">
                    {gameState.players.length >= 2 ? (
                       isLeader ? (
                          <button 
                             onClick={handleStartGame}
                             className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-900/20 flex justify-center items-center gap-2 transition-all active:scale-95"
                          >
                             <Play size={20} fill="currentColor" /> INICIAR PARTIDA
                          </button>
                       ) : (
                          <div className="text-center text-slate-400 text-sm animate-pulse bg-slate-900/50 py-3 rounded-xl">
                             Esperando que el líder inicie...
                          </div>
                       )
                    ) : (
                       <div className="text-center text-yellow-500 bg-yellow-500/10 p-3 rounded-xl border border-yellow-500/20 text-sm">
                          Se necesitan al menos 2 jugadores.
                       </div>
                    )}
                 </div>
              </div>

              {/* Right: Persistent Leaderboard */}
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl">
                 <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-200">
                    <Trophy size={20} className="text-yellow-400"/> Top 10 Global
                 </h2>
                 <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700/50">
                    <table className="w-full text-left">
                       <thead className="bg-slate-700/50 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                          <tr>
                             <th className="p-3">#</th>
                             <th className="p-3">Agente</th>
                             <th className="p-3 text-right">Wins</th>
                          </tr>
                       </thead>
                       <tbody className="text-sm divide-y divide-slate-800">
                          {gameState.leaderboard.map((entry, idx) => (
                             <tr key={idx} className="hover:bg-slate-700/20 transition-colors">
                                <td className="p-3 font-mono text-slate-500 w-8">
                                   {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                </td>
                                <td className="p-3 font-medium text-slate-200">{entry.name}</td>
                                <td className="p-3 text-right font-mono text-yellow-500 font-bold">{entry.wins}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
     );
  }

  // --- GAME VIEW ---
  return (
    <div className={`h-screen w-full bg-slate-900 overflow-hidden flex flex-col ${shake ? 'animate-shake' : ''}`}>
      
      {/* TOP BAR */}
      <header className="h-14 bg-slate-800/80 backdrop-blur border-b border-slate-700 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center space-x-2">
          <Bomb className="text-red-500" size={20} />
          <span className="font-black text-lg tracking-tighter hidden sm:block">WORD<span className="text-slate-400">EXPLOSION</span></span>
        </div>
        <div className="font-mono text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-700">
           VIVOS: <span className="text-white">{gameState.players.filter(p => !p.isDead).length}</span> / {gameState.players.length}
        </div>
      </header>

      {/* MAIN AREA */}
      <main className="flex-grow flex flex-col items-center justify-center relative p-4 w-full max-w-4xl mx-auto">
        
        {/* WINNER OVERLAY */}
        <AnimatePresence>
          {gameState.winner && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/90 backdrop-blur-md"
            >
               <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute -z-10 opacity-20"
               >
                  <div className="w-[500px] h-[500px] bg-gradient-to-r from-yellow-500 via-red-500 to-pink-500 rounded-full blur-3xl"/>
               </motion.div>

              <div className="text-9xl mb-4 drop-shadow-2xl">🏆</div>
              <h2 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tight text-center">¡VICTORIA!</h2>
              <div className="bg-slate-800 border border-yellow-500/30 px-8 py-4 rounded-2xl flex flex-col items-center mb-8 shadow-2xl">
                 <img src={gameState.winner.avatar} className="w-20 h-20 rounded-full border-4 border-yellow-500 mb-2 shadow-lg"/>
                 <span className="text-3xl font-bold text-yellow-400">{gameState.winner.name}</span>
                 <span className="text-sm text-slate-400 uppercase tracking-widest mt-1">+1 Victoria Global</span>
              </div>
              <div className="animate-pulse text-slate-500 font-mono text-sm">Regresando al Lobby...</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ACTIVE GAMEPLAY */}
        {gameState.isGameActive && !gameState.winner && (
          <div className="w-full flex flex-col items-center">
            
            {/* SYLLABLE */}
            <motion.div 
               key={gameState.currentSyllable}
               initial={{ scale: 0.5, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               className="mb-8"
            >
              <div className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-2">Sílaba</div>
              <div className="bg-slate-800 border border-slate-600 px-12 py-6 rounded-2xl shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
                <span className="text-6xl md:text-7xl font-black font-mono text-white uppercase tracking-wide">
                   {gameState.currentSyllable}
                </span>
              </div>
            </motion.div>

            {/* BOMB */}
            <div className="relative w-48 h-48 mb-10 flex items-center justify-center">
                <motion.div 
                  animate={{ scale: [1, 1.05 + (100 - bombPercent)/300], opacity: [0.2, 0] }}
                  transition={{ repeat: Infinity, duration: Math.max(0.2, bombPercent / 200) }}
                  className={`absolute inset-0 rounded-full ${bombColor}`}
                />
                
                <motion.div 
                  animate={{ rotate: bombPercent < 20 ? [-3, 3, -3] : 0 }}
                  transition={{ repeat: Infinity, duration: 0.1 }}
                  className={`w-40 h-40 rounded-full ${bombColor} shadow-[inset_0_-8px_16px_rgba(0,0,0,0.4)] flex items-center justify-center relative border-4 border-black/20`}
                >
                    {/* Spark */}
                    <motion.div 
                      className="absolute -top-2 right-8 w-4 h-4 bg-yellow-300 rounded-full blur-sm z-10"
                      animate={{ opacity: [1, 0.2], scale: [1, 1.5] }}
                      transition={{ repeat: Infinity, duration: 0.05 }}
                    />
                    
                    <div className="text-center z-10">
                       <span className={`text-5xl font-black text-white font-mono drop-shadow-md`}>
                         {Math.ceil(gameState.bombTimer)}
                       </span>
                       <div className="text-white/70 text-[10px] font-bold uppercase mt-0.5">SEG</div>
                    </div>
                </motion.div>
            </div>

            {/* FEEDBACK & INPUT */}
            <div className="w-full max-w-md relative z-20 px-4">
               <div className="h-8 mb-2 flex items-center justify-center">
                 <AnimatePresence mode="wait">
                   {gameState.feedbackMessage && (
                      <motion.div
                        key={gameState.feedbackMessage}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-red-400 text-sm font-bold flex items-center gap-1 bg-slate-900/80 px-3 py-1 rounded-full"
                      >
                         <AlertCircle size={14}/> {gameState.feedbackMessage}
                      </motion.div>
                   )}
                 </AnimatePresence>
               </div>

               <form onSubmit={handleSubmitWord}>
                 <div className="relative group">
                   <input
                     ref={inputRef}
                     type="text"
                     value={inputWord}
                     onChange={(e) => setInputWord(e.target.value)}
                     disabled={!isMyTurn || myPlayer?.isDead}
                     placeholder={isMyTurn ? `Escribe palabra con "${gameState.currentSyllable}"` : `Turno de ${currentPlayer?.name}...`}
                     className={`w-full text-center text-xl py-4 rounded-xl border-b-4 font-mono outline-none transition-all
                        ${isMyTurn 
                          ? 'bg-slate-100 text-slate-900 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] transform scale-105' 
                          : 'bg-slate-800 text-slate-500 border-slate-700 opacity-60'
                        }
                        ${myPlayer?.isDead ? 'opacity-30 cursor-not-allowed' : ''}
                     `}
                     autoFocus
                   />
                 </div>
               </form>
            </div>

          </div>
        )}
      </main>

      {/* FOOTER: PLAYER LIST & SMOOTH SCROLL */}
      <footer className="h-36 bg-slate-800/80 border-t border-slate-700 backdrop-blur flex flex-col shrink-0">
         <div className="h-full flex items-center overflow-x-auto px-6 gap-4 scrollbar-hide mask-linear pb-4 pt-4" style={{ scrollBehavior: 'smooth' }}>
            {gameState.players.map((p, idx) => {
               const isCurrent = idx === gameState.currentTurnIndex && gameState.isGameActive;
               
               return (
                 <div 
                   key={p.id}
                   ref={(el) => { if (el) playerRefs.current.set(p.id, el); }}
                   className={`
                     relative flex flex-col items-center justify-center p-2 rounded-xl min-w-[90px] transition-all duration-500
                     ${isCurrent 
                        ? 'bg-slate-700 border-2 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] -translate-y-2 scale-110 z-10' 
                        : 'bg-slate-800/50 border border-slate-700/50 opacity-60 scale-95 grayscale-[0.3]'
                     }
                     ${p.isDead ? 'opacity-40 grayscale' : ''}
                   `}
                 >
                    {isCurrent && (
                       <div className="absolute -top-2.5 bg-green-500 text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm">
                         TURNO
                       </div>
                    )}

                    <div className="relative mb-1.5">
                       <img 
                          src={p.avatar} 
                          alt="p" 
                          className={`w-10 h-10 rounded-full bg-slate-600 object-cover ${isCurrent ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-slate-700' : ''}`}
                       />
                       {p.isDead && (
                          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                             <Skull size={20} className="text-red-500"/>
                          </div>
                       )}
                    </div>
                    
                    <div className="font-bold text-[10px] text-slate-200 w-20 text-center truncate font-mono">
                       {p.name}
                    </div>
                    
                    <div className="flex gap-0.5 mt-1 justify-center">
                       {[...Array(3)].map((_, i) => (
                          <Heart 
                            key={i} 
                            size={10} 
                            className={`transition-colors ${i < p.lives ? "text-red-500 fill-red-500" : "text-slate-600 fill-slate-600/20"}`}
                          />
                       ))}
                    </div>
                 </div>
               );
            })}
         </div>
      </footer>

    </div>
  );
};

export default App;
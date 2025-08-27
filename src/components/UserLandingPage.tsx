// src/components/UserLandingPage.tsx - UPDATED: Enhanced with winner display support
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TicketBookingGrid } from './TicketBookingGrid';
import { UserDisplay } from './UserDisplay';
import { RecentWinnersDisplay } from './RecentWinnersDisplay';
import { GameDataProvider } from '@/providers/GameDataProvider';
import { useActiveGamesSubscription } from '@/hooks/useSupabaseSubscription';
import type { GameData } from '@/services/supabase-types';
import { 
  Loader2, 
  Trophy, 
  Gamepad2, 
  Phone,
  Ticket,
  RefreshCw,
  Activity,
  Clock,
  Zap,
  CheckCircle
} from 'lucide-react';

interface UserLandingPageProps {
  onGameSelection?: (gameId: string) => void;
  selectedGameId?: string | null;
  // ✅ UNCHANGED: Accept pre-loaded games for instant display
  preloadedGames?: GameData[];
  gamesLoading?: boolean;
  gamesError?: string | null;
}

// 🔧 MODIFIED: Enhanced game summary interface with winner information
interface GameSummary {
  gameId: string;
  name: string;
  hostPhone?: string;
  maxTickets: number;
  isActive: boolean;
  isCountdown: boolean;
  hasStarted: boolean;
  gameOver: boolean; // 🆕 NEW: Track if game is completed
  bookedTickets: number;
  createdAt: string;
  // 🆕 NEW: Winner information for completed games
  winnerCount?: number;
  prizesWon?: number;
  totalPrizes?: number;
}

export const UserLandingPage: React.FC<UserLandingPageProps> = ({ 
  onGameSelection, 
  selectedGameId,
  preloadedGames = [],
  gamesLoading = false,
  gamesError = null
}) => {
  const [currentView, setCurrentView] = useState<'list' | 'booking' | 'game' | 'winners'>('list'); // 🆕 NEW: Add winners view
  
  // ✅ UNCHANGED: Use pre-loaded games with fallback subscription (now includes completed games)
  const fallbackSubscription = useActiveGamesSubscription();
  const shouldUseFallback = preloadedGames.length === 0 && !gamesLoading && !gamesError;
  
  // ✅ UNCHANGED: Choose data source (preloaded vs subscription)
  const gameDataSource = useMemo(() => {
    if (preloadedGames.length > 0 || gamesLoading || gamesError) {
      // Use pre-loaded data (faster path)
      return {
        games: preloadedGames,
        loading: gamesLoading,
        error: gamesError,
        source: 'preloaded'
      };
    } else {
      // Fallback to subscription (slower path)
      return {
        games: fallbackSubscription.data || [],
        loading: fallbackSubscription.loading,
        error: fallbackSubscription.error,
        source: 'subscription'
      };
    }
  }, [preloadedGames, gamesLoading, gamesError, fallbackSubscription]);

  // 🔧 MODIFIED: Enhanced game summaries with winner information
  const gameSummaries: GameSummary[] = useMemo(() => {
    if (!gameDataSource.games) return [];
    
    return gameDataSource.games.map(game => {
      const bookedTickets = game.tickets ? 
        Object.values(game.tickets).filter(t => t.isBooked).length : 0;
      
      // 🆕 NEW: Calculate winner statistics for completed games
      let winnerCount = 0;
      let prizesWon = 0;
      const totalPrizes = Object.keys(game.prizes).length;
      
      if (game.gameState.gameOver) {
        const wonPrizes = Object.values(game.prizes).filter(p => p.won);
        prizesWon = wonPrizes.length;
        winnerCount = wonPrizes.reduce((total, prize) => 
          total + (prize.winners?.length || 0), 0
        );
      }
      
      return {
        gameId: game.gameId,
        name: game.name,
        hostPhone: game.hostPhone,
        maxTickets: game.maxTickets,
        isActive: game.gameState.isActive,
        isCountdown: game.gameState.isCountdown,
        hasStarted: (game.gameState.calledNumbers?.length || 0) > 0,
        gameOver: game.gameState.gameOver, // 🆕 NEW
        bookedTickets,
        createdAt: game.createdAt,
        // 🆕 NEW: Winner statistics
        winnerCount,
        prizesWon,
        totalPrizes
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [gameDataSource.games]);

  // 🔧 MODIFIED: Handle completed game selection
  const selectGame = useCallback((gameId: string) => {
    console.log('🎯 Selecting game:', gameId);
    
    if (onGameSelection) {
      onGameSelection(gameId);
    }
    
    const selectedGame = gameDataSource.games?.find(g => g.gameId === gameId);
    if (selectedGame) {
      // 🆕 NEW: Handle completed games
      if (selectedGame.gameState.gameOver) {
        console.log('🏆 Selected completed game - showing winners');
        setCurrentView('winners');
        return;
      }
      
      // ✅ UNCHANGED: Existing active game logic
      const hasStarted = (selectedGame.gameState.calledNumbers?.length || 0) > 0 || 
                        selectedGame.gameState.isActive || 
                        selectedGame.gameState.isCountdown;
      
      setCurrentView(hasStarted ? 'game' : 'booking');
    }
  }, [onGameSelection, gameDataSource.games]);
  // 🔥 AUTO-NAVIGATION: Automatically switch views when game state changes in real-time
useEffect(() => {
  // STEP 1: Only run when a specific game is selected (not on the games list page)
  if (!selectedGameId || currentView === 'list') {
    // If no game selected or we're on the games list, don't do anything
    return;
  }
  
  // STEP 2: Find the currently selected game from the real-time supabase data
  const selectedGame = gameDataSource.games?.find(g => g.gameId === selectedGameId);
  
  // STEP 3: If the game doesn't exist anymore, go back to the games list
  if (!selectedGame) {
    console.log('🔍 Game not found, returning to list');
    setCurrentView('list');
    if (onGameSelection) {
      onGameSelection('');
    }
    return;
  }
  
  // STEP 4: Determine what view should be shown based on current game state
  let shouldShowView: 'booking' | 'game' | 'winners';
  
  if (selectedGame.gameState.gameOver) {
    // Case 1: Game is finished → show winners page
    shouldShowView = 'winners';
    console.log('🏆 Game finished, should show winners');
    
  } else if (
    selectedGame.gameState.isActive || 
    selectedGame.gameState.isCountdown || 
    (selectedGame.gameState.calledNumbers?.length || 0) > 0
  ) {
    // Case 2: Game has started (active, countdown, or numbers called) → show live game
    shouldShowView = 'game';
    console.log('🎮 Game started, should show live game');
    
  } else {
    // Case 3: Game not started yet → show booking page
    shouldShowView = 'booking';
    console.log('🎫 Game not started, should show booking');
  }
  
  // STEP 5: Only switch views if the target view is different from current view
  if (currentView !== shouldShowView) {
    console.log(`🔄 AUTO-SWITCHING VIEW: ${currentView} → ${shouldShowView}`, {
      gameId: selectedGameId,
      gameOver: selectedGame.gameState.gameOver,
      isActive: selectedGame.gameState.isActive,
      isCountdown: selectedGame.gameState.isCountdown,
      calledNumbers: selectedGame.gameState.calledNumbers?.length || 0
    });
    
    // Make the switch!
    setCurrentView(shouldShowView);
  }
  
}, [selectedGameId, currentView, gameDataSource.games, onGameSelection]);

  // ✅ NEW: Listen for explicit game end events for players
  useEffect(() => {
    const handleGameEnd = (event: CustomEvent) => {
      const { gameId: endedGameId } = event.detail;
      console.log(`🎉 Player received game end event for game ${endedGameId} - current game: ${selectedGameId}`);
      
      if (endedGameId === selectedGameId && currentView !== 'winners') {
        console.log('✅ Game end event matches current game - redirecting to winners');
        setTimeout(() => {
          setCurrentView('winners');
          console.log('🏆 Player force-redirected to winners via custom event');
        }, 500);
      }
    };

    window.addEventListener('tambola-game-ended', handleGameEnd as EventListener);
    
    return () => {
      window.removeEventListener('tambola-game-ended', handleGameEnd as EventListener);
    };
  }, [selectedGameId, currentView]);

  // ✅ UNCHANGED: All existing handler functions
  const handleBookTicket = async (ticketId: string, playerName: string, playerPhone: string) => {
    const selectedGame = gameDataSource.games?.find(g => g.gameId === selectedGameId);
    if (!selectedGame) return;

    try {
      await supabaseService.bookTicket(ticketId, playerName, playerPhone, selectedGame.gameId);
      console.log('✅ Ticket booked successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to book ticket');
    }
  };

  const handleBackToList = useCallback(() => {
    setCurrentView('list');
    if (onGameSelection) {
      onGameSelection('');
    }
  }, [onGameSelection]);

  // 🆕 NEW: Winners view rendering
  if (currentView === 'winners' && selectedGameId) {
    return (
      <GameDataProvider gameId={selectedGameId}>
        <div className="space-y-4">
          <div className="p-4 bg-white">
            <Button 
              onClick={handleBackToList} 
              className="bg-black text-white hover:bg-gray-800 border-black"
            >
              ← Back to Games
            </Button>
          </div>
          <RecentWinnersDisplay />
        </div>
      </GameDataProvider>
    );
  }

  // ✅ UNCHANGED: All existing view rendering logic (game, booking, loading, error)
  if (currentView === 'game' && selectedGameId) {
    return (
      <GameDataProvider gameId={selectedGameId}>
        <div className="space-y-4">
          <div className="p-4 text-white">
           <Button 
              onClick={handleBackToList} 
              className="bg-black text-white hover:bg-gray-800 border-black"
            >
              ← Back to Games
            </Button>
          </div>
          <UserDisplay />
        </div>
      </GameDataProvider>
    );
  }

   if (currentView === 'booking' && selectedGameId) {
  const selectedGame = gameDataSource.games?.find(g => g.gameId === selectedGameId);
  
  if (!selectedGame) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 p-4 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-600">Game not found</p>
            <Button onClick={handleBackToList} className="mt-4">
              Back to Games
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ NOTE: We removed the conflicting auto-switch logic here
  // Our new useEffect handles all transitions automatically

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button 
              onClick={handleBackToList} 
              className="bg-black text-white hover:bg-gray-800 border-black"
            >
              ← Back to Games
            </Button>
          <div className="flex items-center space-x-2">
            <Badge variant="default">Booking Phase</Badge>
            <Badge variant="outline" className="text-green-600 border-green-400">
              <Activity className="w-3 h-3 mr-1" />
              Live Updates
            </Badge>
          </div>
        </div>

        <TicketBookingGrid 
          tickets={selectedGame.tickets || {}}
          gameData={selectedGame}
          onBookTicket={handleBookTicket}
          onGameStart={() => setCurrentView('game')}
        />
      </div>
    </div>
  );
}

  // ✅ UNCHANGED: Loading and error states
  if (gameDataSource.loading && gameSummaries.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">
            {gameDataSource.source === 'preloaded' ? 'Loading games...' : 'Connecting to game server...'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {gameDataSource.source === 'preloaded' ? 'Fast loading enabled' : 'Enhanced view with winners'}
          </p>
        </div>
      </div>
    );
  }

  if (gameDataSource.error && gameSummaries.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Connection Error</h2>
            <p className="text-gray-600 mb-4">{gameDataSource.error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 🔧 MODIFIED: Enhanced games list with completed game indicators
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ✅ UNCHANGED: Welcome Header */}
        <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-orange-200">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              Welcome to Tambola!
            </CardTitle>
            <p className="text-gray-600 text-lg mt-2">
              Join the excitement! Book your tickets and play live Tambola games.
            </p>
           
          </CardHeader>
        </Card>

        {/* 🔧 MODIFIED: Enhanced Games List */}
        {gameSummaries.length === 0 ? (
          <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-orange-200">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4">🎯</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">No Games Available</h2>
              <p className="text-gray-600 mb-4">
                There are currently no active or recent Tambola games. Check back soon!
              </p>
              <Button 
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-orange-200">
            <CardHeader>
              <CardTitle className="text-2xl text-gray-800 text-center">
                Available Games ({gameSummaries.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gameSummaries.map((game, index) => (
                  <Card 
                    key={game.gameId}
                    className={`cursor-pointer transition-all duration-200 border-gray-200 hover:border-orange-300 hover:shadow-lg ${
                      index === 0 ? 'ring-2 ring-blue-200' : ''
                    } ${game.gameOver ? 'bg-gradient-to-br from-yellow-50 to-orange-50' : ''}`}
                    onClick={() => selectGame(game.gameId)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 text-lg">{game.name}</h3>
                          {index === 0 && (
                            <p className="text-xs text-blue-600 font-medium">← Most Recent</p>
                          )}
                        </div>
                        <Badge 
                          variant={
                            game.isActive ? "default" :
                            game.isCountdown ? "secondary" :
                            game.hasStarted && !game.gameOver ? "destructive" :
                            game.gameOver ? "outline" : // 🆕 NEW: Completed games
                            "outline"
                          }
                          className={game.gameOver ? "border-yellow-500 text-yellow-700 bg-yellow-100" : ""}
                        >
                          {game.isActive ? '🔴 Live' : 
                           game.isCountdown ? '🟡 Starting' : 
                           game.hasStarted && !game.gameOver ? '🎮 Playing' :
                           game.gameOver ? '🏆 Completed' : // 🆕 NEW
                           '⚪ Booking'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        {!game.gameOver ? (
                          // ✅ UNCHANGED: Active game display
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Ticket className="w-4 h-4 mr-2 text-blue-600" />
                                <span className="text-sm text-gray-600">Tickets</span>
                              </div>
                              <span className="font-semibold text-blue-600">
                                {game.bookedTickets}/{game.maxTickets}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Trophy className="w-4 h-4 mr-2 text-purple-600" />
                                <span className="text-sm text-gray-600">Available</span>
                              </div>
                              <span className="font-semibold text-purple-600">
                                {game.maxTickets - game.bookedTickets} tickets
                              </span>
                            </div>
                          </>
                        ) : (
                          // 🆕 NEW: Completed game display
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Trophy className="w-4 h-4 mr-2 text-yellow-600" />
                                <span className="text-sm text-gray-600">Winners</span>
                              </div>
                              <span className="font-semibold text-yellow-600">
                                {game.winnerCount || 0} players
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                <span className="text-sm text-gray-600">Prizes Won</span>
                              </div>
                              <span className="font-semibold text-green-600">
                                {game.prizesWon || 0}/{game.totalPrizes || 0}
                              </span>
                            </div>
                          </>
                        )}
                        
                        {game.hostPhone && (
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-2 text-green-600" />
                            <span className="text-sm text-gray-600">{game.hostPhone}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 pt-3 border-t">
                        <Button 
                          className={`w-full ${
                            game.gameOver 
                              ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600' 
                              : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                          } text-white`}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectGame(game.gameId);
                          }}
                        >
                          {game.gameOver ? (
                            <>
                              <Trophy className="w-4 h-4 mr-2" />
                              View Winners
                            </>
                          ) : game.hasStarted ? (
                            <>
                              <Gamepad2 className="w-4 h-4 mr-2" />
                              Watch Game
                            </>
                          ) : (
                            <>
                              <Ticket className="w-4 h-4 mr-2" />
                              Join Game
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* ✅ UPDATED: Performance info */}
              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    {gameDataSource.source === 'preloaded' ? (
                      <Zap className="w-4 h-4 mr-1 text-green-600" />
                    ) : (
                      <Activity className="w-4 h-4 mr-1 text-blue-600" />
                    )}
                    <span>
                      {gameDataSource.source === 'preloaded' 
                        ? 'Fast loading active - Games loaded instantly' 
                        : 'Live view - Active games + recent winners available'
                      }
                    </span>
                  </div>
                  {gameDataSource.loading && (
                    <div className="flex items-center text-orange-600">
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      <span>Refreshing...</span>
                    </div>
                  )}
                </div>
               </div>
            </CardContent>
          </Card>
        )}

        {/* Footer - Copyright */}
        <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-orange-200">
          <CardContent className="p-4">
            <div className="text-center text-sm text-gray-600">
              <p>
                Developed and designed by <span className="font-semibold text-gray-800">Innovative Archive</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                © 2025 All rights reserved. ™
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

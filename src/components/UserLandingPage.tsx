// src/components/UserLandingPage.tsx - OPTIMIZED: Uses pre-loaded games for instant display
import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TicketBookingGrid } from './TicketBookingGrid';
import { UserDisplay } from './UserDisplay';
import { GameDataProvider } from '@/providers/GameDataProvider';
import { useActiveGamesSubscription } from '@/hooks/useFirebaseSubscription';
import { firebaseService, GameData } from '@/services/firebase';
import { 
  Loader2, 
  Trophy, 
  Gamepad2, 
  Phone,
  Ticket,
  RefreshCw,
  Activity,
  Clock,
  Zap
} from 'lucide-react';

interface UserLandingPageProps {
  onGameSelection?: (gameId: string) => void;
  selectedGameId?: string | null;
  // ✅ NEW: Accept pre-loaded games for instant display
  preloadedGames?: GameData[];
  gamesLoading?: boolean;
  gamesError?: string | null;
}

// Simplified game summary for list view
interface GameSummary {
  gameId: string;
  name: string;
  hostPhone?: string;
  maxTickets: number;
  isActive: boolean;
  isCountdown: boolean;
  hasStarted: boolean;
  bookedTickets: number;
  createdAt: string;
}

export const UserLandingPage: React.FC<UserLandingPageProps> = ({ 
  onGameSelection, 
  selectedGameId,
  preloadedGames = [],
  gamesLoading = false,
  gamesError = null
}) => {
  const [currentView, setCurrentView] = useState<'list' | 'booking' | 'game'>('list');
  
  // ✅ NEW: Use pre-loaded games with fallback subscription
  // Only subscribe if pre-loaded games aren't available
  const fallbackSubscription = useActiveGamesSubscription();
  const shouldUseFallback = preloadedGames.length === 0 && !gamesLoading && !gamesError;
  
  // ✅ OPTIMIZED: Choose data source (preloaded vs subscription)
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

  // Convert to summaries for list view
  const gameSummaries: GameSummary[] = useMemo(() => {
    if (!gameDataSource.games) return [];
    
    return gameDataSource.games.map(game => {
      const bookedTickets = game.tickets ? 
        Object.values(game.tickets).filter(t => t.isBooked).length : 0;
      
      return {
        gameId: game.gameId,
        name: game.name,
        hostPhone: game.hostPhone,
        maxTickets: game.maxTickets,
        isActive: game.gameState.isActive,
        isCountdown: game.gameState.isCountdown,
        hasStarted: (game.gameState.calledNumbers?.length || 0) > 0,
        bookedTickets,
        createdAt: game.createdAt
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [gameDataSource.games]);

  // Handle game selection
  const selectGame = useCallback((gameId: string) => {
    console.log('🎯 Selecting game:', gameId);
    
    if (onGameSelection) {
      onGameSelection(gameId);
    }
    
    // Determine view based on selected game state
    const selectedGame = gameDataSource.games?.find(g => g.gameId === gameId);
    if (selectedGame) {
      const hasStarted = (selectedGame.gameState.calledNumbers?.length || 0) > 0 || 
                        selectedGame.gameState.isActive || 
                        selectedGame.gameState.isCountdown ||
                        selectedGame.gameState.gameOver;
      
      setCurrentView(hasStarted ? 'game' : 'booking');
    }
  }, [onGameSelection, gameDataSource.games]);

  // Handle booking a ticket
  const handleBookTicket = async (ticketId: string, playerName: string, playerPhone: string) => {
    const selectedGame = gameDataSource.games?.find(g => g.gameId === selectedGameId);
    if (!selectedGame) return;

    try {
      await firebaseService.bookTicket(ticketId, playerName, playerPhone, selectedGame.gameId);
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

  // Show game view with provider
  if (currentView === 'game' && selectedGameId) {
    return (
      <GameDataProvider gameId={selectedGameId}>
        <div className="space-y-4">
          <div className="p-4 bg-white">
            <Button onClick={handleBackToList} variant="outline">
              ← Back to Games
            </Button>
          </div>
          <UserDisplay />
        </div>
      </GameDataProvider>
    );
  }

  // Show booking view
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

    // Check if game started while in booking view
    const hasGameStarted = (selectedGame.gameState.calledNumbers?.length || 0) > 0 || 
                          selectedGame.gameState.isActive || 
                          selectedGame.gameState.isCountdown;

    if (hasGameStarted) {
      // Auto-switch to game view
      setCurrentView('game');
      return null; // Will re-render with game view
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button onClick={handleBackToList} variant="outline">
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

  // ✅ NEW: Show immediate loading only if no games available
  if (gameDataSource.loading && gameSummaries.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">
            {gameDataSource.source === 'preloaded' ? 'Loading games...' : 'Connecting to game server...'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {gameDataSource.source === 'preloaded' ? 'Fast loading enabled' : 'Fallback mode active'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
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

  // ✅ OPTIMIZED: Games list view with performance indicators
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Welcome Header */}
        <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-orange-200">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              🎲 Welcome to Tambola! 🎲
            </CardTitle>
            <p className="text-gray-600 text-lg mt-2">
              Join the excitement! Book your tickets and play live Tambola games.
            </p>
            <div className="flex justify-center items-center space-x-4 mt-4 text-sm">
              {/* ✅ NEW: Performance indicators */}
              <Badge variant="default" className="flex items-center bg-green-600">
                {gameDataSource.source === 'preloaded' ? (
                  <>
                    <Zap className="w-3 h-3 mr-1" />
                    Fast Load
                  </>
                ) : (
                  <>
                    <Activity className="w-3 h-3 mr-1" />
                    Real-time
                  </>
                )}
              </Badge>
              <Badge variant="outline" className="flex items-center border-blue-400 text-blue-600">
                <Clock className="w-3 h-3 mr-1" />
                Auto-refresh
              </Badge>
              {gameDataSource.loading && (
                <Badge variant="outline" className="flex items-center border-orange-400 text-orange-600">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Updating
                </Badge>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Games List */}
        {gameSummaries.length === 0 ? (
          <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-orange-200">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4">🎯</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">No Active Games</h2>
              <p className="text-gray-600 mb-4">
                There are currently no active Tambola games. Check back soon!
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
              <p className="text-center text-gray-600">
                {gameDataSource.source === 'preloaded' ? (
                  <>
                    ⚡ Fast loaded • Real-time updates active
                  </>
                ) : (
                  <>
                    🔴 Live updates • Auto-refresh enabled
                  </>
                )}
                {gameDataSource.loading && (
                  <span className="text-orange-600"> • Updating...</span>
                )}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gameSummaries.map((game, index) => (
                  <Card 
                    key={game.gameId}
                    className={`cursor-pointer transition-all duration-200 border-gray-200 hover:border-orange-300 hover:shadow-lg ${
                      index === 0 ? 'ring-2 ring-blue-200' : ''
                    }`}
                    onClick={() => selectGame(game.gameId)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 text-lg">{game.name}</h3>
                          {index === 0 && (
                            <p className="text-xs text-blue-600 font-medium">← Newest Game</p>
                          )}
                        </div>
                        <Badge 
                          variant={
                            game.isActive ? "default" :
                            game.isCountdown ? "secondary" :
                            game.hasStarted ? "destructive" :
                            "outline"
                          }
                        >
                          {game.isActive ? '🔴 Live' : 
                           game.isCountdown ? '🟡 Starting' : 
                           game.hasStarted ? '🏁 Finished' :
                           '⚪ Booking'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Ticket className="w-4 h-4 mr-2 text-blue-600" />
                            <span className="text-sm text-gray-600">Tickets</span>
                          </div>
                          <span className="font-semibold text-blue-600">
                            {game.bookedTickets}/{game.maxTickets}
                          </span>
                        </div>
                        
                        {game.hostPhone && (
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-2 text-green-600" />
                            <span className="text-sm text-gray-600">+{game.hostPhone}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center">
                            <Trophy className="w-4 h-4 mr-2 text-purple-600" />
                            <span className="text-sm text-gray-600">Available</span>
                          </div>
                          <span className="font-semibold text-purple-600">
                            {game.maxTickets - game.bookedTickets} tickets
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t">
                        <Button 
                          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectGame(game.gameId);
                          }}
                        >
                          {game.hasStarted ? (
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
              
              {/* ✅ NEW: Performance info */}
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
                        : 'Real-time mode - Games updating live'
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
      </div>
    </div>
  );
};

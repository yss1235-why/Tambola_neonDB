// src/components/RecentWinnersDisplay.tsx - COMPLETELY REWRITTEN: Mobile-optimized with shared utility
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  ChevronDown, 
  ChevronUp, 
  Ticket,
  User,
  Phone,
  CheckCircle,
  AlertCircle,
  Play
} from 'lucide-react';
import { useGameData } from '@/providers/GameDataProvider';
// ✅ NEW: Import shared ticket renderer utility
import { renderTicket } from '@/utils/ticketRenderer';

interface RecentWinnersDisplayProps {
  hostMode?: boolean;
  onCreateNewGame?: () => void;
}

export const RecentWinnersDisplay: React.FC<RecentWinnersDisplayProps> = ({ 
  hostMode = false,
  onCreateNewGame 
}) => {
  const { gameData, isLoading, error } = useGameData();
  const [expandedWinners, setExpandedWinners] = useState<Set<string>>(new Set());
  
  // ✅ START WITH ALL TICKETS COLLAPSED for mobile-friendly one-screen view
  React.useEffect(() => {
    if (gameData && gameData.game_state.gameOver) {
      setExpandedWinners(new Set()); // Start collapsed
    }
  },  [gameData?.game_state.gameOver]);
  
  // Toggle winner ticket display
  const toggleWinnerTicket = (winnerId: string) => {
    setExpandedWinners(prev => {
      const newSet = new Set(prev);
      if (newSet.has(winnerId)) {
        newSet.delete(winnerId);
      } else {
        newSet.add(winnerId);
      }
      return newSet;
    });
  };
  
  // Calculate game statistics
  const gameStats = useMemo(() => {
    if (!gameData) return null;
    
    const endTime = new Date(gameData.lastWinnerAt || gameData.createdAt);
    const totalPlayers = Object.values(gameData.tickets || {}).filter(t => t.isBooked).length;
    
    return { endTime, totalPlayers };
  }, [gameData]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="ml-3 text-gray-600">Loading game results...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-red-300">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Results</h3>
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!gameData || !gameData.game_state.gameOver) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Game Not Completed</h3>
          <p className="text-gray-600">Results will appear when the game ends.</p>
        </CardContent>
      </Card>
    );
  }
  
  const wonPrizes = Object.values(gameData.prizes || {}).filter(p => p.won);
  const totalWinners = wonPrizes.reduce((total, prize) => total + (prize.winners?.length || 0), 0);
  
  // 🎯 HOST MODE: Clean celebration view
  if (hostMode) {
    return (
      <div className="space-y-4">
        {/* Celebration Header */}
        <Card className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
          <CardContent className="text-center py-6">
            <Trophy className="w-12 h-12 mx-auto mb-3 animate-bounce" />
            <h1 className="text-2xl md:text-4xl font-bold mb-2">🎉 Game Completed! 🎉</h1>
            <p className="text-lg md:text-xl opacity-90">
              Congratulations to all {totalWinners} winner{totalWinners !== 1 ? 's' : ''}!
            </p>
            {gameStats && (
              <p className="text-sm opacity-75 mt-2">
                {gameStats.endTime.toLocaleDateString()} at {gameStats.endTime.toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Prize Winners - Compact for Host */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
              🏆 Prize Winners
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wonPrizes.length === 0 ? (
              <div className="text-center py-6">
                <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No prizes were won in this game.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {wonPrizes
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((prize) => (
                  <Card key={prize.id} className="bg-green-50 border-green-200">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-green-800 flex items-center">
                            🏆 {prize.name}
                            {prize.id === 'fullHouse' && ' ⭐ FINAL WINNER!'}
                          </h3>
                          <p className="text-sm text-green-600">{prize.pattern}</p>
                        </div>
                        <Badge className="bg-green-600 text-white">
                          {prize.winners?.length || 0} winner{(prize.winners?.length || 0) !== 1 ? 's' : ''}
                        </Badge>
                      </div>

                      {/* Winners List - Compact for Host */}
                      {prize.winners && prize.winners.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {prize.winners.map((winner, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex items-center">
                                <User className="w-4 h-4 text-gray-600 mr-2" />
                                <span className="font-medium text-gray-800">{winner.name}</span>
                              </div>
                              <div className="text-sm text-gray-600">
                                Ticket {winner.ticketId}
                                {winner.phone && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    📞 {winner.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create New Game Button */}
        {onCreateNewGame && (
          <Card>
            <CardContent className="p-4 text-center">
              <Button 
                onClick={onCreateNewGame} 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3"
                size="lg"
              >
                <Play className="w-5 h-5 mr-2" />
                Create New Game
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // 🔄 PUBLIC MODE: Detailed view with expandable tickets
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        
        {/* Mobile-Optimized Game Completion Header */}
        <Card className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
          <CardHeader className="text-center py-4 sm:py-6">
            <CardTitle className="text-xl sm:text-2xl md:text-4xl font-bold">
              🎉 Game Completed! 🎉
            </CardTitle>
            <div className="text-sm sm:text-base md:text-lg opacity-90 mt-2">
              <p className="font-medium">Congratulations to all {totalWinners} winners!</p>
              {gameStats && (
                <p className="text-xs sm:text-sm opacity-75 mt-1">
                  {gameStats.endTime.toLocaleDateString()} at {gameStats.endTime.toLocaleTimeString(undefined, { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Mobile-Optimized Prize Winners Display */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Trophy className="w-5 h-5 mr-2" />
                Prize Winners
              </div>
              <Badge className="bg-green-600 text-white text-xs sm:text-sm">
                {wonPrizes.length} prize{wonPrizes.length !== 1 ? 's' : ''} won
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {wonPrizes
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((prize) => (
                <Card key={prize.id} className="bg-green-50 border-green-200 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-2 sm:p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-green-800 text-sm sm:text-base truncate flex items-center">
                            🏆 {prize.name}
                            {prize.winningNumber && (
                              <Badge variant="outline" className="ml-2 text-xs border-green-400 text-green-700 hidden sm:inline-flex">
                                Won on #{prize.winningNumber}
                              </Badge>
                            )}
                          </h3>
                        </div>
                          <Badge className="bg-green-600 text-white text-xs">
                          {prize.winners?.length || 0}
                        </Badge>
                      </div>
                      
                      {/* Winners List - Mobile Optimized with Multiple Winner Support */}
                      {prize.winners && prize.winners.length > 0 && (
                        <div className="space-y-1">
                          {/* Multiple Winners Header */}
                          {prize.winners.length > 1 && (
                            <div className="text-xs bg-green-100 border border-green-300 rounded p-1.5 mb-1.5">
                              <p className="text-green-800 font-medium">
                                🎉 Multiple Winners ({prize.winners.length} players!)
                              </p>
                            </div>
                          )}
                          
                          {prize.winners.map((winner, idx) => {
                            const winnerId = `${prize.id}-${idx}`;
                            const isExpanded = expandedWinners.has(winnerId);
                            const winnerTicket = gameData.tickets[winner.ticketId];
                            
                            return (
                              <div key={winnerId} className="bg-white rounded-md border border-green-200">
                                {/* Winner Header - Clickable */}
                                <Button
                                  variant="ghost"
                                  onClick={() => toggleWinnerTicket(winnerId)}
                                   className="w-full justify-between p-1.5 sm:p-2 h-auto hover:bg-green-50 rounded-md"
                                >
                                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                                    <div className="bg-green-100 p-1.5 rounded-full flex-shrink-0">
                                      <Ticket className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                      <p className="font-medium text-gray-800 text-xs sm:text-sm truncate flex items-center">
                                        <User className="w-3 h-3 mr-1 flex-shrink-0" />
                                        {winner.name}
                                        {/* Winner number indicator for multiple winners */}
                                        {prize.winners.length > 1 && (
                                          <Badge variant="outline" className="ml-2 text-xs border-green-400 text-green-700">
                                            Winner #{idx + 1}
                                          </Badge>
                                        )}
                                      </p>
                                      <div className="flex items-center space-x-2 text-xs text-gray-600">
                                        <span>Ticket {winner.ticketId}</span>
                                        {winner.phone && (
                                          <span className="hidden sm:inline flex items-center">
                                            <Phone className="w-3 h-3 mr-1" />
                                            {winner.phone}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center flex-shrink-0 ml-2">
                                    <span className="text-xs text-gray-500 mr-1 hidden sm:inline">
                                      {isExpanded ? 'Hide' : 'Show'} Ticket
                                    </span>
                                    {isExpanded ? 
                                      <ChevronUp className="w-4 h-4 text-green-600" /> : 
                                      <ChevronDown className="w-4 h-4 text-green-600" />
                                    }
                                  </div>
                                </Button>
                                
                                {/* Expandable Winning Ticket */}
                                {isExpanded && (
                                   <div className="px-1.5 sm:px-2 pb-1.5 sm:pb-2 bg-gray-50 border-t border-green-200">
                                   <div className="flex items-center justify-between mb-1.5 pt-1.5">
                                      <h5 className="font-medium text-gray-800 flex items-center text-xs sm:text-sm">
                                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-green-600" />
                                        {winner.name}'s Winning Ticket {winner.ticketId}
                                        {prize.winners.length > 1 && (
                                          <span className="ml-2 text-green-600">(#{idx + 1})</span>
                                        )}
                                      </h5>
                                      <Badge variant="outline" className="text-xs border-green-400 text-green-700">
                                        {prize.name} Winner
                                      </Badge>
                                    </div>
                                    {winnerTicket ? (
                                      <div className="p-2">
                                        {/* ✅ NEW: Use shared renderTicket utility with pattern highlighting */}
                                        {renderTicket({
                                          ticket: winnerTicket,
                                          calledNumbers: gameData.game_state?.calledNumbers || [],
                                          showPlayerInfo: false,
                                          patternHighlight: prize.id // ✅ KEY FEATURE: Pattern highlighting
                                        })}
                                      </div>
                                    ) : (
                                      <div className="text-center py-4 text-gray-500">
                                        <Ticket className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                        <p className="text-sm">Ticket data not available</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* No Winners Message - Mobile Optimized */}
            {wonPrizes.length === 0 && (
              <div className="text-center py-6 sm:py-8">
                <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">No Prizes Won</h3>
                <p className="text-sm sm:text-base text-gray-600">No prizes were won in this game.</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Game ended with {gameData.game_state?.calledNumbers?.length || 0} numbers called.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

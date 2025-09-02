// src/components/PrizeManagementPanel.tsx - Fixed without refresh dependency
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Phone, 
  Clock,
  CheckCircle,
  Target
} from 'lucide-react';
import { GameData, Prize } from '@/services/supabase';

interface PrizeManagementPanelProps {
  gameData: GameData;
  onRefreshGame: () => void; // Keep for compatibility but don't use
}

export const PrizeManagementPanel: React.FC<PrizeManagementPanelProps> = ({ 
  gameData 
}) => {
  // Get booked tickets for validation
  const bookedTickets = gameData.tickets ? 
    Object.values(gameData.tickets).filter(ticket => ticket.isBooked) : [];

  // Get prize display info
  const getPrizeDisplayInfo = (prize: Prize) => {
    if (!prize.won) {
      return {
        status: 'pending',
        icon: '⏳',
        className: 'bg-gray-50 border-gray-200',
        badgeVariant: 'secondary' as const,
        statusText: 'Not Won'
      };
    }

    const winnerCount = prize.winners?.length || 0;
    return {
      status: 'won',
      icon: '🏆',
      className: 'bg-green-50 border-green-200',
      badgeVariant: 'default' as const,
      statusText: `Won by ${winnerCount} player${winnerCount !== 1 ? 's' : ''}`
    };
  };

  return (
    <div className="space-y-6">
      {/* Prize Management Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trophy className="w-6 h-6 mr-2" />
            Prize Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Prize Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {Object.keys(gameData.prizes || {}).length}
              </div>
              <div className="text-sm text-blue-700">Total Prizes</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(gameData.prizes || {}).filter(p => p.won).length}
              </div>
              <div className="text-sm text-green-700">Prizes Won</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-2xl font-bold text-purple-600">
                {Object.values(gameData.prizes || {}).reduce((total, prize) => 
                  total + (prize.winners?.length || 0), 0
                )}
              </div>
              <div className="text-sm text-purple-700">Total Winners</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-2xl font-bold text-orange-600">
                {bookedTickets.length}
              </div>
              <div className="text-sm text-orange-700">Active Players</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prize List */}
      <Card>
        <CardHeader>
          <CardTitle>Prizes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.values(gameData.prizes || {})
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((prize) => {
              const displayInfo = getPrizeDisplayInfo(prize);
              
              return (
                <Card key={prize.id} className={`${displayInfo.className} transition-all duration-200`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span className="text-2xl mr-3">{displayInfo.icon}</span>
                          <div>
                            <h3 className="font-bold text-lg text-gray-800">{prize.name}</h3>
                            <p className="text-sm text-gray-600">{prize.pattern}</p>
                          </div>
                        </div>
                        
                        {/* Prize Status */}
                        <div className="flex items-center space-x-4 mb-3">
                          <Badge variant={displayInfo.badgeVariant}>
                            {displayInfo.statusText}
                          </Badge>
                          {prize.won && prize.winningNumber && (
                            <Badge variant="outline">
                              <Target className="w-3 h-3 mr-1" />
                              Won on number {prize.winningNumber}
                            </Badge>
                          )}
                          {prize.won && prize.wonAt && (
                            <Badge variant="outline">
                              <Clock className="w-3 h-3 mr-1" />
                              {new Date(prize.wonAt).toLocaleTimeString()}
                            </Badge>
                          )}
                        </div>

                        {/* Winners Display */}
                        {prize.won && prize.winners && prize.winners.length > 0 && (
                          <div className="bg-white p-3 rounded border border-green-200">
                            <div className="flex items-center mb-2">
                              <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                              <p className="text-sm font-medium text-green-700">Winners:</p>
                            </div>
                            <div className="space-y-1">
                              {prize.winners.map((winner, index) => (
                                <div key={index} className="flex items-center justify-between text-sm">
                                  <span className="font-medium text-gray-800">
                                    🎉 {winner.name} - Ticket {winner.ticketId}
                                  </span>
                                  {winner.phone && (
                                    <span className="text-gray-500 flex items-center">
                                      <Phone className="w-3 h-3 mr-1" />
                                      {winner.phone}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* No Prizes Message */}
          {Object.keys(gameData.prizes || {}).length === 0 && (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No prizes configured for this game.</p>
              <p className="text-gray-500 text-sm mt-2">
                Prizes are configured when creating a new game.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

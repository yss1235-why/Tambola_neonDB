// src/components/PrizeTracker.tsx - Updated for compatibility
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Prize } from '@/services/firebase';

interface PrizeTrackerProps {
  prizes: Prize[];
}

export const PrizeTracker: React.FC<PrizeTrackerProps> = ({ prizes }) => {
  return (
    <Card className="tambola-card">
      <CardHeader>
        <CardTitle className="text-gray-800">🏆 Prizes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {prizes.map((prize) => (
          <div
            key={prize.id}
            className={`p-3 rounded-lg border-2 transition-all duration-300 ${
              prize.won
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-lg'
                : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-bold ${prize.won ? 'text-green-800' : 'text-gray-800'}`}>
                  {prize.name}
                </h3>
                <p className={`text-sm ${prize.won ? 'text-green-600' : 'text-gray-600'}`}>
                  {prize.pattern}
                </p>
                {prize.won && prize.winners && prize.winners.length > 0 && (
                  <p className="text-xs text-green-700 font-medium mt-1">
                    Won by: {prize.winners.map(w => `${w.name} (Ticket #${w.ticketId})`).join(', ')}
                  </p>
                )}
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                prize.won 
                  ? 'bg-green-500 text-white animate-bounce-in' 
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {prize.won ? '✓' : '?'}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

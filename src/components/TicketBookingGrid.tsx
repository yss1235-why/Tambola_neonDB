// src/components/TicketBookingGrid.tsx - FIXED: Complete file with real-time subscription safety
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, User, Users, Loader2, Activity, Clock } from 'lucide-react';
import { supabaseService } from '@/services/supabase';
import type { TambolaTicket, GameData } from '@/services/supabase-types';

interface TicketBookingGridProps {
  tickets: { [key: string]: TambolaTicket };
  gameData: GameData;
  onBookTicket: (ticketId: string, playerName: string, playerPhone: string) => Promise<void>;
  onGameStart: () => void;
}

export const TicketBookingGrid: React.FC<TicketBookingGridProps> = ({ 
  tickets, 
  gameData, 
  onBookTicket, 
  onGameStart 
}) => {
  const [hostPhone, setHostPhone] = useState<string>('');
  const [isLoadingHost, setIsLoadingHost] = useState(true);
  const [realTimeGameData, setRealTimeGameData] = useState<GameData>(gameData);
   const [viewMode, setViewMode] = useState<'all' | 'available'>('all');

  // ✅ FIXED: Add subscription ref for cleanup
  const subscriptionRef = useRef<(() => void) | null>(null);

  // ✅ FIXED: Setup real-time subscription to detect game state changes
  useEffect(() => {
    console.log('🔔 TicketBooking: Setting up real-time subscription for game:', gameData.gameId);
    
    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current();
    }

   const unsubscribe = supabaseService.subscribeToGame(gameData.gameId, (updatedGameData) => {
      if (updatedGameData) {
        console.log('📡 TicketBooking: Game state updated:', {
         isActive: updatedGameData.game_state.isActive,
          isCountdown: updatedGameData.game_state.isCountdown,
          calledNumbers: updatedGameData.game_state.calledNumbers?.length || 0,
          gameOver: updatedGameData.game_state.gameOver
        });

        setRealTimeGameData(updatedGameData);

        // ✅ FIXED: Auto-switch to game view when host starts the game
        const hasGameStarted = (updatedGameData.game_state.calledNumbers?.length || 0) > 0 || 
                              updatedGameData.game_state.isActive ||
                              updatedGameData.game_state.isCountdown ||
                              updatedGameData.game_state.gameOver;

        if (hasGameStarted) {
          console.log('🎮 TicketBooking: Auto-switching to game view - host started the game!');
          onGameStart();
        }
      }
    });

    subscriptionRef.current = unsubscribe;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current();
      }
    };
  }, [gameData.gameId, onGameStart]);

  // Load host phone number
  useEffect(() => {
    const loadHostInfo = async () => {
      setIsLoadingHost(true);
      try {
        // First try to get phone from game data
        if (realTimeGameData.hostPhone) {
          setHostPhone(realTimeGameData.hostPhone);
        } else {
          // Fallback to host profile
          const host = await supabaseService.getHostById(realTimeGameData.hostId);
          if (host && host.phone) {
            setHostPhone(host.phone);
          }
        }
      } catch (error) {
        console.error('Error loading host info:', error);
      } finally {
        setIsLoadingHost(false);
      }
    };

    loadHostInfo();
  }, [realTimeGameData.hostId, realTimeGameData.hostPhone]);

  const handleBookTicket = (ticketId: string) => {
    const ticket = tickets[ticketId];
    if (!ticket || ticket.isBooked) return;

    if (!hostPhone) {
      alert('Host contact information not available. Please try again later.');
      return;
    }

    // Create simplified WhatsApp message with only ticket number
    const message = `Hi! I want to book Ticket ${ticketId}. Please confirm my booking.`;
    const whatsappUrl = `https://wa.me/${hostPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // ✅ FIXED: Use real-time data for accurate counts
  const bookedCount = Object.values(realTimeGameData.tickets || {}).filter(t => t.isBooked).length;
  const totalCount = Math.min(realTimeGameData.maxTickets, Object.keys(realTimeGameData.tickets || {}).length);
  const availableCount = totalCount - bookedCount;

 // Get only the tickets up to maxTickets limit
  const allTickets = Object.entries(realTimeGameData.tickets || {})
    .slice(0, realTimeGameData.maxTickets)
    .reduce((acc, [ticketId, ticket]) => {
      acc[ticketId] = ticket;
      return acc;
    }, {} as { [key: string]: TambolaTicket });

  // Filter tickets based on view mode
  const availableTickets = viewMode === 'available' 
    ? Object.entries(allTickets)
        .filter(([_, ticket]) => !ticket.isBooked)
        .reduce((acc, [ticketId, ticket]) => {
          acc[ticketId] = ticket;
          return acc;
        }, {} as { [key: string]: TambolaTicket })
    : allTickets;
  // ✅ FIXED: Check real-time game state
 if (realTimeGameData.game_state.isActive || realTimeGameData.game_state.isCountdown) {
    // Game is starting/started - this view should switch automatically
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full bg-white/90 backdrop-blur-sm border-2 border-orange-200">
          <CardContent className="p-8 text-center">
            <Clock className="w-16 h-16 mx-auto mb-4 text-orange-500 animate-pulse" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Game Starting!</h2>
            <p className="text-gray-600 mb-4">
              The host has started the game. Switching to game view...
            </p>
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Game Info Section */}
      <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-orange-200">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl text-gray-800">
            {realTimeGameData.name}
          </CardTitle>
          <div className="flex justify-center items-center space-x-8 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{bookedCount}</div>
              <div className="text-sm text-gray-600">Tickets Booked</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{availableCount}</div>
              <div className="text-sm text-gray-600">Available</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{totalCount}</div>
              <div className="text-sm text-gray-600">Max Tickets</div>
            </div>
          </div>
          {/* ✅ FIXED: Real-time status indicator */}
         
        </CardHeader>
      </Card>

      {/* Tickets Grid */}
      {/* Tickets Grid */}
      <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-orange-200">
        <CardHeader>
          <CardTitle className="text-2xl text-gray-800 text-center">
            {viewMode === 'all' ? 'All Tickets' : 'Available Tickets Only'}
          </CardTitle>
          
          {/* View Mode Toggle */}
          <div className="flex justify-center mt-4 gap-2">
            <Button
              onClick={() => setViewMode('all')}
              variant={viewMode === 'all' ? 'default' : 'outline'}
              size="sm"
              className={viewMode === 'all' 
                ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                : 'text-gray-600 hover:text-gray-800'}
            >
              🎫 All Tickets ({Object.keys(allTickets).length})
            </Button>
            <Button
              onClick={() => setViewMode('available')}
              variant={viewMode === 'available' ? 'default' : 'outline'}
              size="sm"
              className={viewMode === 'available' 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'text-gray-600 hover:text-gray-800'}
            >
              ✅ Available Only ({Object.values(allTickets).filter(t => !t.isBooked).length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {Object.entries(availableTickets).map(([ticketId, ticket]) => (
    <div
      key={ticketId}
      className={`relative rounded border-2 transition-all duration-200 ${
        ticket.isBooked 
          ? 'bg-gradient-to-br from-green-100 to-emerald-100 border-green-300 shadow-md' 
          : 'bg-white border-orange-200 hover:border-orange-400 hover:shadow-lg cursor-pointer'
      }`}
    >
      {/* NEW: Ticket Info Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-gray-800">Ticket {ticketId}</span>
        </div>
        <div className="text-right">
          {ticket.isBooked ? (
            <span className="text-sm text-gray-600">{ticket.playerName}</span>
          ) : (
            <span className="text-sm text-green-600 font-medium">Available</span>
          )}
        </div>
      </div>

{/* ✅ FIXED: Ticket Grid with Safety Checks */}
<div className="p-2">
                  {/* ✅ SAFETY: Check if ticket rows exist and are properly structured */}
                 {ticket.rows && Array.isArray(ticket.rows) && ticket.rows.every(row => Array.isArray(row)) ? (
                  <div className="grid grid-cols-9 gap-1 mb-1 bg-amber-50 p-1 border border-yellow-500 rounded">
                    {ticket.rows.flat().map((number, index) => (
                      <div
                        key={index}
                        className={`aspect-square flex items-center justify-center text-xs font-bold rounded border-2 text-black ${
                          number === 0 
                            ? 'bg-white border-yellow-500' 
                            : 'bg-white border-yellow-500'
                        }`}
                      >
                        {number === 0 ? '' : number}
                      </div>
                    ))}
                  </div>
                  ) : (
                    /* ✅ FIXED: Show loading state if ticket data is incomplete */
                   <div className="grid grid-cols-9 gap-1 mb-2">
                      <div className="col-span-9 text-center py-2">

                        <div className="flex items-center justify-center space-x-2">
                          <Clock className="w-4 h-4 text-yellow-600 animate-pulse" />
                          <span className="text-sm text-yellow-700">
                            Ticket data updating...
                          </span>
                        </div>
                        <p className="text-xs text-yellow-600 mt-1">
                          Real-time update in progress
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Booking Status / Button */}
                    <div className="py-1 px-3 rounded-b bg-gray-50">
                      {ticket.isBooked ? (
                         <div className="text-center">
                          {/* Phone number removed */}
                        </div>
                         
                      ) : (
                      <Button
                        onClick={() => handleBookTicket(ticketId)}
                        disabled={!hostPhone || isLoadingHost || !ticket.rows}
                        size="sm"
                        className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 w-full h-6 text-xs disabled:opacity-50"
                      >
                        <Phone className="w-3 h-3 mr-1" />
                        {isLoadingHost ? 'Loading...' : 
                         !ticket.rows ? 'Loading...' : 
                         'Book'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
         </div>

          {/* Empty State for Available Only mode */}
          {viewMode === 'available' && Object.keys(availableTickets).length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎟️</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                All Tickets Have Been Booked!
              </h3>
              <p className="text-gray-600 mb-4">
                There are no available tickets at the moment.
              </p>
              <Button
                onClick={() => setViewMode('all')}
                variant="outline"
                size="sm"
                className="text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                View All Tickets
              </Button>
            </div>
          )}
         
        </CardContent>
      </Card>
    </div>
  );
};

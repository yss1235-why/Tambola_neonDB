// src/components/TicketManagementGrid.tsx - MOBILE 6-COLUMN FIX: Optimized for 3-digit numbers

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Ticket, 
  Users, 
  Phone, 
  Edit, 
  Trash2, 
  UserPlus,
  CheckSquare,
  Loader2,
  X
} from 'lucide-react';
import { supabaseService } from '@/services/supabase';
import type { GameData, TambolaTicket } from '@/services/supabase-types';

interface TicketManagementGridProps {
  gameData: GameData;
  onRefreshGame: () => void;
}

interface BookingForm {
  playerName: string;
  playerPhone: string;
}

interface TicketInfo {
  ticketId: string;
  isBooked: boolean;
  playerName?: string;
  playerPhone?: string;
  bookedAt?: string;
}

export const TicketManagementGrid: React.FC<TicketManagementGridProps> = ({ 
  gameData,
  onRefreshGame
}) => {
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTicket, setEditingTicket] = useState<TicketInfo | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCanceling, setIsCanceling] = useState('');
  const [isExpanding, setIsExpanding] = useState(false);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    playerName: '',
    playerPhone: ''
  });

  const [editForm, setEditForm] = useState<BookingForm>({
    playerName: '',
    playerPhone: ''
  });

  // Detect when tickets are being expanded
  useEffect(() => {
    const currentTicketCount = Object.keys(gameData.tickets || {}).length;
    const expectedTicketCount = gameData.maxTickets;
    
    if (currentTicketCount > 0 && currentTicketCount < expectedTicketCount) {
      setIsExpanding(true);
    } else {
      setIsExpanding(false);
    }
  }, [gameData.tickets, gameData.maxTickets]);

  // Generate ticket information
  const ticketInfo = useMemo(() => {
    const tickets: TicketInfo[] = [];
    
    for (let i = 1; i <= gameData.maxTickets; i++) {
      const ticketId = i.toString();
      const ticket = gameData.tickets?.[ticketId];
      
      tickets.push({
        ticketId,
        isBooked: ticket?.isBooked || false,
        playerName: ticket?.playerName,
        playerPhone: ticket?.playerPhone,
        bookedAt: ticket?.bookedAt
      });
    }
    
    return tickets;
  }, [gameData.tickets, gameData.maxTickets]);

  const bookedCount = ticketInfo.filter(t => t.isBooked).length;
  const availableCount = ticketInfo.length - bookedCount;

  // UPDATED: Create 6-column rows instead of 10-column
  const ticketRows = useMemo(() => {
    const rows: TicketInfo[][] = [];
    for (let i = 0; i < ticketInfo.length; i += 6) {
      rows.push(ticketInfo.slice(i, i + 6));
    }
    return rows;
  }, [ticketInfo]);

  const handleTicketClick = (ticketId: string, isBooked: boolean) => {
    if (isBooked) {
      const ticket = ticketInfo.find(t => t.ticketId === ticketId);
      if (ticket) {
        setEditingTicket(ticket);
        setEditForm({
          playerName: ticket.playerName || '',
          playerPhone: ticket.playerPhone || ''
        });
        setShowEditDialog(true);
      }
    } else {
      setSelectedTickets(prev => 
        prev.includes(ticketId) 
          ? prev.filter(id => id !== ticketId)
          : [...prev, ticketId]
      );
    }
  };

  const selectAllAvailable = () => {
    const availableTickets = ticketInfo
      .filter(t => !t.isBooked)
      .map(t => t.ticketId);
    setSelectedTickets(availableTickets);
  };

  const deselectAll = () => {
    setSelectedTickets([]);
  };

  const handleBookTickets = async () => {
    if (selectedTickets.length === 0 || !bookingForm.playerName.trim()) return;

    setIsBooking(true);
    try {
      for (const ticketId of selectedTickets) {
       await supabaseService.bookTicket(
          ticketId,
          bookingForm.playerName.trim(),
          bookingForm.playerPhone.trim(),
          gameData.gameId
        );
      }

      setSelectedTickets([]);
      setBookingForm({ playerName: '', playerPhone: '' });
      setShowBookingDialog(false);
      onRefreshGame();
    } catch (error) {
      console.error('Error booking tickets:', error);
    } finally {
      setIsBooking(false);
    }
  };

  const handleUpdateTicket = async () => {
    if (!editingTicket) return;

    setIsUpdating(true);
    try {
      // Use bookTicket to update player information (since ticket is already booked)
      await supabaseService.bookTicket(
        editingTicket.ticketId,
        editForm.playerName.trim(),
        editForm.playerPhone.trim(),
        gameData.gameId
      );

      setShowEditDialog(false);
      setEditingTicket(null);
      setEditForm({ playerName: '', playerPhone: '' });
      onRefreshGame();
    } catch (error) {
      console.error('Error updating ticket:', error);
      alert('Failed to update ticket. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

 const handleCancelBooking = async (ticketId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    setIsCanceling(ticketId);
    try {
      await supabaseService.unbookTicket(gameData.gameId, ticketId);
      onRefreshGame();
    } catch (error) {
      console.error('Error canceling booking:', error);
      alert('Failed to cancel booking. Please try again.');
    } finally {
      setIsCanceling('');
    }
  };

  const expandTickets = async () => {
    setIsExpanding(true);
    try {
      await supabaseService.expandGameTickets(gameData.gameId, gameData.maxTickets);
      onRefreshGame();
    } catch (error) {
      console.error('Error expanding tickets:', error);
    } finally {
      setIsExpanding(false);
    }
  };

  const getTicketClassName = (ticket: TicketInfo) => {
    const baseClasses = "aspect-square flex items-center justify-center border-2 rounded-lg cursor-pointer transition-all duration-200";
    
    if (ticket.isBooked) {
      return `${baseClasses} border-green-500 bg-green-200 text-black`;
    } else if (selectedTickets.includes(ticket.ticketId)) {
      return `${baseClasses} border-blue-500 bg-blue-200 text-black`;
    } else {
      return `${baseClasses} border-gray-300 bg-white text-black hover:border-gray-400`;
    }
  };

  // Clear selection when component unmounts or game changes
  useEffect(() => {
    return () => {
      setSelectedTickets([]);
    };
  }, [gameData.gameId]);

  // Smart scroll detection for floating position
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 300; // Adjust threshold as needed
      setIsScrolledDown(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="space-y-6 relative">
      {/* Loading State */}
      {(isBooking || isUpdating || isExpanding) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="font-medium">
              {isBooking ? 'Booking...' : isUpdating ? 'Updating...' : 'Expanding tickets...'}
            </span>
          </div>
        </div>
      )}

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Booking Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center p-2 bg-blue-50 rounded">
                <div className="text-lg font-bold text-blue-600">{gameData.maxTickets}</div>
                <div className="text-xs text-blue-700">Total</div>
              </div>
              <div className="text-center p-2 bg-green-50 rounded">
                <div className="text-lg font-bold text-green-600">{bookedCount}</div>
                <div className="text-xs text-green-700">Booked</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-lg font-bold text-gray-600">{availableCount}</div>
                <div className="text-xs text-gray-700">Available</div>
              </div>
              <div className="text-center p-2 bg-orange-50 rounded">
                <div className="text-lg font-bold text-orange-600">{selectedTickets.length}</div>
                <div className="text-xs text-orange-700">Selected</div>
              </div>
            </div>
         {/* Selection Controls */}
          <div className="flex gap-2 mb-4">
            <Button
              onClick={() => setShowBookingDialog(true)}
              disabled={selectedTickets.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
              size="sm"
            >
              <UserPlus className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Book Selected </span>({selectedTickets.length})
            </Button>

            <Button
              onClick={selectedTickets.length === availableCount ? deselectAll : selectAllAvailable}
              variant="outline"
              disabled={availableCount === 0}
              className="flex-1"
              size="sm"
            >
              <CheckSquare className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">{selectedTickets.length === availableCount ? 'Deselect All' : 'Select All'}</span>
              <span className="sm:hidden">{selectedTickets.length === availableCount ? 'Deselect' : 'Select All'}</span>
            </Button>

            {selectedTickets.length > 0 && (
              <Button 
                onClick={deselectAll}
                variant="outline"
                className="flex-shrink-0"
                size="sm"
              >
                <X className="w-3 h-3 sm:mr-1" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-200 border-2 border-blue-500 rounded"></div>
              <span>Selected</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-200 border-2 border-green-500 rounded"></div>
              <span>Booked</span>
            </div>
          </div>

          {(Object.keys(gameData.tickets || {}).length < gameData.maxTickets) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Ticket Expansion Available
                  </p>
                  <p className="text-xs text-yellow-700">
                    Current: {Object.keys(gameData.tickets || {}).length} / {gameData.maxTickets} tickets
                  </p>
                </div>
                <Button
                  onClick={expandTickets}
                  disabled={isExpanding}
                  size="sm"
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  {isExpanding ? 'Expanding...' : 'Expand Tickets'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* UPDATED: 6-Column Tickets Grid for Mobile */}
      <Card>
        <CardHeader>
          
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ticketRows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-6 gap-4 sm:gap-3">
                {row.map((ticket) => (
                  <div
                    key={ticket.ticketId}
                    className={getTicketClassName(ticket)}
                    onClick={() => handleTicketClick(ticket.ticketId, ticket.isBooked)}
                    title={`Ticket ${ticket.ticketId}${ticket.isBooked ? ` - Booked by ${ticket.playerName}` : selectedTickets.includes(ticket.ticketId) ? ' - Selected' : ' - Available'}`}
                  >
                    <span className="font-bold text-lg">
                      {ticket.ticketId}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 🆕 COMPACT HORIZONTAL FLOATING BOOKING SUMMARY */}
      {selectedTickets.length > 0 && (
        <div 
          className={`fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 transition-all duration-300 ${
            isScrolledDown 
              ? 'bottom-4 left-1/2 transform -translate-x-1/2' 
              : 'bottom-4 left-4'
          }`}
          style={{
            maxWidth: '500px'
          }}
        >
          <div className="flex items-center space-x-3">
            {/* Selection count */}
            <span className="font-medium text-sm whitespace-nowrap">
              {selectedTickets.length} sel
            </span>
            
           {/* Name input */}
                <input
                  type="text"
                  placeholder="Name *"
                  value={bookingForm.playerName}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, playerName: e.target.value }))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm w-24 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black placeholder:text-black"
                  required
                />
                
                {/* Phone input */}
                <input
                  type="text"
                  placeholder="Phone"
                  value={bookingForm.playerPhone}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, playerPhone: e.target.value }))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm w-24 focus:outline-none focus:ring-1 focus:ring-blue-500 text-black placeholder:text-black"
                />
            
            {/* Book button */}
            <Button
              onClick={handleBookTickets}
              disabled={!bookingForm.playerName.trim() || isBooking}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 h-7"
            >
              {isBooking ? 'Booking...' : 'Book'}
            </Button>
            
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={deselectAll}
              className="h-6 w-6 p-0 hover:bg-gray-100"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Booking Dialog (Original - unchanged) */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent>
          <DialogHeader>
            
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="playerName" className="text-white font-medium">Player Name *</Label>
              <Input
                id="playerName"
                value={bookingForm.playerName}
                onChange={(e) => setBookingForm(prev => ({ ...prev, playerName: e.target.value }))}
                placeholder="Enter player name"
               className="text-gray-900 placeholder:text-gray-500"
                required
              />
            </div>
            <div>
              <Label htmlFor="playerPhone" className="text-white font-medium">Phone Number</Label>
              <Input
                  id="playerPhone"
                  value={bookingForm.playerPhone}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, playerPhone: e.target.value }))}
                  placeholder="Enter phone number (optional)"
                  className="text-white placeholder:text-white"
                />
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm font-medium">Selected Tickets:</p>
              <p className="text-sm text-gray-600">
                {selectedTickets.map(id => `${id}`).join(', ')}
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowBookingDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBookTickets}
                disabled={!bookingForm.playerName.trim() || isBooking}
              >
                {isBooking ? 'Booking...' : `Book ${selectedTickets.length} Tickets`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog (Original - unchanged) */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Ticket #{editingTicket?.ticketId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editPlayerName">Player Name</Label>
              <Input
                id="editPlayerName"
                value={editForm.playerName}
                onChange={(e) => setEditForm(prev => ({ ...prev, playerName: e.target.value }))}
                placeholder="Enter player name"
              />
            </div>
            <div>
              <Label htmlFor="editPlayerPhone">Phone Number</Label>
              <Input
                id="editPlayerPhone"
                value={editForm.playerPhone}
                onChange={(e) => setEditForm(prev => ({ ...prev, playerPhone: e.target.value }))}
                placeholder="Enter phone number"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTicket}
                disabled={isUpdating}
              >
                {isUpdating ? 'Updating...' : 'Update Ticket'}
              </Button>
            </div>
          </div>
        </DialogContent>
     </Dialog>

      {/* NEW: Booked Tickets List */}
      {(() => {
        const bookedTickets = ticketInfo.filter(t => t.isBooked);
        const bookedTicketRows = [];
        for (let i = 0; i < bookedTickets.length; i += 2) {
          bookedTicketRows.push(bookedTickets.slice(i, i + 2));
        }
        
        return bookedTickets.length > 0 ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Booked Tickets ({bookedTickets.length})</span>
                <Badge variant="secondary">{bookedTickets.length} players</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bookedTicketRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-2 gap-3">
                    {row.map((ticket) => (
                      <div
                        key={ticket.ticketId}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800">
                            {ticket.playerName || 'Unknown Player'}
                          </div>
                          <div className="text-sm text-gray-600">
                            Ticket #{ticket.ticketId}
                          </div>
                          {ticket.playerPhone && (
                            <div className="text-xs text-gray-500">
                              📞 {ticket.playerPhone}
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingTicket(ticket);
                              setEditForm({
                                playerName: ticket.playerName || '',
                                playerPhone: ticket.playerPhone || ''
                              });
                              setShowEditDialog(true);
                            }}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelBooking(ticket.ticketId)}
                            disabled={isCanceling === ticket.ticketId}
                            className="text-red-600 hover:text-red-700"
                          >
                            {isCanceling === ticket.ticketId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null;
      })()}
    </div>
  );
};

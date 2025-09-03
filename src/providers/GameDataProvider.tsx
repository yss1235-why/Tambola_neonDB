// Supabase Game Data Provider
// Replaces Firebase GameDataProvider - MUCH SIMPLER!

import React, { createContext, useContext, useMemo } from 'react';
import { useGameSubscription, useHostCurrentGameSubscription, useGamePrizesSubscription, useGameTicketsSubscription } from '@/hooks/useSupabaseSubscription';
import { supabase } from '@/services/supabase';
import type { GameData } from '@/services/supabase-types';
// Game phase enum for cleaner state management
export type GamePhase = 'creation' | 'setup' | 'booking' | 'countdown' | 'playing' | 'finished';

interface GameDataContextValue {
  gameData: GameData | null;
  currentPhase: GamePhase;
  timeUntilAction: number;
  isLoading: boolean;
  error: string | null;
}

const GameDataContext = createContext<GameDataContextValue | null>(null);

interface GameDataProviderProps {
  children: React.ReactNode;
  gameId?: string | null;
  userId?: string | null; // For host mode
}

/**
 * SIMPLIFIED Supabase GameDataProvider
 * 
 * Benefits over Firebase version:
 * ✅ No complex subscription deduplication
 * ✅ No race conditions between multiple subscriptions  
 * ✅ Simple, predictable data flow
 * ✅ Built-in error handling
 * ✅ Automatic cleanup
 */
export const GameDataProvider: React.FC<GameDataProviderProps> = ({
  children,
  gameId,
  userId
}) => {
  // Determine subscription type based on props
  const isHostMode = !!userId && (!gameId || gameId === 'HOST_CURRENT');
  
// Use appropriate subscription hooks
const hostGameSub = useHostCurrentGameSubscription(isHostMode ? userId : null);
const directGameSub = useGameSubscription(!isHostMode && gameId ? gameId : null);

// Get current game ID for subscriptions
const currentGameId = isHostMode ? hostGameSub.data?.id : gameId;

// Subscribe to tickets and prizes for real-time updates
const prizesSub = useGamePrizesSubscription(currentGameId);
const ticketsSub = useGameTicketsSubscription(currentGameId);

// Select active subscription data
const activeSubscription = isHostMode ? hostGameSub : directGameSub;
const { data: baseGameData, loading: isGameLoading, error: gameError } = activeSubscription;
const { data: prizesData, loading: isPrizesLoading } = prizesSub;
const { data: ticketsData, loading: isTicketsLoading } = ticketsSub;

// Combine all loading states  
const isLoading = isGameLoading || isPrizesLoading || isTicketsLoading;
const error = gameError;

// Combine game data with prizes and tickets
const gameData = useMemo(() => {
  if (!baseGameData) return null;

  // Convert prizes array to object format expected by GameHost
  const prizesObject: { [key: string]: any } = {};
  if (prizesData && Array.isArray(prizesData)) {
    prizesData.forEach(prize => {
      prizesObject[prize.id] = {
        id: prize.id,
        name: prize.name,
        pattern: prize.pattern,
        description: prize.description,
        won: prize.won,
        order: prize.prize_order,
        winners: prize.winners || [],
        winningNumber: prize.winning_number,
        wonAt: prize.won_at
      };
    });
  }

  // Convert tickets array to object format
  const ticketsObject: { [key: string]: any } = {};
  if (ticketsData && Array.isArray(ticketsData)) {
    ticketsData.forEach(ticket => {
      ticketsObject[ticket.id] = {
        ticketId: ticket.ticket_id,
        gameId: ticket.game_id,
        playerName: ticket.player_name,
        playerPhone: ticket.player_phone,
        rows: ticket.rows,
        markedNumbers: ticket.marked_numbers || [],
        isBooked: ticket.is_booked,
        bookedAt: ticket.booked_at,
        metadata: ticket.metadata,
        positionInSet: ticket.position_in_set,
        setId: ticket.set_id
      };
    });
  }

  // Return combined game data with all the properties GameHost expects
  return {
    ...baseGameData,
    prizes: prizesObject,
    tickets: ticketsObject,
    maxTickets: baseGameData.max_tickets,
    hostPhone: baseGameData.host_phone || baseGameData.hostPhone || '', // Try both possible field names
    name: baseGameData.name
  };
}, [baseGameData, prizesData, ticketsData]);

// ==================== FETCH HOST PHONE FROM SETTINGS ====================

// Add host phone from host settings if not already present
const [hostPhoneFromSettings, setHostPhoneFromSettings] = React.useState<string>('');

React.useEffect(() => {
  const fetchHostPhone = async () => {
    if (!baseGameData || hostPhoneFromSettings || (gameData?.hostPhone && gameData.hostPhone.trim() !== '')) {
      return; // Already have phone or no game data
    }

    try {
      // Import the service dynamically to avoid circular imports
      const { supabaseService } = await import('@/services/supabase');
     const hostSettings = await supabaseService.getHostSettings(baseGameData.host_id);

        if (hostSettings?.settings?.hostPhone) {
          setHostPhoneFromSettings(hostSettings.settings.hostPhone);
        }
    } catch (error) {
      console.error('Error fetching host phone from settings:', error);
    }
  };

  fetchHostPhone();
}, [baseGameData?.host_id, hostPhoneFromSettings, gameData?.hostPhone]);

// Final gameData with host phone from settings if needed
const finalGameData = useMemo(() => {
  if (!gameData) return null;
  
  // If we already have a phone in gameData, use it
  if (gameData.hostPhone && gameData.hostPhone.trim() !== '') {
    return gameData;
  }
  
 // Otherwise, use phone from host settings
return {
  ...gameData,
  hostPhone: hostPhoneFromSettings || ''
};
}, [gameData, hostPhoneFromSettings]);

// ==================== COMPUTED VALUES ====================

// Determine current game phase
const currentPhase: GamePhase = useMemo(() => {
  if (!finalGameData) return 'creation';
  
  switch (finalGameData.status) {
    case 'setup':
      return 'setup';
    case 'countdown':
      return 'countdown';
    case 'active':
      return finalGameData.game_state?.isActive ? 'playing' : 'booking';
    case 'paused':
      return 'playing'; // Still in playing phase, just paused
    case 'finished':
      return 'finished';
    default:
      return 'setup';
  }
}, [finalGameData]);

// Calculate time until next action (for countdown, etc.)
const timeUntilAction = useMemo(() => {
  if (!finalGameData) return 0;
  
  if (currentPhase === 'countdown') {
    return finalGameData.game_state?.countdownTime || 0;
  }
  
  return 0;
}, [finalGameData, currentPhase]);

const contextValue: GameDataContextValue = useMemo(() => ({
  gameData: finalGameData,
  currentPhase,
  timeUntilAction,
  isLoading,
  error
}), [finalGameData, currentPhase, timeUntilAction, isLoading, error]);

  return (
    <GameDataContext.Provider value={contextValue}>
      {children}
    </GameDataContext.Provider>
  );
};

// ==================== CUSTOM HOOK ====================

/**
 * Hook to consume game data context
 */
export const useGameData = (): GameDataContextValue => {
  const context = useContext(GameDataContext);
  
  if (!context) {
    throw new Error('useGameData must be used within a GameDataProvider');
  }
  
  return context;
};

// ==================== ADDITIONAL HELPER HOOKS ====================

/**
 * Hook to get specific game data with automatic subscription
 */
export const useSpecificGame = (gameId: string | null) => {
  return useGameSubscription(gameId);
};

/**
 * Hook to get host's current game with automatic subscription
 */
export const useHostGame = (hostId: string | null) => {
  return useHostCurrentGameSubscription(hostId);
};

/**
 * Hook to check if game is in specific phase
 */
export const useGamePhase = (targetPhase: GamePhase) => {
  const { currentPhase, gameData } = useGameData();
  
  return {
    isInPhase: currentPhase === targetPhase,
    currentPhase,
    gameData
  };
};

/**
 * Hook to get game statistics
 */
export const useGameStats = () => {
  const { gameData } = useGameData();
  
  return useMemo(() => {
    if (!gameData) {
      return {
        totalNumbers: 90,
        calledNumbers: 0,
        remainingNumbers: 90,
        progress: 0
      };
    }

    const calledCount = gameData.game_state?.totalNumbersCalled || 0;
    const totalNumbers = 90;
    const remainingNumbers = totalNumbers - calledCount;
    const progress = (calledCount / totalNumbers) * 100;

    return {
      totalNumbers,
      calledNumbers: calledCount,
      remainingNumbers,
      progress: Math.round(progress)
    };
  }, [gameData]);
};

/**
 * Hook to check game permissions for current user
 */
export const useGamePermissions = () => {
  const { gameData } = useGameData();
  const [currentUser, setCurrentUser] = React.useState<any>(null);

  // Get current user (simplified)
  React.useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  return useMemo(() => {
    if (!gameData || !currentUser) {
      return {
        canManage: false,
        canPlay: true,
        isHost: false,
        isAdmin: false
      };
    }

    const isHost = gameData.host_id === currentUser.id;
    const userRole = currentUser.user_metadata?.role;
    const isAdmin = userRole === 'admin';

    return {
      canManage: isHost || isAdmin,
      canPlay: true,
      isHost,
      isAdmin
    };
  }, [gameData, currentUser]);
};

// Re-export for compatibility with existing code
export default GameDataProvider;

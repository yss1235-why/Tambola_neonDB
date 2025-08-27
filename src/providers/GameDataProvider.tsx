// Supabase Game Data Provider
// Replaces Firebase GameDataProvider - MUCH SIMPLER!

import React, { createContext, useContext, useMemo } from 'react';
import { useGameSubscription, useHostCurrentGameSubscription } from '@/hooks/useSupabaseSubscription';
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
  
  // Use appropriate subscription hook
  const hostGameSub = useHostCurrentGameSubscription(isHostMode ? userId : null);
  const directGameSub = useGameSubscription(!isHostMode && gameId ? gameId : null);
  
  // Select active subscription data
  const activeSubscription = isHostMode ? hostGameSub : directGameSub;
  const { data: gameData, loading: isLoading, error } = activeSubscription;

  // ==================== COMPUTED VALUES ====================

  // Determine current game phase
  const currentPhase: GamePhase = useMemo(() => {
    if (!gameData) return 'creation';
    
    switch (gameData.status) {
      case 'setup':
        return 'setup';
      case 'countdown':
        return 'countdown';
      case 'active':
        return gameData.game_state?.isActive ? 'playing' : 'booking';
      case 'paused':
        return 'playing'; // Still in playing phase, just paused
      case 'finished':
        return 'finished';
      default:
        return 'setup';
    }
  }, [gameData]);

  // Calculate time until next action (for countdown, etc.)
  const timeUntilAction = useMemo(() => {
    if (!gameData) return 0;
    
    if (currentPhase === 'countdown') {
      return gameData.game_state?.countdownTime || 0;
    }
    
    return 0;
  }, [gameData, currentPhase]);

  // ==================== CONTEXT VALUE ====================

  const contextValue: GameDataContextValue = useMemo(() => ({
    gameData,
    currentPhase,
    timeUntilAction,
    isLoading,
    error
  }), [gameData, currentPhase, timeUntilAction, isLoading, error]);

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

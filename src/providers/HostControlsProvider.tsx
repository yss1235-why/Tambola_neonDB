// src/providers/HostControlsProvider.tsx - Actions-only provider for host game controls
import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { firebaseService } from '@/services/firebase';
import { useGameData } from './GameDataProvider';

interface HostControlsContextValue {
  // Game flow controls
  startGame: () => Promise<void>;
  pauseGame: () => Promise<void>;
  resumeGame: () => Promise<void>;
  endGame: () => Promise<void>;
  
  // Configuration
  updateCallInterval: (seconds: number) => void;
  
  // Status
  isProcessing: boolean;
}

const HostControlsContext = createContext<HostControlsContextValue | null>(null);

interface HostControlsProviderProps {
  children: React.ReactNode;
  userId: string;
}

/**
 * HostControlsProvider - Handles all host actions and automatic game management
 * Separated from data concerns for cleaner architecture
 */
export const HostControlsProvider: React.FC<HostControlsProviderProps> = ({
  children,
  userId
}) => {
  const { gameData } = useGameData();
  
  // Internal state for processing and timers
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [callInterval, setCallInterval] = React.useState(5);
  
  // 🛡️ NEW: Pause state lock mechanism
  const [pauseRequested, setPauseRequested] = React.useState(false);
  
  // Refs for stable timer management
  const gameActiveRef = useRef(false);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🛡️ NEW: Ref for immediate access in timer callbacks (eliminates race condition)
  const pauseRequestedRef = useRef(false);
  const timerGenerationRef = useRef(0);

  // 🛡️ ENHANCED: Update game active ref when game state changes, but respect manual pause
  useEffect(() => {
    if (gameData) {
      const shouldBeActive = gameData.gameState.isActive && !gameData.gameState.gameOver;
      
      // Only sync from database if we're not in a manual pause state
      if (!pauseRequested) {
        gameActiveRef.current = shouldBeActive;
        console.log(`🔄 Syncing gameActiveRef from database: ${shouldBeActive}`);
      } else {
        console.log(`🛡️ Manual pause active - ignoring database sync`);
      }
      
      // If game is actually ended in database, clear pause request
      if (gameData.gameState.gameOver) {
        setPauseRequested(false);
        pauseRequestedRef.current = false;
        gameActiveRef.current = false;
        console.log(`🏁 Game ended - clearing pause state`);
      }
    }
  }, [gameData?.gameState.isActive, gameData?.gameState.gameOver, pauseRequested]);

  // Clear all timers on unmount or game end
  const clearAllTimers = useCallback(() => {
    if (gameTimerRef.current) {
      clearTimeout(gameTimerRef.current);
      gameTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    gameActiveRef.current = false;
  }, []);

  // Automatic number calling loop
  const startNumberCallingLoop = useCallback(() => {
    if (!gameData) return;
    
    // Capture current generation when starting the loop
    const loopGeneration = timerGenerationRef.current;
    
    const scheduleNextCall = () => {
      // Check if this timer generation is still valid
      if (timerGenerationRef.current !== loopGeneration) {
        console.log(`🚫 Timer generation ${loopGeneration} invalidated, stopping`);
        return;
      }
      
      // Existing checks
      if (!gameActiveRef.current || pauseRequestedRef.current) return;
      
      gameTimerRef.current = setTimeout(async () => {
        // 🔧 CRITICAL: Check timer generation FIRST in callback
        if (timerGenerationRef.current !== loopGeneration) {
          console.log(`🚫 Timer callback generation ${loopGeneration} invalidated, aborting`);
          return;
        }
        
        // Then existing checks
        if (!gameActiveRef.current || pauseRequestedRef.current || !gameData) return;
        
        try {
          console.log(`🎯 Auto-calling next number for game ${gameData.gameId} (gen: ${loopGeneration})`);
          const result = await firebaseService.callNextNumber(gameData.gameId);
          
          // Check generation again after async operation
          if (timerGenerationRef.current !== loopGeneration) {
            console.log(`🚫 Timer generation changed during async call, stopping`);
            return;
          }
          
          if (result.success && !result.gameEnded && gameActiveRef.current && !pauseRequestedRef.current) {
            scheduleNextCall(); // Continue with same generation
          } else {
            clearAllTimers();
          }
        } catch (error) {
          console.error('❌ Auto-call error:', error);
          
          // Check generation before retrying
          if (timerGenerationRef.current === loopGeneration && gameActiveRef.current && !pauseRequestedRef.current) {
            scheduleNextCall();
          }
        }
      }, callInterval * 1000);
    };

    scheduleNextCall();
  }, [gameData, callInterval, clearAllTimers]);

  // Start game with countdown
  const startGame = useCallback(async () => {
    if (!gameData || isProcessing) return;
    
    setIsProcessing(true);
    try {
      console.log(`🎮 Starting game with countdown: ${gameData.gameId}`);
      
      // 🛡️ Clear pause state when starting
      setPauseRequested(false);
      pauseRequestedRef.current = false;
      
      // Clear any existing timers
      clearAllTimers();
      
      // Start 10-second countdown
      await firebaseService.updateGameState(gameData.gameId, {
        isCountdown: true,
        countdownTime: 10,
        isActive: false
      });

      let timeLeft = 10;
      countdownTimerRef.current = setInterval(async () => {
        timeLeft--;
        
        if (timeLeft > 0) {
          await firebaseService.updateGameState(gameData.gameId, {
            countdownTime: timeLeft
          });
        } else {
          // Countdown finished - activate game
          clearInterval(countdownTimerRef.current!);
          countdownTimerRef.current = null;
          
          await firebaseService.updateGameState(gameData.gameId, {
            isActive: true,
            isCountdown: false,
            countdownTime: 0
          });
          
          gameActiveRef.current = true;
          startNumberCallingLoop();
        }
      }, 1000);
      
    } catch (error: any) {
      console.error('❌ Start game error:', error);
      throw new Error(error.message || 'Failed to start game');
    } finally {
      setIsProcessing(false);
    }
  }, [gameData, isProcessing, clearAllTimers, startNumberCallingLoop]);

  // 🛡️ ENHANCED: Pause game with immediate state lock
  const pauseGame = useCallback(async () => {
    if (!gameData || isProcessing) return;
    
    setIsProcessing(true);
    try {
      console.log(`⏸️ Pausing game: ${gameData.gameId}`);
      
      // 🔧 CRITICAL: Increment timer generation to invalidate all queued callbacks
      timerGenerationRef.current++;
      const currentGeneration = timerGenerationRef.current;
      console.log(`🔄 Timer generation incremented to: ${currentGeneration}`);
      
      // Set pause state immediately
      setPauseRequested(true);
      pauseRequestedRef.current = true;
      gameActiveRef.current = false;
      
      // Clear existing timers
      clearAllTimers();
      
      // Update database
      await firebaseService.updateGameState(gameData.gameId, {
        isActive: false,
        isCountdown: false
      });
      
      console.log(`✅ Game paused successfully: ${gameData.gameId}`);
      
    } catch (error: any) {
      console.error('❌ Pause game error:', error);
      
      // Rollback pause state
      setPauseRequested(false);
      pauseRequestedRef.current = false;
      
      if (gameData.gameState.isActive && !gameData.gameState.gameOver) {
        gameActiveRef.current = true;
        startNumberCallingLoop();
      }
      
      throw new Error(error.message || 'Failed to pause game');
    } finally {
      setIsProcessing(false);
    }
  }, [gameData, isProcessing, clearAllTimers, startNumberCallingLoop]);

  // 🛡️ ENHANCED: Resume game
  const resumeGame = useCallback(async () => {
    if (!gameData || isProcessing) return;
    
    setIsProcessing(true);
    try {
      console.log(`▶️ Resuming game: ${gameData.gameId}`);
      
      // 🛡️ STEP 1: Update database first
      await firebaseService.updateGameState(gameData.gameId, {
        isActive: true,
        isCountdown: false
      });
      
      // Increment generation for new timer loop
      timerGenerationRef.current++;
      console.log(`🔄 New timer generation for resume: ${timerGenerationRef.current}`);

      // 🛡️ STEP 2: Clear pause lock and activate locally
      setPauseRequested(false);
      pauseRequestedRef.current = false;
      gameActiveRef.current = true;
      
      // 🛡️ STEP 3: Restart the calling loop
      startNumberCallingLoop();
      
      console.log(`✅ Game resumed successfully: ${gameData.gameId}`);
      
    } catch (error: any) {
      console.error('❌ Resume game error:', error);
      throw new Error(error.message || 'Failed to resume game');
    } finally {
      setIsProcessing(false);
    }
  }, [gameData, isProcessing, startNumberCallingLoop]);

  // End game
  const endGame = useCallback(async () => {
    if (!gameData || isProcessing) return;
    
    setIsProcessing(true);
    try {
      console.log(`🏁 Ending game: ${gameData.gameId}`);
      
      // Clear pause state and stop timers
      setPauseRequested(false);
      pauseRequestedRef.current = false;
      clearAllTimers();
      
      await firebaseService.updateGameState(gameData.gameId, {
        isActive: false,
        isCountdown: false,
        gameOver: true
      });
      
      console.log(`✅ Game ended successfully: ${gameData.gameId}`);
      
    } catch (error: any) {
      console.error('❌ End game error:', error);
      throw new Error(error.message || 'Failed to end game');
    } finally {
      setIsProcessing(false);
    }
  }, [gameData, isProcessing, clearAllTimers]);

  // Update call interval
  const updateCallInterval = useCallback((seconds: number) => {
    setCallInterval(seconds);
    console.log(`⏰ Call interval updated to ${seconds} seconds`);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const value: HostControlsContextValue = {
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    updateCallInterval,
    isProcessing
  };

  return (
    <HostControlsContext.Provider value={value}>
      {children}
    </HostControlsContext.Provider>
  );
};

export const useHostControls = () => {
  const context = useContext(HostControlsContext);
  if (!context) {
    throw new Error('useHostControls must be used within a HostControlsProvider');
  }
  return context;
};

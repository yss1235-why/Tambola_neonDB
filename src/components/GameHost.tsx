// src/components/GameHost.tsx - Complete updated component with fixed winner announcement tracking
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TicketManagementGrid } from './TicketManagementGrid';
import { NumberGrid } from './NumberGrid';
import { PrizeManagementPanel } from './PrizeManagementPanel';
import { 
  Play, 
  Pause, 
  Square, 
  Users, 
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  Trophy,
  Ticket,
  Lock,
  Edit,
  Trash2,
  Settings,
  Phone,
  ArrowLeft,
  RotateCcw,
  Timer,
  RefreshCw,
  Zap,
  Target,
  Eye
} from 'lucide-react';
import { 
  firebaseService, 
  GameData, 
  TambolaTicket, 
  HostUser 
} from '@/services/firebase';

interface GameHostProps {
  user: HostUser;
  userRole: 'host';
}

interface TicketSet {
  id: string;
  name: string;
  available: boolean;
  ticketCount: number;
  description: string;
}

interface GamePrize {
  id: string;
  name: string;
  pattern: string;
  description: string;
}

interface CreateGameForm {
  hostPhone: string;
  maxTickets: number;
  selectedTicketSet: string;
  selectedPrizes: string[];
}

interface EditGameForm {
  gameId: string;
  hostPhone: string;
  maxTickets: number;
  selectedPrizes: string[];
}

// Ticket sets data
const TICKET_SETS: TicketSet[] = [
  {
    id: "1",
    name: "Classic Set 1",
    available: true,
    ticketCount: 600,
    description: "Traditional ticket set with balanced number distribution"
  },
  {
    id: "2", 
    name: "Premium Set 2",
    available: true,
    ticketCount: 600,
    description: "Premium ticket set with optimized winning patterns"
  },
  {
    id: "3",
    name: "Deluxe Set 3", 
    available: false,
    ticketCount: 600,
    description: "Deluxe ticket set (Coming Soon)"
  },
  {
    id: "4",
    name: "Ultimate Set 4",
    available: false, 
    ticketCount: 600,
    description: "Ultimate ticket set (Coming Soon)"
  }
];

// Available game prizes
const AVAILABLE_PRIZES: GamePrize[] = [
  {
    id: 'quickFive',
    name: 'Quick Five',
    pattern: 'First 5 numbers',
    description: 'First player to mark any 5 numbers (Multiple winners possible if same number call)'
  },
  {
    id: 'topLine',
    name: 'Top Line',
    pattern: 'Complete top row',
    description: 'Complete the top row of any ticket (Multiple winners possible)'
  },
  {
    id: 'middleLine',
    name: 'Middle Line',
    pattern: 'Complete middle row', 
    description: 'Complete the middle row of any ticket (Multiple winners possible)'
  },
  {
    id: 'bottomLine',
    name: 'Bottom Line',
    pattern: 'Complete bottom row',
    description: 'Complete the bottom row of any ticket (Multiple winners possible)'
  },
  {
    id: 'fourCorners',
    name: 'Four Corners',
    pattern: 'All four corner numbers',
    description: 'Mark all four corner numbers of any ticket (Multiple winners possible)'
  },
  {
    id: 'fullHouse',
    name: 'Full House',
    pattern: 'Complete ticket',
    description: 'Complete all numbers on any ticket (Multiple winners possible if same number call)'
  }
];

// Traditional Tambola number calls
const getNumberCall = (number: number): string => {
  const traditionalCalls: { [key: number]: string } = {
    1: "Kelly's Eyes",
    2: "One Little Duck",
    3: "Cup of Tea",
    4: "Knock at the Door",
    5: "Man Alive",
    6: "Half a Dozen",
    7: "Lucky Seven",
    8: "Garden Gate",
    9: "Doctor's Orders",
    10: "Uncle Ben",
    11: "Legs Eleven",
    12: "One Dozen",
    13: "Unlucky for Some",
    14: "Valentine's Day",
    15: "Young and Keen",
    16: "Sweet Sixteen",
    17: "Dancing Queen",
    18: "Now You Can Vote",
    19: "Goodbye Teens",
    20: "One Score",
    21: "Key of the Door",
    22: "Two Little Ducks",
    30: "Dirty Thirty",
    44: "Droopy Drawers",
    45: "Halfway There",
    50: "Half a Century",
    55: "Snakes Alive",
    66: "Clickety Click",
    77: "Sunset Strip",
    88: "Two Fat Ladies",
    90: "Top of the Shop"
  };

  const call = traditionalCalls[number];
  return call ? `${call} - ${number}` : `Number ${number}`;
};

export const GameHost: React.FC<GameHostProps> = ({ user, userRole }) => {
  const [activeTab, setActiveTab] = useState('create-game');
  const [currentGame, setCurrentGame] = useState<GameData | null>(null);
  const [selectedGameInMyGames, setSelectedGameInMyGames] = useState<GameData | null>(null);
  const [allGames, setAllGames] = useState<GameData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedGameForEdit, setSelectedGameForEdit] = useState<GameData | null>(null);
  
  // Auto-resume state
  const [isAutoResuming, setIsAutoResuming] = useState(true);
  const [autoResumeGame, setAutoResumeGame] = useState<GameData | null>(null);
  
  const [createGameForm, setCreateGameForm] = useState<CreateGameForm>({
    hostPhone: '',
    maxTickets: 100,
    selectedTicketSet: '1',
    selectedPrizes: []
  });

  const [editGameForm, setEditGameForm] = useState<EditGameForm>({
    gameId: '',
    hostPhone: '',
    maxTickets: 100,
    selectedPrizes: []
  });

  const { toast } = useToast();

  // Game control states
  const [gameInterval, setGameInterval] = useState<NodeJS.Timeout | null>(null);
  const [availableNumbers, setAvailableNumbers] = useState<number[]>(
    Array.from({ length: 90 }, (_, i) => i + 1)
  );
  const [gameUnsubscribe, setGameUnsubscribe] = useState<(() => void) | null>(null);
  
  // ✅ FIXED: Track announced winners to prevent repeated notifications
  const [announcedWinners, setAnnouncedWinners] = useState<Set<string>>(new Set());
  
  // Game control states
  const [callInterval, setCallInterval] = useState<number>(5);
  const [countdownDuration, setCountdownDuration] = useState<number>(10);
  const [isGamePaused, setIsGamePaused] = useState<boolean>(false);
  const [currentCountdown, setCurrentCountdown] = useState<number>(0);
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);

  // Check subscription status
  const isSubscriptionValid = useCallback(() => {
    if (!user.isActive) return false;
    if (!user.subscriptionEndDate) return false;
    
    const subscriptionEnd = new Date(user.subscriptionEndDate);
    const now = new Date();
    
    return subscriptionEnd > now && user.isActive;
  }, [user.isActive, user.subscriptionEndDate]);

  const getSubscriptionStatus = useCallback(() => {
    if (!user.isActive) {
      return { status: 'inactive', message: 'Account is deactivated', variant: 'destructive' as const };
    }
    
    if (!user.subscriptionEndDate) {
      return { status: 'no-subscription', message: 'No subscription date', variant: 'destructive' as const };
    }
    
    const subscriptionEnd = new Date(user.subscriptionEndDate);
    const now = new Date();
    
    if (isNaN(subscriptionEnd.getTime())) {
      return { status: 'invalid-date', message: 'Invalid subscription date', variant: 'destructive' as const };
    }
    
    const daysLeft = Math.ceil((subscriptionEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { status: 'expired', message: 'Subscription expired', variant: 'destructive' as const };
    if (daysLeft <= 7) return { status: 'expiring', message: `Expires in ${daysLeft} days`, variant: 'secondary' as const };
    return { status: 'active', message: `Active (${daysLeft} days left)`, variant: 'default' as const };
  }, [user.isActive, user.subscriptionEndDate]);

  // Auto-resume logic - find active or recent games
  const findActiveOrRecentGame = useCallback((games: GameData[]): GameData | null => {
    console.log('🔍 Checking for active or recent games...');
    
    const sortedGames = games.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const activeGame = sortedGames.find(game => 
      game.gameState.isActive || 
      game.gameState.isCountdown
    );

    if (activeGame) {
      console.log('🎮 Found active game:', activeGame.name, activeGame.gameState);
      return activeGame;
    }

    const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
    const recentGame = sortedGames.find(game => {
      const gameDate = new Date(game.createdAt).getTime();
      const hasProgress = game.gameState.calledNumbers && game.gameState.calledNumbers.length > 0;
      const isRecent = gameDate > fourHoursAgo;
      
      return (game.gameState.gameOver || hasProgress) && isRecent;
    });

    if (recentGame) {
      console.log('📅 Found recent game:', recentGame.name, recentGame.gameState);
      return recentGame;
    }

    const pausedGame = sortedGames.find(game => {
      const hasProgress = game.gameState.calledNumbers && game.gameState.calledNumbers.length > 0;
      return hasProgress && !game.gameState.gameOver;
    });

    if (pausedGame) {
      console.log('⏸️ Found paused game:', pausedGame.name, pausedGame.gameState);
      return pausedGame;
    }

    console.log('❌ No active or recent games found');
    return null;
  }, []);

  // ✅ FIXED: Auto-resume function with proper winner tracking reset
  const autoResumeFromGame = useCallback(async (game: GameData) => {
    console.log('🔄 Auto-resuming game:', game.name);
    
    try {
      setCurrentGame(game);
      setSelectedGameInMyGames(game);
      setAutoResumeGame(game);
      setActiveTab('game-control');
      
      // ✅ Reset announced winners when resuming
      setAnnouncedWinners(new Set());
      
      const called = game.gameState.calledNumbers || [];
      const available = Array.from({ length: 90 }, (_, i) => i + 1)
        .filter(num => !called.includes(num));
      setAvailableNumbers(available);

      const unsubscribe = firebaseService.subscribeToGame(game.gameId, (updatedGame) => {
        if (updatedGame) {
          setCurrentGame(updatedGame);
          setSelectedGameInMyGames(updatedGame);
          const calledNums = updatedGame.gameState.calledNumbers || [];
          const availableNums = Array.from({ length: 90 }, (_, i) => i + 1)
            .filter(num => !calledNums.includes(num));
          setAvailableNumbers(availableNums);
          
          // ✅ FIXED: Only announce NEW winners using timestamp
          if (updatedGame.lastWinnerAnnouncement && 
              updatedGame.lastWinnerAt && 
              !announcedWinners.has(updatedGame.lastWinnerAt)) {
            
            setAnnouncedWinners(prev => new Set([...prev, updatedGame.lastWinnerAt!]));
            
            toast({
              title: "🎉 NEW WINNER!",
              description: updatedGame.lastWinnerAnnouncement,
              duration: 8000,
            });
            
            console.log('🎉 NEW winner notification:', updatedGame.lastWinnerAnnouncement);
          }
        }
      });
      setGameUnsubscribe(() => unsubscribe);

      if (game.gameState.isActive && !game.gameState.gameOver) {
        console.log('▶️ Resuming active game...');
        setIsGamePaused(false);
        
        toast({
          title: "Game Resumed",
          description: `Resumed ${game.name} - automatic number calling continues with prize validation!`,
        });
        
        setTimeout(() => {
          startNumberCalling();
        }, 1000);
      } else if (game.gameState.gameOver) {
        toast({
          title: "Game Completed",
          description: `Loaded completed game: ${game.name}`,
        });
      } else {
        toast({
          title: "Game Loaded",
          description: `Loaded game: ${game.name} - ready to continue with automatic prize validation!`,
        });
      }

    } catch (error) {
      console.error('❌ Error auto-resuming game:', error);
      toast({
        title: "Auto-Resume Failed",
        description: "Failed to resume the previous game. You can manually select it from My Games.",
        variant: "destructive",
      });
    } finally {
      setIsAutoResuming(false);
    }
  }, [toast, announcedWinners]);

  // Load host games and check for auto-resume
  const loadHostGames = useCallback(async () => {
    try {
      console.log('📥 Loading host games...');
      const games = await firebaseService.getHostGames(user.uid);
      setAllGames(games);
      
      if (isAutoResuming && games.length > 0) {
        const resumeGame = findActiveOrRecentGame(games);
        if (resumeGame) {
          console.log('🚀 Auto-resuming game found!');
          await autoResumeFromGame(resumeGame);
          return;
        }
      }
      
      setIsAutoResuming(false);
    } catch (error: any) {
      console.error('❌ Error loading host games:', error);
      setIsAutoResuming(false);
      toast({
        title: "Error",
        description: "Failed to load your games",
        variant: "destructive",
      });
    }
  }, [user.uid, isAutoResuming, findActiveOrRecentGame, autoResumeFromGame, toast]);

  const loadPreviousSettings = async () => {
    try {
      const settings = await firebaseService.getHostSettings(user.uid);
      if (settings) {
        setCreateGameForm(prev => ({
          ...prev,
          hostPhone: settings.hostPhone || prev.hostPhone,
          maxTickets: settings.maxTickets || prev.maxTickets,
          selectedTicketSet: settings.selectedTicketSet || prev.selectedTicketSet,
          selectedPrizes: settings.selectedPrizes || prev.selectedPrizes
        }));
      }
    } catch (error) {
      console.error('Error loading previous settings:', error);
    }
  };

  // Load host games and settings on mount
  useEffect(() => {
    if (isSubscriptionValid()) {
      loadHostGames();
      loadPreviousSettings();
    }
  }, [isSubscriptionValid, loadHostGames]);

  // Cleanup intervals and subscriptions on unmount
  useEffect(() => {
    return () => {
      if (gameInterval) {
        clearInterval(gameInterval);
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      if (gameUnsubscribe) {
        gameUnsubscribe();
      }
    };
  }, [gameInterval, countdownInterval, gameUnsubscribe]);

  const savePreviousSettings = async () => {
    try {
      await firebaseService.saveHostSettings(user.uid, {
        hostPhone: createGameForm.hostPhone,
        maxTickets: createGameForm.maxTickets,
        selectedTicketSet: createGameForm.selectedTicketSet,
        selectedPrizes: createGameForm.selectedPrizes
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // ===========================
  // GAME CREATION & MANAGEMENT
  // ===========================

  const handleMaxTicketsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (value === '') {
      setCreateGameForm(prev => ({ ...prev, maxTickets: 0 }));
      return;
    }
    
    const numValue = parseInt(value, 10);
    
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(1, Math.min(600, numValue));
      setCreateGameForm(prev => ({ ...prev, maxTickets: clampedValue }));
    }
  };

  const handleEditMaxTicketsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (value === '') {
      setEditGameForm(prev => ({ ...prev, maxTickets: 0 }));
      return;
    }
    
    const numValue = parseInt(value, 10);
    
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(1, Math.min(600, numValue));
      setEditGameForm(prev => ({ ...prev, maxTickets: clampedValue }));
    }
  };

  const createNewGame = async () => {
    if (!isSubscriptionValid()) {
      toast({
        title: "Access Denied",
        description: "Your subscription has expired or account is inactive",
        variant: "destructive",
      });
      return;
    }

    if (!createGameForm.hostPhone.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter your WhatsApp phone number",
        variant: "destructive",
      });
      return;
    }

    if (!createGameForm.selectedTicketSet) {
      toast({
        title: "Validation Error",
        description: "Please select a ticket set",
        variant: "destructive",
      });
      return;
    }

    if (createGameForm.selectedPrizes.length === 0) {
      toast({
        title: "Validation Error", 
        description: "Please select at least one prize",
        variant: "destructive",
      });
      return;
    }

    if (createGameForm.maxTickets < 1 || createGameForm.maxTickets > 600) {
      toast({
        title: "Validation Error",
        description: "Max tickets must be between 1 and 600",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const gameName = `Game ${new Date().toLocaleString()}`;
      
      const gameData = await firebaseService.createGame(
        {
          name: gameName,
          maxTickets: createGameForm.maxTickets,
          ticketPrice: 0,
          hostPhone: createGameForm.hostPhone
        },
        user.uid,
        createGameForm.selectedTicketSet,
        createGameForm.selectedPrizes
      );

      await savePreviousSettings();

      setCurrentGame(gameData);
      setSelectedGameInMyGames(gameData);
      setActiveTab('my-games');
      await loadHostGames();

      setAvailableNumbers(Array.from({ length: 90 }, (_, i) => i + 1));

      // ✅ Reset announced winners for new game
      setAnnouncedWinners(new Set());

      toast({
        title: "Game Created with Auto Prize Validation!",
        description: `Game created successfully with ${createGameForm.maxTickets} tickets and automatic winner detection!`,
      });

      const unsubscribe = firebaseService.subscribeToGame(gameData.gameId, (updatedGame) => {
        if (updatedGame) {
          setCurrentGame(updatedGame);
          setSelectedGameInMyGames(updatedGame);
          const called = updatedGame.gameState.calledNumbers || [];
          const available = Array.from({ length: 90 }, (_, i) => i + 1)
            .filter(num => !called.includes(num));
          setAvailableNumbers(available);
          
          // ✅ FIXED: Handle winner announcements with timestamp tracking
          if (updatedGame.lastWinnerAnnouncement && 
              updatedGame.lastWinnerAt && 
              !announcedWinners.has(updatedGame.lastWinnerAt)) {
            
            setAnnouncedWinners(prev => new Set([...prev, updatedGame.lastWinnerAt!]));
            
            toast({
              title: "🎉 NEW WINNER!",
              description: updatedGame.lastWinnerAnnouncement,
              duration: 8000,
            });
          }
        }
      });

      setGameUnsubscribe(() => unsubscribe);
    } catch (error: any) {
      console.error('Create game error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create game",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ===========================
  // ENHANCED GAME CONTROL FUNCTIONS
  // ===========================

  const startCountdown = async () => {
    if (!currentGame || !isSubscriptionValid()) return;

    try {
      setCurrentCountdown(countdownDuration);
      
      await firebaseService.updateGameState(currentGame.gameId, {
        ...currentGame.gameState,
        isCountdown: true,
        countdownTime: countdownDuration,
        isActive: false
      });

      toast({
        title: "Game Starting",
        description: `${countdownDuration} second countdown has begun! Automatic prize validation is ready!`,
      });

      const countdown = setInterval(async () => {
        setCurrentCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdown);
            setCountdownInterval(null);
            startGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setCountdownInterval(countdown);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start countdown",
        variant: "destructive",
      });
    }
  };

  const startGame = async () => {
    if (!currentGame) return;

    try {
      await firebaseService.updateGameState(currentGame.gameId, {
        ...currentGame.gameState,
        isCountdown: false,
        isActive: true,
        countdownTime: 0
      });

      setIsGamePaused(false);
      startNumberCalling();

      toast({
        title: "Game Started with Auto Prize Validation!",
        description: "Automatic number calling has begun with real-time winner detection!",
        duration: 6000,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start game",
        variant: "destructive",
      });
    }
  };

  // ✅ ENHANCED: Using new prize validation method
  const startNumberCalling = () => {
    if (!currentGame) return;

    console.log('🎯 Starting number calling with automatic prize validation, interval:', callInterval, 'seconds');

    const interval = setInterval(async () => {
      console.log('🔄 Number calling interval triggered, available numbers:', availableNumbers.length);
      
      if (availableNumbers.length === 0) {
        console.log('🏁 No more numbers available, ending game');
        clearInterval(interval);
        await endGame();
        return;
      }

      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const numberToBeCalled = availableNumbers[randomIndex];
      
      console.log('📞 Calling number with prize validation:', numberToBeCalled);
      
      // Update local available numbers immediately (optimistic update)
      setAvailableNumbers(prev => {
        const newAvailable = prev.filter(n => n !== numberToBeCalled);
        console.log('🔄 Updated available numbers locally, remaining:', newAvailable.length);
        return newAvailable;
      });
      
      try {
        // ✅ NEW: Use enhanced method with automatic prize validation
        const result = await firebaseService.callNumberWithPrizeValidation(
          currentGame.gameId, 
          numberToBeCalled
        );
        
        console.log('✅ Number called successfully with prize validation:', {
          number: numberToBeCalled,
          winnersFound: result.winners ? Object.keys(result.winners).length : 0,
          announcements: result.announcements
        });

        // Show winner notifications immediately (these will be filtered by timestamp)
        if (result.announcements && result.announcements.length > 0) {
          for (const announcement of result.announcements) {
            toast({
              title: "🎉 WINNER DETECTED!",
              description: announcement,
              duration: 10000,
            });
          }
        }

        // Clear current number after display time
        setTimeout(async () => {
          if (currentGame) {
            console.log('🔄 Clearing current number display');
            await firebaseService.clearCurrentNumber(currentGame.gameId);
          }
        }, 3000);

      } catch (error) {
        console.error('❌ Error calling number with prize validation:', error);
        
        // Revert optimistic update on error
        setAvailableNumbers(prev => {
          if (!prev.includes(numberToBeCalled)) {
            return [...prev, numberToBeCalled].sort((a, b) => a - b);
          }
          return prev;
        });
        
        toast({
          title: "Error Calling Number",
          description: `Failed to call number ${numberToBeCalled}. Retrying...`,
          variant: "destructive",
        });
      }
    }, callInterval * 1000);

    setGameInterval(interval);
    console.log('✅ Number calling interval started with automatic prize validation');
  };

  const pauseGame = async () => {
    if (gameInterval) {
      clearInterval(gameInterval);
      setGameInterval(null);
    }

    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
    }

    setIsGamePaused(true);

    if (currentGame) {
      try {
        await firebaseService.updateGameState(currentGame.gameId, {
          ...currentGame.gameState,
          isActive: false,
          isCountdown: false
        });

        toast({
          title: "Game Paused",
          description: "The game has been paused. Prize validation will resume when you continue.",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to pause game",
          variant: "destructive",
        });
      }
    }
  };

  const resumeGame = async () => {
    if (!currentGame) return;

    try {
      await firebaseService.updateGameState(currentGame.gameId, {
        ...currentGame.gameState,
        isActive: true,
        isCountdown: false
      });

      setIsGamePaused(false);
      startNumberCalling();

      toast({
        title: "Game Resumed",
        description: "Automatic number calling with prize validation has resumed!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resume game",
        variant: "destructive",
      });
    }
  };

  const endGame = async () => {
    if (gameInterval) {
      clearInterval(gameInterval);
      setGameInterval(null);
    }

    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
    }

    setIsGamePaused(false);

    if (currentGame) {
      try {
        await firebaseService.updateGameState(currentGame.gameId, {
          ...currentGame.gameState,
          isActive: false,
          isCountdown: false,
          gameOver: true,
          currentNumber: null
        });

        toast({
          title: "Game Ended",
          description: "The game has been completed. Check the final prize results!",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to end game",
          variant: "destructive",
        });
      }
    }
  };

  // ✅ FIXED: Reset game function clears announced winners
  const resetGame = async () => {
    const confirmed = window.confirm('Are you sure you want to reset the game? This will clear all called numbers, prizes, and restart the game.');
    if (!confirmed) return;

    if (gameInterval) {
      clearInterval(gameInterval);
      setGameInterval(null);
    }

    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
    }

    setIsGamePaused(false);
    setAvailableNumbers(Array.from({ length: 90 }, (_, i) => i + 1));
    
    // ✅ Clear announced winners when resetting
    setAnnouncedWinners(new Set());

    if (currentGame) {
      try {
        // Reset game state
        await firebaseService.updateGameState(currentGame.gameId, {
          ...currentGame.gameState,
          isActive: false,
          isCountdown: false,
          gameOver: false,
          calledNumbers: [],
          currentNumber: null
        });

        // Reset all prizes
        const resetPrizes = { ...currentGame.prizes };
        for (const prizeId of Object.keys(resetPrizes)) {
          await firebaseService.resetPrize(currentGame.gameId, prizeId);
        }

        toast({
          title: "Game Reset",
          description: "The game has been reset and is ready to start again with fresh prize validation.",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to reset game",
          variant: "destructive",
        });
      }
    }
  };

  // ===========================
  // UTILITY FUNCTIONS
  // ===========================

  const getBookedTicketsCount = (game?: GameData) => {
    const gameToCheck = game || currentGame;
    if (!gameToCheck || !gameToCheck.tickets) return 0;
    return Object.values(gameToCheck.tickets).filter(ticket => ticket.isBooked).length;
  };

  const handleTicketSetSelect = (setId: string) => {
    const ticketSet = TICKET_SETS.find(set => set.id === setId);
    if (ticketSet && ticketSet.available) {
      setCreateGameForm(prev => ({ ...prev, selectedTicketSet: setId }));
    }
  };

  const handlePrizeToggle = (prizeId: string, checked: boolean) => {
    setCreateGameForm(prev => ({
      ...prev,
      selectedPrizes: checked 
        ? [...prev.selectedPrizes, prizeId]
        : prev.selectedPrizes.filter(id => id !== prizeId)
    }));
  };

  const handleEditPrizeToggle = (prizeId: string, checked: boolean) => {
    setEditGameForm(prev => ({
      ...prev,
      selectedPrizes: checked 
        ? [...prev.selectedPrizes, prizeId]
        : prev.selectedPrizes.filter(id => id !== prizeId)
    }));
  };

  const subscriptionStatus = getSubscriptionStatus();

  // Subscription check
  if (!isSubscriptionValid()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-800">Host Dashboard</h1>
            <p className="text-slate-600">Welcome back, {user.name}!</p>
          </div>

          <Card className="border-red-500">
            <CardHeader>
              <CardTitle className="flex items-center text-red-600">
                <AlertCircle className="w-6 h-6 mr-2" />
                Account Access Restricted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {subscriptionStatus.message}. Please contact the administrator to restore access to your account.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Auto-resume loading screen
  if (isAutoResuming) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Your Games...</h2>
            <p className="text-gray-600 mb-4">
              Checking for active games to resume with automatic prize validation
            </p>
            <div className="flex justify-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===========================
  // RENDER FUNCTIONS
  // ===========================

  const renderCreateGame = () => (
    <div className="space-y-6">
      {/* Subscription Status */}
      <Card className={`border-l-4 ${
        subscriptionStatus.status === 'active' ? 'border-l-green-500' :
        subscriptionStatus.status === 'expiring' ? 'border-l-yellow-500' : 'border-l-red-500'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Subscription Status</p>
              <Badge variant={subscriptionStatus.variant}>{subscriptionStatus.message}</Badge>
            </div>
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
        </CardContent>
      </Card>

      {/* Auto-Resume Alert */}
      {autoResumeGame && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="text-blue-600">🔄</div>
              <div>
                <p className="text-sm font-medium text-gray-800">Auto-Resume Active!</p>
                <p className="text-xs text-gray-600">
                  Resumed game: <strong>{autoResumeGame.name}</strong> - Go to Game Control to manage it.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ✅ NEW: Prize Validation Feature Alert */}
      <Card className="border-l-4 border-l-green-500">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Zap className="w-6 h-6 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-800">🎯 Automatic Prize Validation Enabled!</p>
              <p className="text-xs text-gray-600">
                Winners are automatically detected and announced when numbers are called. 
                Multiple winners possible if they win on the same number call!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create New Game */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Create New Game with Auto Prize Validation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Game Settings */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="host-phone" className="text-base font-semibold">WhatsApp Phone Number</Label>
              <p className="text-sm text-gray-600 mb-2">Your WhatsApp number for ticket bookings (e.g., 919876543210)</p>
              <Input
                id="host-phone"
                placeholder="919876543210"
                value={createGameForm.hostPhone}
                onChange={(e) => setCreateGameForm(prev => ({ ...prev, hostPhone: e.target.value }))}
                className="border-2 border-gray-200 focus:border-blue-400"
              />
            </div>
            
            <div>
              <Label htmlFor="max-tickets" className="text-base font-semibold">Maximum Tickets</Label>
              <p className="text-sm text-gray-600 mb-2">Set the maximum number of tickets to sell (1-600)</p>
              <Input
                id="max-tickets"
                type="number"
                min="1"
                max="600"
                placeholder="100"
                value={createGameForm.maxTickets === 0 ? '' : createGameForm.maxTickets.toString()}
                onChange={handleMaxTicketsChange}
                className="border-2 border-gray-200 focus:border-blue-400"
              />
              {createGameForm.maxTickets === 0 && (
                <p className="text-xs text-red-500 mt-1">Please enter a number between 1 and 600</p>
              )}
            </div>
          </div>

          {/* Ticket Set Selection */}
          <div>
            <Label className="text-base font-semibold">Select Ticket Set</Label>
            <p className="text-sm text-gray-600 mb-4">Choose from available ticket sets</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TICKET_SETS.map((ticketSet) => (
                <Card 
                  key={ticketSet.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    !ticketSet.available 
                      ? 'bg-gray-100 border-gray-300 opacity-60' 
                      : createGameForm.selectedTicketSet === ticketSet.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-25'
                  }`}
                  onClick={() => handleTicketSetSelect(ticketSet.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <Ticket className={`w-5 h-5 mr-2 ${
                            !ticketSet.available ? 'text-gray-400' : 'text-blue-600'
                          }`} />
                          <h3 className={`font-semibold ${
                            !ticketSet.available ? 'text-gray-500' : 'text-gray-800'
                          }`}>
                            {ticketSet.name}
                          </h3>
                          {!ticketSet.available && (
                            <Lock className="w-4 h-4 ml-2 text-gray-400" />
                          )}
                        </div>
                        <p className={`text-sm mb-2 ${
                          !ticketSet.available ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {ticketSet.description}
                        </p>
                        <Badge variant={ticketSet.available ? "default" : "secondary"}>
                          {ticketSet.ticketCount} Tickets
                        </Badge>
                      </div>
                      {createGameForm.selectedTicketSet === ticketSet.id && (
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Prize Selection with Enhanced Descriptions */}
          <div>
            <Label className="text-base font-semibold">Select Game Prizes</Label>
            <p className="text-sm text-gray-600 mb-2">Choose which prizes to include in this game</p>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-blue-600" />
                <p className="text-sm text-blue-800">
                  <strong>Auto Prize Validation:</strong> Winners are automatically detected and announced! 
                  Multiple winners allowed if they win on the same number call.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AVAILABLE_PRIZES.map((prize) => (
                <Card key={prize.id} className="border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id={`prize-${prize.id}`}
                        checked={createGameForm.selectedPrizes.includes(prize.id)}
                        onCheckedChange={(checked) => handlePrizeToggle(prize.id, checked as boolean)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label 
                          htmlFor={`prize-${prize.id}`}
                          className="cursor-pointer"
                        >
                          <div className="mb-1">
                            <h4 className="font-semibold text-gray-800">{prize.name}</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{prize.pattern}</p>
                          <p className="text-xs text-gray-500">{prize.description}</p>
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Create Game Button */}
          <Button 
            onClick={createNewGame} 
            disabled={isLoading || !createGameForm.hostPhone.trim() || !createGameForm.selectedTicketSet || createGameForm.selectedPrizes.length === 0 || createGameForm.maxTickets < 1}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            {isLoading ? 'Creating Game...' : 'Create Game with Auto Prize Validation'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderMyGames = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Trophy className="w-6 h-6 mr-2" />
              My Games ({allGames.length})
            </div>
            <Button onClick={loadHostGames} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allGames.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No games created yet</p>
              <p className="text-gray-500 text-sm mt-2">Create your first game with automatic prize validation to get started!</p>
              <Button
                onClick={() => setActiveTab('create-game')}
                className="mt-4"
                variant="outline"
              >
                Create First Game
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {allGames.map((game) => {
                const wonPrizes = Object.values(game.prizes).filter(p => p.won);
                const totalWinners = wonPrizes.reduce((total, prize) => 
                  total + (prize.winners ? prize.winners.length : 0), 0
                );
                const bookedTickets = getBookedTicketsCount(game);
                
                return (
                  <Card 
                    key={game.gameId}
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedGameInMyGames?.gameId === game.gameId
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                    onClick={() => {
                      setSelectedGameInMyGames(game);
                      setCurrentGame(game);
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-800 mb-1">{game.name}</h3>
                          <p className="text-sm text-gray-600">
                            Created: {new Date(game.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Badge 
                            variant={
                              game.gameState.isActive ? "default" : 
                              game.gameState.isCountdown ? "secondary" : 
                              game.gameState.gameOver ? "outline" : "secondary"
                            }
                          >
                            {game.gameState.isActive ? "🟢 Live" : 
                             game.gameState.isCountdown ? "🟡 Starting" : 
                             game.gameState.gameOver ? "🔴 Completed" : "⚪ Waiting"}
                          </Badge>
                          {selectedGameInMyGames?.gameId === game.gameId && (
                            <Eye className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="text-xl font-bold text-blue-600">{bookedTickets}</div>
                          <div className="text-xs text-blue-700">Players</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="text-xl font-bold text-green-600">
                            {(game.gameState.calledNumbers || []).length}
                          </div>
                          <div className="text-xs text-green-700">Numbers Called</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="text-xl font-bold text-purple-600">{wonPrizes.length}</div>
                          <div className="text-xs text-purple-700">Prizes Won</div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <div className="text-xl font-bold text-orange-600">{totalWinners}</div>
                          <div className="text-xs text-orange-700">Total Winners</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        <Badge variant="outline">Max: {game.maxTickets} tickets</Badge>
                        <Badge variant="outline">Set: {game.ticketSetId}</Badge>
                        <Badge variant="outline">{Object.keys(game.prizes).length} prizes</Badge>
                        {game.hostPhone && (
                          <Badge variant="outline">
                            <Phone className="w-3 h-3 mr-1" />
                            WhatsApp
                          </Badge>
                        )}
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                          Auto Prize Validation: 
                          <span className="text-green-600 font-medium ml-1">✅ Enabled</span>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGameForEdit(game);
                              setEditGameForm({
                                gameId: game.gameId,
                                hostPhone: game.hostPhone || '',
                                maxTickets: game.maxTickets,
                                selectedPrizes: Object.keys(game.prizes)
                              });
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Are you sure you want to delete "${game.name}"?`)) {
                                firebaseService.deleteGame(game.gameId).then(() => {
                                  toast({
                                    title: "Game Deleted",
                                    description: `${game.name} has been deleted.`,
                                  });
                                  loadHostGames();
                                });
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Game Actions */}
      {selectedGameInMyGames && (
        <Card>
          <CardHeader>
            <CardTitle>Game Actions: {selectedGameInMyGames.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setActiveTab('game-control')}
                className="bg-green-600 hover:bg-green-700"
              >
                <Settings className="w-4 h-4 mr-2" />
                Game Control & Prize Management
              </Button>
              
              {!selectedGameInMyGames.gameState.gameOver && (
                <Button
                  onClick={() => {
                    // Set current game and switch tabs
                    setCurrentGame(selectedGameInMyGames);
                    setActiveTab('game-control');
                  }}
                  variant="outline"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Manage Tickets & Prizes
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Game Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Game: {selectedGameForEdit?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-host-phone">WhatsApp Phone Number</Label>
              <Input
                id="edit-host-phone"
                placeholder="919876543210"
                value={editGameForm.hostPhone}
                onChange={(e) => setEditGameForm(prev => ({ ...prev, hostPhone: e.target.value }))}
                className="border-2 border-gray-200 focus:border-blue-400"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-max-tickets">Maximum Tickets</Label>
              <Input
                id="edit-max-tickets"
                type="number"
                min="1"
                max="600"
                value={editGameForm.maxTickets === 0 ? '' : editGameForm.maxTickets.toString()}
                onChange={handleEditMaxTicketsChange}
                className="border-2 border-gray-200 focus:border-blue-400"
              />
            </div>

            <div>
              <Label className="text-base font-semibold">Game Prizes</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {AVAILABLE_PRIZES.map((prize) => (
                  <div key={prize.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-prize-${prize.id}`}
                      checked={editGameForm.selectedPrizes.includes(prize.id)}
                      onCheckedChange={(checked) => handleEditPrizeToggle(prize.id, checked as boolean)}
                    />
                    <Label htmlFor={`edit-prize-${prize.id}`} className="text-sm">
                      {prize.name} - {prize.pattern}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={async () => {
                  if (!selectedGameForEdit) return;
                  setIsLoading(true);
                  try {
                    await firebaseService.updateGameConfig(selectedGameForEdit.gameId, {
                      maxTickets: editGameForm.maxTickets,
                      hostPhone: editGameForm.hostPhone,
                      selectedPrizes: editGameForm.selectedPrizes
                    });
                    
                    toast({
                      title: "Game Updated",
                      description: "Game configuration has been updated successfully!",
                    });
                    
                    setShowEditDialog(false);
                    await loadHostGames();
                  } catch (error: any) {
                    toast({
                      title: "Update Failed",
                      description: error.message || "Failed to update game",
                      variant: "destructive",
                    });
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading || editGameForm.selectedPrizes.length === 0}
                className="flex-1"
              >
                {isLoading ? 'Updating...' : 'Update Game'}
              </Button>
              <Button
                onClick={() => setShowEditDialog(false)}
                variant="outline"
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderGameControl = () => {
    if (!currentGame) {
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No game selected. Select a game from "My Games" tab first.</p>
            <Button
              onClick={() => setActiveTab('my-games')}
              className="mt-4"
              variant="outline"
            >
              Go to My Games
            </Button>
          </CardContent>
        </Card>
      );
    }

    const wonPrizes = Object.values(currentGame.prizes).filter(p => p.won);
    const totalWinners = wonPrizes.reduce((total, prize) => 
      total + (prize.winners ? prize.winners.length : 0), 0
    );

    return (
      <div className="space-y-6">
        {/* Auto-Resume Notification */}
        {autoResumeGame?.gameId === currentGame.gameId && (
          <Card className="border-l-4 border-l-blue-500 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <RefreshCw className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Auto-Resumed Game</p>
                  <p className="text-xs text-blue-700">
                    This game was automatically resumed with automatic prize validation enabled.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Prize Validation Status */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Zap className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">🎯 Auto Prize Validation Active</p>
                  <p className="text-xs text-green-700">
                    Winners: {totalWinners} | Prizes Won: {wonPrizes.length}/{Object.keys(currentGame.prizes).length} | 
                    Announcements: {announcedWinners.size} tracked
                  </p>
                </div>
              </div>
              <Badge variant="default" className="bg-green-600">
                Live Detection
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Game Control Header */}
        <Card className="game-control-panel">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Game Control: {currentGame.name}
              <Badge 
                className={`game-status-indicator ${
                  currentGame.gameState.isActive ? 'game-status-active' : 
                  currentGame.gameState.isCountdown ? 'game-status-countdown' : 
                  isGamePaused ? 'game-status-paused' : 'game-status-waiting'
                }`}
              >
                {currentGame.gameState.isActive ? "🟢 Live Game" : 
                 currentGame.gameState.isCountdown ? "🟡 Starting..." : 
                 isGamePaused ? "🟣 Paused" : "⚪ Waiting"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Game Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="call-interval">Number Call Interval (seconds)</Label>
                <Input
                  id="call-interval"
                  type="number"
                  min="3"
                  max="15"
                  value={callInterval}
                  onChange={(e) => setCallInterval(parseInt(e.target.value) || 5)}
                  disabled={currentGame.gameState.isActive}
                  className="form-input-enhanced"
                />
                <p className="text-xs text-gray-500 mt-1">Time between automatic number calls with prize validation</p>
              </div>
              <div>
                <Label htmlFor="countdown-duration">Countdown Duration (seconds)</Label>
                <Input
                  id="countdown-duration"
                  type="number"
                  min="5"
                  max="30"
                  value={countdownDuration}
                  onChange={(e) => setCountdownDuration(parseInt(e.target.value) || 10)}
                  disabled={currentGame.gameState.isActive || currentGame.gameState.isCountdown}
                  className="form-input-enhanced"
                />
                <p className="text-xs text-gray-500 mt-1">Countdown time before game starts</p>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex flex-wrap gap-3">
              {!currentGame.gameState.isActive && !currentGame.gameState.isCountdown && !currentGame.gameState.gameOver && !isGamePaused && (
                <Button onClick={startCountdown} className="control-btn-start">
                  <Play className="w-4 h-4 mr-2" />
                  Start Game with Auto Validation
                </Button>
              )}

              {isGamePaused && !currentGame.gameState.gameOver && (
                <Button onClick={resumeGame} className="control-btn-start">
                  <Play className="w-4 h-4 mr-2" />
                  Resume Game
                </Button>
              )}

              {(currentGame.gameState.isActive || currentGame.gameState.isCountdown) && (
                <Button onClick={pauseGame} className="control-btn-pause">
                  <Pause className="w-4 h-4 mr-2" />
                  Pause Game
                </Button>
              )}

              {(currentGame.gameState.isActive || currentGame.gameState.isCountdown || isGamePaused) && (
                <Button onClick={endGame} className="control-btn-stop">
                  <Square className="w-4 h-4 mr-2" />
                  End Game
                </Button>
              )}

              {(currentGame.gameState.gameOver || (currentGame.gameState.calledNumbers && currentGame.gameState.calledNumbers.length > 0)) && (
                <Button onClick={resetGame} className="control-btn-reset">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset Game & Prizes
                </Button>
              )}
            </div>

            {/* Countdown Display */}
            {currentGame.gameState.isCountdown && (
              <div className="countdown-display">
                <Clock className="w-16 h-16 mx-auto mb-6 animate-pulse" />
                <p className="countdown-number mb-4">
                  {currentCountdown || currentGame.gameState.countdownTime}
                </p>
                <p className="text-2xl font-semibold">Game starting soon with auto prize validation...</p>
              </div>
            )}

            {/* Current Number Display */}
            {currentGame.gameState.currentNumber && (
              <div className="current-number-display">
                <p className="text-3xl mb-4 font-semibold">Current Number</p>
                <p className="current-number-text">{currentGame.gameState.currentNumber}</p>
                <p className="text-xl mt-4 font-medium">
                  {getNumberCall(currentGame.gameState.currentNumber)}
                </p>
                <p className="text-lg mt-2 text-yellow-100">
                  🎯 Auto-checking for winners...
                </p>
              </div>
            )}

            {/* Enhanced Game Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="stat-card stat-card-blue">
                <div className="text-2xl font-bold">
                  {(currentGame.gameState.calledNumbers || []).length}
                </div>
                <div className="text-sm font-medium">Numbers Called</div>
              </div>

              <div className="stat-card stat-card-green">
                <div className="text-2xl font-bold">
                  {getBookedTicketsCount()}
                </div>
                <div className="text-sm font-medium">Active Players</div>
              </div>

              <div className="stat-card stat-card-purple">
                <div className="text-2xl font-bold">
                  {availableNumbers.length}
                </div>
                <div className="text-sm font-medium">Numbers Left</div>
              </div>

              <div className="stat-card stat-card-yellow">
                <div className="text-2xl font-bold">
                  {wonPrizes.length}
                </div>
                <div className="text-sm font-medium">Prizes Won</div>
              </div>

              <div className="stat-card stat-card-orange">
                <div className="text-2xl font-bold">
                  {totalWinners}
                </div>
                <div className="text-sm font-medium">Total Winners</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prize Management Panel */}
        <PrizeManagementPanel 
          gameData={currentGame}
          onRefreshGame={loadHostGames}
        />

        {/* Ticket Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Ticket Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TicketManagementGrid 
              gameData={currentGame}
              onRefreshGame={loadHostGames}
            />
          </CardContent>
        </Card>

        {/* Number Grid - Display Only */}
        <Card>
          <CardHeader>
            <CardTitle>Numbers Board (1-90)</CardTitle>
            <p className="text-sm text-gray-600">
              Called numbers are highlighted. Numbers are called automatically with real-time prize validation.
            </p>
          </CardHeader>
          <CardContent>
            <NumberGrid
              calledNumbers={currentGame.gameState.calledNumbers || []}
              currentNumber={currentGame.gameState.currentNumber}
            />
          </CardContent>
        </Card>

        {/* Recent Numbers with Prize Info */}
        {(currentGame.gameState.calledNumbers || []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Numbers Called
                <Badge variant="outline" className="text-xs">
                  {(currentGame.gameState.calledNumbers || []).length} / 90
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {(currentGame.gameState.calledNumbers || [])
                  .slice(-20)
                  .reverse()
                  .map((num, index) => {
                    const wasWinningNumber = wonPrizes.some(prize => prize.winningNumber === num);
                    return (
                      <div
                        key={`${num}-${index}`}
                        className={`recent-number ${
                          index === 0 ? 'recent-number-current' : 
                          index < 5 ? 'recent-number-recent' : 'recent-number-older'
                        } ${wasWinningNumber ? 'ring-2 ring-yellow-400' : ''}`}
                        title={`${getNumberCall(num)} - Called ${index === 0 ? 'now' : `${index + 1} number${index > 0 ? 's' : ''} ago`}${wasWinningNumber ? ' 🏆 WINNING NUMBER!' : ''}`}
                      >
                        {num}
                        {wasWinningNumber && <div className="absolute -top-1 -right-1 text-yellow-400">🏆</div>}
                      </div>
                    );
                  })}
              </div>
              
              {/* Show game progress */}
              <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-700">Game Progress</span>
                  <span className="text-sm font-bold text-slate-800">
                    {Math.round(((currentGame.gameState.calledNumbers || []).length / 90) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${((currentGame.gameState.calledNumbers || []).length / 90) * 100}%` 
                    }}
                  ></div>
                </div>
                <div className="mt-2 text-xs text-slate-600 flex justify-between">
                  <span>🎯 Auto validation: {totalWinners} winners detected</span>
                  <span>📊 {wonPrizes.length}/{Object.keys(currentGame.prizes).length} prizes won</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">
            Host Dashboard with Auto Prize Validation
          </h1>
          <p className="text-slate-600">
            Welcome back, {user.name}! Automatic winner detection is enabled for all your games.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create-game">Create Game</TabsTrigger>
            <TabsTrigger value="my-games">My Games</TabsTrigger>
            <TabsTrigger value="game-control">Game Control</TabsTrigger>
          </TabsList>

          <TabsContent value="create-game" className="mt-6">
            {renderCreateGame()}
          </TabsContent>

          <TabsContent value="my-games" className="mt-6">
            {renderMyGames()}
          </TabsContent>

          <TabsContent value="game-control" className="mt-6">
            {renderGameControl()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

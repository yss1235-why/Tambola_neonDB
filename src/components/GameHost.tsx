// src/components/GameHost.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause, 
  Square, 
  Users, 
  Trophy, 
  Plus,
  Clock,
  DollarSign,
  Calendar,
  AlertCircle
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

interface CreateGameForm {
  name: string;
  maxTickets: number;
  ticketPrice: number;
}

export const GameHost: React.FC<GameHostProps> = ({ user, userRole }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentGame, setCurrentGame] = useState<GameData | null>(null);
  const [gamesList, setGamesList] = useState<GameData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [createGameForm, setCreateGameForm] = useState<CreateGameForm>({
    name: '',
    maxTickets: 50,
    ticketPrice: 100
  });
  const { toast } = useToast();

  // Game control states
  const [gameInterval, setGameInterval] = useState<NodeJS.Timeout | null>(null);
  const [availableNumbers, setAvailableNumbers] = useState<number[]>(
    Array.from({ length: 90 }, (_, i) => i + 1)
  );
  const [gameUnsubscribe, setGameUnsubscribe] = useState<(() => void) | null>(null);

  // Check subscription status
  const isSubscriptionValid = () => {
    console.log('🔍 Checking subscription validity for user:', user);
    console.log('🔍 User isActive:', user.isActive);
    console.log('🔍 User subscriptionEndDate:', user.subscriptionEndDate);
    
    if (!user.isActive) {
      console.log('❌ User is not active');
      return false;
    }
    
    if (!user.subscriptionEndDate) {
      console.log('❌ No subscription end date');
      return false;
    }
    
    const subscriptionEnd = new Date(user.subscriptionEndDate);
    const now = new Date();
    
    console.log('🔍 Subscription end date:', subscriptionEnd);
    console.log('🔍 Current date:', now);
    console.log('🔍 Is subscription valid?', subscriptionEnd > now);
    
    return subscriptionEnd > now && user.isActive;
  };

  const getSubscriptionStatus = () => {
    console.log('🔍 Getting subscription status for user:', user);
    
    if (!user.isActive) {
      console.log('❌ User is inactive');
      return { status: 'inactive', message: 'Account is deactivated', variant: 'destructive' as const };
    }
    
    if (!user.subscriptionEndDate) {
      console.log('❌ No subscription end date');
      return { status: 'no-subscription', message: 'No subscription date', variant: 'destructive' as const };
    }
    
    const subscriptionEnd = new Date(user.subscriptionEndDate);
    const now = new Date();
    
    // Check if date is valid
    if (isNaN(subscriptionEnd.getTime())) {
      console.log('❌ Invalid subscription date:', user.subscriptionEndDate);
      return { status: 'invalid-date', message: 'Invalid subscription date', variant: 'destructive' as const };
    }
    
    const daysLeft = Math.ceil((subscriptionEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log('🔍 Days left:', daysLeft);
    
    if (daysLeft < 0) return { status: 'expired', message: 'Subscription expired', variant: 'destructive' as const };
    if (daysLeft <= 7) return { status: 'expiring', message: `Expires in ${daysLeft} days`, variant: 'secondary' as const };
    return { status: 'active', message: `Active (${daysLeft} days left)`, variant: 'default' as const };
  };

  // Load games when component mounts
  useEffect(() => {
    if (isSubscriptionValid()) {
      loadGames();
    }
  }, []);

  // Cleanup intervals and subscriptions on unmount
  useEffect(() => {
    return () => {
      if (gameInterval) {
        clearInterval(gameInterval);
      }
      if (gameUnsubscribe) {
        gameUnsubscribe();
      }
    };
  }, [gameInterval, gameUnsubscribe]);

  const loadGames = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, you'd fetch host's games from Firebase
      // For now, we'll use an empty list
      setGamesList([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load games",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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

    if (!createGameForm.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a game name",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const gameData = await firebaseService.createGame(
        {
          name: createGameForm.name,
          maxTickets: createGameForm.maxTickets,
          ticketPrice: createGameForm.ticketPrice
        },
        user.uid
      );

      setCurrentGame(gameData);
      setGamesList(prev => [...prev, gameData]);
      setCreateGameForm({ name: '', maxTickets: 50, ticketPrice: 100 });
      setActiveTab('game-control');

      toast({
        title: "Game Created",
        description: `${gameData.name} has been created successfully!`,
      });

      // Subscribe to real-time game updates
      const unsubscribe = firebaseService.subscribeToGame(gameData.gameId, (updatedGame) => {
        if (updatedGame) {
          setCurrentGame(updatedGame);
          // Update available numbers based on called numbers
          const called = updatedGame.gameState.calledNumbers || [];
          const available = Array.from({ length: 90 }, (_, i) => i + 1)
            .filter(num => !called.includes(num));
          setAvailableNumbers(available);
        }
      });

      setGameUnsubscribe(() => unsubscribe);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create game",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = async () => {
    if (!currentGame || !isSubscriptionValid()) return;

    try {
      // Start countdown
      await firebaseService.updateGameState(currentGame.gameId, {
        ...currentGame.gameState,
        isCountdown: true,
        countdownTime: 10,
        isActive: false
      });

      toast({
        title: "Game Starting",
        description: "10 second countdown has begun!",
      });

      // Start the actual game after countdown
      setTimeout(async () => {
        await firebaseService.updateGameState(currentGame.gameId, {
          ...currentGame.gameState,
          isCountdown: false,
          isActive: true,
          countdownTime: 0
        });

        // Start number calling
        startNumberCalling();
      }, 10000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start game",
        variant: "destructive",
      });
    }
  };

  const startNumberCalling = () => {
    if (!currentGame) return;

    const interval = setInterval(async () => {
      if (availableNumbers.length === 0) {
        clearInterval(interval);
        await endGame();
        return;
      }

      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const numberToBeCalled = availableNumbers[randomIndex];
      
      setAvailableNumbers(prev => prev.filter(n => n !== numberToBeCalled));
      
      try {
        // Add the number to called numbers
        await firebaseService.addCalledNumber(currentGame.gameId, numberToBeCalled);
        
        // Update current number (for display)
        await firebaseService.updateGameState(currentGame.gameId, {
          ...currentGame.gameState,
          currentNumber: numberToBeCalled
        });

        console.log(`Number called: ${numberToBeCalled}`);

        // Reset current number after 3 seconds
        setTimeout(async () => {
          await firebaseService.updateGameState(currentGame.gameId, {
            ...currentGame.gameState,
            currentNumber: null
          });
        }, 3000);
      } catch (error) {
        console.error('Error calling number:', error);
      }
    }, currentGame.gameState.callInterval);

    setGameInterval(interval);
  };

  const pauseGame = async () => {
    if (gameInterval) {
      clearInterval(gameInterval);
      setGameInterval(null);
    }

    if (currentGame) {
      try {
        await firebaseService.updateGameState(currentGame.gameId, {
          ...currentGame.gameState,
          isActive: false
        });

        toast({
          title: "Game Paused",
          description: "The game has been paused.",
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

  const endGame = async () => {
    if (gameInterval) {
      clearInterval(gameInterval);
      setGameInterval(null);
    }

    if (currentGame) {
      try {
        await firebaseService.updateGameState(currentGame.gameId, {
          ...currentGame.gameState,
          isActive: false,
          gameOver: true,
          currentNumber: null
        });

        toast({
          title: "Game Ended",
          description: "The game has been completed.",
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

  const getBookedTicketsCount = () => {
    if (!currentGame) return 0;
    return Object.values(currentGame.tickets).filter(ticket => ticket.isBooked).length;
  };

  const getTotalRevenue = () => {
    if (!currentGame) return 0;
    return getBookedTicketsCount() * currentGame.ticketPrice;
  };

  const subscriptionStatus = getSubscriptionStatus();

  // If subscription is invalid, show warning
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
              
              <div className="mt-6 space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>Account Status:</strong> {user.isActive ? 'Active' : 'Inactive'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Subscription End:</strong> {user.subscriptionEndDate ? new Date(user.subscriptionEndDate).toLocaleDateString() : 'Not set'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Created:</strong> {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Not set'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Raw Data:</strong> {JSON.stringify(user, null, 2)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const renderDashboard = () => (
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Games</p>
                <p className="text-2xl font-bold">{gamesList.length}</p>
              </div>
              <Trophy className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Players</p>
                <p className="text-2xl font-bold">{currentGame ? getBookedTicketsCount() : 0}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="text-2xl font-bold">₹{getTotalRevenue()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {currentGame && (
        <Card>
          <CardHeader>
            <CardTitle>Current Game: {currentGame.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Badge variant={currentGame.gameState.isActive ? "default" : "secondary"}>
                {currentGame.gameState.isActive ? "Active" : "Waiting"}
              </Badge>
              <span className="text-sm text-gray-600">
                {getBookedTicketsCount()}/{currentGame.maxTickets} tickets booked
              </span>
            </div>
            
            {currentGame.gameState.calledNumbers.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Recent Numbers:</p>
                <div className="flex flex-wrap gap-2">
                  {currentGame.gameState.calledNumbers.slice(-10).map((num, index) => (
                    <Badge key={index} variant="outline">{num}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderCreateGame = () => (
    <Card>
      <CardHeader>
        <CardTitle>Create New Game</CardTitle>
      </CardHeader>
      <Car

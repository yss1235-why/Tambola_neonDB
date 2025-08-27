// Main Supabase Service
// Replaces src/services/firebase.ts

import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase-types';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Re-export types for convenience
export type {
  AdminUser,
  HostUser,
  User,
  GameData,
  GameState,
  TambolaTicket,
  Prize,
  HostSettings,
  CreateGameConfig,
  UpdateGameData,
  CreateTicketData,
  UpdatePrizeData,
  GameFilters,
  TicketFilters,
  ApiResponse,
  NumberGenerationResult,
  GameActionResult,
  SubscriptionState,
  RealtimePayload,
  CallNextNumberParams,
  CallNextNumberResponse,
  EndGameParams,
  EndGameResponse
} from './supabase-types';

// Export specialized services
export { supabaseAuth } from './supabase-auth';
export { supabaseGame } from './supabase-game';

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format Supabase error for user display
 */
export const formatError = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
  if (error.details) return error.details;
  
  return 'An unexpected error occurred';
};

/**
 * Create a standardized API response
 */
export const createApiResponse = <T>(
  data: T | null, 
  error: any = null
): { data: T | null; error: string | null; success: boolean } => {
  return {
    data,
    error: error ? formatError(error) : null,
    success: !error
  };
};

/**
 * Test Supabase connection
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('id')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned, which is fine
      console.error('Supabase connection error:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    return false;
  }
};

/**
 * Get current user session
 */
export const getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  
  return session;
};

/**
 * Get current user
 */
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  
  return user;
};

/**
 * Sign out current user
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
  
  console.log('✅ User signed out successfully');
};

// ==================== COORDINATED SERVICE CLASS ====================

/**
 * Main service class that coordinates between specialized services
 * Similar structure to your existing FirebaseService
 */
class SupabaseService {
  // Auth methods (delegated to supabaseAuth)
  async loginAdmin(email: string, password: string) {
    return supabaseAuth.loginAdmin(email, password);
  }

  async loginHost(email: string, password: string) {
    return supabaseAuth.loginHost(email, password);
  }

  async logout() {
    return supabaseAuth.logout();
  }

  async getUserData() {
    return supabaseAuth.getUserData();
  }

  async getCurrentUserRole() {
    return supabaseAuth.getCurrentUserRole();
  }

  // Host management (delegated to supabaseAuth)
  async createHost(email: string, password: string, name: string, phone: string, adminId: string, subscriptionMonths: number) {
    return supabaseAuth.createHost(email, password, name, phone, adminId, subscriptionMonths);
  }

  async getAllHosts() {
    return supabaseAuth.getAllHosts();
  }

  async updateHost(hostId: string, updates: any) {
    return supabaseAuth.updateHost(hostId, updates);
  }

  async deleteHost(hostId: string) {
    return supabaseAuth.deleteHost(hostId);
  }

  async extendHostSubscription(hostId: string, additionalMonths: number) {
    return supabaseAuth.extendHostSubscription(hostId, additionalMonths);
  }

  // Host settings
  async saveHostSettings(hostId: string, settings: any) {
    return supabaseAuth.saveHostSettings(hostId, settings);
  }

  async getHostSettings(hostId: string) {
    return supabaseAuth.getHostSettings(hostId);
  }

  async updateHostTemplate(hostId: string, templateSettings: any) {
    return supabaseAuth.updateHostTemplate(hostId, templateSettings);
  }

  // Game operations (delegated to supabaseGame)
  async createGame(config: CreateGameConfig) {
    return supabaseGame.createGame(config);
  }

  async updateGame(gameId: string, updates: UpdateGameData) {
    return supabaseGame.updateGame(gameId, updates);
  }

  async deleteGame(gameId: string) {
    return supabaseGame.deleteGame(gameId);
  }

  async getGameData(gameId: string) {
    return supabaseGame.getGameData(gameId);
  }

  async updateGameState(gameId: string, gameState: Partial<GameState>) {
    return supabaseGame.updateGameState(gameId, gameState);
  }

  // Game flow control (simplified - no race conditions!)
  async startGameWithCountdown(gameId: string) {
    return supabaseGame.startGameWithCountdown(gameId);
  }

  async updateCountdownTime(gameId: string, timeLeft: number) {
    return supabaseGame.updateCountdownTime(gameId, timeLeft);
  }

  async activateGameAfterCountdown(gameId: string) {
    return supabaseGame.activateGameAfterCountdown(gameId);
  }

  async pauseGame(gameId: string) {
    return supabaseGame.pauseGame(gameId);
  }

  async resumeGame(gameId: string) {
    return supabaseGame.resumeGame(gameId);
  }

  async endGame(gameId: string) {
    return supabaseGame.endGame(gameId);
  }

  // Number calling - MUCH SIMPLER than Firebase version!
  async callNextNumberAndContinue(gameId: string) {
    return supabaseGame.callNextNumberAndContinue(gameId);
  }

  async generateGameNumbers(gameId: string) {
    return supabaseGame.generateGameNumbers(gameId);
  }

  // Ticket operations
  async createTicket(ticketData: CreateTicketData) {
    return supabaseGame.createTicket(ticketData);
  }

  async bookTicket(ticketId: string, playerName: string, playerPhone?: string) {
    return supabaseGame.bookTicket(ticketId, playerName, playerPhone);
  }

  async markTicketNumber(ticketId: string, number: number) {
    return supabaseGame.markTicketNumber(ticketId, number);
  }

  // Prize operations
  async updatePrize(prizeId: string, updates: UpdatePrizeData) {
    return supabaseGame.updatePrize(prizeId, updates);
  }

  async checkWinCondition(ticketId: string, pattern: string, calledNumbers: number[]) {
    return supabaseGame.checkWinCondition(ticketId, pattern, calledNumbers);
  }

  // Subscription helpers (for compatibility with existing code)
  subscribeToGame(gameId: string, callback: (gameData: any) => void) {
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  subscribeToGameTickets(gameId: string, callback: (tickets: any[]) => void) {
    const channel = supabase
      .channel(`tickets-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `game_id=eq.${gameId}`
        },
        async () => {
          // Fetch all tickets for this game
          const { data } = await supabase
            .from('tickets')
            .select('*')
            .eq('game_id', gameId);
          
          callback(data || []);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  subscribeToHosts(callback: (hosts: any[]) => void) {
    const channel = supabase
      .channel('hosts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hosts'
        },
        async () => {
          const { data } = await supabase
            .from('hosts')
            .select('*')
            .order('created_at', { ascending: false });
          
          callback(data || []);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  subscribeToAllActiveGames(callback: (games: any[]) => void) {
    const channel = supabase
      .channel('active-games')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games'
        },
        async () => {
          const { data } = await supabase
            .from('games')
            .select('*')
            .in('status', ['setup', 'countdown', 'active', 'paused'])
            .order('created_at', { ascending: false });
          
          callback(data || []);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }

  subscribeToHostGames(hostId: string, callback: (games: any[]) => void) {
    const channel = supabase
      .channel(`host-games-${hostId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `host_id=eq.${hostId}`
        },
        async () => {
          const { data } = await supabase
            .from('games')
            .select('*')
            .eq('host_id', hostId)
            .order('created_at', { ascending: false });
          
          callback(data || []);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }
}

// Create and export service instance
export const supabaseService = new SupabaseService();

// Default export for compatibility with existing imports
export default supabaseService;

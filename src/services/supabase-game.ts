// Supabase Game Service


import { supabase } from './supabase';
import type { 
  GameData,
  GameState,
  TambolaTicket,
  Prize,
  CreateGameConfig,
  UpdateGameData,
  CreateTicketData,
  UpdatePrizeData,
  NumberGenerationResult,
  GameActionResult,
  CallNextNumberResponse
} from './supabase-types';

class SupabaseGameService {
  // ==================== GAME CREATION & MANAGEMENT ====================

  /**
   * Create new game
   */
 async createGame(config: CreateGameConfig): Promise<GameData> {
    try {
      console.log('🎮 Creating new game:', config.name);
      
      // Ensure we have a valid session before creating game
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User authentication required. Please login again.');
      }

      // Create game record
      const { data: gameData, error } = await supabase
        .from('games')
        .insert({
          name: config.name,
          host_id: config.host_id,
          max_tickets: config.max_tickets || 100,
          ticket_price: config.ticket_price || 0,
          status: 'setup'
        })
        .select()
        .single();

      if (error || !gameData) {
        throw new Error(error?.message || 'Failed to create game');
      }

      // Create default prizes if provided
      if (config.prizes && config.prizes.length > 0) {
        const prizesWithGameId = config.prizes.map(prize => ({
          ...prize,
          game_id: gameData.id
        }));

        const { error: prizesError } = await supabase
          .from('prizes')
          .insert(prizesWithGameId);

        if (prizesError) {
          console.warn('Failed to create prizes:', prizesError);
        }
      }

      console.log('✅ Game created successfully:', gameData.id);
      
      return gameData as GameData;

    } catch (error: any) {
      console.error('❌ Error creating game:', error);
      throw new Error(error.message || 'Failed to create game');
    }
  }

  /**
   * Update game information
   */
  async updateGame(gameId: string, updates: UpdateGameData): Promise<void> {
    try {
      const { error } = await supabase
        .from('games')
        .update(updates)
        .eq('id', gameId);

      if (error) {
        throw error;
      }

      console.log('✅ Game updated:', gameId);

    } catch (error: any) {
      console.error('❌ Error updating game:', error);
      throw new Error(error.message || 'Failed to update game');
    }
  }

  /**
   * Delete game
   */
  async deleteGame(gameId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (error) {
        throw error;
      }

      console.log('✅ Game deleted:', gameId);

    } catch (error: any) {
      console.error('❌ Error deleting game:', error);
      throw new Error(error.message || 'Failed to delete game');
    }
  }

  /**
   * Get game data by ID
   */
  async getGameData(gameId: string): Promise<GameData | null> {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as GameData || null;

    } catch (error: any) {
      console.error('Error getting game data:', error);
      return null;
    }
  }

  /**
   * Update game state (simplified version)
   */
  async updateGameState(gameId: string, gameState: Partial<GameState>): Promise<void> {
    try {
      // Get current game state
      const currentGame = await this.getGameData(gameId);
      if (!currentGame) {
        throw new Error('Game not found');
      }

      // Merge with current state
      const updatedGameState = {
        ...currentGame.game_state,
        ...gameState
      };

      // Update in database
      const { error } = await supabase
        .from('games')
        .update({ game_state: updatedGameState })
        .eq('id', gameId);

      if (error) {
        throw error;
      }

      console.log('✅ Game state updated:', gameId);

    } catch (error: any) {
      console.error('❌ Error updating game state:', error);
      throw new Error(error.message || 'Failed to update game state');
    }
  }

  // ==================== GAME FLOW CONTROL (SIMPLIFIED!) ====================

  /**
   * Start game with countdown - MUCH simpler than Firebase version!
   */
  async startGameWithCountdown(gameId: string): Promise<void> {
    try {
      console.log('🚀 Starting countdown for game:', gameId);

      // Generate game numbers first
      const numbers = this.generateNumberSequence();
      
      const gameState: GameState = {
        isActive: false,
        isCountdown: true,
        countdownTime: 10,
        gameOver: false,
        calledNumbers: [],
        currentNumber: null,
        totalNumbersCalled: 0
      };

      // Update game with countdown state and pre-generated numbers
      const { error } = await supabase
        .from('games')
        .update({
          status: 'countdown',
          game_state: gameState,
          session_numbers: numbers,
          session_metadata: {
            created: new Date().toISOString(),
            source: 'host',
            validated: true,
            totalNumbers: 90
          }
        })
        .eq('id', gameId);

      if (error) {
        throw error;
      }

      console.log('✅ Game countdown started');

    } catch (error: any) {
      console.error('❌ Failed to start countdown:', error);
      throw new Error(error.message || 'Failed to start countdown');
    }
  }

  /**
   * Update countdown time
   */
  async updateCountdownTime(gameId: string, timeLeft: number): Promise<void> {
    try {
      // Get current game state
      const currentGame = await this.getGameData(gameId);
      if (!currentGame) return;

      const updatedGameState = {
        ...currentGame.game_state,
        countdownTime: timeLeft
      };

      const { error } = await supabase
        .from('games')
        .update({ game_state: updatedGameState })
        .eq('id', gameId);

      if (error) {
        console.error('Failed to update countdown:', error);
      }

    } catch (error: any) {
      console.error('Error updating countdown:', error);
    }
  }

  /**
   * Activate game after countdown
   */
  async activateGameAfterCountdown(gameId: string): Promise<void> {
    try {
      console.log('🎯 Activating game after countdown:', gameId);

      const gameState: GameState = {
        isActive: true,
        isCountdown: false,
        countdownTime: 0,
        gameOver: false,
        calledNumbers: [],
        currentNumber: null,
        totalNumbersCalled: 0
      };

      const { error } = await supabase
        .from('games')
        .update({
          status: 'active',
          game_state: gameState,
          started_at: new Date().toISOString()
        })
        .eq('id', gameId);

      if (error) {
        throw error;
      }

      console.log('✅ Game activated successfully');

    } catch (error: any) {
      console.error('❌ Failed to activate game:', error);
      throw new Error(error.message || 'Failed to activate game');
    }
  }

  /**
   * Pause game
   */
  async pauseGame(gameId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('games')
        .update({ status: 'paused' })
        .eq('id', gameId);

      if (error) {
        throw error;
      }

      console.log('⏸️ Game paused:', gameId);

    } catch (error: any) {
      console.error('❌ Error pausing game:', error);
      throw new Error(error.message || 'Failed to pause game');
    }
  }

  /**
   * Resume game
   */
  async resumeGame(gameId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('games')
        .update({ status: 'active' })
        .eq('id', gameId);

      if (error) {
        throw error;
      }

      console.log('▶️ Game resumed:', gameId);

    } catch (error: any) {
      console.error('❌ Error resuming game:', error);
      throw new Error(error.message || 'Failed to resume game');
    }
  }

  /**
   * End game
   */
  async endGame(gameId: string): Promise<void> {
    try {
      const currentGame = await this.getGameData(gameId);
      if (!currentGame) return;

      const updatedGameState = {
        ...currentGame.game_state,
        isActive: false,
        gameOver: true
      };

      const { error } = await supabase
        .from('games')
        .update({
          status: 'finished',
          game_state: updatedGameState,
          ended_at: new Date().toISOString()
        })
        .eq('id', gameId);

      if (error) {
        throw error;
      }

      console.log('🏁 Game ended:', gameId);

    } catch (error: any) {
      console.error('❌ Error ending game:', error);
      throw new Error(error.message || 'Failed to end game');
    }
  }

  // ==================== NUMBER CALLING (NO RACE CONDITIONS!) ====================

  /**
   * Call next number - SERVER-SIDE LOGIC PREVENTS RACE CONDITIONS!
   */
  async callNextNumberAndContinue(gameId: string): Promise<boolean> {
    try {
      console.log('📞 Calling next number for game:', gameId);

      // Use RPC function for atomic operation - NO RACE CONDITIONS!
      const { data, error } = await supabase.rpc('call_next_number', {
        game_id: gameId
      });

      if (error) {
        console.error('RPC error:', error);
        throw error;
      }

      const result = data as CallNextNumberResponse;
      
      if (result.success) {
        console.log(`✅ Number called: ${result.number}`);
        return !result.game_over; // Continue if game is not over
      } else {
        console.log('🏁 Game ended:', result.message);
        return false; // Stop calling numbers
      }

    } catch (error: any) {
      console.error('❌ Error calling next number:', error);
      throw new Error(error.message || 'Failed to call next number');
    }
  }

  /**
   * Generate game numbers
   */
  async generateGameNumbers(gameId: string): Promise<NumberGenerationResult> {
    try {
      const numbers = this.generateNumberSequence();
      
      const { error } = await supabase
        .from('games')
        .update({
          session_numbers: numbers,
          session_metadata: {
            created: new Date().toISOString(),
            source: 'host',
            validated: true,
            totalNumbers: 90
          }
        })
        .eq('id', gameId);

      if (error) {
        throw error;
      }

      return {
        success: true,
        numbers,
        source: 'host'
      };

    } catch (error: any) {
      return {
        success: false,
        numbers: [],
        source: 'host',
        error: error.message
      };
    }
  }

  /**
   * Generate shuffled number sequence (1-90)
   */
  private generateNumberSequence(): number[] {
    const numbers = Array.from({ length: 90 }, (_, i) => i + 1);
    
    // Fisher-Yates shuffle
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    
    return numbers;
  }

  // ==================== TICKET OPERATIONS ====================

  /**
   * Create ticket
   */
  async createTicket(ticketData: CreateTicketData): Promise<TambolaTicket> {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .insert(ticketData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('🎫 Ticket created:', data.ticket_id);
      return data as TambolaTicket;

    } catch (error: any) {
      console.error('❌ Error creating ticket:', error);
      throw new Error(error.message || 'Failed to create ticket');
    }
  }

  /**
   * Book ticket
   */
  async bookTicket(ticketId: string, playerName: string, playerPhone?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          is_booked: true,
          player_name: playerName,
          player_phone: playerPhone,
          booked_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) {
        throw error;
      }

      console.log('✅ Ticket booked:', ticketId);

    } catch (error: any) {
      console.error('❌ Error booking ticket:', error);
      throw new Error(error.message || 'Failed to book ticket');
    }
  }

  /**
   * Mark number on ticket
   */
  async markTicketNumber(ticketId: string, number: number): Promise<void> {
    try {
      // Get current ticket
      const { data: ticket, error: fetchError } = await supabase
        .from('tickets')
        .select('marked_numbers')
        .eq('id', ticketId)
        .single();

      if (fetchError || !ticket) {
        throw new Error('Ticket not found');
      }

      // Add number to marked numbers if not already marked
      const markedNumbers = ticket.marked_numbers || [];
      if (!markedNumbers.includes(number)) {
        markedNumbers.push(number);

        const { error } = await supabase
          .from('tickets')
          .update({ marked_numbers: markedNumbers })
          .eq('id', ticketId);

        if (error) {
          throw error;
        }
      }

      console.log('✅ Number marked on ticket:', number);

    } catch (error: any) {
      console.error('❌ Error marking ticket number:', error);
      throw new Error(error.message || 'Failed to mark ticket number');
    }
  }

  // ==================== PRIZE OPERATIONS ====================

  /**
   * Update prize
   */
  async updatePrize(prizeId: string, updates: UpdatePrizeData): Promise<void> {
    try {
      const { error } = await supabase
        .from('prizes')
        .update(updates)
        .eq('id', prizeId);

      if (error) {
        throw error;
      }

      console.log('🏆 Prize updated:', prizeId);

    } catch (error: any) {
      console.error('❌ Error updating prize:', error);
      throw new Error(error.message || 'Failed to update prize');
    }
  }

  /**
   * Check win condition using RPC function
   */
  async checkWinCondition(ticketId: string, pattern: string, calledNumbers: number[]): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('validate_win', {
        ticket_id: ticketId,
        pattern,
        called_numbers: calledNumbers
      });

      if (error) {
        throw error;
      }

      return data?.is_winner || false;

    } catch (error: any) {
      console.error('❌ Error checking win condition:', error);
      return false;
    }
  }

  // ==================== QUERY HELPERS ====================

  /**
   * Get all games for a host
   */
  async getHostGames(hostId: string): Promise<GameData[]> {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('host_id', hostId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data as GameData[] || [];

    } catch (error: any) {
      console.error('Error fetching host games:', error);
      return [];
    }
  }

  /**
   * Get tickets for a game
   */
  async getGameTickets(gameId: string): Promise<TambolaTicket[]> {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return data as TambolaTicket[] || [];

    } catch (error: any) {
      console.error('Error fetching game tickets:', error);
      return [];
    }
  }

  /**
   * Get prizes for a game
   */
  async getGamePrizes(gameId: string): Promise<Prize[]> {
    try {
      const { data, error } = await supabase
        .from('prizes')
        .select('*')
        .eq('game_id', gameId)
        .order('prize_order', { ascending: true });

      if (error) {
        throw error;
      }

      return data as Prize[] || [];

    } catch (error: any) {
      console.error('Error fetching game prizes:', error);
      return [];
    }
  }

  /**
   * Get active games (public)
   */
  async getActiveGames(): Promise<GameData[]> {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .in('status', ['setup', 'countdown', 'active', 'paused'])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data as GameData[] || [];

    } catch (error: any) {
      console.error('Error fetching active games:', error);
      return [];
    }
  }
}

// Export singleton instance
export const supabaseGame = new SupabaseGameService();

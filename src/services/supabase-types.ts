// Supabase Types for Tambola Game
// Replaces Firebase type definitions

export type UserRole = 'admin' | 'host';
export type GameStatus = 'setup' | 'countdown' | 'active' | 'paused' | 'finished';

// ==================== USER TYPES ====================

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin';
  permissions: {
    createHosts: boolean;
    manageUsers: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface HostUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'host';
  subscription_end_date: string;
  is_active: boolean;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export type User = AdminUser | HostUser;

// ==================== GAME TYPES ====================

export interface GameState {
  isActive: boolean;
  isCountdown: boolean;
  countdownTime: number;
  gameOver: boolean;
  calledNumbers: number[];
  currentNumber: number | null;
  totalNumbersCalled: number;
}

export interface SessionMetadata {
  created: string;
  source: 'admin' | 'host';
  validated: boolean;
  totalNumbers: number;
}

export interface GameData {
  id: string;
  name: string;
  host_id: string;
  max_tickets: number;
  ticket_price: number;
  status: GameStatus;
  game_state: GameState;
  session_numbers: number[];
  session_metadata: SessionMetadata;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  updated_at: string;
  
  // Computed properties (not stored in DB)
  hostPhone?: string;
  lastWinnerAnnouncement?: string;
  lastWinnerAt?: string;
}

// ==================== TICKET TYPES ====================

export interface TicketMetadata {
  corners: number[];
  center: number;
  hasValidCorners: boolean;
  hasValidCenter: boolean;
  allNumbers: number[];
}

export interface TambolaTicket {
  id: string;
  game_id: string;
  ticket_id: string; // Human readable ID (A001, B002, etc.)
  player_name: string;
  player_phone?: string;
  rows: number[][]; // 3x9 grid
  marked_numbers: number[];
  is_booked: boolean;
  booked_at: string;
  metadata?: TicketMetadata;
  position_in_set?: number;
  set_id?: number;
  created_at: string;
}

// ==================== PRIZE TYPES ====================

export interface PrizeWinner {
  name: string;
  ticketId: string;
  phone?: string;
}

export interface Prize {
  id: string;
  game_id: string;
  name: string;
  pattern: string;
  description?: string;
  prize_order: number;
  won: boolean;
  winning_number?: number;
  won_at?: string;
  winners: PrizeWinner[];
  created_at: string;
  updated_at: string;
}

// ==================== HOST SETTINGS TYPES ====================

export interface HostSettings {
  id: string;
  host_id: string;
  settings: {
    defaultTicketPrice: number;
    defaultMaxTickets: number;
    callInterval: number;
    speechRate: number;
    autoEndGame: boolean;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface NumberGenerationResult {
  success: boolean;
  numbers: number[];
  source: 'admin' | 'host';
  error?: string;
}

export interface GameActionResult {
  success: boolean;
  message: string;
  data?: any;
  shouldContinue?: boolean;
}

// ==================== SUBSCRIPTION TYPES ====================

export interface RealtimePayload<T> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  errors: any;
}

export interface SubscriptionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// ==================== CREATE/UPDATE TYPES ====================

export interface CreateGameConfig {
  name: string;
  host_id: string;
  max_tickets?: number;
  ticket_price?: number;
  prizes?: Omit<Prize, 'id' | 'game_id' | 'created_at' | 'updated_at' | 'won' | 'winners'>[];
}

export interface UpdateGameData {
  name?: string;
  max_tickets?: number;
  ticket_price?: number;
  status?: GameStatus;
  game_state?: Partial<GameState>;
  started_at?: string;
  ended_at?: string;
}

export interface CreateTicketData {
  game_id: string;
  ticket_id: string;
  player_name: string;
  player_phone?: string;
  rows: number[][];
  metadata?: TicketMetadata;
  position_in_set?: number;
  set_id?: number;
}

export interface UpdatePrizeData {
  won?: boolean;
  winning_number?: number;
  won_at?: string;
  winners?: PrizeWinner[];
}

// ==================== FILTER/QUERY TYPES ====================

export interface GameFilters {
  host_id?: string;
  status?: GameStatus;
  created_after?: string;
  created_before?: string;
  active_only?: boolean;
}

export interface TicketFilters {
  game_id?: string;
  player_name?: string;
  is_booked?: boolean;
}

// ==================== UTILITY TYPES ====================

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ==================== RPC FUNCTION TYPES ====================

export interface CallNextNumberParams {
  game_id: string;
}

export interface CallNextNumberResponse {
  success: boolean;
  number: number | null;
  game_over: boolean;
  message: string;
  total_called: number;
}

export interface EndGameParams {
  game_id: string;
  reason?: string;
}

export interface EndGameResponse {
  success: boolean;
  message: string;
  final_stats: {
    total_numbers_called: number;
    duration_minutes: number;
    total_winners: number;
  };
}

export interface ValidateWinParams {
  ticket_id: string;
  pattern: string;
  called_numbers: number[];
}

export interface ValidateWinResponse {
  is_winner: boolean;
  pattern: string;
  winning_numbers: number[];
  message: string;
}

// ==================== DATABASE TABLE TYPES ====================

// Raw database table interfaces (exactly matching SQL schema)
export interface Database {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string;
          email: string;
          name: string;
          permissions: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          permissions?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          permissions?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      hosts: {
        Row: {
          id: string;
          email: string;
          name: string;
          phone: string | null;
          subscription_end_date: string;
          is_active: boolean;
          created_at: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          phone?: string | null;
          subscription_end_date: string;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          phone?: string | null;
          subscription_end_date?: string;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          name: string;
          host_id: string;
          max_tickets: number;
          ticket_price: number;
          status: GameStatus;
          game_state: any;
          session_numbers: number[];
          session_metadata: any;
          created_at: string;
          started_at: string | null;
          ended_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          host_id: string;
          max_tickets?: number;
          ticket_price?: number;
          status?: GameStatus;
          game_state?: any;
          session_numbers?: number[];
          session_metadata?: any;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          host_id?: string;
          max_tickets?: number;
          ticket_price?: number;
          status?: GameStatus;
          game_state?: any;
          session_numbers?: number[];
          session_metadata?: any;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
          updated_at?: string;
        };
      };
      tickets: {
        Row: {
          id: string;
          game_id: string;
          ticket_id: string;
          player_name: string;
          player_phone: string | null;
          rows: any;
          marked_numbers: number[];
          is_booked: boolean;
          booked_at: string;
          metadata: any;
          position_in_set: number | null;
          set_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          ticket_id: string;
          player_name: string;
          player_phone?: string | null;
          rows: any;
          marked_numbers?: number[];
          is_booked?: boolean;
          booked_at?: string;
          metadata?: any;
          position_in_set?: number | null;
          set_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          ticket_id?: string;
          player_name?: string;
          player_phone?: string | null;
          rows?: any;
          marked_numbers?: number[];
          is_booked?: boolean;
          booked_at?: string;
          metadata?: any;
          position_in_set?: number | null;
          set_id?: number | null;
          created_at?: string;
        };
      };
      prizes: {
        Row: {
          id: string;
          game_id: string;
          name: string;
          pattern: string;
          description: string | null;
          prize_order: number;
          won: boolean;
          winning_number: number | null;
          won_at: string | null;
          winners: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          name: string;
          pattern: string;
          description?: string | null;
          prize_order?: number;
          won?: boolean;
          winning_number?: number | null;
          won_at?: string | null;
          winners?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          name?: string;
          pattern?: string;
          description?: string | null;
          prize_order?: number;
          won?: boolean;
          winning_number?: number | null;
          won_at?: string | null;
          winners?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      host_settings: {
        Row: {
          id: string;
          host_id: string;
          settings: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          settings?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          settings?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      call_next_number: {
        Args: CallNextNumberParams;
        Returns: CallNextNumberResponse;
      };
      end_game: {
        Args: EndGameParams;
        Returns: EndGameResponse;
      };
      validate_win: {
        Args: ValidateWinParams;
        Returns: ValidateWinResponse;
      };
    };
  };
}

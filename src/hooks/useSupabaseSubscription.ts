// Supabase Real-time Subscription Hooks
// Replaces useFirebaseSubscription.ts - MUCH SIMPLER!

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import type { 
  GameData, 
  HostUser, 
  TambolaTicket, 
  Prize,
  SubscriptionState,
  RealtimePayload 
} from '@/services/supabase-types';

// ==================== GENERIC SUBSCRIPTION HOOK ====================

/**
 * Generic subscription hook for any Supabase table
 * Much simpler than Firebase version - no deduplication needed!
 */
function useSupabaseSubscription<T>(
  tableName: string,
  filter?: string,
  options: {
    enabled?: boolean;
    initialFetch?: boolean;
    selectQuery?: string;
  } = {}
): SubscriptionState<T[]> {
  const { enabled = true, initialFetch = true, selectQuery = '*' } = options;
  
  const [state, setState] = useState<SubscriptionState<T[]>>({
    data: null,
    loading: enabled,
    error: null
  });

  const isMountedRef = useRef(true);
  const channelRef = useRef<any>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!enabled || !initialFetch) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      let query = supabase.from(tableName).select(selectQuery);
      
     // Apply filter if provided
      if (filter) {
        // Parse filter string like "game_id=eq.123"
        const filterParts = filter.split('=');
        if (filterParts.length >= 2) {
          const column = filterParts[0];
          const operatorAndValue = filterParts.slice(1).join('='); // Handle values with = signs
          const [operator, ...valueParts] = operatorAndValue.split('.');
          const value = valueParts.join('.'); // Handle values with dots
          
          if (operator === 'eq') {
            query = query.eq(column, value);
          }
          // Add more operators as needed
        }
      }

      const { data, error } = await query;

      if (!isMountedRef.current) return;

      if (error) {
        setState(prev => ({ ...prev, loading: false, error: error.message }));
      } else {
        setState(prev => ({ ...prev, data: data as T[], loading: false, error: null }));
      }

    } catch (error: any) {
      if (isMountedRef.current) {
        setState(prev => ({ ...prev, loading: false, error: error.message }));
      }
    }
  }, [enabled, initialFetch, tableName, selectQuery, filter]);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    // Fetch initial data
    fetchData();

    // Set up real-time subscription
    const channelName = `${tableName}_${filter || 'all'}_${Date.now()}`;
    
    let subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: tableName,
          filter: filter || undefined
        },
        (payload: RealtimePayload<T>) => {
          console.log(`🔄 Real-time update on ${tableName}:`, payload.eventType);
          
          // Re-fetch data when changes occur
          // This is simpler than trying to update state manually
          fetchData();
        }
      )
      .subscribe();

    channelRef.current = subscription;

    // Cleanup
    return () => {
      isMountedRef.current = false;
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return state;
}

// ==================== SPECIFIC SUBSCRIPTION HOOKS ====================

/**
 * Subscribe to a single game
 */
export function useGameSubscription(gameId: string | null): SubscriptionState<GameData> {
  const { data, loading, error } = useSupabaseSubscription<GameData>(
    'games',
    gameId ? `id=eq.${gameId}` : undefined,
    { enabled: !!gameId }
  );

  return {
    data: data && data.length > 0 ? data[0] : null,
    loading,
    error
  };
}

/**
 * Subscribe to all active games
 */
export function useActiveGamesSubscription(): SubscriptionState<GameData[]> {
  const [state, setState] = useState<SubscriptionState<GameData[]>>({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchActiveGames = async () => {
      try {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .in('status', ['setup', 'countdown', 'active', 'paused'])
          .order('created_at', { ascending: false });

        if (error) {
          setState({ data: null, loading: false, error: error.message });
        } else {
          setState({ data: data as GameData[], loading: false, error: null });
        }
      } catch (err: any) {
        setState({ data: null, loading: false, error: err.message });
      }
    };

    fetchActiveGames();

    // Subscribe to changes
    const subscription = supabase
      .channel('active_games')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games'
        },
        () => {
          console.log('🔄 Games table updated - refetching active games');
          fetchActiveGames();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return state;
}

/**
 * Subscribe to host's current/recent game
 */
export function useHostCurrentGameSubscription(hostId: string | null): SubscriptionState<GameData> {
  const [state, setState] = useState<SubscriptionState<GameData>>({
    data: null,
    loading: !!hostId,
    error: null
  });

  useEffect(() => {
    if (!hostId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const fetchHostGame = async () => {
      try {
        // Get host's most recent game (active first, then most recent completed)
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .eq('host_id', hostId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          setState({ data: null, loading: false, error: error.message });
          return;
        }

        if (!data || data.length === 0) {
          setState({ data: null, loading: false, error: null });
          return;
        }

        // Find active game first
        const activeGame = data.find(game => 
          ['setup', 'countdown', 'active', 'paused'].includes(game.status)
        );

        if (activeGame) {
          setState({ data: activeGame as GameData, loading: false, error: null });
          return;
        }

        // If no active game, return most recent completed game
        const recentGame = data[0];
        setState({ data: recentGame as GameData, loading: false, error: null });

      } catch (err: any) {
        setState({ data: null, loading: false, error: err.message });
      }
    };

    fetchHostGame();

    // Subscribe to changes in host's games
    const subscription = supabase
      .channel(`host_games_${hostId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `host_id=eq.${hostId}`
        },
        () => {
          console.log('🔄 Host games updated - refetching');
          fetchHostGame();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [hostId]);

  return state;
}

/**
 * Subscribe to game tickets
 */
export function useGameTicketsSubscription(gameId: string | null): SubscriptionState<TambolaTicket[]> {
  return useSupabaseSubscription<TambolaTicket>(
    'tickets',
    gameId ? `game_id=eq.${gameId}` : undefined,
    { enabled: !!gameId }
  );
}

/**
 * Subscribe to game prizes  
 */
export function useGamePrizesSubscription(gameId: string | null): SubscriptionState<Prize[]> {
  return useSupabaseSubscription<Prize>(
    'prizes',
    gameId ? `game_id=eq.${gameId}` : undefined,
    { 
      enabled: !!gameId,
      selectQuery: '*'
    }
  );
}

/**
 * Subscribe to all hosts (admin only)
 */
export function useHostsSubscription(): SubscriptionState<HostUser[]> {
  return useSupabaseSubscription<HostUser>('hosts', undefined, {
    selectQuery: '*'
  });
}

/**
 * Subscribe to host's games
 */
export function useHostGamesSubscription(hostId: string | null): SubscriptionState<GameData[]> {
  return useSupabaseSubscription<GameData>(
    'games',
    hostId ? `host_id=eq.${hostId}` : undefined,
    { enabled: !!hostId }
  );
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Create a custom subscription with more control
 */
export function useCustomSubscription<T>(
  tableName: string,
  callback: (data: T[]) => void,
  options: {
    filter?: string;
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    selectQuery?: string;
    enabled?: boolean;
  } = {}
) {
  const { filter, event = '*', selectQuery = '*', enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    const fetchData = async () => {
      let query = supabase.from(tableName).select(selectQuery);
      
     if (filter) {
        const filterParts = filter.split('=');
        if (filterParts.length >= 2) {
          const column = filterParts[0];
          const operatorAndValue = filterParts.slice(1).join('=');
          const [operator, ...valueParts] = operatorAndValue.split('.');
          const value = valueParts.join('.');
          
          if (operator === 'eq') {
            query = query.eq(column, value);
          }
        }
      }

      const { data } = await query;
      if (data) {
        callback(data as T[]);
      }
    };

    fetchData();

    // Set up subscription
    const subscription = supabase
      .channel(`custom_${tableName}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table: tableName,
          filter: filter || undefined
        },
        () => {
          fetchData(); // Re-fetch on changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [tableName, filter, event, selectQuery, enabled, callback]);
}

/**
 * Cleanup all subscriptions (useful for app shutdown)
 */
export function cleanupAllSubscriptions() {
  console.log('🧹 Cleaning up Supabase subscriptions');
  supabase.removeAllChannels();
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanupAllSubscriptions);
}

// ==================== OPTIMISTIC UPDATE HELPERS ====================

/**
 * Helper for optimistic updates
 */
export function useOptimisticUpdate<T>(
  initialData: T[] | null
) {
  const [optimisticData, setOptimisticData] = useState<T[] | null>(initialData);

  // Sync with server data
  useEffect(() => {
    setOptimisticData(initialData);
  }, [initialData]);

  const addOptimistic = useCallback((item: T) => {
    setOptimisticData(prev => prev ? [...prev, item] : [item]);
  }, []);

  const removeOptimistic = useCallback((predicate: (item: T) => boolean) => {
    setOptimisticData(prev => prev ? prev.filter(item => !predicate(item)) : null);
  }, []);

  const updateOptimistic = useCallback((predicate: (item: T) => boolean, updater: (item: T) => T) => {
    setOptimisticData(prev => 
      prev ? prev.map(item => predicate(item) ? updater(item) : item) : null
    );
  }, []);

  return {
    data: optimisticData,
    addOptimistic,
    removeOptimistic,
    updateOptimistic
  };
}

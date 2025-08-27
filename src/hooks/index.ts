// src/hooks/index.ts - UPDATED: Export simplified auth instead of useLazyAuth
export { 
  useFirebaseSubscription,
  useGameSubscription,
  useActiveGamesSubscription,
  useHostCurrentGameSubscription,
  cleanupAllSubscriptions
} from './useSupabaseSubscription';

// ✅ CHANGED: Export simplified auth hook instead of useLazyAuth
export { useAuth } from './useAuth';

// ✅ UNCHANGED: Other hooks remain the same
export { useToast } from './use-toast';
export { useIsMobile } from './use-mobile';

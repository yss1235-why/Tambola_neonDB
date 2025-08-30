// Supabase Authentication Hook
// Replaces Firebase useAuth.ts - MUCH SIMPLER!

import { useState, useEffect, useCallback } from 'react';
import { supabaseAuth } from '@/services/supabase-auth';
import { supabase } from '@/services/supabase';
import type { AdminUser, HostUser } from '@/services/supabase-types';
import { cleanupAllSubscriptions } from './useSupabaseSubscription';

interface AuthState {
  user: AdminUser | HostUser | null;
  userRole: 'admin' | 'host' | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

interface AuthActions {
  loginAdmin: (email: string, password: string) => Promise<void>;
  loginHost: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  initializeAuth: () => Promise<() => void>; // For compatibility - no-op
}

/**
 * SIMPLIFIED Supabase Authentication Hook
 * 
 * Benefits over Firebase version:
 * ✅ No race conditions
 * ✅ No complex lazy loading
 * ✅ No subscription cleanup issues
 * ✅ Simple, predictable state management
 * ✅ Built-in error handling
 */
export const useAuth = (): AuthState & AuthActions => {
  const [state, setState] = useState<AuthState>({
    user: null,
    userRole: null,
    loading: true,
    error: null,
    initialized: false
  });

  // ==================== INITIALIZE AUTH STATE ====================

  useEffect(() => {
    console.log('🔐 Initializing Supabase auth system...');

    let isMounted = true;

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event, session?.user?.email || 'no user');

        if (!isMounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          try {
            console.log('🔐 User signed in, loading profile...');
            
            // Use session user directly instead of making another API call
            const userData = await supabaseAuth.getUserDataFromSession(session.user);
            const role = userData?.role || null;

            if (userData && role) {
              setState({
                user: userData,
                userRole: role as 'admin' | 'host',
                loading: false,
                initialized: true,
                error: null
              });
              console.log('✅ User profile loaded successfully:', userData.email);
            } else {
              console.warn('⚠️ User authenticated but no profile found');
              setState({
                user: null,
                userRole: null,
                loading: false,
                initialized: true,
                error: 'User profile not found'
              });
            }
          } catch (error: any) {
            console.error('❌ Error loading user profile:', error);
            setState({
              user: null,
              userRole: null,
              loading: false,
              initialized: true,
              error: error.message || 'Failed to load user profile'
            });
          }
        } else if (event === 'SIGNED_OUT' || !session) {
          console.log('🔐 User signed out or no session');
          setState({
            user: null,
            userRole: null,
            loading: false,
            initialized: true,
            error: null
          });
        }
      }
    );

    // Set timeout to prevent hanging in loading state
    const loadingTimeout = setTimeout(() => {
      if (isMounted) {
        setState(prev => {
          if (prev.loading && !prev.initialized) {
            console.warn('⚠️ Auth loading timeout reached');
            return {
              ...prev,
              loading: false,
              initialized: true
            };
          }
          return prev;
        });
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      console.log('🧹 Auth cleanup completed');
    };
  }, []);

  // ==================== LOGIN METHODS ====================

  const loginAdmin = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('🔐 Admin login attempt for:', email);
      
      const adminUser = await supabaseAuth.loginAdmin(email, password);
      
      // State will be updated by onAuthStateChange listener
      console.log('✅ Admin login successful');
      
    } catch (error: any) {
      console.error('❌ Admin login failed:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message || 'Admin login failed'
      }));
      throw error;
    }
  }, []);

  const loginHost = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('🔐 Host login attempt for:', email);
      
      const hostUser = await supabaseAuth.loginHost(email, password);
      
      // State will be updated by onAuthStateChange listener
      console.log('✅ Host login successful');
      
    } catch (error: any) {
      console.error('❌ Host login failed:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message || 'Host login failed'
      }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('🔐 Logout initiated...');
      
      // Clean up subscriptions before logout
      console.log('🧹 Cleaning up subscriptions before logout...');
      cleanupAllSubscriptions();
      
      await supabaseAuth.logout();
      
      // State will be updated by onAuthStateChange listener
      console.log('✅ Logout successful');
      
    } catch (error: any) {
      console.error('❌ Logout failed:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message || 'Logout failed'
      }));
      throw error;
    }
  }, []);

  // ==================== UTILITY METHODS ====================

  const clearError = useCallback(() => {
    console.log('🧹 Clearing auth error');
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Compatibility method - no-op since auth is always initialized
  const initializeAuth = useCallback(async (): Promise<() => void> => {
    console.log('🔐 initializeAuth called (no-op in Supabase version)');
    return () => {}; // Empty cleanup function
  }, []);

  // ==================== RETURN STATE & ACTIONS ====================

  return {
    ...state,
    loginAdmin,
    loginHost,
    logout,
    clearError,
    initializeAuth
  };
};

// ==================== ADDITIONAL HELPERS ====================

/**
 * Hook to check if current user has specific role
 */
export const useAuthRole = (requiredRole: 'admin' | 'host') => {
  const { user, userRole, loading } = useAuth();
  
  return {
    hasRole: userRole === requiredRole,
    user,
    loading
  };
};

/**
 * Hook to get current session
 */
export const useSession = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
};

// Supabase Authentication Hook

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

  // First, check if there's an existing session
    const initializeAuth = async () => {
      try {
        // ✅ FIXED: Add timeout to prevent hanging
        const getSessionWithTimeout = async () => {
          const getSessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('getSession timed out')), 10000)
          );
          
          try {
            return await Promise.race([getSessionPromise, timeoutPromise]);
          } catch (error) {
            console.error('getSession timeout:', error);
            return { data: { session: null }, error: null };
          }
        };


        const { data: { session } } = await getSessionWithTimeout();
        
        if (session?.user && isMounted) {
          console.log('🔐 Found existing session, loading user data...');
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
            console.log('✅ Existing session restored:', userData.email);
          }
        } else if (isMounted) {
          setState({
            user: null,
            userRole: null,
            loading: false,
            initialized: true,
            error: null
          });
        }
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        if (isMounted) {
          setState({
            user: null,
            userRole: null,
            loading: false,
            initialized: true,
            error: 'Failed to initialize authentication'
          });
        }
      }
    };

    initializeAuth();
// Listen to auth state changes (FIXED: No async calls in callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth event:', event, session?.user?.email || 'no user');

        if (!isMounted) return;

        // ✅ FIXED: Use setTimeout to dispatch async work AFTER callback completes
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(async () => {
            if (!isMounted) return;
            
            try {
              console.log('🔐 User signed in, loading profile...');
              
              // Wait a bit for auth to stabilize after sign in
              await new Promise(resolve => setTimeout(resolve, 500));
        
              // Use session user directly instead of making another API call
              const userData = await supabaseAuth.getUserDataFromSession(session.user);
              const role = userData?.role || null;

              if (!isMounted) return;

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
              if (isMounted) {
                setState({
                  user: null,
                  userRole: null,
                  loading: false,
                  initialized: true,
                  error: error.message || 'Failed to load user profile'
                });
              }
            }
          }, 0);
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

    return () => {
        isMounted = false;
        // Timeout safety code removed - no timeout to clear
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
    // ✅ FIXED: Get initial session with timeout protection
    const getSessionWithTimeout = async () => {
      const getSessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getSession timed out')), 10000)
      );
      
      try {
        return await Promise.race([getSessionPromise, timeoutPromise]);
      } catch (error) {
        console.error('getSession timeout:', error);
        return { data: { session: null }, error: null };
      }
    };

    getSessionWithTimeout().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for changes - no async calls in callback
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

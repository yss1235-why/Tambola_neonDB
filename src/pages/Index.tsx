// Main Index Page - Supabase Version
// Replaces Firebase Index.tsx - MUCH SIMPLER!

import React, { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/Header';
import { UserLandingPage } from '@/components/UserLandingPage';
import { GameHost } from '@/components/GameHost';
import { AdminDashboard } from '@/components/AdminDashboard';
import { GameDataProvider } from '@/providers/GameDataProvider';
import { useAuth } from '@/hooks/useAuth';
import { useActiveGamesSubscription } from '@/hooks/useSupabaseSubscription';
import { GestureDetector } from '@/components/GestureDetector';
import { DEFAULT_GESTURE_CONFIG } from '@/utils/gestureConfig';
import type { AdminUser, HostUser } from '@/services/supabase-types';

const Index = () => {
  // ==================== SIMPLIFIED AUTH STATE ====================
  
  const auth = useAuth();
  const { user: currentUser, userRole, loading: authLoading, error: authError } = auth;

  // ==================== SIMPLIFIED GAMES LOADING ====================
  
  const { 
    data: allGames, 
    loading: gamesLoading, 
    error: gamesError 
  } = useActiveGamesSubscription();

  // ==================== LOCAL STATE ====================
  
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [showAdminLoginViaGesture, setShowAdminLoginViaGesture] = useState(false);

  // ==================== SIMPLE LOGIN HANDLERS ====================

  const handleUserLogin = useCallback(async (
    type: 'admin' | 'host', 
    email: string, 
    password: string
  ) => {
    try {
      console.log(`🔐 ${type} login attempt:`, email);
      
      if (type === 'admin') {
        await auth.loginAdmin(email, password);
      } else {
        await auth.loginHost(email, password);
      }
      
      console.log(`✅ ${type} login successful`);
      
    } catch (error: any) {
      console.error(`❌ ${type} login failed:`, error);
      throw error; // Let UI components handle the error display
    }
  }, [auth]);

  // ==================== GESTURE DETECTION ====================

  const handleAdminGesture = useCallback(() => {
    console.log('🤲 Admin gesture detected');
    setShowAdminLoginViaGesture(true);
  }, []);

  const handleCloseGestureLogin = useCallback(() => {
    setShowAdminLoginViaGesture(false);
  }, []);

  // ==================== ERROR HANDLING ====================

  useEffect(() => {
    if (authError) {
      console.error('Auth error:', authError);
    }
    if (gamesError) {
      console.error('Games loading error:', gamesError);
    }
  }, [authError, gamesError]);

  // ==================== RENDER LOADING STATE ====================

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-orange-800 font-medium">Loading Tambola Game...</p>
        </div>
      </div>
    );
  }

  // ==================== RENDER AUTHENTICATED VIEWS ====================

  if (currentUser) {
    return (
      <>
        <Header />
        
        <main className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 pt-16">
          {/* Admin Dashboard */}
          {userRole === 'admin' && (
            <AdminDashboard 
              admin={currentUser as AdminUser}
              games={allGames || []}
              gamesLoading={gamesLoading}
            />
          )}

          {/* Host Dashboard */}
          {userRole === 'host' && (
            <GameDataProvider userId={currentUser.id}>
              <GameHost 
                host={currentUser as HostUser}
                onGameSelect={setSelectedGameId}
              />
            </GameDataProvider>
          )}
        </main>
      </>
    );
  }

  // ==================== RENDER GUEST VIEW ====================

  return (
    <>
      <Header onUserLogin={handleUserLogin} />
      
      <main className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 pt-16">
        {selectedGameId ? (
          // Game View with Real-time Data
          <GameDataProvider gameId={selectedGameId}>
            <UserLandingPage 
              games={allGames || []}
              gamesLoading={gamesLoading}
              selectedGameId={selectedGameId}
              onGameSelect={setSelectedGameId}
              onBack={() => setSelectedGameId(null)}
            />
          </GameDataProvider>
        ) : (
          // Games List
          <UserLandingPage 
            games={allGames || []}
            gamesLoading={gamesLoading}
            onGameSelect={setSelectedGameId}
          />
        )}
        
        {/* Gesture Detection for Admin Access */}
        <GestureDetector
          config={DEFAULT_GESTURE_CONFIG}
          onGestureDetected={handleAdminGesture}
          isActive={!currentUser}
        />
        
        {/* Admin Login Modal (via gesture) */}
        {showAdminLoginViaGesture && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Admin Access
              </h2>
              <AdminLoginForm
                onLogin={(email, password) => handleUserLogin('admin', email, password)}
                onClose={handleCloseGestureLogin}
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
};

// ==================== ADMIN LOGIN FORM COMPONENT ====================

interface AdminLoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onClose: () => void;
}

const AdminLoginForm: React.FC<AdminLoginFormProps> = ({ onLogin, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await onLogin(email, password);
      onClose(); // Close modal on success
    } catch (error: any) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
          disabled={loading}
          autoFocus
        />
      </div>
      
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
          disabled={loading}
        />
      </div>
      
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      
      <div className="flex space-x-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default Index;

/**
 * 🎉 IMPROVEMENTS OVER FIREBASE VERSION:
 * 
 * ✅ SIMPLER STATE MANAGEMENT:
 * - No complex lazy auth initialization
 * - No race conditions between auth and data loading
 * - Straightforward error handling
 * 
 * ✅ CLEANER DATA FLOW:
 * - Direct subscription hooks
 * - No subscription deduplication needed
 * - Automatic cleanup
 * 
 * ✅ BETTER PERFORMANCE:
 * - Fewer re-renders due to simpler state
 * - No redundant API calls
 * - Optimized real-time subscriptions
 * 
 * ✅ EASIER MAINTENANCE:
 * - Clear separation of concerns
 * - Predictable component lifecycle
 * - Simplified debugging
 */

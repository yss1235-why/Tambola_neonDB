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
  const { user: currentUser, userRole, loading: authLoading, error: authError, initialized: authInitialized } = auth;

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

 // ==================== MISSING HANDLER - ADD THIS ====================

const handleRequestLogin = useCallback(async () => {
  console.log('🔐 Auth initialization requested...');
  // Since Supabase auth is always initialized, this is just for compatibility
  await auth.initializeAuth();
  return Promise.resolve();
}, [auth]);

// ==================== SIMPLE LOGIN HANDLERS ====================

const handleUserLogin = useCallback(async (
  type: 'admin' | 'host', 
  email: string, 
  password: string
): Promise<boolean> => { // <-- Add return type boolean
  try {
    console.log(`🔐 ${type} login attempt:`, email);
    
    if (type === 'admin') {
      await auth.loginAdmin(email, password);
    } else {
      await auth.loginHost(email, password);
    }
    
    console.log(`✅ ${type} login successful`);
    return true; // <-- Return success
    
  } catch (error: any) {
    console.error(`❌ ${type} login failed:`, error);
    throw error; // Let UI components handle the error display
  }
}, [auth]);

// ==================== LOGOUT HANDLER ====================

const handleUserLogout = useCallback(async (): Promise<boolean> => {
  try {
    console.log('🔐 Logout requested...');
    await auth.logout();
    console.log('✅ Logout successful');
    return true;
  } catch (error: any) {
    console.error('❌ Logout failed:', error);
    return false;
  }
}, [auth]);

// ==================== CLEAR ERROR HANDLER ====================

const handleClearError = useCallback(() => {
  console.log('🧹 Clearing auth error');
  auth.clearError();
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
      <Header
        currentUser={currentUser}
        userRole={userRole}
        authLoading={authLoading}
        authError={authError}
        authInitialized={authInitialized}
        onRequestLogin={handleRequestLogin}
        onUserLogin={handleUserLogin}
        onUserLogout={handleUserLogout}
        onClearError={handleClearError}
      />
        
        <main className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 pt-16">
          {/* Admin Dashboard */}
          {userRole === 'admin' && (
            <AdminDashboard 
              user={currentUser as AdminUser}   // ← CORRECT
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
    <Header
      currentUser={currentUser}
      userRole={userRole}
      authLoading={authLoading}
      authError={authError}
      authInitialized={authInitialized}
      onRequestLogin={handleRequestLogin}
      onUserLogin={handleUserLogin}
      onUserLogout={handleUserLogout}
      onClearError={handleClearError}
      forceShowAdminLogin={showAdminLoginViaGesture}
      onAdminLoginClose={handleCloseGestureLogin}
    />
      
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
          onGestureComplete={handleAdminGesture}
          enabled={!currentUser}
        />
        
       {/* Admin login is now handled by Header component */}
      </main>
    </>
  );
};



export default Index;

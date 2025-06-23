// src/services/firebase-core.ts - Infrastructure: Firebase setup, auth, basic DB, types, subscriptions

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  push, 
  update, 
  remove, 
  onValue, 
  off, 
  query, 
  orderByChild, 
  equalTo,
  runTransaction
} from 'firebase/database';

// ================== FIREBASE CONFIGURATION ==================

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);

// ================== TYPE DEFINITIONS ==================

export interface GameState {
  isActive: boolean;
  isCountdown: boolean;
  countdownTime: number;
  gameOver: boolean;
  calledNumbers: number[];
  currentNumber: number | null;
}

export interface TambolaTicket {
  ticketId: string;
  rows: number[][];
  markedNumbers: number[];
  isBooked: boolean;
  playerName: string;
  playerPhone: string;
  bookedAt: string;
  metadata?: TicketMetadata;
  positionInSet?: number;
  setId?: number;
}

export interface TicketMetadata {
  corners: number[];
  center: number;
  hasValidCorners: boolean;
  hasValidCenter: boolean;
  allNumbers: number[];
}

export interface Prize {
  id: string;
  name: string;
  pattern: string;
  description: string;
  won: boolean;
  order: number;
  winners?: {
    name: string;
    ticketId: string;
    phone?: string;
  }[];
  winningNumber?: number;
  wonAt?: string;
}

export interface GameData {
  gameId: string;
  name: string;
  hostId: string;
  hostPhone: string;
  createdAt: string;
  maxTickets: number;
  ticketPrice: number;
  gameState: GameState;
  tickets: { [ticketId: string]: TambolaTicket };
  prizes: { [prizeId: string]: Prize };
  lastWinnerAnnouncement?: string;
  lastWinnerAt?: string;
  updatedAt?: string;
}

export interface HostUser {
  uid: string;
  email: string;
  name: string;
  phone: string;
  role: 'host';
  subscriptionEndDate: string;
  isActive: boolean;
}

export interface AdminUser {
  uid: string;
  email: string;
  name: string;
  role: 'admin';
  permissions: {
    createHosts: boolean;
    manageUsers: boolean;
  };
}

export interface HostSettings {
  hostPhone: string;
  maxTickets: number;
  selectedTicketSet: string;
  selectedPrizes: string[];
  updatedAt?: string;
}

export interface CreateGameConfig {
  name: string;
  maxTickets: number;
  ticketPrice: number;
  hostPhone: string;
}

interface TicketRowData {
  setId: number;
  ticketId: number;
  rowId: number;
  numbers: number[];
}

// ================== UTILITY FUNCTIONS ==================

export const removeUndefinedValues = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefinedValues).filter(item => item !== undefined);
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefinedValues(value);
    }
  }
  return cleaned;
};

// ================== FIREBASE CORE SERVICE CLASS ==================

export class FirebaseCore {
  private cleanupInProgress = new Set<string>();
  
  // ================== RACE CONDITION PREVENTION ==================

  private activeLocks = new Map<string, Promise<any>>();

  /**
   * ✅ RACE CONDITION PREVENTION: Ensure only one update per game at a time
   */
  private async withGameLock<T>(gameId: string, operation: () => Promise<T>): Promise<T> {
    const lockKey = `game_${gameId}`;
    
    if (this.activeLocks.has(lockKey)) {
      console.log(`⏳ Waiting for existing operation on game: ${gameId}`);
      await this.activeLocks.get(lockKey);
    }
    
    const operationPromise = (async () => {
      try {
        console.log(`🔒 Acquired lock for game: ${gameId}`);
        return await operation();
      } finally {
        console.log(`🔓 Released lock for game: ${gameId}`);
        this.activeLocks.delete(lockKey);
      }
    })();
    
    this.activeLocks.set(lockKey, operationPromise);
    return operationPromise;
  }

  /**
   * ✅ TRANSACTION WRAPPER: Safe Firebase updates with retries
   */
  async safeTransactionUpdate(
    path: string, 
    updates: any, 
    retries: number = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`📡 Transaction attempt ${attempt}/${retries} for: ${path}`);
        
        await runTransaction(ref(database, path), (current) => {
          if (current === null) {
            throw new Error(`Path ${path} does not exist`);
          }
          return { ...current, ...removeUndefinedValues(updates) };
        });
        
        console.log(`✅ Transaction completed successfully for: ${path}`);
        return;
        
      } catch (error: any) {
        console.warn(`⚠️ Transaction attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          throw new Error(`Transaction failed after ${retries} attempts: ${error.message}`);
        }
        
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // ================== AUTHENTICATION ==================
  
  async loginAdmin(email: string, password: string): Promise<AdminUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = await this.getUserData();
      if (!userData || userData.role !== 'admin') {
        throw new Error('Not authorized as admin');
      }
      return userData as AdminUser;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to login as admin');
    }
  }

  async loginHost(email: string, password: string): Promise<HostUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = await this.getUserData();
      if (!userData || userData.role !== 'host') {
        throw new Error('Not authorized as host');
      }
      return userData as HostUser;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to login as host');
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to logout');
    }
  }

  async getUserData(): Promise<AdminUser | HostUser | null> {
    try {
      const user = auth.currentUser;
      if (!user) return null;

      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return null;
    } catch (error: any) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  async getCurrentUserRole(): Promise<string | null> {
    try {
      const userData = await this.getUserData();
      return userData?.role || null;
    } catch (error: any) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  // ================== BASIC DATABASE OPERATIONS ==================

  async getGameData(gameId: string): Promise<GameData | null> {
    try {
      const gameRef = ref(database, `games/${gameId}`);
      const snapshot = await get(gameRef);
      
      if (snapshot.exists()) {
        return snapshot.val() as GameData;
      }
      return null;
    } catch (error: any) {
      console.error('Error getting game data:', error);
      throw new Error(error.message || 'Failed to get game data');
    }
  }

  async updateGameState(gameId: string, gameState: GameState): Promise<void> {
    try {
      const gameStateRef = ref(database, `games/${gameId}/gameState`);
      await set(gameStateRef, removeUndefinedValues(gameState));
    } catch (error: any) {
      console.error('Error updating game state:', error);
      throw new Error(error.message || 'Failed to update game state');
    }
  }

  // ================== HOST MANAGEMENT ==================

  async createHost(email: string, password: string, name: string, phone: string, adminId: string, subscriptionMonths: number): Promise<void> {
    try {
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + subscriptionMonths);

      const hostData: HostUser = {
        uid: '', // Will be set after user creation
        email,
        name,
        phone,
        role: 'host',
        subscriptionEndDate: subscriptionEndDate.toISOString(),
        isActive: true
      };

      // In a real implementation, you would create the user account first
      // and then store the host data with the generated UID
      
      console.log('Host creation initiated:', { email, name, subscriptionMonths });
      
      // This would typically involve:
      // 1. Creating auth user
      // 2. Storing user data in database
      // 3. Setting up initial host settings
      
    } catch (error: any) {
      console.error('Error creating host:', error);
      throw new Error(error.message || 'Failed to create host');
    }
  }

  async getAllHosts(): Promise<HostUser[]> {
    try {
      const hostsRef = ref(database, 'users');
      const hostsQuery = query(hostsRef, orderByChild('role'), equalTo('host'));
      const snapshot = await get(hostsQuery);
      
      if (snapshot.exists()) {
        return Object.values(snapshot.val()) as HostUser[];
      }
      return [];
    } catch (error: any) {
      console.error('Error getting hosts:', error);
      throw new Error(error.message || 'Failed to get hosts');
    }
  }

  async updateHost(hostId: string, updates: Partial<HostUser>): Promise<void> {
    try {
      const hostRef = ref(database, `users/${hostId}`);
      await update(hostRef, removeUndefinedValues(updates));
    } catch (error: any) {
      console.error('Error updating host:', error);
      throw new Error(error.message || 'Failed to update host');
    }
  }

  async deleteHost(hostId: string): Promise<void> {
    try {
      const hostRef = ref(database, `users/${hostId}`);
      await remove(hostRef);
    } catch (error: any) {
      console.error('Error deleting host:', error);
      throw new Error(error.message || 'Failed to delete host');
    }
  }

  async getHostById(hostId: string): Promise<HostUser | null> {
    try {
      const hostRef = ref(database, `users/${hostId}`);
      const snapshot = await get(hostRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.role === 'host') {
          return userData as HostUser;
        }
      }
      return null;
    } catch (error: any) {
      console.error('Error getting host by ID:', error);
      return null;
    }
  }

  async extendHostSubscription(hostId: string, additionalMonths: number): Promise<void> {
    try {
      const host = await this.getHostById(hostId);
      if (!host) {
        throw new Error('Host not found');
      }

      const currentEndDate = new Date(host.subscriptionEndDate);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + additionalMonths);

      await this.updateHost(hostId, {
        subscriptionEndDate: newEndDate.toISOString()
      });
    } catch (error: any) {
      console.error('Error extending host subscription:', error);
      throw new Error(error.message || 'Failed to extend host subscription');
    }
  }

  async toggleHostStatus(hostId: string, isActive: boolean): Promise<void> {
    try {
      await this.updateHost(hostId, { isActive });
    } catch (error: any) {
      console.error('Error toggling host status:', error);
      throw new Error(error.message || 'Failed to toggle host status');
    }
  }

  async changeHostPassword(hostId: string, newPassword: string): Promise<void> {
    try {
      // In a real implementation, this would update the authentication password
      console.log('Password change initiated for host:', hostId);
      
      // This would typically involve:
      // 1. Updating the Firebase Auth password
      // 2. Possibly logging the host out of all sessions
      // 3. Sending confirmation email
      
    } catch (error: any) {
      console.error('Error changing host password:', error);
      throw new Error(error.message || 'Failed to change host password');
    }
  }

  // ================== HOST SETTINGS ==================

  async saveHostSettings(hostId: string, settings: HostSettings): Promise<void> {
    try {
      const settingsRef = ref(database, `hostSettings/${hostId}`);
      const settingsWithTimestamp = {
        ...settings,
        updatedAt: new Date().toISOString()
      };
      await set(settingsRef, removeUndefinedValues(settingsWithTimestamp));
    } catch (error: any) {
      console.error('Error saving host settings:', error);
      throw new Error(error.message || 'Failed to save host settings');
    }
  }

  async getHostSettings(hostId: string): Promise<HostSettings | null> {
    try {
      const settingsRef = ref(database, `hostSettings/${hostId}`);
      const snapshot = await get(settingsRef);
      
      if (snapshot.exists()) {
        return snapshot.val() as HostSettings;
      }
      return null;
    } catch (error: any) {
      console.error('Error getting host settings:', error);
      return null;
    }
  }

  async updateHostTemplate(hostId: string, template: Partial<HostSettings>): Promise<void> {
    try {
      const settingsRef = ref(database, `hostSettings/${hostId}`);
      const templateWithTimestamp = {
        ...template,
        updatedAt: new Date().toISOString()
      };
      await update(settingsRef, removeUndefinedValues(templateWithTimestamp));
    } catch (error: any) {
      console.error('Error updating host template:', error);
      throw new Error(error.message || 'Failed to update host template');
    }
  }

  // ================== REAL-TIME SUBSCRIPTIONS ==================

  subscribeToGame(gameId: string, callback: (gameData: GameData | null) => void): () => void {
    const gameRef = ref(database, `games/${gameId}`);
    
    const unsubscribe = onValue(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        const gameData = snapshot.val() as GameData;
        callback(gameData);
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Firebase subscription error:', error);
      callback(null);
    });

    return () => off(gameRef, 'value', unsubscribe);
  }

  subscribeToAllActiveGames(callback: (games: GameData[]) => void): () => void {
    const gamesRef = ref(database, 'games');
    
    const unsubscribe = onValue(gamesRef, (snapshot) => {
      if (snapshot.exists()) {
        const allGames = Object.values(snapshot.val()) as GameData[];
        
        const validGames = allGames.filter(game => 
          game.hostId && game.gameId && game.gameState
        );

        const gamesByHost = new Map<string, GameData[]>();
        validGames.forEach(game => {
          if (!gamesByHost.has(game.hostId)) {
            gamesByHost.set(game.hostId, []);
          }
          gamesByHost.get(game.hostId)!.push(game);
        });

        const activeGames: GameData[] = [];
        for (const [hostId, hostGames] of gamesByHost) {
          const latestGame = hostGames.reduce((latest, current) => 
            new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
          );
          
          if (latestGame.gameState.isActive && !latestGame.gameState.gameOver) {
            activeGames.push(latestGame);
          }
        }

        callback(activeGames);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error('Firebase subscription error:', error);
      callback([]);
    });

    return () => off(gamesRef, 'value', unsubscribe);
  }

  subscribeToGames(callback: (games: GameData[]) => void): () => void {
    const gamesRef = ref(database, 'games');
    
    const unsubscribe = onValue(gamesRef, (snapshot) => {
      if (snapshot.exists()) {
        const games = Object.values(snapshot.val()) as GameData[];
        callback(games);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error('Firebase subscription error:', error);
      callback([]);
    });

    return () => off(gamesRef, 'value', unsubscribe);
  }

  subscribeToHosts(callback: (hosts: HostUser[]) => void): () => void {
    const hostsRef = ref(database, 'users');
    const hostsQuery = query(hostsRef, orderByChild('role'), equalTo('host'));
    
    const unsubscribe = onValue(hostsQuery, (snapshot) => {
      if (snapshot.exists()) {
        const hosts = Object.values(snapshot.val()) as HostUser[];
        callback(hosts);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error('Firebase hosts subscription error:', error);
      callback([]);
    });

    return () => off(hostsQuery, 'value', unsubscribe);
  }
}

// ================== SINGLETON EXPORT ==================

export const firebaseCore = new FirebaseCore();

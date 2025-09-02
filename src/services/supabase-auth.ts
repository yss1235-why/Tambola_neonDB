// Supabase Authentication Service
import { supabase, supabaseAdmin, createAdminClient } from './supabase';
import type { 
  AdminUser, 
  HostUser, 
  User, 
  HostSettings,
  ApiResponse 
} from './supabase-types';

class SupabaseAuthService {
  // ==================== TIMEOUT HELPERS ====================

  /**
   * Wrapper to add timeout to any auth operation
   */
  private async withTimeout<T>(
    promise: Promise<T>, 
    operation: string, 
    timeoutMs: number = 10000
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    );
    
    try {
      return await Promise.race([promise, timeoutPromise]);
    } catch (error: any) {
      console.error(`❌ ${operation} failed:`, error);
      throw error;
    }
  }

  /**
   * Safe getUser with timeout protection
   */
  private async getSafeUser() {
    return await this.withTimeout(
      supabase.auth.getUser(),
      'getUser',
      10000
    );
  }

  /**
   * Safe getSession with timeout protection  
   */
  private async getSafeSession() {
    return await this.withTimeout(
      supabase.auth.getSession(),
      'getSession',
      10000
    );
  }

  // ==================== AUTHENTICATION ====================
  /**
   * Login as admin user
   */
  async loginAdmin(email: string, password: string): Promise<AdminUser> {
    try {
     // ✅ FIXED: Sign in with timeout protection
      const { data: authData, error: authError } = await this.withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password
        }),
        'signInWithPassword',
        15000 // Longer timeout for login
      );

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('No user data returned from authentication');
      }

      // Get admin data from database
      const { data: adminData, error: dbError } = await supabase
        .from('admins')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (dbError || !adminData) {
        // Clean up auth session if admin record doesn't exist
        await supabase.auth.signOut();
        throw new Error('Admin account not found or access denied');
      }

      // Update auth metadata with role
      await supabase.auth.updateUser({
        data: { 
          role: 'admin',
          user_role: 'admin'
        }
      });

      const admin: AdminUser = {
        ...adminData,
        role: 'admin'
      };

      console.log('✅ Admin login successful:', admin.email);
      return admin;

    } catch (error: any) {
      console.error('❌ Admin login failed:', error);
      throw new Error(error.message || 'Admin login failed');
    }
  }

  /**
   * Login as host user
   */
  async loginHost(email: string, password: string): Promise<HostUser> {
    try {
    // ✅ FIXED: Sign in with timeout protection
      const { data: authData, error: authError } = await this.withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password
        }),
        'signInWithPassword',
        15000 // Longer timeout for login
      );

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('No user data returned from authentication');
      }

      // Get host data from database
      const { data: hostData, error: dbError } = await supabase
        .from('hosts')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (dbError || !hostData) {
        // Clean up auth session if host record doesn't exist
        await supabase.auth.signOut();
        throw new Error('Host account not found or access denied');
      }

      // Check if host subscription is active
      const subscriptionEndDate = new Date(hostData.subscription_end_date);
      if (subscriptionEndDate < new Date()) {
        await supabase.auth.signOut();
        throw new Error('Host subscription has expired. Please contact admin.');
      }

      if (!hostData.is_active) {
        await supabase.auth.signOut();
        throw new Error('Host account is deactivated. Please contact admin.');
      }

      // Update auth metadata with role
      await supabase.auth.updateUser({
        data: { 
          role: 'host',
          user_role: 'host'
        }
      });

      const host: HostUser = {
        ...hostData,
        role: 'host'
      };

      console.log('✅ Host login successful:', host.email);
      return host;

    } catch (error: any) {
      console.error('❌ Host login failed:', error);
      throw new Error(error.message || 'Host login failed');
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      // ✅ FIXED: Logout with timeout protection
      const { error } = await this.withTimeout(
        supabase.auth.signOut(),
        'signOut',
        10000
      );
      
      if (error) {
        throw error;
      }

      console.log('✅ User logged out successfully');

    } catch (error: any) {
      console.error('❌ Logout failed:', error);
      throw new Error(error.message || 'Logout failed');
    }
  }

  /**
   * Get current user data (admin or host)
   */
async getUserData(): Promise<User | null> {
    try {
      console.log('🔍 getUserData: Starting...');
      
    // ✅ FIXED: Use safe method with timeout
      const { data: { user } } = await this.getSafeUser();
      console.log('🔍 getUserData: Got user from auth:', user?.id);
      
      if (!user) {
        console.log('🔍 getUserData: No user found');
        return null;
      }
      
      console.log('🔍 getUserData: About to query database for user:', user.id);

     // Try to get admin data first
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('id', user.id)
        .single();

      if (adminError && adminError.code !== 'PGRST116') {
        console.error('Error querying admin table:', adminError);
        throw new Error(`Database error: ${adminError.message}`);
      }

      if (adminData) {
        console.log('✅ Found admin record');
        return {
          ...adminData,
          role: 'admin'
        } as AdminUser;
      }

      // Try to get host data
      const { data: hostData, error: hostError } = await supabase
        .from('hosts')
        .select('*')
        .eq('id', user.id)
        .single();

      if (hostError && hostError.code !== 'PGRST116') {
        console.error('Error querying host table:', hostError);
        throw new Error(`Database error: ${hostError.message}`);
      }

      if (hostData) {
        console.log('✅ Found host record');
        return {
          ...hostData,
          role: 'host'
        } as HostUser;
      }

      console.warn('User authenticated but no admin/host record found');
      return null;

    } catch (error: any) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  /**
   * Get current user role
   */
  async getCurrentUserRole(): Promise<string | null> {
    const userData = await this.getUserData();
    return userData?.role || null;
  }

  // ==================== HOST MANAGEMENT ====================

  /**
   * Create new host account
   */
  async createHost(
    email: string, 
    password: string, 
    name: string, 
    phone: string, 
    adminId: string, 
    subscriptionMonths: number
  ): Promise<void> {
    try {
      console.log(`🔄 Creating host account: ${email}`);

      // Create auth user (this will generate the UUID)
    const adminClient = createAdminClient();
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          role: 'host'
        }
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Failed to create auth user');
      }

      const hostId = authData.user.id;

      // Calculate subscription end date
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + subscriptionMonths);

      // Create host database record
      const { error: dbError } = await supabase
        .from('hosts')
        .insert({
          id: hostId,
          email,
          name,
          phone,
          subscription_end_date: subscriptionEndDate.toISOString(),
          is_active: true,
          created_by: adminId
        });

      if (dbError) {
        // Clean up auth user if database insert fails
       if (supabaseAdmin) {
          await supabaseAdmin.auth.admin.deleteUser(hostId);
        }
        throw new Error(dbError.message);
      }

      console.log(`✅ Host ${name} created successfully with ID: ${hostId}`);

    } catch (error: any) {
      console.error('❌ Error creating host:', error);
      throw new Error(error.message || 'Failed to create host');
    }
  }

  /**
   * Get all hosts
   */
  async getAllHosts(): Promise<HostUser[]> {
    try {
      const { data, error } = await supabase
        .from('hosts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map(host => ({
        ...host,
        role: 'host'
      })) as HostUser[];

    } catch (error: any) {
      console.error('Error fetching hosts:', error);
      return [];
    }
  }

  /**
   * Update host information
   */
  async updateHost(hostId: string, updates: Partial<HostUser>): Promise<void> {
    try {
      const { error } = await supabase
        .from('hosts')
        .update(updates)
        .eq('id', hostId);

      if (error) {
        throw error;
      }

      console.log(`✅ Host ${hostId} updated successfully`);

    } catch (error: any) {
      console.error('❌ Error updating host:', error);
      throw new Error(error.message || 'Failed to update host');
    }
  }

  /**
   * Delete host account
   */
  async deleteHost(hostId: string): Promise<void> {
    try {
      // Delete from database (this will cascade to related records)
      const { error: dbError } = await supabase
        .from('hosts')
        .delete()
        .eq('id', hostId);

      if (dbError) {
        throw dbError;
      }

    
      // Delete auth user
      if (supabaseAdmin) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(hostId);
        if (authError) {
          console.warn('Database record deleted but auth deletion failed:', authError);
        }
      } else {
        console.warn('Admin client not available - cannot delete auth user');
      }
      console.log(`✅ Host ${hostId} deleted successfully`);

    } catch (error: any) {
      console.error('❌ Error deleting host:', error);
      throw new Error(error.message || 'Failed to delete host');
    }
  }

  /**
   * Get host by ID
   */
  async getHostById(hostId: string): Promise<HostUser | null> {
    try {
      const { data, error } = await supabase
        .from('hosts')
        .select('*')
        .eq('id', hostId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        ...data,
        role: 'host'
      } as HostUser;

    } catch (error: any) {
      console.error('Error getting host by ID:', error);
      return null;
    }
  }

  /**
   * Extend host subscription
   */
  async extendHostSubscription(hostId: string, additionalMonths: number): Promise<void> {
    try {
      // Get current subscription end date
      const { data: hostData, error: fetchError } = await supabase
        .from('hosts')
        .select('subscription_end_date')
        .eq('id', hostId)
        .single();

      if (fetchError || !hostData) {
        throw new Error('Host not found');
      }

      // Calculate new end date
      const currentEndDate = new Date(hostData.subscription_end_date);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + additionalMonths);

      // Update subscription
      const { error: updateError } = await supabase
        .from('hosts')
        .update({ subscription_end_date: newEndDate.toISOString() })
        .eq('id', hostId);

      if (updateError) {
        throw updateError;
      }

      console.log(`✅ Host subscription extended by ${additionalMonths} months`);

    } catch (error: any) {
      console.error('❌ Error extending subscription:', error);
      throw new Error(error.message || 'Failed to extend subscription');
    }
  }

  // ==================== HOST SETTINGS ====================

  /**
   * Save host settings
   */
  async saveHostSettings(hostId: string, settings: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('host_settings')
        .upsert({
          host_id: hostId,
          settings
        }, {
          onConflict: 'host_id'
        });

      if (error) {
        throw error;
      }

      console.log(`✅ Host settings saved for: ${hostId}`);

    } catch (error: any) {
      console.error('❌ Error saving host settings:', error);
      throw new Error(error.message || 'Failed to save host settings');
    }
  }

  /**
   * Get host settings
   */
  async getHostSettings(hostId: string): Promise<HostSettings | null> {
    try {
      const { data, error } = await supabase
        .from('host_settings')
        .select('*')
        .eq('host_id', hostId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      return data as HostSettings || null;

    } catch (error: any) {
      console.error('Error fetching host settings:', error);
      return null;
    }
  }

  /**
   * Update host template settings
   */
  async updateHostTemplate(hostId: string, templateSettings: Partial<any>): Promise<void> {
    try {
      // Get current settings
      const currentSettings = await this.getHostSettings(hostId);
      
      const updatedSettings = {
        ...currentSettings?.settings || {},
        ...templateSettings,
        updatedAt: new Date().toISOString()
      };

      await this.saveHostSettings(hostId, updatedSettings);

      console.log(`✅ Host template updated for: ${hostId}`);

    } catch (error: any) {
      console.error('❌ Error updating host template:', error);
      throw new Error(error.message || 'Failed to update host template');
    }
  }

  // ==================== AUTH STATE HELPERS ====================

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  /**
   * Get current session
   */
  async getCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getCurrentSession();
    return !!session?.user;
  }

  /**
   * Check if current user is admin
   */
  async isAdmin(): Promise<boolean> {
    const role = await this.getCurrentUserRole();
    return role === 'admin';
  }

  /**
   * Check if current user is host
   */
  async isHost(): Promise<boolean> {
    const role = await this.getCurrentUserRole();
    return role === 'host';
  }

 /**
 * Get user data using session user (avoids extra API call)
 */
async getUserDataFromSession(sessionUser: any): Promise<User | null> {
  try {
    console.log('🔍 getUserDataFromSession: Starting for user:', sessionUser.id);
    
    const userId = sessionUser.id;
    const userRole = sessionUser.user_metadata?.role || sessionUser.app_metadata?.role;
    
    console.log('🔍 User role from metadata:', userRole);

    // Check the appropriate table based on stored role
    if (userRole === 'admin') {
      console.log('🔍 Checking admin table for admin user...');
      
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('id', userId)
        .single();

      if (adminError && adminError.code !== 'PGRST116') {
        console.error('Error querying admin table:', adminError);
        throw new Error(`Database error: ${adminError.message}`);
      }

      if (adminData) {
        console.log('✅ Found admin record');
        return {
          ...adminData,
          role: 'admin'
        } as AdminUser;
      }
    } else if (userRole === 'host') {
      console.log('🔍 Checking host table for host user...');
      
      try {
        // Use RPC to get host data directly
        const { data: hostData, error: hostError } = await supabase
          .rpc('get_host_by_id', { host_id: userId });
        
        console.log('🔍 RPC result:', { hasData: !!hostData, error: hostError });
        
        if (hostError) {
          console.error('RPC error:', hostError);
          return null;
        }
        
        if (hostData) {
          console.log('✅ Found host record via RPC');
          return {
            ...hostData,
            role: 'host'
          } as HostUser;
        }
        
        console.warn('No host record found');
        return null;
        
      } catch (error: any) {
        console.error('Error in getUserDataFromSession:', error);
        return null;
      }
    } else {
      // No role metadata found - return null and force re-login
      console.warn('⚠️ No role metadata found for user. User needs to login again.');
      return null;
    }

    console.warn('User authenticated but no matching record found');
    return null;

  } catch (error: any) {
    console.error('Error getting user data from session:', error);
    return null;
  }
}
}

// Export singleton instance
export const supabaseAuth = new SupabaseAuthService();

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const AuthContext = createContext(null);

export const DEFAULT_STORE = {
  id: 'store_mittal_dept',
  name: 'Mittal Departmental Store',
  slug: 'mittal-store',
  enabled_modules: {
    pos: true,
    inward_ocr: true,
    ledger: true,
    delivery: true
  }
};

export const DEFAULT_USER_PROFILE = {
  id: 'user_owner_default',
  full_name: 'Store Owner',
  email: 'owner@mittalstore.com',
  role: 'store_owner',
  store_id: 'store_mittal_dept',
  is_active: true
};

export const DEFAULT_SUPER_ADMIN_PROFILE = {
  id: 'user_super_admin_master',
  full_name: 'Super Administrator',
  email: 'superadmin@jaljivan.com',
  role: 'super_admin',
  store_id: null,
  is_active: true
};

const STORAGE_STORE_KEY = 'jal_jivan_current_store';
const STORAGE_PROFILE_KEY = 'jal_jivan_user_profile';
const STORAGE_ROLE_KEY = 'jal_jivan_user_role';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Current Store State
  const [currentStore, setCurrentStoreState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_STORE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_STORE;
  });

  // 2. User Role State (super_admin, store_owner, billing_cashier, inventory_staff, delivery_boy)
  const [userRole, setUserRoleState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ROLE_KEY);
      if (saved) return saved;
    } catch (e) {}
    return 'store_owner';
  });

  // 3. User Profile State
  const [userProfile, setUserProfileState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PROFILE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_USER_PROFILE;
  });

  // Helper to persist store updates
  const setCurrentStore = useCallback((store) => {
    const updated = typeof store === 'function' ? store(currentStore) : store;
    if (updated) {
      const normalized = {
        ...updated,
        enabled_modules: {
          pos: true,
          inward_ocr: true,
          ledger: true,
          delivery: true,
          ...(updated.enabled_modules || {})
        }
      };
      setCurrentStoreState(normalized);
      try {
        localStorage.setItem(STORAGE_STORE_KEY, JSON.stringify(normalized));
      } catch (e) {}
    }
  }, [currentStore]);

  // Helper to persist role updates
  const setUserRole = useCallback((role) => {
    setUserRoleState(role);
    try {
      localStorage.setItem(STORAGE_ROLE_KEY, role);
    } catch (e) {}
  }, []);

  // Helper to persist profile updates
  const setUserProfile = useCallback((profile) => {
    setUserProfileState(profile);
    try {
      localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {}
  }, []);

  // Login helper for atomic state updates & localStorage syncing
  const loginUser = useCallback(({ profile, store, role, session: newSession }) => {
    const activeRole = role || profile?.role || 'store_owner';
    if (profile) {
      setUserProfile(profile);
    }
    setUserRole(activeRole);
    if (store) {
      setCurrentStore(store);
    }
    if (newSession !== undefined) {
      setSession(newSession);
    }

    try {
      if (profile) localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
      localStorage.setItem(STORAGE_ROLE_KEY, activeRole);
      if (store) localStorage.setItem(STORAGE_STORE_KEY, JSON.stringify(store));
      localStorage.setItem('jal_jivan_admin_logged_in', 'true');
      localStorage.setItem(
        'admin_session',
        JSON.stringify({
          user: profile?.full_name || profile?.email || 'Admin User',
          role: activeRole,
          store_id: store?.id || profile?.store_id || null,
          token: `sess_${Date.now()}`,
          loggedInAt: Date.now()
        })
      );
    } catch (e) {}
  }, [setUserProfile, setUserRole, setCurrentStore]);

  // Logout helper
  const logoutUser = useCallback(async () => {
    if (isSupabaseConfigured && supabase?.auth) {
      try {
        await supabase.auth.signOut();
      } catch (e) {}
    }
    setSession(null);
    setUserRole('store_owner');
    setUserProfile(DEFAULT_USER_PROFILE);
    try {
      localStorage.removeItem(STORAGE_PROFILE_KEY);
      localStorage.removeItem(STORAGE_ROLE_KEY);
      localStorage.removeItem('jal_jivan_admin_logged_in');
      localStorage.removeItem('admin_session');
    } catch (e) {}
  }, [setUserRole, setUserProfile]);

  // Fetch user_profiles joining stores for the authenticated user session
  const fetchUserProfile = useCallback(async (currentSession) => {
    if (!isSupabaseConfigured || !supabase || !currentSession?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      const userId = currentSession.user.id;
      // Requirement 1: supabase.from('user_profiles').select('*, stores(*)').eq('id', session.user.id).single()
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*, stores(*)')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setUserProfile(data);
        if (data.role) {
          setUserRole(data.role);
        }

        if (data.stores) {
          const storeRecord = Array.isArray(data.stores) ? data.stores[0] : data.stores;
          if (storeRecord) {
            setCurrentStore({
              id: storeRecord.id,
              name: storeRecord.name,
              slug: storeRecord.slug,
              enabled_modules: storeRecord.enabled_modules || {
                pos: true,
                inward_ocr: true,
                ledger: true,
                delivery: true
              }
            });
          }
        } else if (data.store_id) {
          // If foreign key wasn't explicitly auto-joined, fetch stores directly
          const { data: storeData } = await supabase
            .from('stores')
            .select('*')
            .eq('id', data.store_id)
            .single();

          if (storeData) {
            setCurrentStore(storeData);
          }
        }
      } else if (error) {
        console.warn('user_profiles fetch notice (using active session profile):', error.message);
      }
    } catch (err) {
      console.warn('Exception during user_profiles / stores load:', err);
    } finally {
      setLoading(false);
    }
  }, [setCurrentStore, setUserProfile, setUserRole]);

  // Initialize Auth & Realtime Auth State Listener
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (isSupabaseConfigured && supabase?.auth) {
        try {
          const { data } = await supabase.auth.getSession();
          if (mounted) {
            setSession(data?.session || null);
            if (data?.session) {
              await fetchUserProfile(data.session);
            } else {
              setLoading(false);
            }
          }
        } catch (err) {
          console.warn('Supabase auth session initialization notice:', err);
          if (mounted) setLoading(false);
        }
      } else {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    let authSubscription = null;
    if (isSupabaseConfigured && supabase?.auth) {
      const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (mounted) {
          setSession(newSession);
          if (newSession) {
            await fetchUserProfile(newSession);
          }
        }
      });
      authSubscription = data?.subscription;
    }

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [fetchUserProfile]);

  // Convenience helper to check if a module is enabled for the current store
  const hasModule = useCallback((moduleKey) => {
    if (!currentStore || !currentStore.enabled_modules) return true;
    return Boolean(currentStore.enabled_modules[moduleKey]);
  }, [currentStore]);

  // Is current user store_owner
  const isOwner = useMemo(() => {
    return userRole === 'store_owner';
  }, [userRole]);

  // Is current user super_admin
  const isSuperAdmin = useMemo(() => {
    return userRole === 'super_admin';
  }, [userRole]);

  const value = useMemo(() => ({
    session,
    loading,
    currentStore,
    setCurrentStore,
    userRole,
    setUserRole,
    userProfile,
    setUserProfile,
    loginUser,
    logoutUser,
    refreshProfile: () => fetchUserProfile(session),
    hasModule,
    isOwner,
    isSuperAdmin
  }), [session, loading, currentStore, setCurrentStore, userRole, setUserRole, userProfile, setUserProfile, loginUser, logoutUser, fetchUserProfile, hasModule, isOwner, isSuperAdmin]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

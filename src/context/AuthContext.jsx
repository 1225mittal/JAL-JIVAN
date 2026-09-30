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

  // 2. User Role State (store_owner, billing_cashier, inventory_staff, delivery_boy)
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

  const value = useMemo(() => ({
    session,
    loading,
    currentStore,
    setCurrentStore,
    userRole,
    setUserRole,
    userProfile,
    setUserProfile,
    refreshProfile: () => fetchUserProfile(session),
    hasModule,
    isOwner
  }), [session, loading, currentStore, setCurrentStore, userRole, setUserRole, userProfile, setUserProfile, fetchUserProfile, hasModule, isOwner]);

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

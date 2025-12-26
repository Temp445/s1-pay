import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useUserProfileStore } from '../stores/userProfileStore';

interface AuthContextType {
  user: User | null;
  tenantId: string | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state change:', _event);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);


  useEffect(() => {
    if (user) {
      (async () => {
        const tenant_id = await loadUserTenantId(user.id);
        setTenantId(tenant_id);
        if (tenant_id) {
          await loadUserProfile(user.id, tenant_id);
        }
      })();
    } else {
      setTenantId(null);
      useUserProfileStore.getState().clearUserProfile();
    }
  }, [user]);

  const loadUserTenantId = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_tenant_id');
      if (error) {
        console.error('Error loading tenant_id:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Failed to load tenant_id:', err);
      return null;
    }
  };

  const loadUserProfile = async (userId: string, tenantId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
      }

      useUserProfileStore.getState().setUserProfile(userId, tenantId, data);
    } catch (err) {
      console.error('Failed to load profile:', err);
      useUserProfileStore.getState().setUserProfile(userId, tenantId, null);
    }
  };

  // useEffect(() => {
  //   // Check active sessions and sets the user
  //   supabase.auth.getSession().then(async ({ data: { session }, error }) => {
  //     if (error) {
  //       console.error('Session error:', error);
  //       setUser(null);
  //       setTenantId(null);
  //       useUserProfileStore.getState().clearUserProfile();
  //       setLoading(false);
  //       return;
  //     }

  //     setUser(session?.user ?? null);
  //     if (session?.user) {
  //       const tenant_id = await loadUserTenantId(session.user.id);
  //       setTenantId(tenant_id);
  //       if (tenant_id) {
  //         await loadUserProfile(session.user.id, tenant_id);
  //       }
  //     } else {
  //       setTenantId(null);
  //       useUserProfileStore.getState().clearUserProfile();
  //     }
  //     setLoading(false);
  //   }).catch((err) => {
  //     console.error('Failed to get session:', err);
  //     setUser(null);
  //     setTenantId(null);
  //     useUserProfileStore.getState().clearUserProfile();
  //     setLoading(false);
  //   });

  //   // Listen for changes on auth state
  //   const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
  //     console.log('Auth state change:', event);

  //     // Handle explicit sign out
  //     if (event === 'SIGNED_OUT') {
  //       setUser(null);
  //       setTenantId(null);
  //       useUserProfileStore.getState().clearUserProfile();
  //       setLoading(false);
  //       return;
  //     }

  //     // Update user state based on session
  //     setUser(session?.user ?? null);
  //     if (session?.user) {
  //       const tenant_id = await loadUserTenantId(session.user.id);
  //       setTenantId(tenant_id);
  //       if (tenant_id) {
  //         await loadUserProfile(session.user.id, tenant_id);
  //       }
  //     } else {
  //       setTenantId(null);
  //       useUserProfileStore.getState().clearUserProfile();
  //     }
  //     setLoading(false);
  //   });

  //   return () => subscription.unsubscribe();
  // }, []);

  const handleAuthError = (error: AuthError) => {
    switch (error.message) {
      case 'Invalid login credentials':
        setError('Invalid email or password');
        break;
      case 'User already registered':
        setError('An account with this email already exists');
        break;
      default:
        setError(error.message);
    }
  };

  const clearError = () => setError(null);

  const signIn = async (email: string, password: string) => {
    try {
      clearError();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      handleAuthError(error as AuthError);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      clearError();
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: window.location.origin + '/dashboard'
        }
      });
      if (error) throw error;
    } catch (error) {
      handleAuthError(error as AuthError);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      clearError();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      handleAuthError(error as AuthError);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      clearError();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login'
      });
      if (error) throw error;
    } catch (error) {
      handleAuthError(error as AuthError);
      throw error;
    }
  };

  const value = {
    user,
    tenantId,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    clearError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
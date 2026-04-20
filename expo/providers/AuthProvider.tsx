import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

WebBrowser.maybeCompleteAuthSession();

const extractParamsFromUrl = (url: string): Record<string, string> => {
  const params: Record<string, string> = {};
  try {
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');
    if (hashIndex >= 0) {
      const fragment = url.substring(hashIndex + 1);
      for (const pair of fragment.split('&')) {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
      }
    }
    if (queryIndex >= 0) {
      const endIdx = hashIndex >= 0 ? hashIndex : url.length;
      const query = url.substring(queryIndex + 1, endIdx);
      for (const pair of query.split('&')) {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
      }
    }
  } catch (e) {
    console.log('[Auth] Failed to parse url:', e);
  }
  return params;
};

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

const DEMO_USER_ID = 'demo-user-00000000-0000-0000-0000-000000000000';

const DEMO_PROFILE: Profile = {
  id: DEMO_USER_ID,
  email: 'demo@vinewatch.app',
  display_name: 'Demo User',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  useEffect(() => {
    console.log('[Auth] Initializing auth listener...');
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      console.log('[Auth] Initial session:', s ? 'found' : 'none');
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void fetchProfile(s.user.id);
      }
      setIsLoading(false);
      setIsInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      console.log('[Auth] Auth state changed:', _event);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void fetchProfile(s.user.id);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.log('[Auth] Profile fetch error:', error.message);
      } else {
        console.log('[Auth] Profile loaded:', data?.display_name);
        setProfile(data as Profile);
      }
    } catch (e) {
      console.log('[Auth] Profile fetch exception:', e);
    }
  };

  const signUpMutation = useMutation({
    mutationFn: async ({ email, password, displayName }: { email: string; password: string; displayName: string }) => {
      console.log('[Auth] Signing up:', email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });
      if (error) throw error;
      return data;
    },
  });

  const signInMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      console.log('[Auth] Signing in:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    },
  });

  const signInWithGoogleMutation = useMutation({
    mutationFn: async () => {
      console.log('[Auth] Signing in with Google');
      const redirectTo = Platform.OS === 'web'
        ? (typeof window !== 'undefined' ? window.location.origin : '')
        : AuthSession.makeRedirectUri({
            scheme: 'rork-app',
            path: 'login-callback',
          });
      console.log('[Auth] Redirect URI:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No OAuth URL returned');

      if (Platform.OS === 'web') {
        window.location.href = data.url;
        return null;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      console.log('[Auth] OAuth result type:', result.type);

      if (result.type !== 'success' || !result.url) {
        throw new Error('Google sign-in was cancelled');
      }

      const params = extractParamsFromUrl(result.url);
      const accessToken = params.access_token;
      const refreshToken = params.refresh_token;

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
        return null;
      }

      const code = params.code;
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        return null;
      }

      throw new Error('No tokens received from Google sign-in');
    },
  });

  const signInWithAppleMutation = useMutation({
    mutationFn: async () => {
      console.log('[Auth] Signing in with Apple');

      if (Platform.OS === 'web') {
        const redirectTo = typeof window !== 'undefined' ? window.location.origin : '';
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error) throw error;
        if (!data?.url) throw new Error('No OAuth URL returned');
        window.location.href = data.url;
        return null;
      }

      if (Platform.OS !== 'ios') {
        throw new Error('Apple Sign-In is only available on iOS and web');
      }
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Apple Sign-In is not available on this device');
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('[Auth] Apple credential received, user:', credential.user);

      if (!credential.identityToken) {
        throw new Error('No identity token returned from Apple');
      }

      const displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;

      if (displayName && data.user) {
        try {
          await supabase
            .from('profiles')
            .update({ display_name: displayName })
            .eq('id', data.user.id)
            .is('display_name', null);
        } catch (e) {
          console.log('[Auth] Failed to update profile name:', e);
        }
      }

      return data;
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      console.log('[Auth] Signing out');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ displayName }: { displayName: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      setProfile(data as Profile);
      return data;
    },
  });

  const enterDemoMode = useCallback(() => {
    console.log('[Auth] Entering demo mode');
    setIsDemoMode(true);
    setProfile(DEMO_PROFILE);
    setUser({ id: DEMO_USER_ID, email: 'demo@vinewatch.app' } as User);
    setIsLoading(false);
    setIsInitialized(true);
  }, []);

  const signUp = useCallback(
    (email: string, password: string, displayName: string) =>
      signUpMutation.mutateAsync({ email, password, displayName }),
    [signUpMutation]
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      signInMutation.mutateAsync({ email, password }),
    [signInMutation]
  );

  const signInWithGoogle = useCallback(
    () => signInWithGoogleMutation.mutateAsync(),
    [signInWithGoogleMutation]
  );

  const signInWithApple = useCallback(
    () => signInWithAppleMutation.mutateAsync(),
    [signInWithAppleMutation]
  );

  const signOut = useCallback(
    () => {
      if (isDemoMode) {
        console.log('[Auth] Exiting demo mode');
        setIsDemoMode(false);
        setSession(null);
        setUser(null);
        setProfile(null);
        return Promise.resolve();
      }
      return signOutMutation.mutateAsync();
    },
    [signOutMutation, isDemoMode]
  );

  const updateProfile = useCallback(
    (displayName: string) =>
      updateProfileMutation.mutateAsync({ displayName }),
    [updateProfileMutation]
  );

  return useMemo(() => ({
    session,
    user,
    profile,
    isLoading,
    isInitialized,
    isAuthenticated: !!session || isDemoMode,
    isDemoMode,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
    enterDemoMode,
    updateProfile,
    isSigningIn: signInMutation.isPending,
    isSigningUp: signUpMutation.isPending,
    isSigningInWithGoogle: signInWithGoogleMutation.isPending,
    isSigningInWithApple: signInWithAppleMutation.isPending,
    isSigningOut: signOutMutation.isPending,
    signInError: signInMutation.error?.message ?? null,
    signUpError: signUpMutation.error?.message ?? null,
    googleSignInError: signInWithGoogleMutation.error?.message ?? null,
    appleSignInError: signInWithAppleMutation.error?.message ?? null,
  }), [
    session, user, profile, isLoading, isInitialized, isDemoMode,
    signUp, signIn, signInWithGoogle, signInWithApple, signOut, enterDemoMode, updateProfile,
    signInMutation.isPending, signUpMutation.isPending, signOutMutation.isPending,
    signInWithGoogleMutation.isPending, signInWithAppleMutation.isPending,
    signInMutation.error, signUpMutation.error, signInWithGoogleMutation.error,
    signInWithAppleMutation.error,
  ]);
});

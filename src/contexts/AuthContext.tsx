import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'lecturer' | 'student';
  avatar_url?: string;
  department?: string;
  level?: string;
  notification_email?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, role?: string) => Promise<{ error: any }>;
  createUser: (email: string, password: string, userData: any) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isLecturer: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found error
          console.error('Error fetching profile:', error);
        }
        setProfile(null);
        return null;
      }
      
      console.log('Profile fetched successfully:', data);
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    let authSubscription: any = null;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.warn('Session initialization error:', error);
          setLoading(false);
          setInitialized(true);
          return;
        }
        
        console.log('Initial session:', !!session);
        
        // Set session and user first
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch profile if user exists
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
        
        // Mark as initialized
        setLoading(false);
        setInitialized(true);
        
        console.log('Auth initialization complete');
        
      } catch (error) {
        console.warn('Auth initialization failed:', error);
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    // Set up auth state listener AFTER initialization
    const setupAuthListener = () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return;

          console.log('Auth state change:', event, session?.user?.email);
          
          // Handle different auth events
          switch (event) {
            case 'SIGNED_IN':
              setSession(session);
              setUser(session?.user ?? null);
              if (session?.user) {
                await fetchProfile(session.user.id);
              }
              setLoading(false);
              break;
              
            case 'SIGNED_OUT':
              setSession(null);
              setUser(null);
              setProfile(null);
              setLoading(false);
              break;
              
            case 'TOKEN_REFRESHED':
              // Just update session, don't refetch profile
              setSession(session);
              break;
              
            case 'PASSWORD_RECOVERY':
            case 'USER_UPDATED':
              setSession(session);
              setUser(session?.user ?? null);
              if (session?.user) {
                await fetchProfile(session.user.id);
              }
              break;
              
            default:
              // Handle any other events
              setSession(session);
              setUser(session?.user ?? null);
              if (session?.user) {
                await fetchProfile(session.user.id);
              } else {
                setProfile(null);
              }
              break;
          }
        }
      );
      
      authSubscription = subscription;
    };

    // Initialize auth first, then setup listener
    initializeAuth().then(() => {
      if (mounted) {
        setupAuthListener();
      }
    });

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []); // Empty dependency array - only run once

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return { error };
      }
      
      // Don't set loading to false here - let the auth state change handle it
      return { error: null };
    } catch (error: any) {
      setLoading(false);
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role = 'student') => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });
      
      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success!",
          description: "Please check your email to confirm your account.",
        });
      }
      
      return { error };
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const createUser = async (email: string, password: string, userData: any) => {
    try {
      const response = await fetch(`https://btkbqkyfdmbwboutvxda.supabase.co/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0a2Jxa3lmZG1id2JvdXR2eGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNTE1MTAsImV4cCI6MjA3MTcyNzUxMH0.jEzHAvbTJMp3dqSVK-p2rt8vnRHNdAH2CGhUqBWZWQk`,
        },
        body: JSON.stringify({
          email,
          password,
          userData
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }
      
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast({
          title: "Error signing out",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      
      // Loading will be set to false by the auth state change listener
    } catch (error: any) {
      setLoading(false);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isLecturer = profile?.role === 'lecturer';
  const isStudent = profile?.role === 'student';

  const value = {
    user,
    profile,
    session,
    loading,
    initialized,
    signIn,
    signUp,
    createUser,
    signOut,
    isAdmin,
    isLecturer,
    isStudent,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
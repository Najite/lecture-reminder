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
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, role?: string) => Promise<{ error: any }>;
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
  const { toast } = useToast();
  
  // Track ongoing profile fetch to prevent duplicates
  const fetchingProfile = React.useRef<Promise<any> | null>(null);

  const fetchProfile = async (userId: string) => {
    // If we're already fetching this user's profile, return the existing promise
    if (fetchingProfile.current) {
      console.log('Profile fetch already in progress, waiting...');
      return await fetchingProfile.current;
    }

    // Create new fetch promise
    const fetchPromise = (async () => {
      try {
        console.log('Fetching profile for user ID:', userId);
        
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Profile fetch timeout after 10 seconds')), 10000);
        });
        
        // Create the fetch promise
        const fetchPromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        console.log('Starting profile query...');
        
        // Race the promises
        const result = await Promise.race([fetchPromise, timeoutPromise]);
        const { data, error } = result as any;
        
        console.log('Profile query completed:', { data: !!data, error: !!error });

        if (error) {
          if (error.code === 'PGRST116') {
            console.log('Profile not found, user may need to complete setup');
          } else {
            console.error('Error fetching profile:', error);
          }
          setProfile(null);
          return null;
        } else {
          console.log('Profile fetched successfully:', data);
          setProfile(data);
          return data;
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        
        // If it's a timeout, set profile to null but don't block the app
        if (error instanceof Error && error.message.includes('timeout')) {
          console.warn('Profile fetch timed out, continuing without profile');
          setProfile(null);
        }
        
        return null;
      } finally {
        // Clear the fetching reference when done
        fetchingProfile.current = null;
      }
    })();

    // Store the promise reference
    fetchingProfile.current = fetchPromise;
    
    return await fetchPromise;
  };

  useEffect(() => {
    let mounted = true;
    let initialLoadComplete = false;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth state changed:', event, !!session);
        
        // Skip token refresh events to prevent unnecessary calls
        if (event === 'TOKEN_REFRESHED') {
          setSession(session);
          return;
        }

        // Skip INITIAL_SESSION if we've already handled the initial load
        if (event === 'INITIAL_SESSION' && initialLoadComplete) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          console.log('Calling fetchProfile from auth state change');
          await fetchProfile(session.user.id);
          console.log('fetchProfile completed from auth state change');
        } else if (!session || event === 'SIGNED_OUT') {
          setProfile(null);
        }

        // Mark initial load as complete after handling INITIAL_SESSION
        if (event === 'INITIAL_SESSION') {
          initialLoadComplete = true;
          console.log('Setting loading to false from INITIAL_SESSION');
          setLoading(false);
        } else if (event === 'SIGNED_IN' && initialLoadComplete) {
          console.log('Setting loading to false from SIGNED_IN after initial load');
          setLoading(false);
        }
      }
    );

    // Check for existing session on mount
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (error) {
          console.error('Error getting session:', error);
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        console.log('Initial session check:', !!session);
        
        // If no session, we're done
        if (!session) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          initialLoadComplete = true;
          return;
        }

        // Set session and user
        setSession(session);
        setUser(session.user);
        
        // Fetch profile
        console.log('Fetching profile for user:', session.user.email);
        await fetchProfile(session.user.id);
        console.log('Profile fetch completed in initialization');
        
        // Mark as complete
        initialLoadComplete = true;
        setLoading(false);
        console.log('Auth initialization complete');
        
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          initialLoadComplete = true;
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
      }
      // Don't set loading to false here - let the auth state change handle it
      
      return { error };
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

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
    signIn,
    signUp,
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
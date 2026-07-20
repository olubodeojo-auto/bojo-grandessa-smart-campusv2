import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type {
  Session,
  User,
  AuthChangeEvent,
  AuthError,
  PostgrestError,
} from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const authError = error as Partial<AuthError>;
    const postgrestError = error as Partial<PostgrestError>;

    if (typeof authError.message === "string" && authError.message.trim()) {
      return authError.message;
    }

    if (typeof postgrestError.message === "string" && postgrestError.message.trim()) {
      return postgrestError.message;
    }
  }

  return "Something went wrong. Please try again.";
}

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  fullName: string;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface UserProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

interface UserRoleJoinRow {
  id: string;
  user_id: string;
  role_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  roles: {
    id: string;
    name: string;
  } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const sessionRef = useRef<Session | null>(null);
  const userRef = useRef<User | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const roleRef = useRef<Role | null>(null);
  const profileLoadPromiseRef = useRef<Promise<void> | null>(null);
  const profileRequestIdRef = useRef<number>(0);
  const activeProfileUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const loadProfile = useCallback(async (userId: string): Promise<void> => {
    if (!userId) {
      return;
    }

    if (activeProfileUserIdRef.current === userId && profileLoadPromiseRef.current) {
      return profileLoadPromiseRef.current;
    }

    const requestId = profileRequestIdRef.current + 1;
    profileRequestIdRef.current = requestId;
    activeProfileUserIdRef.current = userId;

    const request = (async (): Promise<void> => {
      try {
        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("users")
          .select("id, first_name, last_name, phone, status, created_at, updated_at")
          .eq("id", userId)
          .maybeSingle<UserProfileRow>();

        if (profileError) {
          throw profileError;
        }

        if (!isMountedRef.current || requestId !== profileRequestIdRef.current) {
          return;
        }

        if (!profileData) {
          setProfile(null);
          setRole(null);
          setError(null);
          return;
        }

        setProfile(profileData);

        const roleSelect =
          "id, user_id, role_id, start_date, end_date, is_active, created_at, roles(id, name)";

        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select(roleSelect)
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle<UserRoleJoinRow>();

        if (roleError) {
          throw roleError;
        }

        if (!isMountedRef.current || requestId !== profileRequestIdRef.current) {
          return;
        }

        if (roleData?.roles) {
          setRole({
            id: roleData.roles.id,
            name: roleData.roles.name,
          });
        } else {
          setRole(null);
        }

        setError(null);
      } catch (err) {
        if (!isMountedRef.current || requestId !== profileRequestIdRef.current) {
          return;
        }

        setError(getErrorMessage(err as Error));
        setProfile(null);
        setRole(null);
      }
    })();

    profileLoadPromiseRef.current = request;

    try {
      await request;
    } finally {
      if (profileLoadPromiseRef.current === request) {
        profileLoadPromiseRef.current = null;
      }
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    const activeUserId = sessionRef.current?.user?.id ?? userRef.current?.id;

    if (!activeUserId) {
      return;
    }

    await loadProfile(activeUserId);
  }, [loadProfile]);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      if (!isMountedRef.current) {
        return;
      }

      profileRequestIdRef.current += 1;
      activeProfileUserIdRef.current = null;
      profileLoadPromiseRef.current = null;
      sessionRef.current = null;
      userRef.current = null;
      profileRef.current = null;
      roleRef.current = null;

      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }

      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    const initializeAuth = async (): Promise<void> => {
      try {
        const {
          data: { session: initialSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!isActive) {
          return;
        }

        sessionRef.current = initialSession;
        userRef.current = initialSession?.user ?? null;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          setLoading(true);
          await loadProfile(initialSession.user.id);
        }
      } catch (err) {
        if (!isActive) {
          return;
        }

        setError(getErrorMessage(err));
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        if (!isActive) {
          return;
        }

        try {
          switch (event) {
            case "SIGNED_IN": {
              sessionRef.current = newSession;
              userRef.current = newSession?.user ?? null;

              setSession(newSession);
              setUser(newSession?.user ?? null);

              if (newSession?.user) {
                setLoading(true);
                await loadProfile(newSession.user.id);
                if (isActive) {
                  setLoading(false);
                }
              }

              break;
            }

            case "SIGNED_OUT": {
              profileRequestIdRef.current += 1;
              activeProfileUserIdRef.current = null;
              profileLoadPromiseRef.current = null;
              sessionRef.current = null;
              userRef.current = null;
              profileRef.current = null;
              roleRef.current = null;

              setSession(null);
              setUser(null);
              setProfile(null);
              setRole(null);
              setLoading(false);

              break;
            }

            case "TOKEN_REFRESHED": {
              sessionRef.current = newSession;
              userRef.current = newSession?.user ?? null;

              setSession(newSession);
              setUser(newSession?.user ?? null);

              if (
                newSession?.user &&
                (sessionRef.current?.user?.id !== newSession.user.id ||
                  !profileRef.current ||
                  profileRef.current.id !== newSession.user.id ||
                  !roleRef.current)
              ) {
                await loadProfile(newSession.user.id);
              }

              break;
            }

            case "USER_UPDATED": {
              sessionRef.current = newSession;
              userRef.current = newSession?.user ?? null;

              setSession(newSession);
              setUser(newSession?.user ?? null);

              if (newSession?.user) {
                await loadProfile(newSession.user.id);
              }

              break;
            }

            default: {
              sessionRef.current = newSession;
              userRef.current = newSession?.user ?? null;

              setSession(newSession);
              setUser(newSession?.user ?? null);

              break;
            }
          }
        } catch (err) {
          if (!isActive) {
            return;
          }

          setError(getErrorMessage(err));
          setLoading(false);
        }
      }
    );

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const fullName = useMemo<string>(() => {
    if (!profile) {
      return "";
    }

    const nameParts = [profile.first_name, profile.last_name].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );

    return nameParts.join(" ").trim();
  }, [profile]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      role,
      fullName,
      isAuthenticated: Boolean(session),
      loading,
      error,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, role, fullName, loading, error, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }

  return context;
}

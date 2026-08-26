import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { subscribeAuth, getCurrentAuthUser } from "@/features/auth/services/auth.service";
import { COLLECTIONS, getById } from "@/lib/firebase/repo";
import type { AppRole, AuthUser } from "@/types/roles";
import type { UserProfile } from "@/types/user";
import { claimsRoleToAppRole } from "@/types/roles";

export type { AppRole, AuthUser };

type SessionValue = {
  session: AuthUser | null;
  user: AuthUser | null;
  loading: boolean;
};

const SessionContext = createContext<SessionValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getCurrentAuthUser()
      .then((current) => {
        if (!active) return;
        setUser(current);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setLoading(false);
      });
    const unsub = subscribeAuth((next) => {
      setUser(next);
      setLoading(false);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ session: user, user, loading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (ctx) return ctx;
  return { session: null, user: null, loading: true };
}

export function useProfile(user: AuthUser | null) {
  const id = user?.id;
  return useQuery({
    queryKey: ["profile", id],
    enabled: !!id,
    staleTime: 5 * 60_000,
    queryFn: async () => getById<UserProfile>(COLLECTIONS.users, id!),
  });
}

export function useRole(user: AuthUser | null) {
  const id = user?.id;
  return useQuery({
    queryKey: ["role", id],
    enabled: !!id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AppRole | null> => {
      let fromClaims: AppRole | null = null;
      const authUser = getFirebaseAuth().currentUser;
      if (authUser) {
        const token = await authUser.getIdTokenResult(true);
        if (typeof token.claims["role"] === "string" && token.claims["role"]) {
          fromClaims = claimsRoleToAppRole(token.claims["role"]);
        }
      }
      let fromProfile: AppRole | null = null;
      try {
        const row = await getById<UserProfile>(COLLECTIONS.users, id!);
        if (row?.role) {
          fromProfile = row.role === "admin" ? "institution" : row.role;
        }
      } catch {
        fromProfile = null;
      }
      // Prefer the Firestore school-operator role when claims are stale (e.g. still "student").
      if (fromProfile === "institution" || fromProfile === "superadmin") {
        return fromProfile;
      }
      if (fromClaims) return fromClaims;
      return fromProfile;
    },
  });
}

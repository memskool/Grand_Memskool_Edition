import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { subscribeAuth, getCurrentAuthUser } from "@/features/auth/services/auth.service";
import { COLLECTIONS, getById } from "@/lib/firebase/repo";
import type { AppRole, AuthUser } from "@/types/roles";
import type { UserProfile } from "@/types/user";
import { claimsRoleToAppRole } from "@/types/roles";
import { loadMyAccount } from "@/features/auth/services/session-account.functions";
import { readCachedProfile, writeCachedProfile } from "@/features/auth/account-cache";
import { isProfileComplete } from "@/features/auth/account-state";

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
    let signOutTimer: ReturnType<typeof setTimeout> | undefined;
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
      if (!active) return;
      if (signOutTimer) {
        clearTimeout(signOutTimer);
        signOutTimer = undefined;
      }
      if (!next) {
        // Tab focus / IndexedDB can emit a brief null; do not wipe the session instantly.
        signOutTimer = setTimeout(() => {
          if (!active) return;
          if (!getFirebaseAuth().currentUser) {
            setUser(null);
            setLoading(false);
          }
        }, 750);
        return;
      }
      setUser(next);
      setLoading(false);
    });
    return () => {
      active = false;
      if (signOutTimer) clearTimeout(signOutTimer);
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

function unwrapProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj["full_name"] === "string" && typeof obj["role"] === "string") {
    return raw as UserProfile;
  }
  for (const key of ["data", "result", "payload", "value"]) {
    const inner = obj[key];
    if (inner && typeof inner === "object") {
      const nested = unwrapProfile(inner);
      if (nested) return nested;
    }
  }
  return null;
}

export function useProfile(user: AuthUser | null) {
  const id = user?.id;
  return useQuery({
    queryKey: ["profile", id],
    enabled: !!id,
    staleTime: 5 * 60_000,
    retry: 2,
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<UserProfile | null> => {
      try {
        const fromServer = unwrapProfile(await loadMyAccount());
        if (fromServer && isProfileComplete(fromServer)) {
          writeCachedProfile(fromServer);
          return fromServer;
        }
      } catch (error) {
        console.error("[profile] loadMyAccount failed:", error);
      }
      try {
        const fromClient = await getById<UserProfile>(COLLECTIONS.users, id!);
        if (fromClient && isProfileComplete(fromClient)) {
          writeCachedProfile(fromClient);
          return fromClient;
        }
      } catch {
        // Client rules can fail while the Admin SDK profile is still valid in cache.
      }
      return readCachedProfile(id!);
    },
  });
}

export function useRole(user: AuthUser | null) {
  const id = user?.id;
  const profile = useProfile(user);
  return useQuery({
    queryKey: ["role", id, profile.dataUpdatedAt],
    enabled: !!id && profile.isFetched,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AppRole | null> => {
      if (profile.data?.role) {
        return profile.data.role === "admin" ? "institution" : profile.data.role;
      }
      const cached = id ? readCachedProfile(id) : null;
      if (cached?.role) {
        return cached.role === "admin" ? "institution" : cached.role;
      }
      let fromClaims: AppRole | null = null;
      const authUser = getFirebaseAuth().currentUser;
      if (authUser) {
        const token = await authUser.getIdTokenResult();
        if (typeof token.claims["role"] === "string" && token.claims["role"]) {
          fromClaims = claimsRoleToAppRole(token.claims["role"]);
        }
      }
      return fromClaims;
    },
  });
}

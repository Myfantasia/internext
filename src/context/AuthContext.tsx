import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { User, UserLocation } from '../types';
import { SESSION_EXPIRED_EVENT, currentPathWithQuery } from '../utils/session';
import { navigate } from '../utils/navigation';

interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
  /** Machine-readable reason, e.g. USE_STAFF_PORTAL, PHONE_TAKEN. */
  code?: string;
  /** The field a duplicate/validation error refers to. */
  field?: string;
}

export type LoginPortal = 'store' | 'staff';

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  referralCode?: string;
  location: UserLocation;
}

interface AuthContextType {
  user: User | null;
  permissions: string[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSalesManager: boolean;
  isStaff: boolean;
  isLoading: boolean;
  /** When the current session ends (absolute 3-hour lifetime). */
  sessionExpiresAt: Date | null;
  can: (permission: string) => boolean;
  /** `portal` is the sign-in page used: customers use the store, staff the staff portal. */
  login: (email: string, password: string, portal?: LoginPortal) => Promise<AuthResult>;
  /** Creates the account only — the user must sign in afterwards. */
  register: (input: RegisterInput) => Promise<AuthResult>;
  registerStaff: (name: string, email: string, phone: string, password: string, invitationCode?: string) => Promise<AuthResult>;
  /** Signs out and returns to the home page (staff: the staff portal sign-in). */
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  changeEmail: (email: string, currentPassword: string) => Promise<AuthResult>;
  logoutAllDevices: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'phone' | 'avatar'>> & { location?: UserLocation }) => Promise<AuthResult>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

const STAFF_ROLES = ['ADMIN', 'SALES_MANAGER'];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const clearAuth = () => {
    setUser(null);
    setPermissions([]);
    setSessionExpiresAt(null);
  };

  // Signs the user out locally and sends them to the right login page with a
  // safe return path, so they land back where they were after signing in.
  const handleExpiredSession = useCallback(() => {
    const previous = userRef.current;
    if (!previous) return;
    clearAuth();
    const isStaff = STAFF_ROLES.includes(previous.role) && window.location.pathname.startsWith('/admin');
    const loginPath = isStaff ? '/admin/login' : '/auth';
    navigate(`${loginPath}?reason=expired&redirect=${encodeURIComponent(currentPathWithQuery())}`);
  }, []);

  const applySession = (data: any) => {
    setUser(data?.user || null);
    setPermissions(data?.permissions || []);
    setSessionExpiresAt(data?.sessionExpiresAt ? new Date(data.sessionExpiresAt) : null);
  };

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      applySession(await parseJson(res));
    } catch {
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  // Server says the session is gone (any API response).
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, [handleExpiredSession]);

  // Timer for the moment the session's 3 hours run out, so the UI does not
  // keep showing private data after expiry. The server enforces it regardless.
  useEffect(() => {
    if (!sessionExpiresAt || !user) return;
    const ms = sessionExpiresAt.getTime() - Date.now();
    if (ms <= 0) {
      handleExpiredSession();
      return;
    }
    // setTimeout cannot exceed ~24.8 days; sessions are far shorter.
    const timer = window.setTimeout(() => {
      // Confirm with the server (clock skew), which also clears the cookie.
      fetch('/api/auth/me', { cache: 'no-store' }).then(parseJson).then((data) => {
        if (!data?.user) handleExpiredSession();
        else applySession(data);
      }).catch(handleExpiredSession);
    }, ms + 1000);
    return () => window.clearTimeout(timer);
  }, [sessionExpiresAt, user, handleExpiredSession]);

  // Re-check when the tab regains focus (laptop wakes after hours asleep).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && userRef.current && sessionExpiresAt && sessionExpiresAt.getTime() <= Date.now()) {
        handleExpiredSession();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [sessionExpiresAt, handleExpiredSession]);

  const login = async (email: string, password: string, portal: LoginPortal = 'store'): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, portal })
      });
      const data = await parseJson(res);
      if (res.ok && data?.success) {
        applySession(data);
        return { success: true, user: data.user };
      }
      return { success: false, message: data?.message || 'Invalid email or password', code: data?.code };
    } catch {
      return { success: false, message: 'Unable to reach the server. Please try again.' };
    }
  };

  const register = async (input: RegisterInput): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      const data = await parseJson(res);
      if (res.ok && data?.success) return { success: true, message: data.message };
      return { success: false, message: data?.message || 'Unable to create account', code: data?.code, field: data?.field };
    } catch {
      return { success: false, message: 'Unable to reach the server. Please try again.' };
    }
  };

  const registerStaff = async (name: string, email: string, phone: string, password: string, invitationCode?: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/staff-register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone: phone || undefined, password, invitationCode })
      });
      const data = await parseJson(res);
      if (res.ok && data?.success) return { success: true, message: data.message };
      return { success: false, message: data?.message || 'Unable to create staff account', code: data?.code, field: data?.field };
    } catch {
      return { success: false, message: 'Unable to reach the server. Please try again.' };
    }
  };

  // Leave protected pages before clearing the user, so the route guard never
  // sees a signed-out user on /customer/... and bounces to the sign-in page.
  const leaveAfterSignOut = (previous: User | null) => {
    const wasStaff = !!previous && STAFF_ROLES.includes(previous.role);
    navigate(wasStaff ? '/admin/login' : '/');
  };

  const logout = async () => {
    const previous = userRef.current;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      leaveAfterSignOut(previous);
      clearAuth();
    }
  };

  const logoutAllDevices = async () => {
    const previous = userRef.current;
    try {
      await fetch('/api/auth/logout-all', { method: 'POST' });
    } finally {
      leaveAfterSignOut(previous);
      clearAuth();
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await parseJson(res);
      if (res.ok && data?.success) {
        if (data.sessionExpiresAt) setSessionExpiresAt(new Date(data.sessionExpiresAt));
        return { success: true, message: data.message };
      }
      return { success: false, message: data?.message || 'Unable to change password' };
    } catch {
      return { success: false, message: 'Unable to reach the server. Please try again.' };
    }
  };

  const changeEmail = async (email: string, currentPassword: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/email', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, currentPassword })
      });
      const data = await parseJson(res);
      if (res.ok && data?.success) {
        setUser(data.user);
        return { success: true, message: data.message };
      }
      return { success: false, message: data?.message || 'Unable to change email', code: data?.code };
    } catch {
      return { success: false, message: 'Unable to reach the server. Please try again.' };
    }
  };

  const updateProfile = async (patch: Partial<Pick<User, 'name' | 'phone' | 'avatar'>> & { location?: UserLocation }): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const data = await parseJson(res);
      if (res.ok && data?.success) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, message: data?.message || 'Unable to update profile', code: data?.code, field: data?.field };
    } catch {
      return { success: false, message: 'Unable to reach the server. Please try again.' };
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'ADMIN';
  const isSalesManager = user?.role === 'SALES_MANAGER';
  const isStaff = isAdmin || isSalesManager;
  const can = (permission: string) => permissions.includes(permission);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isAuthenticated,
        isAdmin,
        isSalesManager,
        isStaff,
        isLoading,
        sessionExpiresAt,
        can,
        login,
        register,
        registerStaff,
        logout,
        logoutAllDevices,
        changePassword,
        changeEmail,
        updateProfile,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

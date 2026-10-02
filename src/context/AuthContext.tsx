import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  permissions: string[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSalesManager: boolean;
  isStaff: boolean;
  isLoading: boolean;
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, phone: string, password: string, referralCode?: string) => Promise<AuthResult>;
  registerStaff: (name: string, email: string, phone: string, password: string, invitationCode?: string, referralCode?: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'phone' | 'avatar'>>) => Promise<AuthResult>;
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await parseJson(res);
      setUser(data?.user || null);
      setPermissions(data?.permissions || []);
    } catch {
      setUser(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await parseJson(res);
      if (res.ok && data?.success) {
        setUser(data.user);
        setPermissions(data.permissions || []);
        return { success: true, user: data.user };
      }
      return { success: false, message: data?.message || 'Invalid email or password' };
    } catch {
      return { success: false, message: 'Unable to reach the server. Please try again.' };
    }
  };

  const register = async (name: string, email: string, phone: string, password: string, referralCode?: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, referralCode })
      });
      const data = await parseJson(res);
      if (res.ok && data?.success) {
        setUser(data.user);
        setPermissions(data.permissions || []);
        return { success: true };
      }
      return { success: false, message: data?.message || 'Unable to create account' };
    } catch {
      return { success: false, message: 'Unable to reach the server. Please try again.' };
    }
  };

  const registerStaff = async (name: string, email: string, phone: string, password: string, invitationCode?: string, referralCode?: string): Promise<AuthResult> => {
    try {
      const res = await fetch('/api/auth/staff-register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, invitationCode, referralCode })
      });
      const data = await parseJson(res);
      if (res.ok && data?.success) {
        setUser(data.user);
        setPermissions(data.permissions || []);
        return { success: true, user: data.user };
      }
      return { success: false, message: data?.message || 'Unable to create staff account' };
    } catch {
      return { success: false, message: 'Unable to reach the server. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setPermissions([]);
    }
  };

  const logoutAllDevices = async () => {
    try {
      await fetch('/api/auth/logout-all', { method: 'POST' });
    } finally {
      setUser(null);
      setPermissions([]);
    }
  };

  const updateProfile = async (patch: Partial<Pick<User, 'name' | 'phone' | 'avatar'>>): Promise<AuthResult> => {
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
      return { success: false, message: data?.message || 'Unable to update profile' };
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
        can,
        login,
        register,
        registerStaff,
        logout,
        logoutAllDevices,
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

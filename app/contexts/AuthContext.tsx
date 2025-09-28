"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (userName: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('current_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.warn('Invalid stored user data:', error);
        localStorage.removeItem('current_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (userName: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // 这里可以替换为实际的数据库查询
      // 暂时使用简单的用户管理逻辑
      const mockUsers: Record<string, { role: 'admin' | 'user' }> = {
        '管理员': { role: 'admin' },
        '经理': { role: 'admin' },
        '室友A': { role: 'user' },
        '室友B': { role: 'user' },
        '室友C': { role: 'user' }
      };

      const userData = mockUsers[userName];
      if (userData) {
        const newUser: User = {
          id: userName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: userName,
          role: userData.role,
          isActive: true
        };

        setUser(newUser);
        localStorage.setItem('current_user', JSON.stringify(newUser));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('current_user');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isLoading,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
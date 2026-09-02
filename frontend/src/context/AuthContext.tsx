"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, AuthResponse } from "@/lib/types";
import { apiFetch } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const storedToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!storedToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const userData = await apiFetch<User>("/auth/me", {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (isMounted) {
          setToken(storedToken);
          setUser(userData);
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (emailOrUsername: string, password: string) => {
    const response = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email_or_username: emailOrUsername,
        password,
      }),
    });

    localStorage.setItem("token", response.access_token);
    setToken(response.access_token);
    setUser(response.user);
  };

  const register = async (username: string, email: string, password: string, fullName?: string) => {
    await apiFetch<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        username,
        email,
        password,
        full_name: fullName || null,
      }),
    });

    // Auto-login upon successful registration
    await login(email, password);
  };

  const logout = () => {
    const currentToken = localStorage.getItem("token");
    if (currentToken) {
      apiFetch("/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => {
        // Ignore network errors during client logout
      });
    }
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      try {
        const userData = await apiFetch<User>("/auth/me", {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        setUser(userData);
      } catch {
        setUser(null);
      }
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "ADMIN",
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

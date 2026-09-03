"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";
  const { login, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    emailOrUsername: "",
    password: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  if (isAuthenticated) {
    router.push(redirectUrl);
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.emailOrUsername.trim() || !formData.password) {
      setError("Please enter both email/username and password.");
      return;
    }

    setIsLoading(true);
    try {
      await login(formData.emailOrUsername.trim(), formData.password);
      router.push(redirectUrl);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid email/username or password.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Background with Subtle Bangladesh Artwork */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/brand/bangladesh-hero-bg.jpg"
          alt="Bangladesh Heritage Artwork"
          fill
          className="object-cover object-center opacity-25"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/85 via-zinc-950/90 to-zinc-950/95" />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md space-y-6 bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 relative rounded-2xl overflow-hidden shadow-md border border-emerald-700/30 mb-3">
            <Image
              src="/brand/logo-sm.jpg"
              alt="Bangladesh Citizen Report Emblem"
              fill
              className="object-cover"
              priority
            />
          </div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            Sign In to Citizen Report
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Access your verified incident submissions, alerts, and citizen dashboard.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/50 p-3.5 border border-red-200 dark:border-red-900">
            <p className="text-xs font-semibold text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Email Address or Username <span className="text-red-500">*</span>
            </label>
            <input
              name="emailOrUsername"
              type="text"
              required
              value={formData.emailOrUsername}
              onChange={handleChange}
              placeholder="e.g. citizen@example.com"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white py-2.5 text-xs font-bold shadow-md shadow-emerald-800/20 disabled:opacity-50 transition active:scale-98"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="text-center text-xs text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          Don&apos;t have an account yet?{" "}
          <Link href="/register" className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
            Register as Citizen
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

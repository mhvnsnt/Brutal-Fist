'use client';

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'login' | 'signup';

interface AuthScreenProps {
  onSuccess: () => void;
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        onSuccess();
      } else {
        await signUp(email, password, { fullName: username });
        setSuccessMsg('CHECK YOUR EMAIL TO CONFIRM YOUR ACCOUNT');
      }
    } catch (err: any) {
      setError(err?.message ?? 'AUTHENTICATION FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono overflow-hidden">
      {/* Atmospheric bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #1c1c2e 0%, #000 80%)' }}
      />
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px)`,
        }}
      />

      <div className="relative z-10 w-[min(90vw,380px)]">
        {/* Title */}
        <div className="mb-8 text-center">
          <div className="text-[8px] tracking-[0.55em] text-zinc-600 mb-1">SCHWARZERBLITZ RUNTIME</div>
          <div className="text-3xl font-black tracking-[0.18em] text-white">BRUTAL FIST</div>
          <div className="mt-3 text-[9px] tracking-[0.4em] text-zinc-500">
            {mode === 'login' ? 'PLAYER LOGIN' : 'CREATE ACCOUNT'}
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex mb-6 border border-zinc-800">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
            className="flex-1 py-2.5 text-[9px] font-black tracking-widest transition-all"
            style={{
              background: mode === 'login' ? '#facc15' : 'transparent',
              color: mode === 'login' ? '#000' : '#52525b',
            }}
          >
            LOGIN
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
            className="flex-1 py-2.5 text-[9px] font-black tracking-widest transition-all"
            style={{
              background: mode === 'signup' ? '#facc15' : 'transparent',
              color: mode === 'signup' ? '#000' : '#52525b',
            }}
          >
            SIGN UP
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="block text-[8px] tracking-[0.4em] text-zinc-600 mb-1.5">FIGHTER TAG</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="ENTER YOUR TAG"
                className="w-full bg-zinc-900 border border-zinc-700 px-4 py-3 text-[11px] text-white placeholder-zinc-700 focus:outline-none focus:border-yellow-400 transition-colors tracking-wider"
                autoComplete="username"
              />
            </div>
          )}

          <div>
            <label className="block text-[8px] tracking-[0.4em] text-zinc-600 mb-1.5">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="PLAYER@EMAIL.COM"
              required
              className="w-full bg-zinc-900 border border-zinc-700 px-4 py-3 text-[11px] text-white placeholder-zinc-700 focus:outline-none focus:border-yellow-400 transition-colors tracking-wider"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-[8px] tracking-[0.4em] text-zinc-600 mb-1.5">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full bg-zinc-900 border border-zinc-700 px-4 py-3 text-[11px] text-white placeholder-zinc-700 focus:outline-none focus:border-yellow-400 transition-colors tracking-wider"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="border border-red-900/60 bg-red-950/30 px-4 py-2.5">
              <div className="text-[9px] text-red-400 tracking-wider">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="border border-green-900/60 bg-green-950/30 px-4 py-2.5">
              <div className="text-[9px] text-green-400 tracking-wider">{successMsg}</div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 text-[11px] font-black tracking-[0.35em] transition-all mt-2"
            style={{
              background: loading ? '#27272a' : '#facc15',
              color: loading ? '#52525b' : '#000',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'PROCESSING...' : mode === 'login' ? 'ENTER ARENA' : 'CREATE FIGHTER'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <div className="text-[7px] tracking-[0.3em] text-zinc-700">
            {mode === 'login' ? 'NEW PLAYER? ' : 'ALREADY REGISTERED? '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setSuccessMsg(null); }}
              className="text-zinc-500 hover:text-yellow-400 transition-colors underline underline-offset-2"
            >
              {mode === 'login' ? 'CREATE ACCOUNT' : 'LOGIN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

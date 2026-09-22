import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(loginData.username, loginData.password);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to login. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillRole = (email: string) => {
    setLoginData({ username: email, password: '123456' });
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50 flex flex-col justify-center items-center px-4 py-4 sm:py-6 overflow-y-auto relative text-zinc-900 font-sans">
      {/* Wrapper */}
      <div className="w-full max-w-md my-auto py-2">
        {/* Header Section */}
        <div className="flex flex-col items-center mb-3 sm:mb-4 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-1 mb-2 shadow-md border border-zinc-200/80 ring-4 ring-indigo-50 flex items-center justify-center overflow-hidden">
            {/* Logo Image */}
            <img
              src="/logo.jpeg"
              alt="FieldSync Logo"
              className="w-full h-full rounded-xl object-cover"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">FieldSync</h1>
          <p className="text-zinc-500 mt-0.5 text-xs sm:text-sm font-medium">
            Academic &amp; Field Inspection Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full">
          <div className="p-4 sm:p-6 rounded-3xl bg-white border border-zinc-200/80 shadow-md">
            <div className="mb-3.5 text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-900">Portal Login</h2>
              <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">Please enter your credentials</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              {/* Username / Email Field */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 mb-1 block">
                  Email ID / Register Number
                </label>
                <input
                  type="text"
                  placeholder="Enter Email ID or Register Number"
                  value={loginData.username}
                  onChange={(e) => setLoginData((prev) => ({ ...prev, username: e.target.value }))}
                  required
                  autoFocus
                  className="w-full h-11 px-4 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm bg-white text-zinc-900 placeholder:text-zinc-400 truncate"
                />
              </div>

              {/* Password Field */}
              <div>
                <label className="text-xs font-semibold text-zinc-700 mb-1 block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e) => setLoginData((prev) => ({ ...prev, password: e.target.value }))}
                    required
                    className="w-full h-11 px-4 pr-12 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm bg-white text-zinc-900 placeholder:text-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors p-1"
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => alert('Password recovery: Contact supervisor or reset via Supabase Auth.')}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-2xl text-xs font-semibold border flex items-start gap-2.5 bg-red-50 border-red-200 text-red-700">
                  <span className="text-sm shrink-0 mt-0.5">⚠️</span>
                  <div className="leading-relaxed">{error}</div>
                </div>
              )}

              {/* Sign In Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 py-2.5 sm:py-3 px-4 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 active:scale-95 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center mt-1"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>

              {/* Predefined Role Fast Login Banner */}
              <div className="pt-3 mt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => fillRole('elakkiya@gmail.com')}
                  className="w-full text-left p-2.5 sm:p-3 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-pink-50/30 hover:from-indigo-100/80 hover:to-purple-100/60 border border-indigo-200/80 hover:border-indigo-400 rounded-2xl transition-all duration-200 cursor-pointer group shadow-sm flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white border border-indigo-200/80 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 group-hover:border-indigo-300 transition-all">
                      ⚡
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                        Field Technician (Elakkiya)
                      </p>
                      <p className="text-[11px] text-zinc-500 font-medium truncate">
                        elakkiya@gmail.com · pass: 123456
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 px-2 py-1 bg-white group-hover:bg-indigo-600 group-hover:text-white text-indigo-600 text-xs font-bold rounded-lg border border-indigo-200 group-hover:border-indigo-600 shadow-sm transition-all flex items-center gap-0.5">
                    Select →
                  </span>
                </button>
              </div>

              {/* Role Fast Pickers */}
              <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
                <span>Fast login:</span>
                <button
                  type="button"
                  onClick={() => fillRole('tharun@gmail.com')}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  Tharun (Admin)
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => fillRole('abi@gmail.com')}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  Abi (Supervisor)
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => fillRole('elakkiya@gmail.com')}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  Elakkiya (Technician)
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export const AdminLogin = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fixed single admin credentials
  const MASTER_USER = 'Mittal';
  const MASTER_PASS = 'MittalStore#2026!Secure';

  const handleSubmit = (e) => {
    e?.preventDefault();
    setErrorMsg('');

    if (username.trim() === MASTER_USER && password === MASTER_PASS) {
      try {
        localStorage.setItem(
          'admin_session',
          JSON.stringify({ user: MASTER_USER, loggedInAt: Date.now() })
        );
        localStorage.setItem('jal_jivan_admin_logged_in', 'true');
      } catch (err) {
        console.error('Failed to store admin session in localStorage', err);
      }
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } else {
      setErrorMsg('Invalid Username or Password.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4 animate-fade-in">
      <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 backdrop-blur-xl p-8 rounded-3xl shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h2>
          <p className="text-xs text-slate-400">
            Sign in with master credentials to access dispatch management
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Admin User ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                id="admin-username-input"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter User ID"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="admin-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <button
            id="admin-login-submit-btn"
            type="submit"
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <span>Sign In to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;

import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, ArrowRight, KeyRound, Users } from 'lucide-react';

export const AdminLogin = ({ onLoginSuccess, onNavigateToStaffLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Master admin credentials (Password and Master PIN accepted)
  const MASTER_USER = 'Mittal';
  const MASTER_PASS = 'MittalStore#2026!Secure';
  const MASTER_PINS = ['2026', '1225', '9999'];

  const handleSubmit = (e) => {
    e?.preventDefault();
    setErrorMsg('');

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    const isUserValid = cleanUser === MASTER_USER.toLowerCase() || cleanUser === 'admin';
    const isPassValid = cleanPass === MASTER_PASS || MASTER_PINS.includes(cleanPass);

    if (isUserValid && isPassValid) {
      try {
        const sessionData = {
          user: MASTER_USER,
          role: 'admin',
          token: `adm_${Date.now()}`,
          loggedInAt: Date.now()
        };
        localStorage.setItem('admin_session', JSON.stringify(sessionData));
        localStorage.setItem('jal_jivan_admin_logged_in', 'true');
      } catch (err) {
        console.error('Failed to store admin session in localStorage', err);
      }
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } else {
      setErrorMsg('Invalid Admin User ID, Password, or Master PIN.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4 py-8 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 backdrop-blur-xl p-7 sm:p-8 rounded-3xl shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-600 to-teal-500 border border-emerald-500/30 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Owner & Admin Sign In</h2>
          <p className="text-xs text-slate-400">
            Exclusive Master Admin sign in with Password or 4-digit Master PIN
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
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
                placeholder="Enter Admin ID (e.g. Mittal)"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Password or Master PIN
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
                placeholder="Enter password or Master PIN"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <button
            id="admin-login-submit-btn"
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <span>Sign In to Admin Hub</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Switch to Staff Login */}
        <div className="pt-4 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400">
            Delivery Staff or Operations Member?{' '}
            <button
              type="button"
              onClick={onNavigateToStaffLogin}
              className="text-cyan-400 hover:text-cyan-300 font-bold underline transition ml-1 inline-flex items-center gap-1"
            >
              <Users className="w-3.5 h-3.5 inline" />
              <span>Go to Staff Sign-In →</span>
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

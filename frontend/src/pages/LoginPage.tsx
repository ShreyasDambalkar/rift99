import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Dna, Loader2, AlertCircle } from 'lucide-react';

export const LoginPage = () => {
    const [tab, setTab] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handle = async () => {
        setLoading(true); setError(null); setMessage(null);
        if (tab === 'login') {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) setError(error.message);
        } else {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) setError(error.message);
            else setMessage('Account created! Check your email to confirm, then log in.');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-8">
                {/* Brand */}
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-blue-600 text-white p-3 rounded-xl mb-3 shadow-lg shadow-blue-600/25">
                        <Dna className="h-7 w-7" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">PharmaGuard</h1>
                    <p className="text-sm text-slate-400 mt-1">Pharmacogenomic Analysis Platform</p>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                    {(['login', 'signup'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all capitalize
                ${tab === t ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                            {t === 'login' ? 'Log In' : 'Sign Up'}
                        </button>
                    ))}
                </div>

                {/* Form */}
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="you@example.com" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handle()}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="••••••••" />
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl p-3">
                            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="text-green-700 text-sm bg-green-50 border border-green-200 rounded-xl p-3">{message}</div>
                    )}

                    <button onClick={handle} disabled={loading || !email || !password}
                        className={`w-full py-3 rounded-xl text-white font-semibold text-sm transition-all mt-2
              ${loading || !email || !password ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25'}`}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : tab === 'login' ? 'Log In' : 'Create Account'}
                    </button>
                </div>

                <p className="text-center text-xs text-slate-400 mt-6">
                    Research use only &bull; All data processed locally
                </p>
            </div>
        </div>
    );
};

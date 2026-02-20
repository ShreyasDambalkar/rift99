import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, Loader2, AlertCircle, Dna } from 'lucide-react';

interface LoginModalProps {
    onClose: () => void;
}

export const LoginModal = ({ onClose }: LoginModalProps) => {
    const [tab, setTab] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleSignIn = async () => {
        setLoading(true); setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setError(error.message); setLoading(false); }
        else onClose();
    };

    const handleSignUp = async () => {
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        setLoading(true); setError(null); setMessage(null);
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) { setError(error.message); setLoading(false); }
        else {
            // Auto sign-in after signup (works when email confirmation is disabled)
            const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
            if (signInErr) {
                setMessage('Account created! Check your email to confirm, then sign in.');
                setLoading(false);
                setTab('signin');
            } else {
                onClose();
            }
        }
    };

    const handle = () => tab === 'signin' ? handleSignIn() : handleSignUp();

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 relative">
                <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
                    <X className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-blue-600 text-white p-2 rounded-lg"><Dna className="h-5 w-5" /></div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">PharmaGuard</h2>
                        <p className="text-xs text-slate-400">Doctor / Patient Portal</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
                    {[{ id: 'signin', label: 'Sign In' }, { id: 'signup', label: 'Create Account' }].map(t => (
                        <button key={t.id} onClick={() => { setTab(t.id as any); setError(null); setMessage(null); }}
                            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition
                ${tab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="you@example.com" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handle()}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="••••••••" />
                        {tab === 'signup' && <p className="text-[11px] text-slate-400 mt-1">Minimum 6 characters</p>}
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl p-3">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
                        </div>
                    )}
                    {message && (
                        <div className="text-green-700 text-xs bg-green-50 border border-green-100 rounded-xl p-3">{message}</div>
                    )}

                    <button onClick={handle} disabled={loading || !email || !password}
                        className={`w-full py-3 rounded-xl text-white font-semibold text-sm transition-all
              ${loading || !email || !password ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25'}`}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : tab === 'signin' ? 'Sign In' : 'Create Account'}
                    </button>
                </div>

                {tab === 'signup' && (
                    <p className="text-center text-xs text-slate-400 mt-4">
                        After creating an account you'll select your role (Doctor or Patient).
                    </p>
                )}
            </div>
        </div>
    );
};

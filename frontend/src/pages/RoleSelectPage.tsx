import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Stethoscope, User, Loader2, AlertCircle, KeyRound } from 'lucide-react';

export const RoleSelectPage = () => {
    const { user, refreshProfile } = useAuth();
    const [role, setRole] = useState<'doctor' | 'patient' | null>(null);
    const [name, setName] = useState('');
    const [hospital, setHospital] = useState('');
    const [doctorCode, setDoctorCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [codeWarning, setCodeWarning] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!role || !name.trim()) { setError('Please fill all required fields.'); return; }
        setLoading(true); setError(null); setCodeWarning(null);

        // 1. Create profile
        const { error: profileErr } = await supabase.from('profiles').insert({
            id: user!.id,
            role,
            name: name.trim(),
            hospital: role === 'doctor' ? hospital.trim() : null,
        });
        if (profileErr) { setError(profileErr.message); setLoading(false); return; }

        // 2. Patient: try to link via doctor code
        if (role === 'patient' && doctorCode.trim()) {
            const code = doctorCode.trim().toUpperCase();
            const { data: dp, error: dpErr } = await supabase
                .from('doctor_patients')
                .select('id, patient_id')
                .eq('patient_code', code)
                .single();

            if (dpErr || !dp) {
                setCodeWarning('Doctor code not found — your account was created without linking. You can re-link later.');
            } else if (dp.patient_id) {
                setCodeWarning('That code is already used by another account.');
            } else {
                await supabase
                    .from('doctor_patients')
                    .update({ patient_id: user!.id })
                    .eq('id', dp.id);
            }
        }

        await refreshProfile();
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-8">
                <h2 className="text-2xl font-bold text-slate-800 mb-1">Welcome to PharmaGuard</h2>
                <p className="text-sm text-slate-400 mb-8">Tell us who you are to set up your account.</p>

                {/* Role Cards */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                        { id: 'doctor' as const, icon: Stethoscope, label: 'Doctor', desc: 'Manage patients and upload clinical reports' },
                        { id: 'patient' as const, icon: User, label: 'Patient', desc: 'View reports shared by your doctor' },
                    ].map(({ id, icon: Icon, label, desc }) => (
                        <button key={id} onClick={() => { setRole(id); setError(null); }}
                            className={`p-5 rounded-xl border-2 text-left transition-all
                ${role === id ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-600/10' : 'border-slate-200 hover:border-blue-300'}`}>
                            <div className={`p-2 rounded-lg w-fit mb-3 ${role === id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <p className="font-bold text-slate-800">{label}</p>
                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                        </button>
                    ))}
                </div>

                {/* Fields */}
                {role && (
                    <div className="space-y-4 mb-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                                Full Name <span className="text-red-400">*</span>
                            </label>
                            <input value={name} onChange={e => setName(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={role === 'doctor' ? 'Dr. Sarah Johnson' : 'Alex Smith'} />
                        </div>
                        {role === 'doctor' && (
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Hospital / Clinic</label>
                                <input value={hospital} onChange={e => setHospital(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="City General Hospital" />
                            </div>
                        )}
                        {role === 'patient' && (
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                                    <span className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> Doctor Code <span className="text-slate-300 font-normal">(optional)</span></span>
                                </label>
                                <input value={doctorCode} onChange={e => setDoctorCode(e.target.value.toUpperCase())}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
                                    placeholder="PG-XXXXX" maxLength={8} />
                                <p className="text-[11px] text-slate-400 mt-1">Enter the code given by your doctor to link your account and see your reports.</p>
                            </div>
                        )}
                    </div>
                )}

                {codeWarning && (
                    <div className="flex items-start gap-2 text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {codeWarning}
                    </div>
                )}
                {error && (
                    <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {error}
                    </div>
                )}

                <button onClick={handleSubmit} disabled={!role || !name.trim() || loading}
                    className={`w-full py-3 rounded-xl text-white font-semibold text-sm transition-all
            ${!role || !name.trim() || loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25'}`}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Continue to Dashboard'}
                </button>
            </div>
        </div>
    );
};

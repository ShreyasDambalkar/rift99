import { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabaseClient';
import { FileUpload } from '../components/FileUpload';
import { DrugInput } from '../components/DrugInput';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { TrafficLightBar } from '../components/TrafficLightBar';
import { JsonViewer } from '../components/JsonViewer';
import { ReportSaver } from '../components/ReportSaver';
import { ReportsList } from '../components/ReportsList';
import { useAuth } from '../context/AuthContext';
import {
    Dna, LogOut, Loader2, AlertCircle, Zap,
    Stethoscope, History, Users, Copy, Check, UserPlus, KeyRound,
    FlaskConical, LayoutDashboard, Settings, MessageCircle, FileDown
} from 'lucide-react';
import { ChatWindow } from '../components/ChatWindow';
import { useChat } from '../context/ChatContext';


const ALL_DRUGS = "CODEINE,WARFARIN,CLOPIDOGREL,SIMVASTATIN,AZATHIOPRINE,FLUOROURACIL";

const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return 'PG-' + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

interface DoctorPatient { id: string; patient_name: string; patient_code: string; patient_id: string | null; }

export const DoctorDashboard = () => {
    const { profile, user, signOut } = useAuth();
    const { unreadCount, markRead } = useChat();
    const [tab, setTab] = useState<'analyze' | 'patients' | 'reports' | 'chat'>('analyze');
    const [file, setFile] = useState<File | null>(null);
    const [drugs, setDrugs] = useState("CODEINE, WARFARIN, CLOPIDOGREL");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [patients, setPatients] = useState<DoctorPatient[]>([]);
    const [newName, setNewName] = useState('');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [addingPatient, setAddingPatient] = useState(false);
    const [selectedChatPatient, setSelectedChatPatient] = useState<DoctorPatient | null>(null);

    const fetchPatients = async () => {
        if (!user) return;
        const { data } = await supabase.from('doctor_patients').select('*').eq('doctor_id', user.id).order('patient_name');
        setPatients(data ?? []);
    };

    useEffect(() => { fetchPatients(); }, [user]);

    const addPatient = async () => {
        if (!newName.trim() || !user) return;
        setAddingPatient(true);
        const { data } = await supabase
            .from('doctor_patients')
            .insert({ doctor_id: user.id, patient_name: newName.trim(), patient_code: generateCode() })
            .select().single();
        if (data) setPatients(prev => [...prev, data].sort((a, b) => a.patient_name.localeCompare(b.patient_name)));
        setNewName('');
        setAddingPatient(false);
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const runAnalysis = async (drugList: string) => {
        if (!file) { setError("Please upload a patient VCF file."); return; }
        setLoading(true); setError(null); setResults(null);
        const formData = new FormData();
        formData.append('vcf_file', file);
        formData.append('drugs', drugList);
        try {
            const res = await axios.post('/api/analyze', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setResults(res.data);
        } catch (err: any) {
            setError(err.response?.data?.message || "Analysis failed. Is the backend running?");
        } finally { setLoading(false); }
    };

    const downloadReport = async () => {
        if (!results) return;
        try {
            const response = await axios.post('/api/generate-report', { results: results.results }, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'PharmaGuard_Report.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("PDF Download failed", err);
            alert("Failed to download report.");
        }
    };

    const navItems: { id: 'analyze' | 'patients' | 'reports' | 'chat'; icon: typeof Stethoscope; label: string; badge?: number }[] = [
        { id: 'analyze', icon: Stethoscope, label: 'New Analysis' },
        { id: 'patients', icon: Users, label: `Patients (${patients.length})` },
        { id: 'reports', icon: History, label: 'Patient Reports' },
        { id: 'chat', icon: MessageCircle, label: 'Messages', badge: unreadCount },
    ];

    const staticNav = [
        { icon: LayoutDashboard, label: 'Dashboard' },
        { icon: FlaskConical, label: 'Gene Library' },
        { icon: Settings, label: 'Settings' },
    ];

    return (
        <div className="flex min-h-screen relative overflow-hidden">

            {/* ── Sidebar ── */}
            <aside className="w-64 sidebar-glass flex flex-col h-screen sticky top-0 z-20 shrink-0">
                {/* Logo */}
                <div className="p-8">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-gradient-to-br from-biotech-purple to-biotech-blue rounded-xl shadow-lg flex items-center justify-center">
                            <Dna className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="font-display font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                                PharmaGuard
                            </span>
                            <p className="text-[10px] text-biotech-purple font-semibold">Clinical Mode</p>
                        </div>
                    </div>
                </div>

                {/* Doctor Info */}
                <div className="mx-4 mb-4 p-3 rounded-2xl bg-white/40 border border-white/40">
                    <p className="text-xs font-bold text-slate-700">Dr. {profile?.name ?? 'Doctor'}</p>
                    {profile?.hospital && <p className="text-[11px] text-slate-400">{profile.hospital}</p>}
                </div>

                {/* Nav: Tab links */}
                <nav className="flex-1 px-4 space-y-1">
                    {navItems.map(({ id, icon: Icon, label, badge }) => (
                        <button key={id}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all
                            ${tab === id
                                    ? 'bg-white/60 text-biotech-blue shadow-sm'
                                    : 'text-slate-500 hover:bg-white/30 hover:text-slate-700'
                                }`}
                            onClick={() => { setTab(id); if (id === 'chat') markRead(); }}>
                            <Icon className="w-4 h-4" />
                            {label}
                            {badge && badge > 0 && (
                                <span className="ml-auto bg-biotech-purple text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {badge}
                                </span>
                            )}
                        </button>
                    ))}
                    <div className="py-2">
                        <div className="h-px bg-slate-200/60" />
                    </div>
                    {staticNav.map(({ icon: Icon, label }) => (
                        <a key={label} href="#"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/30 hover:text-slate-600 text-sm transition-all">
                            <Icon className="w-4 h-4" />
                            {label}
                        </a>
                    ))}
                </nav>

                {/* Compliance + Sign Out */}
                <div className="px-4 pb-2">
                    <div className="flex gap-2 mb-4">
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white/50 text-[11px] font-bold text-slate-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> HIPAA
                        </span>
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white/50 text-[11px] font-bold text-slate-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> GDPR
                        </span>
                    </div>
                </div>

                <div className="p-5">
                    <button onClick={signOut}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition-all">
                        <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 overflow-y-auto">
                {/* Navbar */}
                <header className="navbar-glass sticky top-0 z-30 px-8 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                            {{
                                analyze: 'Clinical Analysis',
                                patients: 'Patient Management',
                                reports: 'Patient Reports',
                                chat: 'Messages',
                            }[tab]}
                        </h1>
                        <p className="text-slate-400 text-xs mt-0.5">
                            Pharmacogenomic Risk Assessment &amp; Insight Panel
                        </p>
                    </div>
                </header>

                <div className="p-8">
                    {/* ── Analysis Tab ── */}
                    {tab === 'analyze' && (
                        <div className="space-y-6">
                            {/* Info banner */}
                            <div className="glass-card rounded-2xl p-4 text-sm text-biotech-blue border-l-4 border-biotech-blue flex items-center gap-3">
                                <Stethoscope className="h-4 w-4 shrink-0" />
                                <span>
                                    <strong>Clinical Mode:</strong> Upload patient VCF, run analysis, then save to a patient record. Create patients first in the{' '}
                                    <button onClick={() => setTab('patients')} className="underline font-semibold">Patients tab</button>.
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* VCF Card */}
                                <div className="glass-card-hover rounded-4xl p-8 flex flex-col">
                                    <div className="w-14 h-14 mb-5 rounded-2xl bg-gradient-to-tr from-biotech-purple to-purple-400 flex items-center justify-center shadow-lg shadow-purple-200/50">
                                        <Dna className="w-7 h-7 text-white" />
                                    </div>
                                    <h3 className="font-display text-xl font-bold text-slate-900 mb-1">Genetic Sequence</h3>
                                    <p className="text-slate-500 text-sm mb-5">Import patient VCF for pharmacogenomic phenotype mapping.</p>
                                    <FileUpload onFileSelect={setFile} selectedFile={file} />
                                </div>
                                {/* Drug Card */}
                                <div className="glass-card-hover rounded-4xl p-8 flex flex-col">
                                    <div className="w-14 h-14 mb-5 rounded-2xl bg-gradient-to-tr from-biotech-blue to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-200/50">
                                        <FlaskConical className="w-7 h-7 text-white" />
                                    </div>
                                    <h3 className="font-display text-xl font-bold text-slate-900 mb-1">Medication Panel</h3>
                                    <p className="text-slate-500 text-sm mb-5">Select compounds to analyze metabolic pathways.</p>
                                    <DrugInput drugs={drugs} setDrugs={setDrugs} />
                                </div>
                            </div>

                            {error && (
                                <div className="glass-card rounded-2xl p-4 flex items-start gap-2 text-red-700 border-l-4 border-red-400">
                                    <AlertCircle className="h-4 w-4 mt-0.5" />
                                    <span className="text-sm">{error}</span>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button onClick={() => runAnalysis(drugs)} disabled={loading || !file}
                                    className={`flex-1 py-4 rounded-2xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2
                                    ${loading || !file ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/20'}`}>
                                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : 'Run Clinical Analysis →'}
                                </button>
                                <button onClick={() => runAnalysis(ALL_DRUGS)} disabled={loading || !file}
                                    className={`flex-1 py-4 rounded-2xl font-bold text-sm border-2 flex items-center justify-center gap-2 transition-all
                                    ${loading || !file ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-biotech-purple text-biotech-purple hover:bg-biotech-purple hover:text-white'}`}>
                                    <Zap className="h-4 w-4" /> Screen All 6 Drugs
                                </button>
                            </div>

                            {results && (
                                <div className="space-y-6">
                                    <div className="glass-card rounded-4xl p-6">
                                        <TrafficLightBar results={results.results} />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="h-px bg-gradient-to-r from-transparent via-biotech-purple/30 to-transparent flex-1" />
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Patient Profile</span>
                                        <div className="h-px bg-gradient-to-r from-transparent via-biotech-blue/30 to-transparent flex-1" />
                                    </div>
                                    <ResultsDisplay results={results.results} />

                                    <button onClick={downloadReport}
                                        className="w-full py-4 bg-gradient-to-r from-biotech-cyan to-biotech-blue text-white font-bold rounded-2xl hover:shadow-lg transition flex items-center justify-center gap-2">
                                        <FileDown className="h-5 w-5" /> Download Professional PDF Report
                                    </button>

                                    <ReportSaver resultJson={results} vcfFile={file} />
                                    <JsonViewer data={results} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Patients Tab ── */}
                    {tab === 'patients' && (
                        <div className="space-y-4">
                            <div className="glass-card rounded-4xl p-8">
                                <h3 className="font-display text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
                                    <Users className="h-5 w-5 text-biotech-purple" /> Your Patients
                                </h3>

                                <div className="flex gap-2 mb-6">
                                    <input value={newName} onChange={e => setNewName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addPatient()}
                                        className="flex-1 px-4 py-3 border border-white/40 bg-white/50 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-biotech-purple"
                                        placeholder="New patient full name..." />
                                    <button onClick={addPatient} disabled={!newName.trim() || addingPatient}
                                        className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white text-sm font-semibold rounded-2xl hover:bg-slate-800 disabled:bg-slate-200 transition">
                                        <UserPlus className="h-4 w-4" /> Add
                                    </button>
                                </div>

                                {patients.length === 0 ? (
                                    <p className="text-center text-slate-400 text-sm py-10">No patients yet. Add one above.</p>
                                ) : (
                                    <div className="divide-y divide-white/40">
                                        {patients.map(p => (
                                            <div key={p.id} className="flex items-center justify-between py-4">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">{p.patient_name}</p>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.patient_id ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {p.patient_id ? '✓ Account Linked' : 'Awaiting Patient'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1 justify-end">
                                                            <KeyRound className="h-3 w-3" /> Patient Code
                                                        </p>
                                                        <p className="font-mono font-bold text-slate-700 text-sm tracking-widest">{p.patient_code}</p>
                                                    </div>
                                                    <button onClick={() => copyCode(p.patient_code)}
                                                        className="p-2 text-slate-400 hover:text-biotech-purple hover:bg-biotech-purple/10 rounded-xl transition">
                                                        {copiedCode === p.patient_code ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-5 p-4 bg-white/30 rounded-2xl text-xs text-slate-500 border border-white/40">
                                    <strong>To link a patient:</strong> Add them above → copy code → tell them to sign up at PharmaGuard and enter the code during registration.
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'reports' && <ReportsList isDoctor={true} />}

                    {/* ── Chat Tab ── */}
                    {tab === 'chat' && (
                        <div className="space-y-4">
                            {patients.filter(p => p.patient_id).length === 0 ? (
                                <div className="glass-card rounded-4xl p-12 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-biotech-purple/10 to-biotech-blue/10 flex items-center justify-center mb-5">
                                        <MessageCircle className="h-7 w-7 text-biotech-purple" />
                                    </div>
                                    <p className="font-display font-bold text-slate-800 text-lg mb-2">No linked patients yet</p>
                                    <p className="text-slate-500 text-sm">Patients need to link their account using their patient code before you can chat.</p>
                                    <button onClick={() => setTab('patients')}
                                        className="mt-5 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-2xl hover:bg-slate-800 transition">
                                        Manage Patients
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Patient selector */}
                                    <div className="glass-card rounded-4xl p-5 space-y-2">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Select Patient</p>
                                        {patients.filter(p => p.patient_id).map(p => (
                                            <button key={p.id}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold hover:bg-white/40 transition-all text-slate-700"
                                                onClick={() => {
                                                    const el = document.getElementById('chat-window-target');
                                                    if (el) el.setAttribute('data-receiver', p.patient_id!);
                                                    // Force re-mount by storing in a simple state
                                                    setSelectedChatPatient(p);
                                                }}>
                                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-biotech-purple to-biotech-blue flex items-center justify-center text-white text-xs font-bold">
                                                    {p.patient_name.charAt(0)}
                                                </div>
                                                {p.patient_name}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Chat window */}
                                    <div className="lg:col-span-2">
                                        {selectedChatPatient?.patient_id ? (
                                            <ChatWindow
                                                receiverId={selectedChatPatient.patient_id}
                                                receiverName={selectedChatPatient.patient_name}
                                            />
                                        ) : (
                                            <div className="glass-card rounded-4xl h-full flex items-center justify-center p-12 text-center">
                                                <p className="text-slate-400 text-sm">Select a patient on the left to start chatting</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <footer className="px-8 py-6 flex justify-between items-center border-t border-white/30 mt-4">
                    <p className="text-slate-400 text-xs">© 2024 PharmaGuard · Clinical Edition · Research Use Only</p>
                    <div className="flex gap-6">
                        <a className="text-slate-400 hover:text-biotech-purple text-xs font-bold uppercase tracking-wider transition-colors" href="#">Documentation</a>
                        <a className="text-slate-400 hover:text-biotech-blue text-xs font-bold uppercase tracking-wider transition-colors" href="#">Privacy</a>
                    </div>
                </footer>
            </main>
        </div>
    );
};

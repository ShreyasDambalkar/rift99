import { useState } from 'react';
import axios from 'axios';
import { FileUpload } from '../components/FileUpload';
import { DrugInput } from '../components/DrugInput';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { TrafficLightBar } from '../components/TrafficLightBar';
import { JsonViewer } from '../components/JsonViewer';
import { LoginModal } from '../components/LoginModal';
import { useAuth } from '../context/AuthContext';
import {
    Dna, Loader2, AlertCircle, Zap, LogIn, LogOut, User, Lock,
    LayoutDashboard, ClipboardList, FlaskConical, Settings, HeartPulse, FileDown
} from 'lucide-react';

const ALL_DRUGS = "CODEINE,WARFARIN,CLOPIDOGREL,SIMVASTATIN,AZATHIOPRINE,FLUOROURACIL";

export const PublicPage = () => {
    const { user, profile, signOut } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [drugs, setDrugs] = useState("CODEINE, WARFARIN, CLOPIDOGREL");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showLogin, setShowLogin] = useState(false);

    const runAnalysis = async (drugList: string) => {
        if (!file) { setError("Please upload a VCF file."); return; }
        setLoading(true); setError(null); setResults(null);
        const formData = new FormData();
        formData.append('vcf_file', file);
        formData.append('drugs', drugList);
        try {
            const res = await axios.post('/api/analyze', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setResults(res.data);
        } catch (err: any) {
            const backendError = err.response?.data?.message || err.response?.data?.error || "Analysis failed. Is the backend running?";
            setError(backendError);
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

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', active: true },
        { icon: ClipboardList, label: 'Patient Logs', active: false },
        { icon: FlaskConical, label: 'Gene Library', active: false },
        { icon: Settings, label: 'Settings', active: false },
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
                        <span className="font-display font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                            PharmaGuard
                        </span>
                    </div>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 px-4 space-y-1">
                    {navItems.map(({ icon: Icon, label, active }) => (
                        <a key={label}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer
                            ${active
                                    ? 'bg-white/60 text-biotech-blue shadow-sm'
                                    : 'text-slate-500 hover:bg-white/30 hover:text-slate-700'
                                }`}
                            href="#">
                            <Icon className="w-4 h-4" />
                            {label}
                        </a>
                    ))}
                </nav>

                {/* Compliance Badges */}
                <div className="px-4 pb-2">
                    <div className="flex gap-2">
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white/50 text-[11px] font-bold text-slate-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> HIPAA
                        </span>
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white/50 text-[11px] font-bold text-slate-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> GDPR
                        </span>
                    </div>
                </div>

                {/* Sidebar Footer CTA */}
                <div className="p-5 mt-2">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-biotech-purple/10 to-biotech-blue/10 border border-white/40">
                        <p className="text-[11px] font-bold text-biotech-purple uppercase tracking-wider mb-1">For Doctors</p>
                        <p className="text-xs text-slate-600 leading-snug">Save patient reports & manage records.</p>
                        {user ? (
                            <button onClick={signOut}
                                className="mt-3 w-full py-2 px-4 rounded-xl bg-white text-xs font-bold text-slate-700 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5">
                                <LogOut className="h-3 w-3" /> Sign Out
                            </button>
                        ) : (
                            <button onClick={() => setShowLogin(true)}
                                className="mt-3 w-full py-2 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5">
                                <LogIn className="h-3 w-3" /> Doctor Login
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 overflow-y-auto">
                {/* Navbar */}
                <header className="navbar-glass sticky top-0 z-30 px-8 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                            Pharmacogenomic Analysis
                        </h1>
                        <p className="text-slate-500 text-xs font-medium mt-0.5">
                            Upload your VCF file to discover how your body processes medications
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {user ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/60 border border-white/40 text-xs text-slate-600 font-medium">
                                <User className="h-3.5 w-3.5 text-biotech-purple" />
                                {profile?.name ?? user.email}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/60 border border-white/40 text-xs text-slate-500">
                                <HeartPulse className="h-3.5 w-3.5 text-biotech-cyan" />
                                Public Analysis Mode
                            </div>
                        )}
                    </div>
                </header>

                <div className="p-8 space-y-8">
                    {/* Upload + Drug Input Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* VCF Upload */}
                        <div className="glass-card-hover rounded-4xl p-8 flex flex-col">
                            <div className="w-14 h-14 mb-5 rounded-2xl bg-gradient-to-tr from-biotech-purple to-purple-400 flex items-center justify-center shadow-lg shadow-purple-200/50">
                                <Dna className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="font-display text-xl font-bold text-slate-900 mb-1">Genetic Sequence</h3>
                            <p className="text-slate-500 text-sm leading-relaxed mb-5">
                                Import your VCF v4.2 file to begin pharmacogenomic phenotype mapping.
                            </p>
                            <FileUpload onFileSelect={setFile} selectedFile={file} />
                        </div>

                        {/* Drug Selection */}
                        <div className="glass-card-hover rounded-4xl p-8 flex flex-col">
                            <div className="w-14 h-14 mb-5 rounded-2xl bg-gradient-to-tr from-biotech-blue to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-200/50">
                                <FlaskConical className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="font-display text-xl font-bold text-slate-900 mb-1">Medication Panel</h3>
                            <p className="text-slate-500 text-sm leading-relaxed mb-5">
                                Select compounds to analyze metabolic pathways and interaction risks.
                            </p>
                            <DrugInput drugs={drugs} setDrugs={setDrugs} />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="glass-card rounded-2xl p-4 flex items-start gap-3 text-red-700 border-l-4 border-red-400">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={() => runAnalysis(drugs)} disabled={loading || !file}
                            className={`flex-1 py-4 rounded-2xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2
                            ${loading || !file
                                    ? 'bg-slate-300 cursor-not-allowed'
                                    : 'bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-900/20'
                                }`}>
                            {loading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</>
                                : <>Run Analysis →</>
                            }
                        </button>
                        <button onClick={() => runAnalysis(ALL_DRUGS)} disabled={loading || !file}
                            className={`flex-1 py-4 rounded-2xl font-bold text-sm border-2 flex items-center justify-center gap-2 transition-all
                            ${loading || !file
                                    ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                                    : 'border-biotech-purple text-biotech-purple hover:bg-biotech-purple hover:text-white'
                                }`}>
                            <Zap className="h-4 w-4" /> Analyze All Supported Drugs
                        </button>
                    </div>

                    {/* Results */}
                    {results && (
                        <div className="space-y-6">
                            <div className="glass-card rounded-4xl p-6">
                                <TrafficLightBar results={results.results} />
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="h-px bg-gradient-to-r from-transparent via-biotech-purple/30 to-transparent flex-1" />
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                    Patient Pharmacogenomic Profile
                                </span>
                                <div className="h-px bg-gradient-to-r from-transparent via-biotech-blue/30 to-transparent flex-1" />
                            </div>

                            <ResultsDisplay results={results.results} />

                            {/* Save Report CTA */}
                            <div className="flex gap-4">
                                <button onClick={downloadReport}
                                    className="px-5 py-2.5 bg-gradient-to-r from-biotech-cyan to-biotech-blue text-white text-sm font-bold rounded-2xl hover:shadow-lg transition flex items-center gap-2">
                                    <FileDown className="h-4 w-4" /> Download PDF Report
                                </button>

                                {!user && (
                                    <button onClick={() => setShowLogin(true)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-2xl hover:bg-slate-800 transition shadow-lg">
                                        <Lock className="h-3.5 w-3.5" /> Sign In to Save
                                    </button>
                                )}
                            </div>

                            <JsonViewer data={results} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <footer className="px-8 py-6 flex flex-col md:flex-row justify-between items-center border-t border-white/30 mt-4">
                    <p className="text-slate-400 text-xs font-medium">
                        © 2024 PharmaGuard · Powered by XGBoost Ensemble (AUC 0.9581) · Research Use Only
                    </p>
                    <div className="flex gap-6 mt-3 md:mt-0">
                        <a className="text-slate-400 hover:text-biotech-purple text-xs font-bold uppercase tracking-wider transition-colors" href="#">Documentation</a>
                        <a className="text-slate-400 hover:text-biotech-blue text-xs font-bold uppercase tracking-wider transition-colors" href="#">Data Privacy</a>
                        <a className="text-slate-400 hover:text-biotech-cyan text-xs font-bold uppercase tracking-wider transition-colors" href="#">System Status</a>
                    </div>
                </footer>
            </main>

            {/* Login Modal */}
            {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
        </div>
    );
};

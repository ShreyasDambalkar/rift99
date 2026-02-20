import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileUpload } from '../components/FileUpload';
import { DrugInput } from '../components/DrugInput';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { TrafficLightBar } from '../components/TrafficLightBar';
import { JsonViewer } from '../components/JsonViewer';
import { PatientReportsList } from '../components/PatientReportsList';
import { ChatWindow } from '../components/ChatWindow';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { supabase } from '../lib/supabaseClient';
import { Dna, LogOut, Loader2, AlertCircle, Zap, ClipboardList, Search, MessageCircle, FileDown } from 'lucide-react';

const ALL_DRUGS = "CODEINE,WARFARIN,CLOPIDOGREL,SIMVASTATIN,AZATHIOPRINE,FLUOROURACIL";

export const PatientDashboard = () => {
    const { profile, signOut, user } = useAuth();
    const { unreadCount, markRead } = useChat();
    const [tab, setTab] = useState<'reports' | 'analyze' | 'chat'>('reports');
    const [doctorInfo, setDoctorInfo] = useState<{ id: string; name: string } | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [drugs, setDrugs] = useState("CODEINE, WARFARIN, CLOPIDOGREL");
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch linked doctor via Supabase
    // Requires RLS policy: "Patients can view linked doctor profile" on profiles
    useEffect(() => {
        const fetchDoctor = async () => {
            if (!user) return;

            // Step 1: get doctor_id from doctor_patients
            const { data: dpRow } = await supabase
                .from('doctor_patients')
                .select('doctor_id')
                .eq('patient_id', user.id)
                .single();

            if (!dpRow?.doctor_id) return;

            // Step 2: get doctor name from profiles
            // (works after adding RLS: "Patients can view linked doctor profile")
            const { data: doctorProfile } = await supabase
                .from('profiles')
                .select('id, name')
                .eq('id', dpRow.doctor_id)
                .single();

            if (doctorProfile) {
                setDoctorInfo({ id: doctorProfile.id, name: doctorProfile.name });
            }
        };
        fetchDoctor();
    }, [user]);

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
            alert("Failed to download report. Is the backend running?");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
            <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 text-white p-2 rounded-lg"><Dna className="h-5 w-5" /></div>
                        <div>
                            <h1 className="text-base font-bold text-slate-800">PharmaGuard</h1>
                            <p className="text-[11px] text-slate-400">Patient Portal &bull; {profile?.name}</p>
                        </div>
                    </div>
                    <button onClick={signOut}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition px-3 py-1.5 rounded-lg hover:bg-red-50">
                        <LogOut className="h-3.5 w-3.5" /> Sign Out
                    </button>
                </div>
                <div className="max-w-5xl mx-auto px-6 flex gap-1">
                    {[
                        { id: 'reports', icon: ClipboardList, label: 'My Reports' },
                        { id: 'analyze', icon: Search, label: 'Run Analysis' },
                        { id: 'chat', icon: MessageCircle, label: 'Chat with Doctor', badge: unreadCount },
                    ].map(({ id, icon: Icon, label, badge }) => (
                        <button key={id} onClick={() => { setTab(id as any); if (id === 'chat') markRead(); }}
                            className={`px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors
                ${tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                            <Icon className="h-3.5 w-3.5" /> {label}
                            {(badge ?? 0) > 0 && (
                                <span className="ml-1 bg-biotech-purple text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
                            )}
                        </button>
                    ))}
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-6 py-8">
                {tab === 'reports' ? (
                    <PatientReportsList onChatWithDoctor={() => { setTab('chat'); markRead(); }} />
                ) : tab === 'chat' ? (
                    <div className="max-w-3xl mx-auto">
                        {doctorInfo ? (
                            <ChatWindow
                                receiverId={doctorInfo.id}
                                receiverName={`Dr. ${doctorInfo.name}`}
                            />
                        ) : (
                            <div className="glass-card rounded-4xl p-12 flex flex-col items-center justify-center text-center">
                                <MessageCircle className="h-8 w-8 text-slate-300 mb-4" />
                                <p className="font-bold text-slate-700">No linked doctor found</p>
                                <p className="text-slate-400 text-sm mt-1">Your doctor needs to add you using your patient code.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                            <strong>Personal Analysis:</strong> Upload your VCF file to check how your body processes medications. Results are shown here and not saved automatically.
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <FileUpload onFileSelect={setFile} selectedFile={file} />
                            <DrugInput drugs={drugs} setDrugs={setDrugs} />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-sm">
                                <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => runAnalysis(drugs)} disabled={loading || !file}
                                className={`flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-all
                  ${loading || !file ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25'}`}>
                                {loading
                                    ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</span>
                                    : 'Check My Medications'}
                            </button>
                            <button onClick={() => runAnalysis(ALL_DRUGS)} disabled={loading || !file}
                                className={`flex-1 py-3 rounded-xl font-semibold text-sm border-2 flex items-center justify-center gap-2 transition-all
                  ${loading || !file ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'}`}>
                                <Zap className="h-4 w-4" /> Check All Drugs
                            </button>
                        </div>

                        {results && (
                            <div className="space-y-6">
                                <TrafficLightBar results={results.results} />
                                <ResultsDisplay results={results.results} />

                                <button onClick={downloadReport}
                                    className="w-full py-4 bg-gradient-to-r from-biotech-cyan to-biotech-blue text-white font-bold rounded-2xl hover:shadow-lg transition flex items-center justify-center gap-2">
                                    <FileDown className="h-5 w-5" /> Download Official PDF Report
                                </button>

                                <JsonViewer data={results} />
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

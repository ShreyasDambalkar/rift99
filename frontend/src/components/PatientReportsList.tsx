import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FileText, Download, ChevronDown, ChevronRight, Loader2, KeyRound, MessageCircle } from 'lucide-react';

interface Report {
    id: string;
    result_json: any;
    vcf_file_url: string;
    created_at: string;
    dp_id: string;
    doctor_patients?: { patient_name: string; doctor_id: string };
}

interface PatientReportsListProps {
    onChatWithDoctor?: () => void;
}

export const PatientReportsList = ({ onChatWithDoctor }: PatientReportsListProps) => {
    const { user, profile } = useAuth();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [linkedDp, setLinkedDp] = useState<any[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            setLoading(true);

            // Find all doctor_patients rows where this user is linked
            const { data: dpRows } = await supabase
                .from('doctor_patients')
                .select('id, patient_name, patient_code')
                .eq('patient_id', user.id);

            setLinkedDp(dpRows ?? []);

            if (!dpRows || dpRows.length === 0) { setLoading(false); return; }

            const dpIds = dpRows.map(d => d.id);

            // Fetch all reports linked to those dp_ids
            const { data: reportData } = await supabase
                .from('reports')
                .select('*')
                .in('dp_id', dpIds)
                .order('created_at', { ascending: false });

            setReports(reportData ?? []);
            setLoading(false);
        };
        load();
    }, [user]);

    const downloadJson = (r: Report) => {
        const blob = new Blob([JSON.stringify(r.result_json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${new Date(r.created_at).toLocaleDateString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
    );

    if (linkedDp.length === 0) return (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
            <KeyRound className="h-10 w-10 text-amber-400 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 mb-1">No Doctor Link Found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Your account isn't linked to a doctor yet. Sign out and sign back in — during profile setup, enter the Patient Code your doctor shared with you.
            </p>
            {profile?.name && <p className="text-xs text-slate-400 mt-3">Logged in as: <strong>{profile.name}</strong></p>}
        </div>
    );

    if (reports.length === 0) return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <FileText className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No reports uploaded yet by your doctor.</p>
            <p className="text-xs text-slate-300 mt-1">Your account is linked — reports will appear here once uploaded.</p>
        </div>
    );

    return (
        <div className="space-y-3">
            <p className="text-xs text-slate-400 mb-4">
                Showing reports from your doctor for: <strong className="text-slate-600">{linkedDp.map(d => d.patient_name).join(', ')}</strong>
            </p>
            {reports.map(r => {
                const results: any[] = r.result_json?.results ?? [];
                const safe = results.filter(x => (x.risk_assessment?.risk_label ?? '').toLowerCase().includes('safe')).length;
                const adjust = results.filter(x => (x.risk_assessment?.risk_label ?? '').toLowerCase().includes('adjust')).length;
                const avoid = results.filter(x => ['toxic', 'ineffective'].some(k => (x.risk_assessment?.risk_label ?? '').toLowerCase().includes(k))).length;
                const isOpen = expandedId === r.id;

                return (
                    <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                                onClick={() => setExpandedId(isOpen ? null : r.id)}>
                                <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-700">Report — {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                    <p className="text-xs text-slate-400">{results.length} medications analysed</p>
                                </div>
                                <div className="flex gap-1.5 flex-shrink-0">
                                    {safe > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">🟢 {safe}</span>}
                                    {adjust > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">🟡 {adjust}</span>}
                                    {avoid > 0 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">🔴 {avoid}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                                {onChatWithDoctor && (
                                    <button
                                        onClick={onChatWithDoctor}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-biotech-purple hover:bg-biotech-purple/10 rounded-xl transition"
                                        title="Chat with doctor about this report">
                                        <MessageCircle className="h-3.5 w-3.5" />
                                        Ask Doctor
                                    </button>
                                )}
                                <button onClick={() => downloadJson(r)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Download">
                                    <Download className="h-4 w-4" />
                                </button>
                                <button onClick={() => setExpandedId(isOpen ? null : r.id)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
                                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        {isOpen && (
                            <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-2">
                                {results.map((res, i) => {
                                    const label = res.risk_assessment?.risk_label ?? 'Unknown';
                                    const lc = label.toLowerCase();
                                    const cls = lc.includes('safe') ? 'bg-green-100 text-green-700'
                                        : lc.includes('adjust') ? 'bg-amber-100 text-amber-700'
                                            : (lc.includes('toxic') || lc.includes('ineffective')) ? 'bg-red-100 text-red-700'
                                                : 'bg-slate-100 text-slate-600';
                                    return (
                                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                                            <div>
                                                <span className="font-semibold text-slate-700">{res.drug}</span>
                                                <span className="text-slate-400 ml-2">{res.pharmacogenomic_profile?.phenotype}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${cls}`}>{label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

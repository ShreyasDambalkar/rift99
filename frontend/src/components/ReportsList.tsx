import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FileText, Download, ChevronDown, ChevronRight, Loader2, RefreshCw, Filter } from 'lucide-react';

interface Report {
    id: string;
    dp_id: string;
    result_json: any;
    created_at: string;
}

interface DpMap { [id: string]: string } // dp_id -> patient_name

export const ReportsList = ({ isDoctor }: { isDoctor: boolean }) => {
    const { user } = useAuth();
    const [reports, setReports] = useState<Report[]>([]);
    const [dpMap, setDpMap] = useState<DpMap>({});
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filterRisk, setFilterRisk] = useState('');
    const [filterDrug, setFilterDrug] = useState('');

    const load = async () => {
        setLoading(true);
        if (!user) return;

        // Load doctor_patients names for display
        const { data: dps } = await supabase
            .from('doctor_patients')
            .select('id, patient_name')
            .eq('doctor_id', user.id);
        const map: DpMap = {};
        (dps ?? []).forEach(d => { map[d.id] = d.patient_name; });
        setDpMap(map);

        const { data } = await supabase
            .from('reports')
            .select('id, dp_id, result_json, created_at')
            .eq('owner_user_id', user.id)
            .order('created_at', { ascending: false });
        setReports(data ?? []);
        setLoading(false);
    };

    useEffect(() => { load(); }, [user]);

    const downloadJson = (r: Report) => {
        const blob = new Blob([JSON.stringify(r.result_json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dpMap[r.dp_id] ?? 'patient'}_report.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const filtered = reports.filter(r => {
        const results: any[] = r.result_json?.results ?? [];
        const matchRisk = filterRisk ? results.some(x => (x.risk_assessment?.risk_label ?? '').toLowerCase().includes(filterRisk.toLowerCase())) : true;
        const matchDrug = filterDrug ? results.some(x => (x.drug ?? '').toLowerCase().includes(filterDrug.toLowerCase())) : true;
        return matchRisk && matchDrug;
    });

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-500" /> Patient Reports
                    <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">{filtered.length}</span>
                </h3>
                {isDoctor && (
                    <div className="flex items-center gap-2">
                        <div className="relative"><Filter className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Risk..." /></div>
                        <div className="relative"><Filter className="h-3 w-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={filterDrug} onChange={e => setFilterDrug(e.target.value)} className="pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Drug..." /></div>
                        <button onClick={load} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><RefreshCw className="h-4 w-4" /></button>
                    </div>
                )}
            </div>
            {filtered.length === 0
                ? <div className="text-center py-12 text-slate-400 text-sm">No reports found.</div>
                : <div className="divide-y divide-slate-100">
                    {filtered.map(r => {
                        const results: any[] = r.result_json?.results ?? [];
                        const safe = results.filter(x => (x.risk_assessment?.risk_label ?? '').toLowerCase().includes('safe')).length;
                        const adjust = results.filter(x => (x.risk_assessment?.risk_label ?? '').toLowerCase().includes('adjust')).length;
                        const avoid = results.filter(x => ['toxic', 'ineffective'].some(k => (x.risk_assessment?.risk_label ?? '').toLowerCase().includes(k))).length;
                        const isOpen = expandedId === r.id;
                        return (
                            <div key={r.id} className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setExpandedId(isOpen ? null : r.id)}>
                                        <div className="bg-indigo-100 p-2 rounded-lg"><FileText className="h-4 w-4 text-indigo-600" /></div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700">{dpMap[r.dp_id] ?? 'Unknown Patient'}</p>
                                            <p className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()} &bull; {results.length} drugs</p>
                                        </div>
                                        <div className="flex gap-1.5 ml-2">
                                            {safe > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">🟢 {safe}</span>}
                                            {adjust > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">🟡 {adjust}</span>}
                                            {avoid > 0 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">🔴 {avoid}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => downloadJson(r)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><Download className="h-4 w-4" /></button>
                                        <button onClick={() => setExpandedId(isOpen ? null : r.id)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
                                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                {isOpen && (
                                    <div className="mt-3 pl-11 space-y-1.5">
                                        {results.map((res, i) => {
                                            const label = res.risk_assessment?.risk_label ?? 'Unknown';
                                            const lc = label.toLowerCase();
                                            const cls = lc.includes('safe') ? 'bg-green-100 text-green-700' : lc.includes('adjust') ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
                                            return (
                                                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                                                    <span className="font-semibold text-slate-700">{res.drug}</span>
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
            }
        </div>
    );
};

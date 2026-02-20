import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Save, Loader2, CheckCircle, UserPlus, ChevronDown, Copy, Check } from 'lucide-react';

interface DoctorPatient {
    id: string;
    patient_name: string;
    patient_code: string;
    patient_id: string | null;
}

interface ReportSaverProps {
    resultJson: any;
    vcfFile: File | null;
    // Called after successful save so parent can refresh
    onSaved?: () => void;
}

const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return 'PG-' + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export const ReportSaver = ({ resultJson, vcfFile, onSaved }: ReportSaverProps) => {
    const { user } = useAuth();
    const [patients, setPatients] = useState<DoctorPatient[]>([]);
    const [selectedDpId, setSelectedDpId] = useState('');
    const [newPatientName, setNewPatientName] = useState('');
    const [showNewPatient, setShowNewPatient] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPatients = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('doctor_patients')
            .select('id, patient_name, patient_code, patient_id')
            .eq('doctor_id', user.id)
            .order('patient_name');
        setPatients(data ?? []);
    };

    useEffect(() => { fetchPatients(); }, [user]);

    const createPatient = async () => {
        if (!newPatientName.trim() || !user) return;
        const code = generateCode();
        const { data, error } = await supabase
            .from('doctor_patients')
            .insert({ doctor_id: user.id, patient_name: newPatientName.trim(), patient_code: code })
            .select()
            .single();
        if (data) {
            setPatients(prev => [...prev, data].sort((a, b) => a.patient_name.localeCompare(b.patient_name)));
            setSelectedDpId(data.id);
            setNewPatientName('');
            setShowNewPatient(false);
        }
        if (error) setError(error.message);
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const handleSave = async () => {
        if (!user || !vcfFile || !selectedDpId) return;
        setSaving(true); setError(null);

        // Upload VCF to Supabase Storage
        const path = `${user.id}/${Date.now()}_${vcfFile.name}`;
        const { error: uploadErr } = await supabase.storage
            .from('vcf-files')
            .upload(path, vcfFile, { contentType: 'text/plain', upsert: false });
        if (uploadErr) { setError(`Upload failed: ${uploadErr.message}`); setSaving(false); return; }

        const { data: { publicUrl } } = supabase.storage.from('vcf-files').getPublicUrl(path);

        // Save report linked to doctor_patients row
        const { error: dbErr } = await supabase.from('reports').insert({
            owner_user_id: user.id,
            dp_id: selectedDpId,
            vcf_file_url: publicUrl,
            result_json: resultJson,
        });
        if (dbErr) { setError(`Save failed: ${dbErr.message}`); setSaving(false); return; }

        setSaved(true); setSaving(false);
        onSaved?.();
    };

    if (!user) return null;

    if (saved) {
        return (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl p-4 text-sm font-medium">
                <CheckCircle className="h-5 w-5" /> Report saved to patient record!
            </div>
        );
    }

    const selectedPatient = patients.find(p => p.id === selectedDpId);

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Save className="h-4 w-4 text-blue-500" /> Save Report to Patient Record
            </h4>

            {/* Patient Dropdown */}
            <div className="mb-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Select Patient</label>
                <div className="relative">
                    <select value={selectedDpId} onChange={e => setSelectedDpId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white pr-10">
                        <option value="">-- Choose a patient --</option>
                        {patients.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.patient_name} {p.patient_id ? '✓' : '(unlinked)'}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Show code for selected patient */}
            {selectedPatient && (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Patient Code</p>
                        <p className="font-mono font-bold text-slate-700 text-sm tracking-widest">{selectedPatient.patient_code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${selectedPatient.patient_id ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {selectedPatient.patient_id ? 'Account Linked' : 'Not Yet Linked'}
                        </span>
                        <button onClick={() => copyCode(selectedPatient.patient_code)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Copy code">
                            {copiedCode === selectedPatient.patient_code ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                </div>
            )}

            {/* Create new patient */}
            {!showNewPatient ? (
                <button onClick={() => setShowNewPatient(true)}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mb-4 transition">
                    <UserPlus className="h-3.5 w-3.5" /> Add New Patient
                </button>
            ) : (
                <div className="flex gap-2 mb-4">
                    <input value={newPatientName} onChange={e => setNewPatientName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && createPatient()}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Patient full name..." autoFocus />
                    <button onClick={createPatient} disabled={!newPatientName.trim()}
                        className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:bg-slate-200 transition">
                        Add
                    </button>
                    <button onClick={() => setShowNewPatient(false)}
                        className="px-3 py-2 bg-slate-100 text-slate-500 text-xs rounded-lg hover:bg-slate-200 transition">
                        Cancel
                    </button>
                </div>
            )}

            {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

            <button onClick={handleSave} disabled={saving || !selectedDpId}
                className={`w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all
          ${saving || !selectedDpId ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20'}`}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save to Records'}
            </button>
        </div>
    );
};

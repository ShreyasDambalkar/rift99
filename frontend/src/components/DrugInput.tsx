import { Plus, X } from 'lucide-react';

interface DrugInputProps {
    drugs: string;
    setDrugs: (drugs: string) => void;
}

const PRESET_DRUGS = ["CODEINE", "WARFARIN", "CLOPIDOGREL", "SIMVASTATIN", "AZATHIOPRINE", "FLUOROURACIL"];

export const DrugInput: React.FC<DrugInputProps> = ({ drugs, setDrugs }) => {
    const currentList = drugs.split(',').map(d => d.trim()).filter(d => d.length > 0);

    const addDrug = (drug: string) => {
        if (!currentList.includes(drug)) setDrugs([...currentList, drug].join(', '));
    };
    const removeDrug = (drug: string) => {
        setDrugs(currentList.filter(d => d !== drug).join(', '));
    };
    const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const v = e.currentTarget.value.trim().toUpperCase();
            if (v) { addDrug(v); e.currentTarget.value = ''; }
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-full flex flex-col">
            <label className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">2</span>
                Select Medications
            </label>

            {/* Selected chips */}
            <div className="flex-1 border border-slate-200 rounded-xl p-3 bg-slate-50/50 min-h-[100px]">
                <div className="flex flex-wrap gap-2 mb-2">
                    {currentList.map((drug, i) => (
                        <span key={`${drug}-${i}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                            {drug}
                            <button onClick={() => removeDrug(drug)} className="hover:text-red-500 transition-colors">
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                    <input type="text" placeholder="Type & press Enter..."
                        className="bg-transparent text-sm outline-none min-w-[140px] text-slate-600 placeholder:text-slate-300"
                        onKeyDown={handleKey}
                    />
                </div>
            </div>

            {/* Quick-add presets */}
            <div className="mt-3">
                <p className="text-[11px] text-slate-400 font-medium mb-2 uppercase tracking-wide">Quick Add</p>
                <div className="flex flex-wrap gap-1.5">
                    {PRESET_DRUGS.filter(d => !currentList.includes(d)).map(drug => (
                        <button key={drug} onClick={() => addDrug(drug)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-500 font-medium hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-1">
                            <Plus className="h-2.5 w-2.5" /> {drug}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

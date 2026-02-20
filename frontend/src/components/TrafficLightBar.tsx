interface TrafficLightBarProps {
    results: any[];
}

export const TrafficLightBar: React.FC<TrafficLightBarProps> = ({ results }) => {
    const counts = { safe: 0, adjust: 0, avoid: 0, unknown: 0 };

    results.forEach(r => {
        const label = (r.risk_assessment?.risk_label || '').toLowerCase();
        if (label.includes('safe')) counts.safe++;
        else if (label.includes('adjust')) counts.adjust++;
        else if (label.includes('toxic') || label.includes('ineffective')) counts.avoid++;
        else counts.unknown++;
    });

    const total = results.length;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700">Patient Drug Compatibility Overview</h3>
                <span className="text-xs text-slate-400">{total} medications analyzed</span>
            </div>

            {/* Summary counts */}
            <div className="flex gap-4 mb-4">
                <SummaryPill emoji="🟢" label="Safe" count={counts.safe} color="bg-green-50 text-green-700 border-green-200" />
                <SummaryPill emoji="🟡" label="Adjust" count={counts.adjust} color="bg-amber-50 text-amber-700 border-amber-200" />
                <SummaryPill emoji="🔴" label="Avoid" count={counts.avoid} color="bg-red-50 text-red-700 border-red-200" />
                {counts.unknown > 0 && (
                    <SummaryPill emoji="⚪" label="Unknown" count={counts.unknown} color="bg-slate-50 text-slate-600 border-slate-200" />
                )}
            </div>

            {/* Progress bar */}
            {total > 0 && (
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                    {counts.safe > 0 && (
                        <div className="bg-green-400 transition-all duration-500" style={{ width: `${(counts.safe / total) * 100}%` }} />
                    )}
                    {counts.adjust > 0 && (
                        <div className="bg-amber-400 transition-all duration-500" style={{ width: `${(counts.adjust / total) * 100}%` }} />
                    )}
                    {counts.avoid > 0 && (
                        <div className="bg-red-400 transition-all duration-500" style={{ width: `${(counts.avoid / total) * 100}%` }} />
                    )}
                    {counts.unknown > 0 && (
                        <div className="bg-slate-300 transition-all duration-500" style={{ width: `${(counts.unknown / total) * 100}%` }} />
                    )}
                </div>
            )}
        </div>
    );
};

const SummaryPill: React.FC<{ emoji: string; label: string; count: number; color: string }> = ({ emoji, label, count, color }) => (
    <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold ${color}`}>
        <span>{emoji}</span>
        <span>{label}: {count}</span>
    </div>
);

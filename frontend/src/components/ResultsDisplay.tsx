import { useState } from 'react';
import { ChevronDown, AlertTriangle, ShieldCheck, Skull, HelpCircle, Ban, ArrowRightLeft, FlaskConical, Pill } from 'lucide-react';

interface Alternative {
    drug: string;
    reason: string;
    evidence: string;
    dosage: string;
}

interface MLRiskAnalysis {
    prediction_label: string;
    confidence_probability: number;
    ml_model_used: string;
    model_auc_score: number;
    medication_alternatives: Alternative | null;
}

interface ResultItem {
    drug: string;
    risk_assessment: {
        risk_label: string;
        severity: string;
        confidence_score: number;
    };
    pharmacogenomic_profile: {
        primary_gene: string;
        phenotype: string;
        diplotype: string;
    };
    llm_generated_explanation: {
        summary: string;
    };
    ml_risk_analysis?: MLRiskAnalysis;
}

// Sort priority: high (avoid) first, then medium (adjust), then low (safe), then unknown
const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, unknown: 3 };

const getBadgeConfig = (riskLabel: string, severity: string) => {
    const label = riskLabel.toLowerCase();
    if (label.includes('safe'))
        return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', icon: ShieldCheck, cardBorder: 'border-l-green-500', cardBg: 'bg-green-50' };
    if (label.includes('adjust'))
        return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle, cardBorder: 'border-l-amber-400', cardBg: 'bg-amber-50' };
    if (label.includes('toxic'))
        return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', icon: Skull, cardBorder: 'border-l-red-500', cardBg: 'bg-red-50' };
    if (label.includes('ineffective'))
        return { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', icon: Ban, cardBorder: 'border-l-red-400', cardBg: 'bg-red-50' };
    // Unknown / gray
    return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', icon: HelpCircle, cardBorder: 'border-l-slate-400', cardBg: 'bg-slate-50' };
};

export const ResultsDisplay: React.FC<{ results: ResultItem[] }> = ({ results }) => {
    // Sort by severity: Red first, Yellow next, Green last
    const sorted = [...results].sort((a, b) => {
        const oa = severityOrder[a.risk_assessment.severity] ?? 3;
        const ob = severityOrder[b.risk_assessment.severity] ?? 3;
        return oa - ob;
    });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((item, idx) => <DrugCard key={`${item.drug}-${idx}`} item={item} />)}
        </div>
    );
};

const DrugCard: React.FC<{ item: ResultItem }> = ({ item }) => {
    const [open, setOpen] = useState(false);
    const [altOpen, setAltOpen] = useState(false);
    const config = getBadgeConfig(item.risk_assessment.risk_label, item.risk_assessment.severity);
    const Icon = config.icon;

    const ml = item.ml_risk_analysis;
    const alternative = ml?.medication_alternatives;
    const showAlt = !!alternative && item.risk_assessment.risk_label.toLowerCase() !== 'safe';

    return (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden border-l-4 ${config.cardBorder} hover:shadow-md transition-shadow`}>
            {/* Header — always visible */}
            <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${config.cardBg}`}>
                            <Icon className={`h-4 w-4 ${config.text}`} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">{item.drug}</h3>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                        {item.risk_assessment.confidence_score}% conf.
                    </span>
                </div>

                {/* Risk Badge */}
                <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full border ${config.bg} ${config.text} ${config.border}`}>
                    {item.risk_assessment.risk_label}
                </span>

                {/* Gene & Phenotype quick info */}
                <div className="flex gap-3 mt-3 text-xs text-slate-500">
                    <span><span className="font-semibold text-slate-600">Gene:</span> {item.pharmacogenomic_profile.primary_gene}</span>
                    <span><span className="font-semibold text-slate-600">Phenotype:</span> {item.pharmacogenomic_profile.phenotype}</span>
                </div>
            </div>

            {/* Expandable Clinical Details */}
            <div className="border-t border-slate-100">
                <button
                    onClick={() => setOpen(!open)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-blue-600 hover:bg-blue-50/50 transition-colors"
                >
                    <span>{open ? 'Hide' : 'Show'} Clinical Details</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                    <div className="px-4 pb-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <InfoBox label="Gene" value={item.pharmacogenomic_profile.primary_gene} />
                            <InfoBox label="Diplotype" value={item.pharmacogenomic_profile.diplotype} />
                            <InfoBox label="Phenotype" value={item.pharmacogenomic_profile.phenotype} />
                            <InfoBox label="Severity" value={item.risk_assessment.severity} />
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                            <p className="text-[10px] text-blue-500 font-semibold uppercase mb-1">Clinical Explanation</p>
                            <p className="text-xs text-slate-600 leading-relaxed">{item.llm_generated_explanation.summary}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Medication Alternative Section — only when risk detected */}
            {showAlt && (
                <div className="border-t border-orange-100">
                    <button
                        onClick={() => setAltOpen(!altOpen)}
                        className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-orange-600 hover:bg-orange-50/50 transition-colors"
                    >
                        <span className="flex items-center gap-1.5">
                            <ArrowRightLeft className="h-3 w-3" />
                            {altOpen ? 'Hide' : 'View'} Safer Alternative
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${altOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {altOpen && (
                        <div className="px-4 pb-4 space-y-3">
                            {/* Alternative Drug Name Banner */}
                            <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-3">
                                <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                                    <Pill className="h-4 w-4 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-orange-500 font-semibold uppercase tracking-wide">Recommended Alternative</p>
                                    <p className="text-sm font-bold text-slate-800">{alternative!.drug}</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">{alternative!.dosage}</p>
                                </div>
                            </div>

                            {/* Reason */}
                            <div className="space-y-2">
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase mb-1">Why Switch?</p>
                                    <p className="text-xs text-slate-600 leading-relaxed">{alternative!.reason}</p>
                                </div>

                                {/* Evidence */}
                                <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                                    <p className="text-[10px] text-green-600 font-semibold uppercase mb-1 flex items-center gap-1">
                                        <FlaskConical className="h-2.5 w-2.5" /> Clinical Evidence
                                    </p>
                                    <p className="text-xs text-slate-600 leading-relaxed">{alternative!.evidence}</p>
                                </div>
                            </div>

                            {/* ML Model Badge */}
                            {ml && (
                                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-2">
                                    <span>ML: {ml.prediction_label} risk ({(ml.confidence_probability * 100).toFixed(0)}% prob.)</span>
                                    <span>AUC {ml.model_auc_score}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const InfoBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-slate-50 rounded-lg p-2">
        <p className="text-[10px] text-slate-400 font-medium uppercase">{label}</p>
        <p className="text-xs font-semibold text-slate-700 truncate">{value}</p>
    </div>
);

import { useState } from 'react';
import { Copy, Check, Download, ChevronRight, ChevronDown, Code } from 'lucide-react';

interface JsonViewerProps { data: any; }

export const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'pharmaguard_results.json';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Code className="h-4 w-4 text-blue-500" />
                    Raw JSON Output
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={handleCopy} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Copy">
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <button onClick={handleDownload} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Download">
                        <Download className="h-4 w-4" />
                    </button>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 ml-1" /> : <ChevronRight className="h-4 w-4 text-slate-400 ml-1" />}
                </div>
            </button>
            {isOpen && (
                <div className="border-t border-slate-100 p-4 bg-slate-900 max-h-[350px] overflow-auto">
                    <pre className="text-xs text-green-400 font-mono leading-relaxed">{JSON.stringify(data, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

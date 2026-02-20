import { useCallback, useState } from 'react';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';

interface FileUploadProps {
    onFileSelect: (file: File | null) => void;
    selectedFile: File | null;
}

const MAX_SIZE_MB = 5;

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, selectedFile }) => {
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    }, []);

    const validate = (file: File) => {
        setError(null);
        if (!file.name.toLowerCase().endsWith('.vcf')) { setError("Only .vcf files are accepted."); return; }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) { setError(`File must be under ${MAX_SIZE_MB}MB.`); return; }
        onFileSelect(file);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setDragActive(false);
        if (e.dataTransfer.files?.[0]) validate(e.dataTransfer.files[0]);
    }, [onFileSelect]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) validate(e.target.files[0]);
    };

    return (
        <div className="flex-1 flex flex-col">
            <label className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                {/* hidden -- label shown in parent card */}
            </label>

            {!selectedFile ? (
                <div
                    className={`flex-1 border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all
            ${dragActive ? 'border-biotech-purple bg-biotech-purple/5' : 'border-slate-200 hover:border-biotech-purple/50 hover:bg-biotech-purple/5'}
          `}
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                    onClick={() => document.getElementById('vcf-upload')?.click()}
                >
                    <input type="file" id="vcf-upload" className="hidden" accept=".vcf" onChange={handleChange} />
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${dragActive ? 'bg-biotech-purple/10' : 'bg-slate-100'}`}>
                        <Upload className={`h-6 w-6 ${dragActive ? 'text-biotech-purple' : 'text-slate-400'}`} />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">Drag & drop your VCF file here</p>
                    <p className="text-xs text-slate-400">or <span className="text-biotech-purple font-semibold">click to browse</span> · Max 5MB</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col justify-center">
                    <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-2.5 rounded-lg">
                                <FileText className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-700">{selectedFile.name}</p>
                                <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB &bull; Ready for analysis</p>
                            </div>
                        </div>
                        <button onClick={() => onFileSelect(null)} className="p-1.5 hover:bg-red-100 rounded-lg transition-colors">
                            <X className="h-4 w-4 text-slate-400 hover:text-red-500" />
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-3 flex items-center text-red-600 text-xs gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> {error}
                </div>
            )}
        </div>
    );
};

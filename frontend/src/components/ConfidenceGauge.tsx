import React from 'react';

export const ConfidenceGauge = ({ value = 85 }: { value?: number }) => {
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;

    return (
        <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
                <circle
                    className="text-slate-800"
                    cx="96"
                    cy="96"
                    fill="transparent"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                />
                <circle
                    className="text-neon-cyan drop-shadow-[0_0_8px_rgba(0,243,255,0.8)] transition-all duration-1000 ease-out"
                    cx="96"
                    cy="96"
                    fill="transparent"
                    r={radius}
                    stroke="currentColor"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeWidth="8"
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-mono font-bold text-white glow-text-cyan">{value}%</span>
                <span className="text-[10px] font-mono text-neon-cyan uppercase mt-1 tracking-widest">Confidence</span>
            </div>
        </div>
    );
};

// --- ICONE INTEGRATE ---
const ICONS_MAP = {
    Upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
    Activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    Calendar: <g><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></g>,
    FileText: <g><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></g>,
    Check: <polyline points="20 6 9 17 4 12" />,
    AlertCircle: <g><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></g>,
    RefreshCw: <g><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></g>,
    X: <g><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></g>,
    Edit2: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
    ArrowUpDown: <g><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></g>,
    Loader2: <path d="M21 12a9 9 0 1 1-6.219-8.56" />,
    Sparkles: <g><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M9 3v4" /><path d="M3 5h4" /><path d="M3 9h4" /></g>,
    MessageSquare: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    Copy: <g><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></g>,
    AlignLeft: <g><line x1="21" x2="3" y1="6" y2="6" /><line x1="15" x2="3" y1="12" y2="12" /><line x1="17" x2="3" y1="18" y2="18" /></g>,
    FileArchive: <g><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" /><polyline points="14 2 14 8 20 8" /><circle cx="10" cy="20" r="2" /><path d="M10 15v2" /><path d="M12.4 13a4 4 0 0 0-4.8 0" /></g>,
    UploadCloud: <g><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M12 12v9" /><path d="m16 16-4-4-4 4" /></g>,
    Lock: <g><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></g>,
    Info: <g><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="16" y2="12" /><line x1="12" x2="12.01" y1="8" y2="8" /></g>,
    Mail: <g><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></g>,
    Settings: <g><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.35a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></g>,
    Terminal: <g><polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" /></g>,
    ChevronLeft: <polyline points="15 18 9 12 15 6" />,
    ChevronRight: <polyline points="9 18 15 12 9 6" />,
    AlarmClock: <g><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M5 3 2 6" /><path d="m22 6-3-3" /><path d="M6.38 18.7 4 21" /><path d="M17.64 18.67 20 21" /></g>,
};

const Icon = ({ name, className, ...props }) => {
    if (!ICONS_MAP[name]) return null;
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>{ICONS_MAP[name]}</svg>
    );
};

// --- COMPONENTE LOGO MONTECENERI ---
const LogoMonteceneri = () => (
    <svg viewBox="0 0 320 100" className="h-16 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(10, 5) scale(0.8)">
            <defs>
                <clipPath id="shieldMask">
                    <path d="M0,0 H100 V65 C100,95 50,115 50,115 C50,115 0,95 0,65 V0 Z" />
                </clipPath>
            </defs>

            <g clipPath="url(#shieldMask)">
                <rect x="0" y="0" width="50" height="120" fill="#1e3a8a" />
                <rect x="50" y="0" width="50" height="120" fill="#d97706" />
                <path d="M0,80 L50,45 V120 H0 Z" fill="#d97706" />
                <path d="M100,80 L50,45 V120 H100 Z" fill="#1e3a8a" />
                <circle cx="50" cy="45" r="14" fill="#b91c1c" />
                <rect x="44" y="62" width="12" height="6" fill="#b91c1c" />
                <rect x="44" y="72" width="12" height="6" fill="#b91c1c" />
                <rect x="44" y="82" width="12" height="6" fill="#b91c1c" />
                <rect x="44" y="92" width="12" height="6" fill="#b91c1c" />
            </g>
        </g>
        <text x="110" y="48" fontFamily="Helvetica, Arial, sans-serif" fontSize="26" fill="#1e3a8a" fontWeight="400" letterSpacing="0.5">Comune di</text>
        <text x="110" y="78" fontFamily="Helvetica, Arial, sans-serif" fontSize="26" fill="#1e3a8a" fontWeight="bold" letterSpacing="0.5">Monteceneri</text>
    </svg>
);

// --- COMPONENTE BARRA PROGRESSO ---
const ProgressBar = ({ progress, total, label, color = "bg-blue-600" }) => (
    <div className="w-full mt-2 animate-in fade-in">
        <div className="flex justify-between text-xs text-slate-500 mb-1 font-medium">
            <span>{label}</span>
            <span>{progress} / {total}</span>
        </div>
        <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div
                className={`h-full ${color} transition-all duration-500 ease-out progress-bar-striped`}
                style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
            ></div>
        </div>
    </div>
);

// Esposizione globale per l'uso in app.js
window.ICONS_MAP = ICONS_MAP;
window.Icon = Icon;
window.LogoMonteceneri = LogoMonteceneri;
window.ProgressBar = ProgressBar;

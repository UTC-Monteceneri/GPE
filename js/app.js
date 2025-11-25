const { useState, useEffect, useRef } = React;

const App = () => {
    // --- STATO CARICAMENTO COMPONENTI GLOBALI ---
    const [componentsReady, setComponentsReady] = useState(false);

    useEffect(() => {
        const checkComponents = () => {
            if (window.Icon && window.ProgressBar && window.LogoMonteceneri) {
                setComponentsReady(true);
            } else {
                setTimeout(checkComponents, 50);
            }
        };
        checkComponents();
    }, []);

    // Recupera i componenti globali a runtime
    const { Icon, ProgressBar, LogoMonteceneri } = window;

    // --- PROMPTS DI SISTEMA ---
    const PROMPTS = window.MONTECENERI_PROMPTS || {
        RENAME: "ERRORE: File prompts.js non trovato.",
        SUMMARY: "ERRORE: File prompts.js non trovato.",
        DIPLOMATIC: "ERRORE: File prompts.js non trovato."
    };

    // --- CONFIGURAZIONE DOCUWARE ---
    const DOCUWARE_CONFIG = window.DOCUWARE_CONFIG || {};

    const fileInputRef = useRef(null);
    const dragCounter = useRef(0);

    // --- LISTE MENU A TENDINA ---
    const DOC_TYPES_LIST = window.DOC_TYPES_LIST || [];
    const PROJECT_PHASES_LIST = window.PROJECT_PHASES_LIST || [];

    // --- STATI ---
    const [config, setConfig] = useState({ apiKey: '', dwUser: '', dwPass: '' });
    const [showConfig, setShowConfig] = useState(false);
    const [files, setFiles] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [dragActive, setDragActive] = useState(false);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [libsLoaded, setLibsLoaded] = useState({ zip: false, mammoth: false, xlsx: false, msgreader: false });

    // --- STATI MODIFICA E ANTEPRIMA ---
    const [editingFileId, setEditingFileId] = useState(null);
    const [editForm, setEditForm] = useState({ filename: '', caseNumber: '', docType: '', projectPhase: '', date: '' });
    const [previewUrl, setPreviewUrl] = useState(null);

    const [activeAnalysisFile, setActiveAnalysisFile] = useState(null);
    const [analysisType, setAnalysisType] = useState('internal_summary');
    const [customPromptText, setCustomPromptText] = useState("");
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [dwModalOpen, setDwModalOpen] = useState(false);

    // DOCUWARE STATES
    const [dwStatus, setDwStatus] = useState('idle'); // idle, logging_in, uploading, success, error
    const [dwLog, setDwLog] = useState([]);
    const [dwProgress, setDwProgress] = useState({ current: 0, total: 0 }); // NUOVO STATO PROGRESSO

    const [libErrors, setLibErrors] = useState([]);

    // --- LOGICA FILE ---
    const formFinalFilename = (data) => {
        if (!data) return "";
        const sanitize = (str) => str ? str.replace(/[\\/:*?"<>|]/g, '').trim() : "";
        const entity = sanitize(data.entity);
        const subject = sanitize(data.subject);
        return entity && entity.toLowerCase() !== 's.n.' ? `${entity}, ${subject}` : subject;
    };

    // --- FUNZIONI HELPER MODIFICA ---
    const startEditing = (file) => {
        const dateObj = file.dateObject || new Date(file.file.lastModified);
        const dateString = dateObj.toISOString().split('T')[0];
        setEditForm({
            filename: file.manualOverride || formFinalFilename(file.data),
            caseNumber: file.data?.case_number || '',
            docType: file.data?.doc_type || '',
            projectPhase: file.data?.project_phase || '',
            date: dateString
        });
        if (file.file) setPreviewUrl(URL.createObjectURL(file.file));
        setEditingFileId(file.id);
    };

    const stopEditing = () => {
        setEditingFileId(null);
        if (previewUrl) {
            window.URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
    };

    const saveEdit = (originalFile, shouldClose = true) => {
        const validDate = editForm.date ? new Date(editForm.date + 'T12:00:00') : (originalFile.dateObject || new Date(originalFile.file.lastModified) || new Date());
        let safeCaseNumber = editForm.caseNumber;
        if (safeCaseNumber && !isNaN(parseInt(safeCaseNumber))) {
            safeCaseNumber = parseInt(safeCaseNumber);
        }

        setFiles(p => p.map(x => x.id === originalFile.id ? {
            ...x,
            manualOverride: editForm.filename,
            dateObject: validDate,
            data: {
                ...x.data,
                subject: editForm.filename,
                case_number: safeCaseNumber,
                doc_type: editForm.docType,
                project_phase: editForm.projectPhase,
                entity: (x.data && x.data.entity) ? x.data.entity : ""
            }
        } : x));

        if (shouldClose) {
            stopEditing();
        }
    };

    const navigateFile = (direction) => {
        const currentFile = files.find(f => f.id === editingFileId);
        if (currentFile) saveEdit(currentFile, false);

        const currentIndex = sortedFiles.findIndex(f => f.id === editingFileId);
        if (currentIndex === -1) return;

        let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (newIndex < 0) newIndex = sortedFiles.length - 1;
        if (newIndex >= sortedFiles.length) newIndex = 0;

        startEditing(sortedFiles[newIndex]);
    };

    useEffect(() => {
        const savedConfig = localStorage.getItem('monteceneri_config');
        if (savedConfig) {
            setConfig(JSON.parse(savedConfig));
        } else {
            setShowConfig(true);
        }
    }, []);

    const saveConfig = (newConfig) => {
        setConfig(newConfig);
        localStorage.setItem('monteceneri_config', JSON.stringify(newConfig));
        setShowConfig(false);
    };

    useEffect(() => {
        if (files.length === 0) {
            setHasStarted(false);
            setLoadingFiles(false);
        }
    }, [files.length]);

    useEffect(() => {
        const loadScriptWithFallback = async (id, urls) => {
            for (const url of urls) {
                try {
                    await new Promise((resolve, reject) => {
                        if (document.getElementById(id)) { resolve(); return; }
                        const script = document.createElement('script');
                        script.src = url;
                        script.id = id;
                        script.async = true;
                        script.onload = resolve;
                        script.onerror = () => {
                            document.head.removeChild(script);
                            reject(new Error(`Failed to load ${url}`));
                        };
                        document.head.appendChild(script);
                    });
                    return true;
                } catch (e) {
                    console.warn(`Tentativo fallito per ${id} su ${url}, provo il prossimo...`);
                }
            }
            return false;
        };

        const loadAll = async () => {
            await Promise.all([
                (async () => {
                    const zipOk = await loadScriptWithFallback("jszip-script", ["https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"]);
                    setLibsLoaded(prev => ({ ...prev, zip: zipOk }));
                    if (!zipOk) setLibErrors(prev => [...prev, "ZIP"]);
                })(),
                (async () => {
                    const mammothOk = await loadScriptWithFallback("mammoth-script", ["https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js", "https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js"]);
                    setLibsLoaded(prev => ({ ...prev, mammoth: mammothOk }));
                    if (!mammothOk) setLibErrors(prev => [...prev, "Word"]);
                })(),
                (async () => {
                    const xlsxOk = await loadScriptWithFallback("xlsx-script", ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"]);
                    setLibsLoaded(prev => ({ ...prev, xlsx: xlsxOk }));
                    if (!xlsxOk) setLibErrors(prev => [...prev, "Excel"]);
                })(),
                (async () => {
                    const datastreamOk = await loadScriptWithFallback("datastream-script", ["https://cdn.jsdelivr.net/npm/wl-msg-reader@0.2.1/lib/DataStream.js"]);
                    const msgreaderOk = await loadScriptWithFallback("msgreader-script", ["https://cdn.jsdelivr.net/npm/wl-msg-reader@0.2.1/lib/msg.reader.js"]);
                    setLibsLoaded(prev => ({ ...prev, msgreader: (datastreamOk && msgreaderOk) }));
                    if (!msgreaderOk || !datastreamOk) setLibErrors(prev => [...prev, "MSG"]);
                })()
            ]);
        };
        loadAll();
    }, []);

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setDragActive(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) {
            setDragActive(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        dragCounter.current = 0;
        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles && droppedFiles.length > 0) {
            setLoadingFiles(true);
            setTimeout(() => {
                const newFiles = Array.from(droppedFiles).map(file => ({
                    id: Math.random().toString(36).substr(2, 9),
                    file,
                    originalName: file.name,
                    status: 'pending',
                    data: null
                }));
                setFiles(prev => [...prev, ...newFiles]);
                setLoadingFiles(false);
            }, 200);
        }
    };

    const criticalLibsReady = libsLoaded.zip;

    const readFileSafe = async (file, method) => {
        if (method === 'arrayBuffer') return await file.arrayBuffer();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    };

    const prepareFileForGemini = async (file) => {
        const ext = file.name.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
            const dataUrl = await readFileSafe(file, 'dataURL');
            let encoded = dataUrl.toString().replace(/^data:(.*,)?/, '');
            if ((encoded.length % 4) > 0) encoded += '='.repeat(4 - (encoded.length % 4));
            return { type: 'binary', mime: file.type, content: encoded };
        }
        if (['docx'].includes(ext)) {
            if (!libsLoaded.mammoth || !window.mammoth) return { type: 'error', content: '' };
            const arrayBuffer = await readFileSafe(file, 'arrayBuffer');
            const result = await window.mammoth.extractRawText({ arrayBuffer });
            return { type: 'text', content: result.value };
        }
        if (['xlsx', 'xls', 'csv'].includes(ext)) {
            if (!libsLoaded.xlsx || !window.XLSX) return { type: 'error', content: '' };
            const arrayBuffer = await readFileSafe(file, 'arrayBuffer');
            const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const csvText = window.XLSX.utils.sheet_to_csv(worksheet);
            return { type: 'text', content: csvText };
        }
        if (['msg'].includes(ext)) {
            if (!libsLoaded.msgreader || !window.MSGReader) return { type: 'error', content: '' };
            const arrayBuffer = await readFileSafe(file, 'arrayBuffer');
            const msgReader = new window.MSGReader(arrayBuffer);
            const fileData = msgReader.getFileData();
            let emailContent = '';
            if (fileData.subject) emailContent += `Oggetto: ${fileData.subject}\n\n`;
            if (fileData.senderName) emailContent += `Da: ${fileData.senderName}\n`;
            if (fileData.body) emailContent += `\n${fileData.body}`;
            return { type: 'text', content: emailContent };
        }
        return { type: 'error', content: '' };
    };

    const callGemini = async (fileData, prompt, systemPrompt, jsonMode = false) => {
        if (!config.apiKey) throw new Error("API Key non configurata nelle impostazioni!");
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${config.apiKey}`;
        let userPart;
        if (fileData.type === 'binary') {
            userPart = { inline_data: { mime_type: fileData.mime, data: fileData.content } };
        } else {
            userPart = { text: `DOCUMENTO ESTRATTO:\n${fileData.content}` };
        }
        const finalPrompt = systemPrompt + "\n\n" + prompt;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: finalPrompt }, userPart] }],
                generationConfig: jsonMode ? { response_mime_type: "application/json" } : {}
            })
        });
        if (!response.ok) throw new Error(`Errore API: ${response.status}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    };

    const processFiles = async () => {
        if (!config.apiKey) { setShowConfig(true); return; }
        const todo = files.filter(f => f.status === 'pending' || f.status === 'error');
        if (todo.length === 0) return;

        setIsProcessing(true); setHasStarted(true); setProgress({ current: 0, total: todo.length });
        let count = 0;

        const BATCH_SIZE = 3;
        for (let i = 0; i < todo.length; i += BATCH_SIZE) {
            const batch = todo.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (f) => {
                setFiles(p => p.map(x => x.id === f.id ? { ...x, status: 'processing' } : x));
                try {
                    const prep = await prepareFileForGemini(f.file);
                    const res = await callGemini(prep, "Estrai i metadati.", PROMPTS.RENAME, true);
                    const json = JSON.parse(res.replace(/```json|```/g, '').trim());
                    let docDate = null;
                    if (json.date_year && json.date_year !== "0000") {
                        docDate = new Date(parseInt(json.date_year), parseInt(json.date_month) - 1, parseInt(json.date_day), 12);
                    } else { docDate = new Date(f.file.lastModified); }
                    setFiles(p => p.map(x => x.id === f.id ? {
                        ...x,
                        status: 'success',
                        data: json,
                        processed: true,
                        dateObject: docDate,
                        extractedText: prep.type === 'text' ? prep.content : null
                    } : x));
                } catch (e) {
                    setFiles(p => p.map(x => x.id === f.id ? { ...x, status: 'error', errorMessage: e.message } : x));
                } finally {
                    count++;
                    setProgress({ current: count, total: todo.length });
                }
            }));
        }
        setIsProcessing(false);
    };

    const handleToolAnalysis = async (type) => {
        if (!activeAnalysisFile) return;
        if (!config.apiKey) { alert("API Key mancante!"); setShowConfig(true); return; }
        setAnalysisType(type);
        setIsAnalyzing(true);
        setAnalysisResult(null);
        let promptSystem;
        if (type === 'diplomatic_response') promptSystem = PROMPTS.DIPLOMATIC;
        else if (type === 'custom') {
            if (!customPromptText.trim()) { alert("Inserisci un prompt personalizzato!"); setIsAnalyzing(false); return; }
            promptSystem = customPromptText;
        }
        else promptSystem = PROMPTS.SUMMARY;
        try {
            let preparedData;
            if (activeAnalysisFile.content) {
                preparedData = { type: 'text', content: activeAnalysisFile.content };
            } else {
                preparedData = await prepareFileForGemini(activeAnalysisFile.file);
            }
            const resultText = await callGemini(preparedData, "Genera il testo richiesto.", promptSystem, false);
            setAnalysisResult(resultText);
        } catch (e) {
            setAnalysisResult("Errore durante l'analisi: " + e.message);
        } finally {
            setIsAnalyzing(false);
        }
    };
    const downloadAllZip = async () => {
        if (!window.JSZip) { alert("Libreria ZIP non ancora caricata. Riprova tra poco."); return; }
        const validFiles = files.filter(f => f.status === 'success' || f.manualOverride);
        if (validFiles.length === 0) { alert("Nessun file elaborato da scaricare."); return; }
        const zip = new window.JSZip();
        const folder = zip.folder("Rinominati_Monteceneri");
        validFiles.forEach(f => {
            const ext = f.originalName.split('.').pop();
            const name = f.manualOverride || formFinalFilename(f.data);
            folder.file(`${name}.${ext}`, f.file);
        });
        try {
            const content = await zip.generateAsync({ type: "blob" });
            const url = window.URL.createObjectURL(content);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Posta_Monteceneri_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e) {
            alert("Errore creazione ZIP: " + e.message);
        }
    };

    const handleDocuWareUpload = async () => {
        if (!config.dwUser || !config.dwPass) { alert("Configura Username e Password nelle impostazioni!"); setShowConfig(true); return; }
        const todo = files.filter(f => f.status === 'success' || f.manualOverride);
        if (todo.length === 0) return;

        setDwStatus('logging_in'); setDwLog([]);
        setDwProgress({ current: 0, total: todo.length }); // RESET PROGRESSO
        const log = (m) => setDwLog(p => [...p, m]);

        log("Login su Tommaso...");
        try {
            const loginForm = new URLSearchParams();
            loginForm.append('UserName', config.dwUser);
            loginForm.append('Password', config.dwPass);
            loginForm.append('RememberMe', 'false');

            const loginRes = await fetch(`${DOCUWARE_CONFIG.baseUrl}/Account/Logon`, {
                method: 'POST', body: loginForm, credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }
            });

            if (!loginRes.ok) throw new Error(`Login Error: ${loginRes.status}`);
            log("âœ… Login OK. Inizio caricamento...");
            setDwStatus('uploading');

            let uploadCount = 0;
            for (const f of todo) {
                const ext = f.originalName.split('.').pop();
                const finalName = f.manualOverride || formFinalFilename(f.data);
                const filename = `${finalName}.${ext}`;
                log(`>> ${filename}`);

                try {
                    const fieldsToUpdate = [];
                    if (f.dateObject && DOCUWARE_CONFIG.fields.date) {
                        const year = f.dateObject.getFullYear();
                        const month = String(f.dateObject.getMonth() + 1).padStart(2, '0');
                        const day = String(f.dateObject.getDate()).padStart(2, '0');
                        fieldsToUpdate.push({ "FieldName": DOCUWARE_CONFIG.fields.date, "Item": `${year}-${month}-${day}`, "ItemElementName": "Date" });
                    }
                    const subjectToSend = f.data?.subject || f.manualOverride;
                    if (subjectToSend && DOCUWARE_CONFIG.fields.subject) {
                        fieldsToUpdate.push({ "FieldName": DOCUWARE_CONFIG.fields.subject, "Item": subjectToSend, "ItemElementName": "String" });
                    }
                    if (f.data?.entity && DOCUWARE_CONFIG.fields.entity) {
                        fieldsToUpdate.push({ "FieldName": DOCUWARE_CONFIG.fields.entity, "Item": f.data.entity, "ItemElementName": "String" });
                    }
                    if (f.data?.doc_type && DOCUWARE_CONFIG.fields.docType) {
                        fieldsToUpdate.push({ "FieldName": DOCUWARE_CONFIG.fields.docType, "Item": f.data.doc_type, "ItemElementName": "String" });
                    }
                    if (f.data?.project_phase && DOCUWARE_CONFIG.fields.projectPhase) {
                        fieldsToUpdate.push({ "FieldName": DOCUWARE_CONFIG.fields.projectPhase, "Item": f.data.project_phase, "ItemElementName": "String" });
                    }
                    if (f.data?.case_number && DOCUWARE_CONFIG.fields.caseNumber) {
                        fieldsToUpdate.push({
                            "FieldName": DOCUWARE_CONFIG.fields.caseNumber,
                            "Item": f.data.case_number,
                            "ItemElementName": "Int"
                        });
                    }

                    const fd = new FormData();
                    const documentMetadata = { "Fields": fieldsToUpdate };
                    fd.append('document', new Blob([JSON.stringify(documentMetadata)], { type: 'application/json' }));
                    fd.append('file', f.file, filename);

                    const upRes = await fetch(`${DOCUWARE_CONFIG.baseUrl}/FileCabinets/${DOCUWARE_CONFIG.basketId}/Documents`, {
                        method: 'POST',
                        body: fd,
                        credentials: 'include',
                        headers: { 'Accept': 'application/json' }
                    });

                    if (!upRes.ok) {
                        throw new Error(`Status ${upRes.status}`);
                    }
                    log("   âœ… Caricato e Indicizzato");
                } catch (e) {
                    if (e.message.includes("Failed to fetch")) {
                        log("   âš ï¸ Possibile successo (No risposta server)");
                    } else {
                        log(`âŒ Errore: ${e.message}`);
                    }
                } finally {
                    uploadCount++;
                    setDwProgress({ current: uploadCount, total: todo.length });
                }
            }
            log("--- FINE ---"); setDwStatus('done');
            setTimeout(() => setFiles([]), 3000);
        } catch (e) {
            log(`âŒ ERRORE SISTEMA: ${e.message}`);
            setDwStatus('error');
        }
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const sortedFiles = React.useMemo(() => {
        if (!sortConfig.key) return files;
        return [...files].sort((a, b) => {
            let aVal = sortConfig.key === 'docDate' ? (a.dateObject ? a.dateObject.getTime() : 0) : a[sortConfig.key];
            let bVal = sortConfig.key === 'docDate' ? (b.dateObject ? b.dateObject.getTime() : 0) : b[sortConfig.key];
            if (sortConfig.key === 'generatedName') {
                aVal = a.processed ? formFinalFilename(a.data) : 'zzz';
                bVal = b.processed ? formFinalFilename(b.data) : 'zzz';
            }
            if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }, [files, sortConfig]);

    if (!componentsReady) return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 font-sans">
            <div className="w-12 h-12 border-4 border-slate-200 border-b-blue-900 rounded-full animate-spin mb-5"></div>
            <div className="text-lg font-semibold text-slate-600 animate-pulse">Caricamento moduli...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100 relative">
            <header className="bg-white border-b-4 border-blue-900 shadow-md sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <LogoMonteceneri />
                        <div className="hidden md:block h-10 w-px bg-slate-200"></div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-blue-900 tracking-tight">Gestione Posta in Entrata</h2>
                                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded border border-blue-200">v1.00</span>
                            </div>
                            <p className="text-sm text-slate-500 font-medium uppercase tracking-wide">Ufficio Tecnico</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowConfig(true)} className="p-2 text-slate-400 hover:text-blue-700 transition-colors rounded-full hover:bg-slate-100" title="Impostazioni">
                            <Icon name="Settings" className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </header >

            < main className="max-w-7xl mx-auto p-6" >
                {!hasStarted && (
                    <div
                        onClick={() => fileInputRef.current.click()}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className={`
                        group relative rounded-3xl p-12 text-center cursor-pointer overflow-hidden border-4 
                        transition-colors duration-200 ease-in-out
                        ${dragActive ? 'bg-blue-50 border-blue-500 shadow-xl border-solid' : 'bg-white border-dashed border-slate-300 hover:border-blue-400 hover:shadow-lg'}
                    `}
                    >
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                    setLoadingFiles(true);
                                    setTimeout(() => {
                                        const newFiles = Array.from(e.target.files).map(file => ({
                                            id: Math.random().toString(36).substr(2, 9),
                                            file, originalName: file.name, status: 'pending', data: null
                                        }));
                                        setFiles(prev => [...prev, ...newFiles]);
                                        setLoadingFiles(false);
                                    }, 300);
                                }
                            }}
                        />
                        <div className="relative z-10 flex flex-col items-center gap-5 pointer-events-none">
                            <div className={`p-5 rounded-full transition-all duration-300 ${loadingFiles ? 'bg-blue-100 text-blue-600 scale-110' : 'bg-slate-100 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50'}`}>
                                <Icon name={loadingFiles ? "Loader2" : "Upload"} className={`w-10 h-10 ${loadingFiles ? 'animate-spin' : ''}`} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-700 mb-1">
                                    {dragActive ? "Rilascia i file qui!" : (loadingFiles ? "Lettura in corso..." : "Trascina qui i documenti")}
                                </h3>
                                <p className="text-slate-400 text-sm">
                                    {dragActive ? "Li prenderÃ² al volo" : "o clicca per selezionare dal computer"}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {
                    files.length > 0 && (
                        <div className="mt-8 slide-up">
                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Icon name="FileText" className="w-5 h-5 text-blue-600" /> Documenti in lavorazione</h3>
                                    <p className="text-slate-400 text-sm">{files.length} file caricati in lista</p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={processFiles} disabled={isProcessing} className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all transform hover:scale-105 disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed">
                                        {isProcessing ? <Icon name="Loader2" className="w-5 h-5 animate-spin" /> : <Icon name="RefreshCw" className="w-5 h-5" />}
                                        {isProcessing ? "Analisi..." : "Avvia Elaborazione"}
                                    </button>
                                    <button onClick={() => downloadAllZip(true)} className="bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all">
                                        {libsLoaded.zip ? <Icon name="FileArchive" className="w-5 h-5 text-slate-500" /> : <Icon name="Loader2" className="animate-spin w-5 h-5" />}
                                        Scarica ZIP
                                    </button>
                                    <button onClick={() => setDwModalOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-all transform hover:scale-105">
                                        <Icon name="UploadCloud" className="w-5 h-5" /> Tommaso
                                    </button>
                                </div>
                            </div>
                            {isProcessing && (
                                <div className="mb-6">
                                    <ProgressBar progress={progress.current} total={progress.total} label={`Avanzamento Elaborazione: ${progress.current} di ${progress.total} completati`} color="bg-blue-600" />
                                </div>
                            )}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-4">
                                <div className="grid grid-cols-12 bg-slate-50 p-4 text-xs font-bold text-slate-500 uppercase border-b border-slate-200 tracking-wider">
                                    <div className="col-span-4 cursor-pointer hover:text-blue-700 flex items-center gap-1" onClick={() => requestSort('originalName')}>Originale <Icon name="ArrowUpDown" className="w-3 h-3" /></div>
                                    <div className="col-span-6 cursor-pointer hover:text-blue-700 flex items-center gap-1" onClick={() => requestSort('generatedName')}>Dati Elaborati e Proposta <Icon name="ArrowUpDown" className="w-3 h-3" /></div>
                                    <div className="col-span-2 text-right">Azioni</div>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {sortedFiles.map(f => (
                                        <div key={f.id} className={`p-4 transition-colors ${editingFileId === f.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                            {editingFileId !== f.id && (
                                                <div className="grid grid-cols-12 gap-4 items-start">
                                                    <div className="col-span-4">
                                                        <div className="text-sm font-medium text-slate-500 break-words mb-2">{f.originalName}</div>
                                                        <div>
                                                            {f.status === 'pending' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">In attesa</span>}
                                                            {f.status === 'processing' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100"><Icon name="Loader2" className="w-3 h-3 mr-1 animate-spin" /> Analisi...</span>}
                                                            {f.status === 'success' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100"><Icon name="Check" className="w-3 h-3 mr-1" /> Pronto</span>}
                                                            {f.status === 'error' && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100" title={f.errorMessage}><Icon name="AlertCircle" className="w-3 h-3 mr-1" /> Errore</span>}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-6">
                                                        <div onClick={() => startEditing(f)} className="text-base font-bold text-slate-800 break-words leading-snug mb-2 cursor-pointer hover:text-blue-600 transition-colors" title="Clicca per modificare">
                                                            {f.manualOverride || formFinalFilename(f.data) || "---"} <Icon name="Edit2" className="inline w-3 h-3 ml-2 text-slate-300" />
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <span onClick={() => startEditing(f)} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 transition-all"><Icon name="Calendar" className="w-3 h-3 mr-1.5 text-slate-400" />{f.dateObject ? f.dateObject.toLocaleDateString('it-CH') : 'No Data'}</span>
                                                            <span onClick={() => startEditing(f)} className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 ${f.data?.case_number ? 'bg-purple-50 text-purple-700 border-purple-100 hover:ring-purple-200' : 'bg-slate-50 text-slate-400 border-dashed border-slate-300 hover:ring-slate-200'}`}>
                                                                <span className="font-bold mr-1">N.</span> {f.data?.case_number || "Incarto?"}
                                                            </span>
                                                            <span onClick={() => startEditing(f)} className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 max-w-xs truncate ${f.data?.doc_type ? 'bg-orange-50 text-orange-700 border-orange-100 hover:ring-orange-200' : 'bg-slate-50 text-slate-400 border-dashed border-slate-300 hover:ring-slate-200'}`}>
                                                                <Icon name="FileText" className={`w-3 h-3 mr-1.5 ${f.data?.doc_type ? 'text-orange-400' : 'text-slate-300'}`} />{f.data?.doc_type || "Tipo Doc?"}
                                                            </span>
                                                            <span onClick={() => startEditing(f)} className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 max-w-xs truncate ${f.data?.project_phase ? 'bg-blue-50 text-blue-700 border-blue-100 hover:ring-blue-200' : 'bg-slate-50 text-slate-400 border-dashed border-slate-300 hover:ring-slate-200'}`}>
                                                                <Icon name="Activity" className={`w-3 h-3 mr-1.5 ${f.data?.project_phase ? 'text-blue-400' : 'text-slate-300'}`} />{f.data?.project_phase || "Fase?"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 flex justify-end gap-2">
                                                        {(f.status === 'success' || f.status === 'error') && (
                                                            <>
                                                                <button onClick={() => startEditing(f)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm"><Icon name="Edit2" className="w-4 h-4" /></button>
                                                                <button onClick={() => { setActiveAnalysisFile(f); setAnalysisType('internal_summary'); setAnalysisResult(null); }} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-yellow-600 hover:border-yellow-300 transition-all shadow-sm"><Icon name="Sparkles" className="w-4 h-4" /></button>
                                                                <button onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-red-600 hover:border-red-300 transition-all shadow-sm"><Icon name="X" className="w-4 h-4" /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >

            {
                showConfig && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm fade-in">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Icon name="Settings" className="w-5 h-5 text-slate-500" /> Configurazione</h2>
                            <p className="text-sm text-slate-500 mb-6">I dati vengono salvati localmente nel browser.</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Google Gemini API Key</label>
                                    <input type="password" value={config.apiKey} onChange={e => setConfig({ ...config, apiKey: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" placeholder="" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">User Tommaso</label>
                                        <input type="text" value={config.dwUser} onChange={e => setConfig({ ...config, dwUser: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Password</label>
                                        <input type="password" value={config.dwPass} onChange={e => setConfig({ ...config, dwPass: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow" />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end gap-3">
                                {config.apiKey && <button onClick={() => setShowConfig(false)} className="text-slate-500 hover:text-slate-700 text-sm px-3 font-medium transition-colors">Annulla</button>}
                                <button onClick={() => saveConfig(config)} className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-blue-900/10 transition-all transform hover:-translate-y-0.5">Salva Configurazione</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {editingFileId && (() => {
                const f = files.find(x => x.id === editingFileId);
                if (!f) return null;
                return (
                    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-[98vw] h-[95vh] flex flex-col overflow-hidden border border-slate-700">
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => navigateFile('prev')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-700 hover:border-blue-300 transition-all shadow-sm" title="Salva e vai al precedente">
                                            <Icon name="ChevronLeft" className="w-4 h-4" /> Precedente
                                        </button>
                                        <button onClick={() => navigateFile('next')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-700 hover:border-blue-300 transition-all shadow-sm" title="Salva e vai al successivo">
                                            Successivo <Icon name="ChevronRight" className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="h-8 w-px bg-slate-300 mx-2"></div>
                                    <div className="flex flex-col">
                                        <h4 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                                            <Icon name="Edit2" className="w-5 h-5" /> Modifica e Verifica
                                        </h4>
                                        <p className="text-sm text-slate-500 font-mono mt-1 max-w-md truncate">{f.originalName}</p>
                                    </div>
                                </div>
                                <button onClick={stopEditing} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-full transition-colors" title="Chiudi senza salvare">
                                    <Icon name="X" className="w-8 h-8" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <div className="h-full grid grid-cols-1 lg:grid-cols-12 divide-x divide-slate-200">
                                    <div className="lg:col-span-4 p-8 overflow-y-auto bg-white flex flex-col h-full">
                                        <div className="space-y-6 flex-1">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Nome Documento (Oggetto)</label>
                                                <textarea autoFocus rows="3" value={editForm.filename} onChange={e => setEditForm({ ...editForm, filename: e.target.value })} className="w-full border border-slate-300 rounded-lg p-3 text-base focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 shadow-sm resize-none" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">N. Incarto</label>
                                                    <input type="text" value={editForm.caseNumber} onChange={e => setEditForm({ ...editForm, caseNumber: e.target.value })} className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-purple-50/50 text-purple-900 font-bold" placeholder="Es. 726" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Tipo Documento</label>
                                                    <select value={editForm.docType} onChange={e => setEditForm({ ...editForm, docType: e.target.value })} className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-orange-50/30 text-slate-700">
                                                        <option value="">-- Seleziona --</option>
                                                        {DOC_TYPES_LIST.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Fase Progetto</label>
                                                <select value={editForm.projectPhase} onChange={e => setEditForm({ ...editForm, projectPhase: e.target.value })} className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50/30 text-slate-700">
                                                    <option value="">-- Seleziona --</option>
                                                    {PROJECT_PHASES_LIST.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Data Documento</label>
                                                <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none bg-green-50/30 text-slate-700 font-medium" />
                                            </div>
                                        </div>
                                        <div className="pt-6 mt-6 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white">
                                            <button onClick={stopEditing} className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors">Annulla</button>
                                            <button onClick={() => saveEdit(f)} className="flex-[2] px-6 py-3 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"><Icon name="Check" className="w-5 h-5" /> Salva Modifiche</button>
                                        </div>
                                    </div>
                                    <div className="lg:col-span-8 bg-slate-800 h-full flex flex-col relative">
                                        <div className="bg-slate-900 px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 flex justify-between shrink-0">
                                            <span>Anteprima File</span>
                                            <span>{previewUrl ? 'Visualizzazione Attiva' : 'Caricamento...'}</span>
                                        </div>
                                        <div className="flex-1 w-full h-full bg-slate-200 overflow-hidden relative">
                                            {previewUrl ? (
                                                f.file.type.startsWith('image/') ? (
                                                    <img src={previewUrl} className="w-full h-full object-contain block" alt="Anteprima" />
                                                ) : f.file.type === 'application/pdf' ? (
                                                    <iframe src={previewUrl} className="w-full h-full object-contain block" title="Anteprima" />
                                                ) : (
                                                    f.extractedText ? (
                                                        <div className="w-full h-full p-6 overflow-auto bg-white">
                                                            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 sticky top-0 bg-white py-2 border-b border-slate-100">
                                                                <Icon name="FileText" className="w-5 h-5 text-blue-600" />
                                                                Contenuto Testuale Estratto
                                                            </h4>
                                                            <pre className="whitespace-pre-wrap font-mono text-sm text-slate-600 leading-relaxed">
                                                                {f.extractedText}
                                                            </pre>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 p-8 text-center">
                                                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center"><Icon name="FileText" className="w-10 h-10 text-slate-300" /></div>
                                                            <div>
                                                                <h4 className="font-bold text-slate-600 mb-1">Anteprima non disponibile</h4>
                                                                <p className="text-sm">Il formato <strong>{f.file.name.split('.').pop().toUpperCase()}</strong> non supporta l'anteprima rapida.</p>
                                                                <p className="text-xs mt-2 text-slate-400">Apri il file originale per visualizzarlo.</p>
                                                            </div>
                                                        </div>
                                                    )
                                                )
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-slate-400 gap-3"><Icon name="Loader2" className="w-8 h-8 animate-spin" /></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {
                dwModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm fade-in">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                            <div className="p-5 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                                <h3 className="font-bold text-orange-900 flex gap-2 items-center"><Icon name="UploadCloud" className="w-5 h-5" /> Caricamento su Tommaso</h3>
                                <button onClick={() => { setDwModalOpen(false); setDwStatus('idle'); }} className="text-orange-400 hover:text-orange-600 bg-white/50 hover:bg-white p-1 rounded-full transition-all"><Icon name="X" className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-6">
                                {dwStatus === 'idle' && (
                                    <>
                                        <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 border border-blue-100 shadow-sm">
                                            <div className="flex gap-3">
                                                <Icon name="Info" className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                                                <div className="leading-relaxed">
                                                    <strong>Istruzioni per 'Allow CORS':</strong><br />
                                                    <ol className="list-decimal ml-4 mt-1 space-y-1 text-xs">
                                                        <li>Installa l'estensione <a href="https://chromewebstore.google.com/detail/allow-cors-access-control/lhobafahddgcelffkeicbaginigeejlf" target="_blank" className="underline font-bold hover:text-blue-900">da qui</a>.</li>
                                                        <li>Clicca l'icona <strong>C</strong> nel browser per attivarla.</li>
                                                        <li>Apri le Opzioni e spunta <strong>Access-Control-Allow-Credentials</strong>.</li>
                                                    </ol>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => window.open(DOCUWARE_CONFIG.loginUrl, '_blank')} className="w-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all group">
                                            <Icon name="Lock" className="w-4 h-4 text-green-600 group-hover:scale-110 transition-transform" /> Sblocca Accesso Server (Login Web)
                                        </button>
                                        <div className="border-t border-slate-100 my-4"></div>
                                        <div className="text-center">
                                            <p className="text-sm text-slate-500 mb-4">Pronto a caricare <strong className="text-slate-800">{files.filter(f => f.status === 'success' || f.manualOverride).length}</strong> documenti.</p>
                                            <button onClick={handleDocuWareUpload} className="w-full bg-orange-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-600/20 hover:bg-orange-700 hover:shadow-orange-600/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5">
                                                <Icon name="UploadCloud" className="w-5 h-5" /> Inizia Caricamento
                                            </button>
                                        </div>
                                    </>
                                )}
                                {(dwStatus === 'logging_in' || dwStatus === 'uploading') && (
                                    <div>
                                        <div className="mb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                {dwStatus === 'logging_in' && <Icon name="Loader2" className="w-5 h-5 animate-spin text-blue-600" />}
                                                <span className="font-bold text-slate-700">
                                                    {dwStatus === 'logging_in' ? 'Connessione in corso...' :
                                                        dwStatus === 'uploading' ? 'Caricamento documenti...' :
                                                            dwStatus === 'success' ? 'Operazione Completata' : 'Errore'}
                                                </span>
                                            </div>
                                            {dwStatus === 'uploading' && (
                                                <ProgressBar progress={dwProgress.current} total={dwProgress.total} label={`Avanzamento Upload: ${dwProgress.current} di ${dwProgress.total}`} color="bg-orange-500" />
                                            )}
                                        </div>
                                        <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono h-48 overflow-y-auto border border-slate-700 shadow-inner">
                                            {dwLog.map((l, i) => <div key={i} className="border-b border-slate-800/50 pb-1.5 mb-1.5 last:border-0 last:pb-0 last:mb-0">{l}</div>)}
                                        </div>
                                    </div>
                                )}
                                {(dwStatus === 'done' || dwStatus === 'error') && (
                                    <div>
                                        <div className="flex flex-col items-center justify-center gap-4 mb-6">
                                            {dwStatus === 'done' ?
                                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center"><Icon name="Check" className="w-8 h-8 text-green-600" /></div> :
                                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center"><Icon name="AlertCircle" className="w-8 h-8 text-red-600" /></div>
                                            }
                                            <span className="font-bold text-lg text-slate-700">{dwStatus === 'done' ? 'Operazione Completata!' : 'Errore Caricamento'}</span>
                                        </div>
                                        <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono h-48 overflow-y-auto border border-slate-700 shadow-inner mb-6">
                                            {dwLog.map((l, i) => <div key={i} className="border-b border-slate-800/50 pb-1.5 mb-1.5 last:border-0 last:pb-0 last:mb-0">{l}</div>)}
                                        </div>
                                        <div className="flex gap-3">
                                            {dwStatus === 'error' && (
                                                <button onClick={() => setDwStatus('idle')} className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                                                    <Icon name="RefreshCw" className="w-4 h-4" /> Riprova
                                                </button>
                                            )}
                                            <button onClick={() => { setDwModalOpen(false); setDwStatus('idle'); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors">Chiudi</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {
                activeAnalysisFile && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200">
                            <div className="p-6 border-b flex justify-between items-center bg-white">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-50 p-3 rounded-xl text-blue-700 shadow-sm"><Icon name="Sparkles" className="w-6 h-6" /></div>
                                    <div>
                                        <h3 className="font-bold text-xl text-slate-800">Analisi Intelligente</h3>
                                        <p className="text-xs text-slate-500 truncate max-w-md font-medium mt-0.5">{activeAnalysisFile.manualOverride || formFinalFilename(activeAnalysisFile.data)}</p>
                                    </div>
                                </div>
                                <button onClick={() => setActiveAnalysisFile(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-all"><Icon name="X" className="w-6 h-6" /></button>
                            </div>
                            <div className="flex border-b border-slate-200 bg-slate-50/50">
                                <button onClick={() => { setAnalysisType('internal_summary'); setAnalysisResult(null); }} className={`flex-1 py-4 text-sm font-bold transition-all ${analysisType === 'internal_summary' ? 'bg-white text-blue-700 border-b-2 border-blue-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                                    <span className="flex items-center justify-center gap-2"><Icon name="AlignLeft" className="w-4 h-4" /> Riassunto Interno</span>
                                </button>
                                <button onClick={() => { setAnalysisType('diplomatic_response'); setAnalysisResult(null); }} className={`flex-1 py-4 text-sm font-bold transition-all ${analysisType === 'diplomatic_response' ? 'bg-white text-blue-700 border-b-2 border-blue-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                                    <span className="flex items-center justify-center gap-2"><Icon name="MessageSquare" className="w-4 h-4" /> Risposta Diplomatica</span>
                                </button>
                                <button onClick={() => { setAnalysisType('custom'); setAnalysisResult(null); }} className={`flex-1 py-4 text-sm font-bold transition-all ${analysisType === 'custom' ? 'bg-white text-blue-700 border-b-2 border-blue-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                                    <span className="flex items-center justify-center gap-2"><Icon name="Terminal" className="w-4 h-4" /> Prompt Personalizzato</span>
                                </button>
                            </div>
                            <div className="p-8 flex-1 overflow-y-auto min-h-[400px] bg-white">
                                {!analysisResult && !isAnalyzing && (
                                    <div className="text-center mt-8 animate-in fade-in">
                                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <Icon name={analysisType === 'custom' ? "Terminal" : "Sparkles"} className="w-10 h-10 text-blue-300" />
                                        </div>

                                        {analysisType === 'custom' ? (
                                            <div className="max-w-lg mx-auto mb-8">
                                                <h4 className="text-lg font-bold text-slate-700 mb-2">Chiedi all'AI</h4>
                                                <p className="text-slate-400 text-sm mb-4">Scrivi una richiesta specifica per analizzare questo documento.</p>
                                                <textarea
                                                    value={customPromptText}
                                                    onChange={(e) => setCustomPromptText(e.target.value)}
                                                    placeholder="Es: Estrai tutte le date di scadenza... oppure Traduci in francese..."
                                                    className="w-full border border-slate-300 rounded-xl p-4 text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm min-h-[120px]"
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <h4 className="text-lg font-bold text-slate-700 mb-2">Pronto a generare</h4>
                                                <p className="text-slate-400 text-sm mb-8">L'intelligenza artificiale analizzerÃ  il contenuto del documento<br />per creare il testo richiesto.</p>
                                            </>
                                        )}

                                        <button onClick={() => handleToolAnalysis(analysisType)} className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-4 rounded-xl shadow-lg hover:shadow-xl shadow-blue-900/20 transition-all transform hover:-translate-y-1 font-bold flex items-center gap-3 mx-auto text-base">
                                            <Icon name="Sparkles" className="w-5 h-5" /> Genera {analysisType === 'internal_summary' ? 'Riassunto' : (analysisType === 'diplomatic_response' ? 'Bozza' : 'Risposta')}
                                        </button>
                                    </div>
                                )}
                                {isAnalyzing && (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-6 animate-in fade-in">
                                        <div className="relative">
                                            <div className="w-16 h-16 border-4 border-blue-100 rounded-full"></div>
                                            <div className="w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                                            <Icon name="Sparkles" className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                        </div>
                                        <p className="font-medium text-slate-600 animate-pulse">Elaborazione in corso...</p>
                                    </div>
                                )}
                                {analysisResult && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 h-full flex flex-col">
                                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-sm font-mono text-slate-700 whitespace-pre-wrap leading-relaxed shadow-inner flex-1 overflow-y-auto">{analysisResult}</div>
                                        <div className="mt-6 flex justify-between items-center gap-3">
                                            <span className="text-xs text-slate-400 mr-auto">Generato da Gemini AI</span>
                                            <button
                                                onClick={() => window.location.href = `mailto:?body=${encodeURIComponent(analysisResult)}`}
                                                className="bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 text-slate-600 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
                                            >
                                                <Icon name="Mail" className="w-4 h-4" /> Invia con Outlook
                                            </button>
                                            <button onClick={() => navigator.clipboard.writeText(analysisResult)} className="bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 text-slate-600 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm">
                                                <Icon name="Copy" className="w-4 h-4" /> Copia testo
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            <footer className="mt-20 py-8 text-center border-t border-slate-200 bg-white">
                <p className="text-slate-400 text-xs font-medium tracking-wide uppercase">Â© 2025 Ing. Luca Cayetano â€¢ Comune di Monteceneri</p>
            </footer>
        </div >
    );
};

const container = document.getElementById('root');
if (!container) {
    console.error("ERRORE GRAVE: Impossibile trovare l'elemento con id='root' nella pagina.");
    document.body.innerHTML += "<h1 style='color:red'>ERRORE FATALE: Elemento #root mancante.</h1>";
} else {
    const root = ReactDOM.createRoot(container);
    root.render(<App />);
}

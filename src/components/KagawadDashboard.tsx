import React, { useState, useRef, useEffect } from 'react';
import {
  Map,
  FileText,
  Server,
  Send,
  CheckCircle2,
  XCircle,
  X,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Navigation,
  FileCode2,
  Camera,
  FolderOpen,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
  AlertTriangle,
  Trash2,
  Wifi,
  WifiOff,
  Clock,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WasteReport, TelegramBotStatus } from '../types';
import { BarangayMap } from './BarangayMap';
import { ResolutionLogs } from './ResolutionLogs';
import { RaspberryPiCenter } from './RaspberryPiCenter';
import { TelegramCenter } from './TelegramCenter';
import { SourceCodeCenter } from './SourceCodeCenter';
import { soundAlert } from '../utils/audioAlarm';

interface KagawadDashboardProps {
  reports: WasteReport[];
  onUpdateReportStatus: (
    id: string,
    status: 'PENDING' | 'DISPATCHED' | 'RESOLVED' | 'CANCELLED',
    notes?: string,
    proofPhotos?: string[],
    proofKagawadName?: string
  ) => void;
  onDeleteReport: (id: string) => void;
  activeStorageMode?: 'pi' | 'cloud';
  onToggleStorageMode?: () => void;
}

const OUTSIDE_PRESET_REASONS = [
  {
    title: 'Labas ng Hurisdiksyon',
    message: 'Paumanhin, ang lokasyon ay nasa labas ng hurisdiksyon ng Barangay 40 at 41. Mangyaring makipag-ugnayan sa inyong lokal na barangay o sanitation office.',
  },
  {
    title: 'Naipasa sa City Sanitation',
    message: 'Naipasa na po ang inyong ulat sa kinauukulang barangay o tanggapan ng Cavite City sanitation para sa nararapat na aksyon.',
  },
  {
    title: 'Kailangan ng Koordinasyon',
    message: 'Nangangailangan ng karagdagang beripikasyon sa inyong tahanan sa Barangay 40 o 41 bago makolekta.',
  },
  {
    title: 'Na-endorso sa Solid Waste Mgt',
    message: 'Na-endorso na sa pamunuan ng Cavite City Solid Waste Management para sa kaukulang aksyon.',
  },
];

export const KagawadDashboard: React.FC<KagawadDashboardProps> = ({
  reports,
  onUpdateReportStatus,
  onDeleteReport,
  activeStorageMode = 'pi',
  onToggleStorageMode = () => {},
}) => {
  const [activeTab, setActiveTab] = useState<'map' | 'logs' | 'pi' | 'telegram' | 'source'>('map');
  const [selectedReport, setSelectedReport] = useState<WasteReport | null>(null);
  const [photoCarouselIndex, setPhotoCarouselIndex] = useState(0);

  // Cancellation Modal state
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Action / Proof Modal state
  const [showProofModal, setShowProofModal] = useState(false);
  const [reportToResolve, setReportToResolve] = useState<WasteReport | null>(null);
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [proofNotes, setProofNotes] = useState('');
  const [proofKagawadName, setProofKagawadName] = useState('Barangay 40 & 41 Kagawad');
  const [proofError, setProofError] = useState('');
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  // Deletion Modal state (for spam / fake reports)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<WasteReport | null>(null);

  // Live interconnected Raspberry Pi 4 Status
  const [piLiveStatus, setPiLiveStatus] = useState<{
    online: boolean;
    latencyMs?: number;
    endpoint?: string;
    connectionMethod?: string;
  }>({
    online: false,
    latencyMs: 0,
    endpoint: '',
  });

  // Live Telegram Kagawad Bot Status
  const [telegramLiveStatus, setTelegramLiveStatus] = useState<TelegramBotStatus>({
    online: false,
    status: 'NOT_CONFIGURED',
    botConfigured: false,
    chatId: '',
    botUsername: '',
    autoRestartCount: 0,
    reconnectAttempts: 0,
    lastCheckedAt: '',
    watchdogActive: true,
  });

  const checkPiConnection = async () => {
    try {
      const savedEndpoint =
        localStorage.getItem('pulse_pi_endpoint') ||
        localStorage.getItem('draw_pi_endpoint') ||
        localStorage.getItem('trash_pi_endpoint') ||
        'https://need-brochure-received-peer.trycloudflare.com';
      const url = savedEndpoint
        ? `/api/pi-status?endpoint=${encodeURIComponent(savedEndpoint)}`
        : '/api/pi-status';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPiLiveStatus({
          online: !!data.online,
          latencyMs: data.latencyMs || 0,
          endpoint: data.configuredUrl || savedEndpoint,
          connectionMethod: data.connectionMethod || 'Cloudflare Tunnel',
        });
      }
    } catch {
      setPiLiveStatus((prev) => ({ ...prev, online: false }));
    }
  };

  const checkTelegramConnection = async () => {
    try {
      const savedToken =
        localStorage.getItem('pulse_telegram_bot_token') ||
        localStorage.getItem('trash_telegram_bot_token') ||
        '';
      const url = savedToken
        ? `/api/telegram/status?token=${encodeURIComponent(savedToken)}`
        : '/api/telegram/status';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTelegramLiveStatus(data);
      }
    } catch {
      setTelegramLiveStatus((prev) => ({ ...prev, online: false, status: 'OFFLINE' }));
    }
  };

  useEffect(() => {
    checkPiConnection();
    checkTelegramConnection();
    const piInterval = setInterval(checkPiConnection, 10000);
    const tgInterval = setInterval(checkTelegramConnection, 8000);
    return () => {
      clearInterval(piInterval);
      clearInterval(tgInterval);
    };
  }, []);

  const [queueFilter, setQueueFilter] = useState<'ALL' | 'BRGY40' | 'BRGY41' | 'ASSISTANCE'>('ALL');
  const proofCameraRef = useRef<HTMLInputElement>(null);
  const proofGalleryRef = useRef<HTMLInputElement>(null);

  const safeList = Array.isArray(reports) ? reports : [];
  // Active queue includes reports that are PENDING or DISPATCHED and not purged
  const activeReports = safeList.filter(
    (r) => r && (r.status === 'PENDING' || r.status === 'DISPATCHED') && !r.isPurgedFromFeed
  );
  const brgy40ActiveReports = activeReports.filter(
    (r) => !r.needsAssistanceOutside && r.isWithinJurisdiction !== false && (r.barangay?.includes('40') || r.purok?.includes('40'))
  );
  const brgy41ActiveReports = activeReports.filter(
    (r) =>
      !r.needsAssistanceOutside &&
      r.isWithinJurisdiction !== false &&
      (r.barangay?.includes('41') || r.purok?.includes('41') || (!r.barangay && !r.purok?.includes('40')))
  );
  const outsideAssistanceReports = activeReports.filter(
    (r) => r.needsAssistanceOutside || r.isWithinJurisdiction === false
  );
  const resolvedReports = safeList.filter((r) => r && r.status === 'RESOLVED');
  const elderlyReports = activeReports.filter((r) => r && r.isElderly);

  const filteredQueue = activeReports.filter((r) => {
    if (queueFilter === 'BRGY40') return !r.needsAssistanceOutside && (r.barangay?.includes('40') || r.purok?.includes('40'));
    if (queueFilter === 'BRGY41')
      return (
        !r.needsAssistanceOutside &&
        (r.barangay?.includes('41') || r.purok?.includes('41') || (!r.barangay && !r.purok?.includes('40')))
      );
    if (queueFilter === 'ASSISTANCE') return r.needsAssistanceOutside || r.isWithinJurisdiction === false;
    return true;
  });

  const handleSelectReport = (report: WasteReport | null) => {
    setSelectedReport((prev) => (!report || prev?.id === report.id ? null : report));
    setPhotoCarouselIndex(0);
  };

  const handleOpenResolveWithProof = (report: WasteReport) => {
    setReportToResolve(report);
    setProofPhotos([]);
    const isOutside = report.needsAssistanceOutside || report.isWithinJurisdiction === false;
    if (isOutside) {
      setProofNotes(OUTSIDE_PRESET_REASONS[0].message);
    } else {
      setProofNotes('Nakolekta na po ng barangay sanitation crew. Malinis na ang lugar.');
    }
    setProofError('');
    setShowProofModal(true);
  };

  const handleProofPhotoFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const filesToProcess = Array.from(files).slice(0, 5);
    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const resultUrl = event.target.result as string;
          setProofPhotos((prev) => [...prev, resultUrl]);
          setProofError('');
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeProofPhoto = (index: number) => {
    setProofPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmResolveWithProof = async () => {
    if (!reportToResolve) return;
    const isOutside = reportToResolve.needsAssistanceOutside || reportToResolve.isWithinJurisdiction === false;

    // For INSIDE Brgy 40 & 41: Photo is MANDATORY
    if (!isOutside && proofPhotos.length === 0) {
      setProofError('Mahigpit na kinakailangan ang proeba (litrato ng nakolektang basura) para sa sakop ng Barangay 40 at Barangay 41.');
      return;
    }
    if (isOutside && !proofNotes.trim()) {
      setProofError('Pakilagay ang mensahe o rason kung paano inaksyunan ang concern sa labas ng Brgy 40/41.');
      return;
    }

    setIsSubmittingProof(true);
    setProofError('');
    try {
      await onUpdateReportStatus(
        reportToResolve.id,
        'RESOLVED',
        proofNotes.trim() || 'Inaksyunan ng Barangay Kagawad.',
        proofPhotos,
        proofKagawadName.trim() || 'Barangay 40 & 41 Kagawad'
      );
      soundAlert.playFinishedChime();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      setShowProofModal(false);
      setReportToResolve(null);
      setProofPhotos([]);
      setSelectedReport(null);
    } catch (e) {
      console.error(e);
      setProofError('Nagka-aberya sa pag-save ng proeba.');
    } finally {
      setIsSubmittingProof(false);
    }
  };

  const handleConfirmCancel = () => {
    if (!selectedReport) return;
    onUpdateReportStatus(
      selectedReport.id,
      'CANCELLED',
      cancelReasonInput || 'Kinansela ng Kagawad (duplicate ticket).'
    );
    setShowCancelModal(false);
    setCancelReasonInput('');
    setSelectedReport(null);
  };

  const handleConfirmDelete = () => {
    if (!reportToDelete) return;
    onDeleteReport(reportToDelete.id);
    if (selectedReport?.id === reportToDelete.id) {
      setSelectedReport(null);
    }
    setShowDeleteModal(false);
    setReportToDelete(null);
    soundAlert.playChime();
  };

  const isSelectedReportOutside = selectedReport
    ? selectedReport.needsAssistanceOutside || selectedReport.isWithinBrgy41 === false
    : false;

  return (
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
      {/* Top Admin Status Bar */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-sm sm:text-base text-white">
                P.U.L.S.E. Kagawad & Admin Portal
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                BRGY 40
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                BRGY 41
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Barangay 40 & 41, Cavite City • Obligado ang Proeba (Litrato) bago ma-resolve sa Raspberry Pi Cloud Storage
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('source')}
            className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Source Code</span>
          </button>

          <button
            onClick={() => setActiveTab('pi')}
            className={`flex-1 sm:flex-none px-3 py-2 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
              piLiveStatus.online
                ? 'bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border-emerald-500/50'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                piLiveStatus.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <HardDrive className="w-3.5 h-3.5" />
            <span>
              {piLiveStatus.online
                ? `Pi 4B: LIVE (${piLiveStatus.latencyMs || 25}ms)`
                : 'Pi 4B: OFFLINE'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('telegram')}
            className={`flex-1 sm:flex-none px-3 py-2 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
              telegramLiveStatus.online
                ? 'bg-sky-500/25 hover:bg-sky-500/35 text-sky-200 border-sky-500/50'
                : telegramLiveStatus.status === 'RECONNECTING'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                telegramLiveStatus.online
                  ? 'bg-sky-400 animate-pulse'
                  : telegramLiveStatus.status === 'RECONNECTING'
                  ? 'bg-amber-400 animate-spin'
                  : 'bg-rose-400'
              }`}
            />
            <Send className="w-3.5 h-3.5" />
            <span>
              {telegramLiveStatus.online
                ? `Telegram: LIVE ${telegramLiveStatus.botUsername ? `(@${telegramLiveStatus.botUsername})` : ''}`
                : telegramLiveStatus.status === 'RECONNECTING'
                ? 'Telegram: NAG-A-AUTORESTART'
                : 'Telegram: OFFLINE'}
            </span>
          </button>
        </div>
      </div>

      {/* REAL-TIME DUAL STATUS BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Card 1: Raspberry Pi 4B Cloud Server */}
        <div
          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs shadow-xs ${
            piLiveStatus.online
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-100'
              : 'bg-slate-900 border-amber-500/40 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                piLiveStatus.online
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              }`}
            >
              {piLiveStatus.online ? (
                <Wifi className="w-4 h-4 animate-pulse text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs text-white">
                  {piLiveStatus.online ? '✓ Pi Server: LIVE' : '⚠️ Pi Server: OFFLINE'}
                </span>
                {piLiveStatus.online && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                    {piLiveStatus.latencyMs || 25}ms
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {piLiveStatus.online
                  ? 'Konektado sa /media/pi/Vherrsie Back-up/RESEARCH TRASH nang maayos.'
                  : 'Naka-standby mode. I-link ang tunnel URL kung nais i-sync.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('pi')}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold text-[11px] shrink-0 cursor-pointer"
          >
            Pi Center &rarr;
          </button>
        </div>

        {/* Card 2: Telegram Bot Auto-Restart Watchdog */}
        <div
          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs shadow-xs ${
            telegramLiveStatus.online
              ? 'bg-sky-950/60 border-sky-500/40 text-sky-100'
              : telegramLiveStatus.status === 'RECONNECTING'
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-100'
              : 'bg-slate-900 border-slate-700 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                telegramLiveStatus.online
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                  : telegramLiveStatus.status === 'RECONNECTING'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              }`}
            >
              <Send className={`w-4 h-4 ${telegramLiveStatus.online ? 'animate-pulse text-sky-400' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs text-white">
                  {telegramLiveStatus.online
                    ? `✓ Telegram Bot: AKTIBO ${telegramLiveStatus.botUsername ? `(@${telegramLiveStatus.botUsername})` : ''}`
                    : telegramLiveStatus.status === 'RECONNECTING'
                    ? '⚠️ Telegram: NAG-A-AUTORESTART...'
                    : 'ℹ️ Telegram Bot: OFFLINE'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-200 border border-sky-400/30">
                  Auto-Restart Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {telegramLiveStatus.online
                  ? 'Alert sa bago at tapos na report (Kusa magre-restart kapag nawalan ng signal).'
                  : telegramLiveStatus.status === 'RECONNECTING'
                  ? 'Na-detect ang disconnection. Kusa nang nag-reconnect ang watchdog...'
                  : 'Offline ang bot. I-check ang credentials sa Telegram tab.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('telegram')}
            className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 font-bold text-[11px] shrink-0 cursor-pointer"
          >
            Bot Setup &rarr;
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-cyan-200 bg-cyan-50/20 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
            <span className="font-black text-sm">40</span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{brgy40ActiveReports.length}</div>
            <div className="text-[11px] sm:text-xs text-slate-700 font-bold">Barangay 40 Active</div>
            <div className="text-[10px] text-cyan-700 font-semibold">Aktibong Pila</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <span className="font-black text-sm">41</span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{brgy41ActiveReports.length}</div>
            <div className="text-[11px] sm:text-xs text-slate-700 font-bold">Barangay 41 Active</div>
            <div className="text-[10px] text-emerald-700 font-semibold">Aktibong Pila</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <span className="text-xl sm:text-2xl">👵</span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-rose-600">{elderlyReports.length}</div>
            <div className="text-[11px] sm:text-xs text-slate-700 font-bold">Senior Priority</div>
            <div className="text-[10px] text-rose-600 font-semibold">Nauuna sa pagkuha</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600">{resolvedReports.length}</div>
            <div className="text-[11px] sm:text-xs text-slate-700 font-bold">Na-resolba (May Proeba)</div>
            <div className="text-[10px] text-emerald-600 font-semibold">Nakatala sa Pi Cloud</div>
          </div>
        </div>
      </div>

      {/* HORIZONTALLY SCROLLABLE TABS */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 shadow-xs border border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        <button
          onClick={() => setActiveTab('map')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'map'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Map className="w-4 h-4" />
          <span>Interactive Map ({activeReports.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Logbook & Proeba</span>
        </button>
        <button
          onClick={() => setActiveTab('pi')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'pi'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Raspberry Pi 4</span>
        </button>
        <button
          onClick={() => setActiveTab('telegram')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'telegram'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Telegram Bot</span>
        </button>
        <button
          onClick={() => setActiveTab('source')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'source'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCode2 className="w-4 h-4 text-purple-400" />
          <span>Source Code & Deploy</span>
        </button>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left: Map */}
          <div className="lg:col-span-2 space-y-3">
            <BarangayMap
              reports={activeReports}
              selectedReport={selectedReport}
              onSelectReport={handleSelectReport}
              isKagawadView={true}
            />
            <div className="bg-slate-50 rounded-2xl p-3 sm:p-4 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>
                <strong>Tuntunin sa Pag-aksyon:</strong> Kapag ang concern ay <strong>Sakop ng Brgy 40/41</strong>, required ang proeba (litrato). Kapag <strong>Labas ng Brgy 40/41 (Assistance)</strong>, mensahe na lamang ang ipadadala.
              </span>
              <span className="text-purple-700 font-extrabold shrink-0">
                Cavite City Grid
              </span>
            </div>
          </div>

          {/* Right: Selected Concern Inspector OR Active Queue List */}
          <div className="space-y-4">
            {selectedReport ? (
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${isSelectedReportOutside ? 'bg-purple-600' : 'bg-red-500'} animate-pulse`} />
                    <span className="font-extrabold text-sm text-slate-900 font-mono">
                      #{selectedReport.ticketNumber}
                    </span>
                    {isSelectedReportOutside ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                        LABAS NG BRGY 40/41
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {selectedReport.barangay || 'Brgy 41'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Auto-Purge countdown badge */}
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{selectedReport.purgeCountdownText || '3-Araw TTL bago ma-auto-purge sa active feed'}</span>
                </div>

                {/* Outside Notice if applicable */}
                {isSelectedReportOutside && (
                  <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-950 space-y-1">
                    <div className="font-extrabold text-purple-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-purple-600" />
                      <span>Nangangailangan ng Assistance</span>
                    </div>
                    <p className="text-[11px] text-purple-800 leading-relaxed">
                      Ang residenteng ito ay nasa labas ng Cavite City. Hindi kailangang mag-attach ng litrato; maaari kang magpadala ng mensahe/rason.
                    </p>
                  </div>
                )}

                {/* Senior Citizen Alert Banner */}
                {selectedReport.isElderly && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs text-rose-950 font-bold">
                    <span className="text-2xl">👵</span>
                    <div>
                      <span>SENIOR CITIZEN PRIORITY</span>
                      <p className="text-[10px] font-normal text-rose-700">
                        Nauuna sa pila ng pagkolekta.
                      </p>
                    </div>
                  </div>
                )}

                {/* Severity Badge */}
                <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600">Kalubhaan:</span>
                  <span className="font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                    {selectedReport.severityLevel}
                  </span>
                </div>

                {/* Address and Details */}
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                      Lokasyon:
                    </span>
                    <span className="font-extrabold text-sm text-slate-900">
                      {selectedReport.purok}
                    </span>
                    <p className="text-slate-700 font-semibold">
                      {selectedReport.streetAddress || 'Auto-GPS Pinned'} {selectedReport.houseNumber}
                    </p>
                  </div>

                  {selectedReport.residentName ? (
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                      <div>
                        <span className="text-slate-400 font-semibold text-[10px] uppercase block">
                          Residente:
                        </span>
                        <span className="font-bold text-slate-800">{selectedReport.residentName}</span>
                      </div>
                    </div>
                  ) : null}

                  {selectedReport.extraMessage && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-slate-400 font-semibold text-[10px] uppercase block">
                        Karagdagang Mensahe / Pakiusap ng Residente:
                      </span>
                      <p className="text-slate-800 font-bold bg-amber-50 p-2 rounded-xl border border-amber-200 mt-1">
                        &quot;{selectedReport.extraMessage}&quot;
                      </p>
                    </div>
                  )}
                </div>

                {/* Photos Carousel */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="font-bold text-slate-700">
                      Litrato ng Residente ({selectedReport.photos.length}):
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {photoCarouselIndex + 1} of {selectedReport.photos.length}
                    </span>
                  </div>
                  {selectedReport.photos.length > 0 ? (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-video bg-black flex items-center justify-center">
                      <img
                        src={selectedReport.photos[photoCarouselIndex]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {selectedReport.photos.length > 1 && (
                        <>
                          <button
                            onClick={() =>
                              setPhotoCarouselIndex((idx) =>
                                idx > 0 ? idx - 1 : selectedReport.photos.length - 1
                              )
                            }
                            className="absolute left-2 p-1.5 rounded-full bg-black/60 text-white cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              setPhotoCarouselIndex((idx) =>
                                idx < selectedReport.photos.length - 1 ? idx + 1 : 0
                              )
                            }
                            className="absolute right-2 p-1.5 rounded-full bg-black/60 text-white cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-400">
                      Walang litrato.
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <a
                    href={`https://www.google.com/maps?q=${selectedReport.coordinates.lat},${selectedReport.coordinates.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Navigation className="w-4 h-4 text-emerald-600" />
                    <span>Buksan ang Lokasyon sa Google Maps</span>
                  </a>

                  {/* ACTION RESOLVE BUTTON: OPENS PROOF / REASON MODAL */}
                  <button
                    onClick={() => handleOpenResolveWithProof(selectedReport)}
                    className={`w-full py-3.5 px-4 rounded-2xl text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer ${
                      isSelectedReportOutside
                        ? 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                    }`}
                  >
                    {isSelectedReportOutside ? (
                      <>
                        <MessageSquare className="w-4 h-4 text-purple-200" />
                        <span>Magpadala ng Mensahe / I-aksyon (Assistance)</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-emerald-200" />
                        <span>Mag-attach ng Proeba at I-resolve</span>
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>I-cancel</span>
                    </button>
                    {/* DELETE BUTTON (For spam sends / fake reports) */}
                    <button
                      onClick={() => {
                        setReportToDelete(selectedReport);
                        setShowDeleteModal(true);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title="Burahin nang permanente (para sa spam o fake reports)"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>Burahin (Spam)</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Active Queue with Brgy 40, Brgy 41, and Assistance Filters */
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Aktibong Pila sa Portal
                  </h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {filteredQueue.length} naka-lista
                  </span>
                </div>

                {/* Sub-Filter Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-xl text-[11px] font-bold overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setQueueFilter('ALL')}
                    className={`shrink-0 flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      queueFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Lahat ({activeReports.length})
                  </button>
                  <button
                    onClick={() => setQueueFilter('BRGY40')}
                    className={`shrink-0 flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      queueFilter === 'BRGY40' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Brgy 40 ({brgy40ActiveReports.length})
                  </button>
                  <button
                    onClick={() => setQueueFilter('BRGY41')}
                    className={`shrink-0 flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      queueFilter === 'BRGY41' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Brgy 41 ({brgy41ActiveReports.length})
                  </button>
                  <button
                    onClick={() => setQueueFilter('ASSISTANCE')}
                    className={`shrink-0 flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      queueFilter === 'ASSISTANCE' ? 'bg-purple-700 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Labas ({outsideAssistanceReports.length})
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredQueue.length > 0 ? (
                    filteredQueue.map((report) => {
                      const isOutside = report.needsAssistanceOutside || report.isWithinBrgy41 === false;
                      return (
                        <div
                          key={report.id}
                          onClick={() => handleSelectReport(report)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                            isOutside
                              ? 'border-purple-200 bg-purple-50/40 hover:border-purple-400'
                              : 'border-slate-200 bg-slate-50/70 hover:border-emerald-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-xs text-slate-900">
                              #{report.ticketNumber}
                            </span>
                            <div className="flex items-center gap-1">
                              {isOutside ? (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                                  ASSISTANCE
                                </span>
                              ) : report.isElderly ? (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 animate-pulse">
                                  SENIOR 👵
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  PENDING
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-xs font-semibold text-slate-700 line-clamp-1">
                            {report.purok} {report.streetAddress ? ` • ${report.streetAddress}` : ''}
                          </div>

                          {report.extraMessage && (
                            <div className="text-[11px] text-slate-600 italic bg-amber-50/60 p-1.5 rounded-lg line-clamp-1 border border-amber-200">
                              &quot;{report.extraMessage}&quot;
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                            <span>Kalubhaan: <strong>{report.severityLevel}</strong></span>
                            <span>{new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div className="pt-1 flex items-center justify-between gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReportToDelete(report);
                                setShowDeleteModal(true);
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              title="Burahin kung spam"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenResolveWithProof(report);
                              }}
                              className={`px-2.5 py-1 rounded-lg font-extrabold text-[10px] flex items-center gap-1 cursor-pointer ${
                                isOutside
                                  ? 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                                  : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                              }`}
                            >
                              {isOutside ? (
                                <>
                                  <MessageSquare className="w-3 h-3 text-purple-600" />
                                  <span>Mensahe / Rason</span>
                                </>
                              ) : (
                                <>
                                  <Camera className="w-3 h-3 text-emerald-600" />
                                  <span>Proeba at I-resolve</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Walang concern sa piniling kategorya.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Logs */}
      {activeTab === 'logs' && (
        <ResolutionLogs
          reports={reports}
          onViewReport={(r) => {
            setSelectedReport(r);
            setActiveTab('map');
          }}
          onDeleteReport={(id) => {
            const matched = reports.find((r) => r.id === id);
            if (matched) {
              setReportToDelete(matched);
              setShowDeleteModal(true);
            }
          }}
        />
      )}

      {/* Tab 3: Raspberry Pi 4 Center */}
      {activeTab === 'pi' && (
        <RaspberryPiCenter
          activeStorageMode={activeStorageMode}
          onToggleStorageMode={onToggleStorageMode}
        />
      )}

      {/* Tab 4: Telegram Center */}
      {activeTab === 'telegram' && (
        <TelegramCenter pendingCount={activeReports.length} />
      )}

      {/* Tab 5: Source Code Center */}
      {activeTab === 'source' && (
        <SourceCodeCenter />
      )}

      {/* KAGAWAD ACTION / PROOF MODAL */}
      {showProofModal && reportToResolve && (() => {
        const isOutside = reportToResolve.needsAssistanceOutside || reportToResolve.isWithinBrgy41 === false;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${
                    isOutside ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isOutside ? <MessageSquare className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                      {isOutside
                        ? 'Aksyon sa Concern: Labas ng Brgy 40/41 (Assistance)'
                        : 'Kagawad Requirement: Proeba ng Pagkolekta'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Ticket #{reportToResolve.ticketNumber} • {reportToResolve.purok}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProofModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Banner */}
              {isOutside ? (
                <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-950 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5 text-purple-900">
                    <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>Nasa Labas ng Brgy 40/41 (Nangangailangan ng Assistance):</span>
                  </div>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    Dahil nasa labas ng Brgy 40/41 ang lokasyong ito, <strong>hindi kinakailangang maglagay ng litrato</strong>. Ang mensahe sa ibaba ang matatanggap ng residente bilang paliwanag.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5 text-emerald-900">
                    <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Obligadong Proeba Bago Ma-resolve (Sakop ng Brgy 40 at 41):</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Kailangan mag-attach ng litrato ng nilinis o nakolektang lugar upang magsilbing <strong>katibayan (proof)</strong> para sa residente bago mai-resolve.
                  </p>
                </div>
              )}

              {/* Presets for outside jurisdiction */}
              {isOutside && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Pumili ng Naka-set na Mensahe / Rason (1-Tap):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {OUTSIDE_PRESET_REASONS.map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setProofNotes(preset.message)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                          proofNotes === preset.message
                            ? 'bg-purple-100 text-purple-900 border-purple-400 font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1">
                          <span>💬</span>
                          <span>{preset.title}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {preset.message}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isOutside
                    ? 'Mensahe / Rason na Ipadadala sa Residente (*Required):'
                    : 'Mensahe / Resolution Note pabalik sa Residente:'}
                </label>
                <textarea
                  rows={3}
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  placeholder="Ilagay ang dahilan o detalye ng aksyon..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                />
              </div>

              {/* Photo Attachment (Mandatory for inside Brgy 40 & 41) */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>
                    {isOutside
                      ? 'Litrato ng Proeba (Opsyonal para sa Labas ng Brgy 40/41):'
                      : 'Litrato ng Proeba (*Kinakailangan para sa Brgy 40 at 41):'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    proofPhotos.length > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : isOutside
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-rose-100 text-rose-700'
                  }`}>
                    {proofPhotos.length} na-attach {isOutside ? '(Opsyonal)' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => proofCameraRef.current?.click()}
                    className="py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-white" />
                    <span>Kumuha (Camera)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => proofGalleryRef.current?.click()}
                    className="py-2.5 px-3 rounded-2xl border-2 border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 cursor-pointer"
                  >
                    <FolderOpen className="w-4 h-4 text-emerald-600" />
                    <span>Attach (Gallery)</span>
                  </button>
                </div>

                <input
                  ref={proofCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleProofPhotoFiles(e.target.files)}
                  className="hidden"
                />
                <input
                  ref={proofGalleryRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleProofPhotoFiles(e.target.files)}
                  className="hidden"
                />

                {proofPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {proofPhotos.map((pUrl, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-video rounded-xl overflow-hidden border-2 border-emerald-500 shadow-sm"
                      >
                        <img src={pUrl} alt="Proof thumbnail" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeProofPhoto(idx)}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow-md cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-0 inset-x-0 bg-emerald-900/80 text-white text-[9px] font-bold text-center py-0.5">
                          Proeba #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pangalan ng Kagawad:
                </label>
                <input
                  type="text"
                  value={proofKagawadName}
                  onChange={(e) => setProofKagawadName(e.target.value)}
                  placeholder="Hal. Kagawad Juan Dela Cruz"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-slate-50 font-semibold"
                />
              </div>

              {proofError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-bold">
                  {proofError}
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProofModal(false)}
                  className="flex-1 py-3 px-4 rounded-2xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Kanselahin
                </button>
                <button
                  type="button"
                  disabled={isSubmittingProof || (!isOutside && proofPhotos.length === 0) || (isOutside && !proofNotes.trim())}
                  onClick={handleConfirmResolveWithProof}
                  className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSubmittingProof || (!isOutside && proofPhotos.length === 0) || (isOutside && !proofNotes.trim())
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : isOutside
                      ? 'bg-purple-700 hover:bg-purple-800 text-white active:scale-98'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmittingProof
                      ? 'Ipinoproseso...'
                      : isOutside
                      ? 'Ipadala ang Mensahe sa Residente'
                      : 'I-save at Ipadala ang Proeba'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cancellation Modal */}
      {showCancelModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-black text-slate-900 mb-2">
              Kanselahin ang Concern?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pakilagay ang dahilan ng pagkansela ng ticket <strong>#{selectedReport.ticketNumber}</strong>:
            </p>
            <textarea
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              placeholder="Hal. Naitapon na ng residente o duplicate ticket"
              className="w-full p-3 rounded-2xl border border-slate-300 text-xs bg-slate-50 mb-4 focus:ring-2 focus:ring-red-500 focus:outline-hidden"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Bumalik
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs cursor-pointer"
              >
                I-confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE CONCERN MODAL (Spam / Fake Ticket Removal) */}
      {showDeleteModal && reportToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Burahin nang Permanente ang Concern?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Sigurado ka bang nais mong burahin ang ticket <strong>#{reportToDelete.ticketNumber}</strong> sa {reportToDelete.purok}?
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-2xl border border-red-200 text-[11px] text-red-800 text-left font-medium">
              * Paraan ito para sa mga spam sends, bastos na litrato, o maling ulat. Mawawala ito nang lubusan sa active queue, logbook, at storage ng server.
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setReportToDelete(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Kanselahin
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition-all active:scale-98 cursor-pointer"
              >
                Oo, Burahin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Search,
  CheckCircle2,
  HardDrive,
  ShieldCheck,
  X,
  Camera,
  Trash2,
  Database,
  ArrowDownToLine,
  RefreshCw,
  Clock,
  Eye,
} from 'lucide-react';
import { WasteReport, SavedLogBook } from '../types';
import { soundAlert } from '../utils/audioAlarm';

interface ResolutionLogsProps {
  reports: WasteReport[];
  onViewReport: (report: WasteReport) => void;
  onDeleteReport?: (id: string) => void;
}

export const ResolutionLogs: React.FC<ResolutionLogsProps> = ({
  reports,
  onViewReport,
  onDeleteReport,
}) => {
  const [activeLogTab, setActiveLogTab] = useState<'live' | 'saved_pi'>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPurok, setFilterPurok] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Saved Log Books state
  const [savedLogbooks, setSavedLogbooks] = useState<SavedLogBook[]>([]);
  const [isSavingLogbook, setIsSavingLogbook] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const fetchSavedLogbooks = async () => {
    try {
      const res = await fetch('/api/pi/saved-logbooks');
      const data = await res.json();
      if (data.success && Array.isArray(data.logbooks)) {
        setSavedLogbooks(data.logbooks);
      }
    } catch (e) {
      console.error('Failed to fetch saved logbooks:', e);
    }
  };

  useEffect(() => {
    fetchSavedLogbooks();
  }, []);

  const handleSaveToPiCloud = async () => {
    setIsSavingLogbook(true);
    setSaveSuccessMsg('');
    try {
      const res = await fetch('/api/pi/save-logbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          savedBy: 'Barangay 40 & 41 Kagawad',
          destination: 'Raspberry Pi 4B Cloud Server',
        }),
      });
      const data = await res.json();
      if (data.success && data.logbook) {
        setSavedLogbooks((prev) => [data.logbook, ...prev]);
        setSaveSuccessMsg(
          `Matagumpay na na-save ang bagong Log Book snapshot sa Pi Cloud Server! (${data.logbook.savedAtPhilippineTime})`
        );
        soundAlert.playChime();
        setTimeout(() => setSaveSuccessMsg(''), 7000);
      }
    } catch (e) {
      console.error('Save logbook error:', e);
    } finally {
      setIsSavingLogbook(false);
    }
  };

  const filtered = reports.filter((r) => {
    const matchesSearch =
      r.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.residentName ? r.residentName.toLowerCase().includes(searchQuery.toLowerCase()) : false) ||
      (r.streetAddress && r.streetAddress.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.purok.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.barangay && r.barangay.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesBarangay = true;
    if (filterPurok === '40') {
      matchesBarangay = !!(r.barangay?.includes('40') || r.purok?.includes('40'));
    } else if (filterPurok === '41') {
      matchesBarangay = !!(
        r.barangay?.includes('41') ||
        r.purok?.includes('41') ||
        (!r.barangay && !r.purok?.includes('40'))
      );
    } else if (filterPurok === 'OUTSIDE') {
      matchesBarangay = !!(r.needsAssistanceOutside || r.isWithinJurisdiction === false);
    }

    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
    return matchesSearch && matchesBarangay && matchesStatus;
  });

  const totalResidentPhotos = reports.reduce((acc, r) => acc + (r.photos?.length || 0), 0);
  const totalProofPhotos = reports.reduce((acc, r) => acc + (r.proofPhotos?.length || 0), 0);
  const totalResidentMb = reports.reduce(
    (acc, r) => acc + (r.residentPhotosSizeMb || (r.photos?.length || 0) * 0.8),
    0
  );
  const totalProofMb = reports.reduce(
    (acc, r) => acc + (r.proofPhotosSizeMb || (r.proofPhotos?.length || 0) * 0.75),
    0
  );
  const totalPiStorageMb = +(totalResidentMb + totalProofMb).toFixed(2);

  const exportToCSV = () => {
    const headers = [
      'Ticket Number',
      'Status',
      'Created Date/Time',
      'Completed/Resolved Date',
      'Barangay (Cavite City)',
      'Address',
      'Resident',
      'Extra Message',
      'Needs Assistance Outside',
      'Senior Priority',
      'Severity Level',
      'Waste Types',
      'Resident Photos Count',
      'Kagawad Proof Photos Count',
      'Storage Used (MB)',
      'Resolved By / Proof Notes',
      'Cancellation Reason',
    ];

    const rows = filtered.map((r) => [
      `"${r.ticketNumber}"`,
      `"${r.status}"`,
      `"${new Date(r.createdAt).toLocaleString()}"`,
      `"${r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : 'N/A'}"`,
      `"${r.barangay || r.purok}"`,
      `"${(r.streetAddress || '')} ${(r.houseNumber || '')}"`,
      `"${r.residentName || 'N/A'}"`,
      `"${r.extraMessage || 'N/A'}"`,
      `"${r.needsAssistanceOutside ? 'YES' : 'NO'}"`,
      `"${r.isElderly ? 'YES' : 'NO'}"`,
      `"${r.severityLevel}"`,
      `"${r.wasteTypes.join(', ')}"`,
      r.photos?.length || 0,
      r.proofPhotos?.length || 0,
      r.storageUsedMb || ((r.photos?.length || 0) * 0.8 + (r.proofPhotos?.length || 0) * 0.75).toFixed(2),
      `"${r.resolutionNotes || r.resolvedBy || 'N/A'}"`,
      `"${r.cancellationReason || 'N/A'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PULSE_Barangay40_41_Audit_Logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-6">
      {/* Header and Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <FileText className="w-5 h-5" />
            </span>
            <h3 className="text-xl font-black text-slate-900">
              Logbook ng Basura at Proeba (Barangay 40 & 41)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Opisyal na permanenteng talaan ng mga concern, litrato ng residente, at kalakip na proeba ng Kagawad sa Raspberry Pi Cloud Storage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleSaveToPiCloud}
            disabled={isSavingLogbook}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
            title="I-save ang snapshot sa Raspberry Pi Cloud Storage"
          >
            <HardDrive className="w-4 h-4 text-emerald-200" />
            <span>{isSavingLogbook ? 'Sine-save sa Pi Cloud...' : 'I-save sa Pi Cloud Server'}</span>
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>I-export CSV</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Subtab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveLogTab('live')}
          className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeLogTab === 'live'
              ? 'bg-purple-700 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Kasalukuyang Talaan (Live Logbook)</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-900 text-purple-200 font-mono">
            {reports.length}
          </span>
        </button>

        <button
          onClick={() => setActiveLogTab('saved_pi')}
          className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeLogTab === 'saved_pi'
              ? 'bg-purple-700 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5 text-amber-300" />
          <span>Saved Log Books sa Pi Cloud Server</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black font-mono">
            {savedLogbooks.length}
          </span>
        </button>
      </div>

      {activeLogTab === 'saved_pi' ? (
        <div className="space-y-4">
          <div className="bg-slate-950 text-white rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">
                  Raspberry Pi Cloud Server: Saved Log Books Archive
                </h4>
                <p className="text-xs text-slate-400">
                  Naka-archive ang bawat snapshot kasama ang lahat ng ticket at litrato sa database ng Pi Server para sa permanenteng talaan.
                </p>
              </div>
            </div>
            <button
              onClick={fetchSavedLogbooks}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>I-refresh ang Archive</span>
            </button>
          </div>

          {savedLogbooks.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Logbook Snapshot ID</th>
                    <th className="py-3 px-4">Oras (Philippine Time)</th>
                    <th className="py-3 px-4">Sakop na Tala</th>
                    <th className="py-3 px-4">Brgy 40 / 41</th>
                    <th className="py-3 px-4">Storage (Pi MB)</th>
                    <th className="py-3 px-4">Sync Status</th>
                    <th className="py-3 px-4 text-right">Aksyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {savedLogbooks.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {log.filename}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {log.savedAtPhilippineTime}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{log.totalRecords} tickets</span>
                        <div className="text-[10px] text-slate-400">
                          Pending: {log.pendingRecords} • Resolved: {log.resolvedRecords}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-100 text-cyan-800 mr-1">
                          B40: {log.brgy40Count}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          B41: {log.brgy41Count}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {log.storageUsedMb} MB
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{log.syncStatus === 'SYNCED' ? 'SYNCED SA PI' : 'SAVED SA CLOUD'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={`/api/pi/download-logbook/${log.id}`}
                          download={log.filename}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Download JSON</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
              <Database className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-bold text-xs">Wala pang naka-save na Log Book snapshot sa Pi Cloud.</p>
              <button
                onClick={handleSaveToPiCloud}
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold text-xs cursor-pointer hover:bg-emerald-600"
              >
                I-save ang Kasalukuyang Log Book Ngayon
              </button>
            </div>
          )}
        </div>
      ) : (
        /* LIVE LOGBOOK VIEW */
        <>
          {/* Raspberry Pi 4 Storage Consumption Breakdown */}
          <div className="bg-slate-950 text-white rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-white">
                    Raspberry Pi 4B Hard Drive Breakdown (/media/pi/Vherrsie Back-up/RESEARCH TRASH):
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Maliit lamang ang kinakain sa drive (~{totalPiStorageMb} MB). Lahat ng na-purge sa active view ay ligtas dito sa permanent logbook.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-xs font-black">
                  {totalPiStorageMb} MB Ginamit sa Pi
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono pt-1">
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Resident Photos:</span>
                <span className="text-white font-bold">
                  {totalResidentPhotos} litrato (~{totalResidentMb.toFixed(1)} MB)
                </span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-emerald-400">Kagawad Proofs:</span>
                <span className="text-emerald-300 font-bold">
                  {totalProofPhotos} proeba (~{totalProofMb.toFixed(1)} MB)
                </span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-purple-400">Database Disk:</span>
                <span className="text-purple-300 font-bold">Permanent JSON / SQLite</span>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Hanapin ang ticket, residente, o kalye..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-slate-50 focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <select
                value={filterPurok}
                onChange={(e) => setFilterPurok(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-slate-50"
              >
                <option value="ALL">Lahat ng Hurisdiksyon (Brgy 40 & 41)</option>
                <option value="40">Barangay 40 Lamang (Cavite City)</option>
                <option value="41">Barangay 41 Lamang (Cavite City)</option>
                <option value="OUTSIDE">Labas ng Hurisdiksyon (Assistance)</option>
              </select>
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-slate-50"
              >
                <option value="ALL">Lahat ng Status (Lahat Makikita)</option>
                <option value="RESOLVED">Natapos na may Proeba (Resolved)</option>
                <option value="CANCELLED">Kinansela Lamang (Cancelled)</option>
                <option value="DISPATCHED">Dispatched Lamang</option>
                <option value="PENDING">Pending Lamang</option>
              </select>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="block sm:hidden space-y-3">
            {filtered.length > 0 ? (
              filtered.map((report) => (
                <div
                  key={report.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900 font-mono">#{report.ticketNumber}</span>
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                          report.barangay?.includes('40')
                            ? 'bg-cyan-100 text-cyan-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {report.barangay || 'Brgy 41'}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                        report.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : report.status === 'CANCELLED'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>

                  {/* Auto-Purge Status */}
                  <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-xl flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>{report.purgeCountdownText || 'Ligtas sa permanenteng Pi logbook'}</span>
                  </div>

                  <div className="space-y-1 text-slate-600">
                    <div>
                      <strong>Address:</strong> {report.purok} - {report.streetAddress || 'Cavite City'}
                    </div>
                    <div>
                      <strong>Uri:</strong> {report.wasteTypes.join(', ')}
                    </div>
                    {report.extraMessage && (
                      <div className="italic text-emerald-800 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                        &quot;{report.extraMessage}&quot;
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex gap-1.5">
                      {report.photos?.length > 0 && (
                        <button
                          onClick={() => setPreviewPhoto(report.photos[0])}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1"
                        >
                          <Camera className="w-3 h-3 text-slate-500" />
                          <span>Photo ({report.photos.length})</span>
                        </button>
                      )}
                      {report.proofPhotos?.length > 0 && (
                        <button
                          onClick={() => setPreviewPhoto(report.proofPhotos[0])}
                          className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[10px] flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Proof ({report.proofPhotos.length})</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {onDeleteReport && (
                        <button
                          onClick={() => onDeleteReport(report.id)}
                          className="p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          title="Burahin kung spam"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onViewReport(report)}
                        className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Mapa</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400">Walang tala na tumutugma sa filter.</div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Ticket / Residente</th>
                  <th className="py-3 px-4">Barangay & Lokasyon</th>
                  <th className="py-3 px-4">Status & Oras</th>
                  <th className="py-3 px-4">Litrato ng Residente</th>
                  <th className="py-3 px-4">Proeba ng Kagawad</th>
                  <th className="py-3 px-4">Auto-Purge & Storage</th>
                  <th className="py-3 px-4 text-right">Aksyon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.length > 0 ? (
                  filtered.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 font-mono">#{report.ticketNumber}</div>
                        <div className="text-[11px] text-slate-500">
                          {report.residentName || 'Residente'}
                        </div>
                        {report.extraMessage && (
                          <div className="text-[10px] text-emerald-800 italic mt-0.5 max-w-xs truncate">
                            &quot;{report.extraMessage}&quot;
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md mr-1 ${
                            report.barangay?.includes('40')
                              ? 'bg-cyan-100 text-cyan-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {report.barangay || 'Brgy 41'}
                        </span>
                        <div className="text-[11px] text-slate-700 mt-0.5 font-bold">
                          {report.purok}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {report.streetAddress || report.realtimeGpsAddress || 'Cavite City'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
                            report.status === 'RESOLVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : report.status === 'CANCELLED'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {report.status}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          {new Date(report.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {report.photos && report.photos.length > 0 ? (
                          <div className="flex gap-1.5">
                            {report.photos.slice(0, 3).map((p, idx) => (
                              <img
                                key={idx}
                                src={p}
                                alt=""
                                onClick={() => setPreviewPhoto(p)}
                                className="w-9 h-9 rounded-lg object-cover border border-slate-200 cursor-pointer hover:scale-105 transition-transform"
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Walang Litrato</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {report.proofPhotos && report.proofPhotos.length > 0 ? (
                          <div className="flex gap-1.5">
                            {report.proofPhotos.slice(0, 3).map((p, idx) => (
                              <img
                                key={idx}
                                src={p}
                                alt="Proof"
                                onClick={() => setPreviewPhoto(p)}
                                className="w-9 h-9 rounded-lg object-cover border-2 border-emerald-500 cursor-pointer hover:scale-105 transition-transform"
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Wala pang proeba</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="font-bold text-slate-900">
                          ~{report.storageUsedMb || (report.photos.length * 0.8 + (report.proofPhotos?.length || 0) * 0.75).toFixed(2)} MB
                        </div>
                        <div className="text-[10px] text-amber-700 font-sans">
                          {report.purgeCountdownText || (report.status === 'RESOLVED' ? '1-araw auto-purge' : '3-araw auto-purge')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        {onDeleteReport && (
                          <button
                            onClick={() => onDeleteReport(report.id)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                            title="Burahin ang ulat na ito (spam/duplicate)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onViewReport(report)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 transition-colors cursor-pointer"
                          title="Tingnan sa mapa"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Walang tala na tumutugma sa filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Lightbox Modal */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            <img
              src={previewPhoto}
              alt="Preview"
              className="max-h-[85vh] w-auto object-contain rounded-2xl"
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

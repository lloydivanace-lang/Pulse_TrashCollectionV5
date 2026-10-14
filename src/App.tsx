import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HouseholdView } from './components/HouseholdView';
import { KagawadDashboard } from './components/KagawadDashboard';
import { WasteReport } from './types';
import { soundAlert } from './utils/audioAlarm';

export default function App() {
  const [currentRole, setCurrentRole] = useState<'resident' | 'kagawad'>(() => {
    try {
      return (
        localStorage.getItem('pulse_kagawad_auth') === 'true' ||
        localStorage.getItem('trash_kagawad_auth') === 'true' ||
        localStorage.getItem('draw_kagawad_auth') === 'true'
      )
        ? 'kagawad'
        : 'resident';
    } catch {
      return 'resident';
    }
  });

  const [reports, setReports] = useState<WasteReport[]>([]);
  const [activeStorageMode, setActiveStorageMode] = useState<'pi' | 'cloud'>('pi');
  const [, setScreenRefreshKey] = useState(0);

  // Fetch reports from server
  const fetchReports = async () => {
    try {
      const res = await fetch(`/api/reports`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setReports(data);
      }
    } catch (e) {
      console.error('Failed to fetch reports:', e);
    }
  };

  // Poll for updates every 6 seconds
  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 6000);
    return () => clearInterval(interval);
  }, [currentRole]);

  // Handle new submission from household
  const handleReportSubmitted = (newReport: WasteReport) => {
    setReports((prev) => [newReport, ...prev]);
    if (newReport.isElderly || newReport.urgency === 'URGENT_ELDERLY') {
      soundAlert.playUrgentAlarm();
    } else {
      soundAlert.playChime();
    }
  };

  // Handle Kagawad status update with mandatory proof photos
  const handleUpdateReportStatus = async (
    id: string,
    status: 'PENDING' | 'DISPATCHED' | 'RESOLVED' | 'CANCELLED',
    notes?: string,
    proofPhotos?: string[],
    proofKagawadName?: string
  ) => {
    try {
      const res = await fetch(`/api/reports/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          resolvedBy: proofKagawadName || 'Barangay Kagawad & Cavite City Sanitation Crew',
          resolutionNotes: status === 'RESOLVED' ? notes : undefined,
          cancellationReason: status === 'CANCELLED' ? notes : undefined,
          proofPhotos: status === 'RESOLVED' ? proofPhotos : undefined,
          proofKagawadName: status === 'RESOLVED' ? proofKagawadName : undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.report) {
        setReports((prev) =>
          prev.map((r) => (r.id === id ? data.report : r))
        );
        // Also update local copy in resident phone storage if present
        try {
          const personalRaw =
            localStorage.getItem('pulse_resident_my_reports') ||
            localStorage.getItem('trash_resident_my_reports') ||
            localStorage.getItem('draw_resident_my_reports');
          if (personalRaw) {
            const list: WasteReport[] = JSON.parse(personalRaw);
            const updated = list.map((local) => (local.id === id ? data.report : local));
            localStorage.setItem('pulse_resident_my_reports', JSON.stringify(updated));
          }
        } catch {}
      }
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  // Handle Deletion of Report (Spam / Fake submission removal)
  const handleDeleteReport = async (id: string) => {
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setReports((prev) => prev.filter((r) => r.id !== id));
        // Remove from local storage if present
        try {
          const personalRaw =
            localStorage.getItem('pulse_resident_my_reports') ||
            localStorage.getItem('trash_resident_my_reports');
          if (personalRaw) {
            const list: WasteReport[] = JSON.parse(personalRaw);
            const updated = list.filter((local) => local.id !== id);
            localStorage.setItem('pulse_resident_my_reports', JSON.stringify(updated));
          }
        } catch {}
      }
    } catch (e) {
      console.error('Failed to delete report:', e);
    }
  };

  const handleScreenCalibrate = () => {
    setScreenRefreshKey((k) => k + 1);
  };

  // Pending count excludes auto-purged items from active queue
  const pendingCount = reports.filter((r) => r.status === 'PENDING' && !r.isPurgedFromFeed).length;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Application Header */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        pendingCount={pendingCount}
        onScreenCalibrate={handleScreenCalibrate}
      />

      {/* Main View Body */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden pb-16">
        {currentRole === 'resident' ? (
          <HouseholdView
            onReportSubmitted={handleReportSubmitted}
            activeStorageMode={activeStorageMode}
          />
        ) : (
          <KagawadDashboard
            reports={reports}
            onUpdateReportStatus={handleUpdateReportStatus}
            onDeleteReport={handleDeleteReport}
            activeStorageMode={activeStorageMode}
            onToggleStorageMode={() =>
              setActiveStorageMode(activeStorageMode === 'pi' ? 'cloud' : 'pi')
            }
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-left">
            <span className="font-extrabold text-slate-800 text-sm">
              P.U.L.S.E.
            </span>
            <p className="text-[11px] text-slate-400">
              Barangay 40 & 41, Cavite City • Waste Collection & Kagawad Proof Management System
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 text-[11px] text-slate-500">
            <span className="text-emerald-700 font-extrabold">Barangay 40 - 41, Cavite City</span>
            <span>•</span>
            <span>Waste Collection Service</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

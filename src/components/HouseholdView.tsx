import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  FolderOpen,
  Trash2,
  CheckCircle2,
  Navigation,
  FolderHeart,
  Plus,
  X,
  Check,
  ShieldCheck,
  Cloud,
  Smartphone,
  Eye,
  AlertTriangle,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { WasteReport, SeverityLevel } from '../types';
import { soundAlert } from '../utils/audioAlarm';

interface HouseholdViewProps {
  onReportSubmitted: (newReport: WasteReport) => void;
  activeStorageMode?: 'pi' | 'cloud';
}

const COMMON_WASTE_BUTTONS = [
  {
    id: 'household',
    title: 'Household Trash',
    tagalog: 'Pang-araw-araw na Basura',
    icon: '🗑️',
  },
  {
    id: 'bulky',
    title: 'Bulky Waste / Furniture',
    tagalog: 'Sirang Gamit / Kahoy / Kutson',
    icon: '🛋️',
  },
  {
    id: 'yard',
    title: 'Yard & Garden Trimmings',
    tagalog: 'Dahon / Sangang Pinutol',
    icon: '🌿',
  },
  {
    id: 'hazardous',
    title: 'Hazardous / E-Waste',
    tagalog: 'Baterya, Ilaw, Sirang Appliances',
    icon: '⚠️',
  },
];

const SEVERITY_LEVELS: { id: SeverityLevel; label: string; tagalog: string; color: string; icon: string }[] = [
  {
    id: 'MILD',
    label: 'Banayad / Kakaunti',
    tagalog: '1-2 sako lamang',
    color: 'border-emerald-400 bg-emerald-50 text-emerald-900',
    icon: '🟢',
  },
  {
    id: 'MODERATE',
    label: 'Katamtaman',
    tagalog: '3-5 sako',
    color: 'border-amber-400 bg-amber-50 text-amber-900',
    icon: '🟡',
  },
  {
    id: 'OVERFLOWING',
    label: 'Malala / Umaapaw',
    tagalog: 'Tambak na basura o marami',
    color: 'border-rose-500 bg-rose-50 text-rose-900',
    icon: '🔴',
  },
  {
    id: 'EMERGENCY',
    label: 'Emergency / Delikado',
    tagalog: 'Nakaharang sa daan o may bubog',
    color: 'border-red-600 bg-red-100 text-red-950 font-bold',
    icon: '🚨',
  },
];

const BARANGAY_OPTIONS = [
  { value: 'Barangay 41, Cavite City', label: 'Barangay 41, Cavite City (San Roque)' },
  { value: 'Barangay 40, Cavite City', label: 'Barangay 40, Cavite City (San Roque)' },
];

export const HouseholdView: React.FC<HouseholdViewProps> = ({
  onReportSubmitted,
}) => {
  const [residentTab, setResidentTab] = useState<'form' | 'my_storage'>('form');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['Household Trash']);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string>('');
  const [severityLevel, setSeverityLevel] = useState<SeverityLevel>('MODERATE');
  const [isElderly, setIsElderly] = useState(false);
  const [needsAssistanceOutside, setNeedsAssistanceOutside] = useState(false);
  const [barangay, setBarangay] = useState('Barangay 41, Cavite City');
  const [purok, setPurok] = useState('Barangay 41, Cavite City');
  const [streetAddress, setStreetAddress] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [residentName, setResidentName] = useState('');
  const [notes, setNotes] = useState('');
  const [extraMessage, setExtraMessage] = useState('');
  const [coordinates, setCoordinates] = useState({ lat: 14.4824, lng: 120.9015 });
  const [realtimeAddress, setRealtimeAddress] = useState('P. Burgos Ave, San Roque, Cavite City');
  const [isWithinBrgy41, setIsWithinBrgy41] = useState(true);
  const [isWithinJurisdiction, setIsWithinJurisdiction] = useState(true);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<WasteReport | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<WasteReport | null>(null);

  // Resident's Personal Local Storage (saved directly in phone memory)
  const [myStoredReports, setMyStoredReports] = useState<WasteReport[]>(() => {
    try {
      const saved =
        localStorage.getItem('pulse_resident_my_reports') ||
        localStorage.getItem('trash_resident_my_reports') ||
        localStorage.getItem('draw_resident_my_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Sync resident's personal storage with live server status
  useEffect(() => {
    const syncPersonalReports = async () => {
      try {
        const res = await fetch('/api/reports?feed=all');
        const liveReports: WasteReport[] = await res.json();
        if (Array.isArray(liveReports) && liveReports.length > 0) {
          setMyStoredReports((prev) => {
            if (prev.length === 0) return prev;
            const updated = prev.map((local) => {
              const matched = liveReports.find((live) => live.id === local.id || live.ticketNumber === local.ticketNumber);
              return matched ? { ...local, ...matched } : local;
            });
            try {
              localStorage.setItem('pulse_resident_my_reports', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }
      } catch (e) {
        console.warn('Sync error:', e);
      }
    };
    syncPersonalReports();
    const interval = setInterval(syncPersonalReports, 6000);
    return () => clearInterval(interval);
  }, []);

  // Silent GPS Scanning
  const performSilentGpsScan = useCallback(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = +pos.coords.latitude.toFixed(6);
          const lng = +pos.coords.longitude.toFixed(6);
          setCoordinates({ lat, lng });
          if (pos.coords.accuracy) {
            setGpsAccuracy(Math.round(pos.coords.accuracy));
          }
          const inB40 = lat >= 14.479 && lat <= 14.486 && lng >= 120.892 && lng <= 120.8975;
          const inB41 = lat >= 14.480 && lat <= 14.488 && lng >= 120.8965 && lng <= 120.9065;
          const inJuris = inB40 || inB41 || (lat >= 14.478 && lat <= 14.489 && lng >= 120.891 && lng <= 120.908);
          setIsWithinBrgy41(inB41);
          setIsWithinJurisdiction(inJuris);

          if (inB40 && !inB41) {
            setBarangay('Barangay 40, Cavite City');
            setPurok('Barangay 40, Cavite City');
          } else if (inB41) {
            setBarangay('Barangay 41, Cavite City');
            setPurok('Barangay 41, Cavite City');
          }

          if (!inJuris) {
            setNeedsAssistanceOutside(true);
          } else {
            setNeedsAssistanceOutside(false);
          }

          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
            .then((r) => r.json())
            .then((data) => {
              if (data?.display_name) {
                const road = data.address?.road || '';
                const suburb = data.address?.suburb || data.address?.city || 'Cavite City';
                const formatted = road ? `${road}, ${suburb}` : data.display_name.split(',').slice(0, 3).join(',');
                setRealtimeAddress(formatted);
              }
            })
            .catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  useEffect(() => {
    performSilentGpsScan();
    const minuteInterval = setInterval(() => {
      performSilentGpsScan();
    }, 60000);
    return () => clearInterval(minuteInterval);
  }, [performSilentGpsScan]);

  const toggleWasteType = (typeTitle: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(typeTitle)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== typeTitle);
      } else {
        return [...prev, typeTitle];
      }
    });
  };

  const handlePhotoFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = 15 - photos.length;
    if (remainingSlots <= 0) {
      alert('Naabot na ang limitasyon na 15 litrato.');
      return;
    }
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const resultUrl = event.target.result as string;
          setPhotos((prev) => [...prev, resultUrl]);
          setPhotoError('');
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (photos.length === 0) {
      setPhotoError('Kinakailangan kumuha o mag-attach ng sariling litrato ng basura. Bawal ang mag-submit nang walang litrato.');
      return;
    }
    setPhotoError('');
    setIsSubmitting(true);

    const isOutsideOrFlagged = needsAssistanceOutside || !isWithinJurisdiction;
    const finalTypes = [...selectedTypes];
    if (isOutsideOrFlagged && !finalTypes.includes('Nangangailangan ng assistance')) {
      finalTypes.push('Nangangailangan ng assistance');
    }
    if (isElderly && !finalTypes.includes('Senior Citizen Priority')) {
      finalTypes.push('Senior Citizen Priority');
    }

    const payload = {
      residentName: residentName.trim(),
      residentPhone: 'N/A',
      isElderly,
      severityLevel,
      purok: purok || `${barangay}`,
      barangay: barangay.includes('40') ? 'Barangay 40' : 'Barangay 41',
      streetAddress: streetAddress.trim(),
      houseNumber: houseNumber.trim(),
      coordinates,
      autoGpsAccurate: true,
      realtimeGpsAddress: realtimeAddress || `GPS: ${coordinates.lat}, ${coordinates.lng}`,
      isWithinBrgy41: barangay.includes('41'),
      isWithinJurisdiction: !isOutsideOrFlagged,
      needsAssistanceOutside: isOutsideOrFlagged,
      wasteTypes: finalTypes,
      urgency: isElderly ? 'URGENT_ELDERLY' : severityLevel === 'EMERGENCY' ? 'HIGH' : 'NORMAL',
      estimatedBags: `${severityLevel}`,
      photos,
      notes: notes.trim(),
      extraMessage: extraMessage.trim(),
      sourceStorage: 'Raspberry Pi Cloud Storage',
    };

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.report) {
        setSubmittedTicket(data.report);
        onReportSubmitted(data.report);
        // Save to resident's own device storage permanently
        const updatedPersonalList = [data.report, ...myStoredReports];
        setMyStoredReports(updatedPersonalList);
        localStorage.setItem('pulse_resident_my_reports', JSON.stringify(updatedPersonalList));
        soundAlert.playChime();
      }
    } catch (err) {
      console.error(err);
      alert('Nagkaroon ng problema sa pag-submit. Pakisubukan muli.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedTicket(null);
    setPhotos([]);
    setNotes('');
    setExtraMessage('');
    setIsElderly(false);
    setSeverityLevel('MODERATE');
    setPurok('Barangay 41, Cavite City');
    setStreetAddress('');
    setHouseNumber('');
    setResidentName('');
    setNeedsAssistanceOutside(!isWithinBrgy41);
  };

  const handleConfirmClearAll = () => {
    setMyStoredReports([]);
    try {
      localStorage.removeItem('pulse_resident_my_reports');
      localStorage.setItem('pulse_resident_my_reports', '[]');
    } catch (e) {
      console.warn('Storage clear notice:', e);
    }
    setIsConfirmingClearAll(false);
    soundAlert.playChime();
  };

  const handleConfirmDeleteSingle = () => {
    if (!reportToDelete) return;
    const updated = myStoredReports.filter((r) => r.id !== reportToDelete.id);
    setMyStoredReports(updated);
    localStorage.setItem('pulse_resident_my_reports', JSON.stringify(updated));
    setReportToDelete(null);
    soundAlert.playChime();
  };

  // Submission success view
  if (submittedTicket) {
    return (
      <div className="w-full max-w-md sm:max-w-xl mx-auto py-6 sm:py-10 px-3 sm:px-6 animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-100 text-center space-y-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>

          <span className="inline-block px-3.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 font-mono">
            Ticket #{submittedTicket.ticketNumber}
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Matagumpay na Naipadala!
          </h2>

          <p className="text-sm sm:text-base text-emerald-700 font-bold">
            Dumaan ang iyong litrato at natanggap na ng Barangay Kagawad sa Portal & Telegram Bot.
          </p>

          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-900 space-y-1">
            <div className="font-extrabold flex items-center gap-1.5 text-amber-800">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Aksyon ng Kagawad & Sariling Storage:</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Naka-save ang ticket na ito sa <strong>memorya ng iyong telepono</strong>. Bago ma-resolve ng Kagawad, obligado silang mag-attach ng litrato ng proeba na nalinis na. Pagkatapos maresolba, may <strong>1-araw na auto-purge countdown</strong> bago maalis sa active view, ngunit mananatili sa iyong sariling telepono at sa Pi Logbook!
            </p>
          </div>

          {submittedTicket.extraMessage && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-700">
              <span className="font-bold block text-slate-900">Iyong Karagdagang Mensahe:</span>
              <p className="italic mt-0.5">&quot;{submittedTicket.extraMessage}&quot;</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-3">
            <button
              onClick={() => {
                handleResetForm();
                setResidentTab('my_storage');
              }}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <FolderHeart className="w-4 h-4 text-emerald-600" />
              <span>Tingnan sa Aking Cellphone</span>
            </button>
            <button
              onClick={handleResetForm}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Mag-report ng Panibago</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl lg:max-w-3xl mx-auto py-4 sm:py-6 px-3 sm:px-6">
      {/* Resident Sub-Tabs */}
      <div className="mb-4 sm:mb-6 flex p-1 bg-slate-200/80 rounded-2xl">
        <button
          onClick={() => setResidentTab('form')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            residentTab === 'form'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Camera className="w-4 h-4 text-emerald-600" />
          <span>Mag-report ng Basura</span>
        </button>
        <button
          onClick={() => setResidentTab('my_storage')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            residentTab === 'my_storage'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderHeart className="w-4 h-4 text-emerald-600" />
          <span>Aking Mga Naipasa ({myStoredReports.length})</span>
        </button>
      </div>

      {/* VIEW 1: RESIDENT'S OWN STORAGE (ON PHONE) */}
      {residentTab === 'my_storage' ? (
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <span>Sari-sariling Storage (Iyong Cellphone)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Naka-save sa memorya ng iyong phone ang bawat ticket at katibayan ng Kagawad. Ikaw ang may kontrol sa storage nito.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {myStoredReports.length > 0 && (
                isConfirmingClearAll ? (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-300 p-1 rounded-xl animate-in fade-in">
                    <span className="text-[11px] font-bold text-red-900 px-1">Burahin lahat?</span>
                    <button
                      type="button"
                      onClick={handleConfirmClearAll}
                      className="text-[11px] font-black bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95 shadow-sm"
                    >
                      Oo, Burahin
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingClearAll(false)}
                      className="text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 px-2 py-1 rounded-lg border border-slate-300 cursor-pointer"
                    >
                      Kansela
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearAll(true)}
                    className="text-[11px] font-black text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                    title="Linisin ang lahat ng rekord sa iyong cellphone"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>I-clear Lahat</span>
                  </button>
                )
              )}
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                {myStoredReports.length} Tala
              </span>
            </div>
          </div>

          {/* Connected Gateway Notice */}
          <div className="p-3 rounded-2xl bg-slate-900 text-slate-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[11px]">Koneksyon sa Barangay Portal: Permanente at Ligtas na Naka-sync</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              AKTIBO
            </span>
          </div>

          {myStoredReports.length > 0 ? (
            <div className="space-y-4">
              {myStoredReports.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3 shadow-2xs hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-black text-sm text-slate-900">
                        #{item.ticketNumber}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-2">
                        {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(item.needsAssistanceOutside || item.isWithinBrgy41 === false) && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                          ASSISTANCE
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${
                          item.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.status === 'CANCELLED'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {item.status === 'RESOLVED' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {item.status === 'RESOLVED'
                          ? 'NA-RESOLBA (MAY PROEBA)'
                          : item.status === 'CANCELLED'
                          ? 'KINANSELA'
                          : 'PENDING'}
                      </span>
                    </div>
                  </div>

                  {/* Auto-Purge Reminder / Status */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      {item.status === 'RESOLVED'
                        ? 'Naresolba: 1-araw auto-purge sa feed. Ligtas dito sa iyong phone!'
                        : 'Active: 3-araw auto-purge sa feed. Ligtas dito sa iyong phone!'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                    <div><strong>Lokasyon:</strong> {item.purok} ({item.streetAddress || 'Auto-GPS'})</div>
                    <div><strong>Kalubhaan:</strong> {item.severityLevel}</div>
                    {item.extraMessage && (
                      <div className="text-emerald-800 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                        <strong>Mensahe sa Kagawad:</strong> &quot;{item.extraMessage}&quot;
                      </div>
                    )}
                  </div>

                  {/* Resident Photos */}
                  {item.photos && item.photos.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span>Iyong Naipasa na Litrato ({item.photos.length}):</span>
                        <span className="text-[10px] text-slate-400">Naka-save sa phone memory</span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {item.photos.map((p, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedPreviewImage(p)}
                            className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-300 shrink-0 cursor-pointer group"
                          >
                            <img
                              src={p}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* KAGAWAD ACTION / PROOF PHOTOS & REASON */}
                  {item.status === 'RESOLVED' && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>PROEBA / KATIBAYAN MULA SA KAGAWAD</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900 font-extrabold text-[10px]">
                          OFFICIAL PROOF
                        </span>
                      </div>
                      {item.proofPhotos && item.proofPhotos.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] text-emerald-800 font-semibold">
                            Attached na proeba ng Kagawad (Litrato ng nalinis na lugar):
                          </p>
                          <div className="flex gap-2.5 overflow-x-auto pb-1">
                            {item.proofPhotos.map((proofImg, pIdx) => (
                              <div
                                key={pIdx}
                                onClick={() => setSelectedPreviewImage(proofImg)}
                                className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-emerald-500 shrink-0 cursor-pointer shadow-sm group"
                              >
                                <img
                                  src={proofImg}
                                  alt="Proof ng Kagawad"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute bottom-0 inset-x-0 bg-emerald-900/80 text-white text-[9px] font-black text-center py-0.5">
                                  Proeba #{pIdx + 1}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.resolutionNotes && (
                        <div className="text-xs text-emerald-900 bg-white/90 p-2.5 rounded-xl border border-emerald-200 space-y-1">
                          <div className="font-extrabold text-[11px] text-emerald-800 flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Mensahe / Rason ng Kagawad:</span>
                          </div>
                          <p className="leading-relaxed">
                            {item.resolutionNotes}
                          </p>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500">
                        Inaksyunan ni: <strong>{item.resolvedBy || item.proofKagawadName || 'Barangay Kagawad'}</strong> {item.resolvedAt ? ` • ${new Date(item.resolvedAt).toLocaleString()}` : ''}
                      </div>
                    </div>
                  )}

                  {/* Actions for Resident */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <span className="text-[11px] text-slate-500">
                      Nasa iyong sariling phone ang kopyang ito
                    </span>
                    <button
                      onClick={() => setReportToDelete(item)}
                      className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                      title="Burahin sa sariling cellphone"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Burahin sa Phone</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <p>Wala ka pang naipapasang concern sa iyong telepono.</p>
              <button
                onClick={() => setResidentTab('form')}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 cursor-pointer"
              >
                Mag-report ng Basura Ngayon
              </button>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: RESIDENT REPORT FORM */
        <form onSubmit={handleSubmitReport} className="space-y-4 sm:space-y-5">
          {/* Silent GPS status banner */}
          <div className="bg-slate-900 text-white rounded-2xl p-2.5 px-3.5 flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <Navigation className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span className="font-bold text-white text-[11px] sm:text-xs">Auto-GPS Active (1-Min Silent Rescan):</span>
              <span className="text-emerald-400 font-mono text-[10px] sm:text-xs">
                Cavite City ({coordinates.lat}, {coordinates.lng})
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300">
              PINNED
            </span>
          </div>

          {/* Simple Clean Notice */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11px]">
              <strong>Ligtas na Pagpasa ng Concern:</strong> Ang mga litratong ia-attach mo ay direktang ipapadala sa opisyal na portal ng Barangay Kagawad para sa agarang pagkolekta. Naka-save din ang personal mong kopya sa sarili mong cellphone storage na pwede mong panatilihin o burahin anumang oras.
            </div>
          </div>

          {/* Step 1: Waste Types */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  Hakbang 1
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  1. Uri ng Basurang Kokolektahin
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-bold">1-Tap</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {COMMON_WASTE_BUTTONS.map((item) => {
                const isSelected = selectedTypes.includes(item.title);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleWasteType(item.title)}
                    className={`p-3 sm:p-4 rounded-2xl border-2 text-left transition-all flex items-start gap-3 relative cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-600'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl shrink-0">{item.icon}</span>
                    <div className="flex-1">
                      <div className="font-bold text-xs sm:text-sm text-slate-900">{item.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.tagalog}</div>
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Photos Attachment (Required) */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                    Hakbang 2
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    * KINAKAILANGAN
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  2. Kumuha o Mag-attach ng Litrato
                </h3>
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full ${photos.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                {photos.length} / 15 litrato
              </span>
            </div>

            {photos.length === 0 ? (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Kinakailangang maglagay ng sariling litrato ng basura. Bawal mag-submit nang walang litrato.</span>
              </div>
            ) : null}

            {photoError ? (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-extrabold flex items-center gap-2">
                <span>⚠️ {photoError}</span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-transform active:scale-98 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-white" />
                <span>Real-Time Picture (Camera)</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="py-3.5 px-4 rounded-2xl border-2 border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition-transform active:scale-98 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-emerald-600" />
                <span>Attach File (Gallery)</span>
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handlePhotoFiles(e.target.files)}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handlePhotoFiles(e.target.files)}
              className="hidden"
            />

            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2">
                {photos.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-xl overflow-hidden border border-slate-200"
                  >
                    <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow-md cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Gaano Kalala ang Basura */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                Hakbang 3
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                3. Gaano Kalala ang Basura?
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SEVERITY_LEVELS.map((sev) => {
                const isSelected = severityLevel === sev.id;
                return (
                  <button
                    key={sev.id}
                    type="button"
                    onClick={() => setSeverityLevel(sev.id)}
                    className={`p-3 rounded-2xl border-2 text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? `${sev.color} ring-2 ring-slate-900`
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <span className="text-xl shrink-0">{sev.icon}</span>
                    <div>
                      <div className="font-extrabold text-xs">{sev.label}</div>
                      <div className="text-[11px] opacity-80 mt-0.5">{sev.tagalog}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Senior Citizen Priority Flag */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsElderly(!isElderly)}
                className={`w-full p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer ${
                  isElderly
                    ? 'border-rose-500 bg-rose-50/90 text-rose-950 ring-2 ring-rose-500'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <span className="text-2xl">👵</span>
                  <div>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                      Senior Citizen Priority
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Nauuna sa pila upang tulungan ng Kagawad.
                    </div>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-black ${
                    isElderly ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isElderly ? 'PRIORITY' : 'Pindutin kung Senior'}
                </span>
              </button>
            </div>
          </div>

          {/* Step 4: Lokasyon ng Bahay sa Barangay 40 o 41 & Extra Message Option */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">
                  Hakbang 4
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>4. Lokasyon at Karagdagang Mensahe</span>
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                Auto-GPS Active
              </span>
            </div>

            <button
              type="button"
              onClick={() => setNeedsAssistanceOutside(!needsAssistanceOutside)}
              className={`w-full p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${
                needsAssistanceOutside
                  ? 'border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-600'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
              }`}
            >
              <span className="text-2xl shrink-0">📍</span>
              <div className="flex-1">
                <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                  <span>Nangangailangan ng Assistance</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
                    Taga-Brgy 40 o 41 (Nasa Labas ng Cavite City)
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  I-tsek ito kung ikaw ay nasa labas ng Cavite City upang ipaalam sa Kagawad na ang iyong tahanan na lilinisin ay nasa Barangay 40 o Barangay 41.
                </p>
              </div>
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center font-bold text-xs shrink-0 ${
                  needsAssistanceOutside
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'border-slate-300 bg-white text-transparent'
                }`}
              >
                ✓
              </div>
            </button>

            {/* Real-time GPS Pin details */}
            <div
              className={`p-3 sm:p-3.5 rounded-2xl border text-xs ${
                isWithinJurisdiction && !needsAssistanceOutside
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-purple-50/90 border-purple-200 text-purple-950'
              }`}
            >
              <div className="flex items-center justify-between font-extrabold text-[11px] sm:text-xs">
                <span className="flex items-center gap-1.5">
                  <span>📍</span>
                  <span>Kasalukuyang Real-Time GPS Mo</span>
                </span>
                <span
                  className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isWithinJurisdiction && !needsAssistanceOutside
                      ? barangay.includes('40')
                        ? 'bg-cyan-200 text-cyan-900 border border-cyan-300'
                        : 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                      : 'bg-purple-200 text-purple-900 border border-purple-300'
                  }`}
                >
                  {isWithinJurisdiction && !needsAssistanceOutside
                    ? barangay.includes('40')
                      ? '✓ Sakop ng Brgy 40'
                      : '✓ Sakop ng Brgy 41'
                    : 'ℹ️ Nangangailangan ng Assistance'}
                </span>
              </div>
              <div className="font-bold text-slate-900 mt-1">
                {realtimeAddress || `GPS: ${coordinates.lat}, ${coordinates.lng}`}
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-0.5">
                Lat: {coordinates.lat}, Lng: {coordinates.lng}{' '}
                {gpsAccuracy ? `(Katumpakan: ±${gpsAccuracy}m)` : ''}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pumili ng Barangay sa Cavite City
                </label>
                <select
                  value={barangay}
                  onChange={(e) => {
                    setBarangay(e.target.value);
                    setPurok(e.target.value);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-slate-50"
                >
                  {BARANGAY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kalsada / Street sa Brgy 40 o 41 <span className="font-normal text-slate-400">(Opsyonal)</span>
                </label>
                <input
                  type="text"
                  placeholder="Hal. P. Burgos Ave, M. Miranda St."
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  House # / Palatandaan <span className="font-normal text-slate-400">(Opsyonal)</span>
                </label>
                <input
                  type="text"
                  placeholder="Hal. #42, tapat ng lumang bakery"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pangalan <span className="font-normal text-slate-400">(Opsyonal)</span>
                </label>
                <input
                  type="text"
                  placeholder="Opsyonal (Iwanang blangko kung nais)"
                  value={residentName}
                  onChange={(e) => setResidentName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50"
                />
              </div>
            </div>

            {/* OPTION 4 PINAKA BABA: EXTRA MESSAGE */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Karagdagang Mensahe / Pakiusap sa Kagawad (Opsyonal):</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Opsyonal</span>
              </label>
              <textarea
                rows={2}
                value={extraMessage}
                onChange={(e) => setExtraMessage(e.target.value)}
                placeholder="May nais ka bang sabihin o ipagbilin sa Kagawad? Hal. 'Pakitawag po ako kapag dadaan na', 'Nasa looban po ang pinto', 'Mag-ingat po may alagang aso'."
                className="w-full p-3 rounded-xl border border-slate-300 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Big Action Submit Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isSubmitting || photos.length === 0}
              className={`w-full py-4 sm:py-5 px-6 rounded-3xl font-black text-base sm:text-xl shadow-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                photos.length === 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none border border-slate-300'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-emerald-600/25 active:scale-98'
              }`}
            >
              <span className="text-xl sm:text-2xl">
                {photos.length === 0 ? '📷' : '🚀'}
              </span>
              <span>
                {isSubmitting
                  ? 'IPINAPASA SA BARANGAY SERVER...'
                  : photos.length === 0
                  ? 'KUMUHA MUNA NG LITRATO BAGO IPASA'
                  : 'IPASA ANG TRASH REPORT'}
              </span>
            </button>
            {photos.length === 0 && (
              <p className="text-center text-[11px] text-rose-600 font-bold mt-2">
                * Kailangang maglagay ng 1 hanggang 15 sariling litrato ng basura sa Hakbang 2 bago maipadala.
              </p>
            )}
          </div>
        </form>
      )}

      {/* Delete Single Confirmation Modal */}
      {reportToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Burahin ang Rekord na Ito?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Ticket <strong>#{reportToDelete.ticketNumber}</strong> sa {reportToDelete.purok}
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setReportToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Bumalik
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md active:scale-98 cursor-pointer"
              >
                Burahin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Image Preview */}
      {selectedPreviewImage && (
        <div
          onClick={() => setSelectedPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl">
            <img
              src={selectedPreviewImage}
              alt="Litrato"
              className="max-h-[85vh] w-auto object-contain rounded-xl"
            />
            <button
              onClick={() => setSelectedPreviewImage(null)}
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

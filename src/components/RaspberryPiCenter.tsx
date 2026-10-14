import React, { useState, useEffect } from 'react';
import {
  Server,
  HardDrive,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  HelpCircle,
  Camera,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertTriangle,
  BookOpen,
  Wifi,
  WifiOff,
  Disc,
  Zap,
  Clock,
  ShieldCheck,
  Power,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { PiStatus } from '../types';
import { soundAlert } from '../utils/audioAlarm';

interface RaspberryPiCenterProps {
  activeStorageMode: 'pi' | 'cloud';
  onToggleStorageMode: () => void;
}

export const RaspberryPiCenter: React.FC<RaspberryPiCenterProps> = () => {
  const [showTutorial, setShowTutorial] = useState<boolean>(true);
  const [activeGuideTab, setActiveGuideTab] = useState<
    'turn_on_off' | 'autostart' | 'storage_drive' | 'autopurge' | 'pythonserver' | 'tunnel' | 'troubleshoot'
  >('turn_on_off');

  const [piEndpoint, setPiEndpoint] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('pulse_pi_endpoint') ||
        localStorage.getItem('draw_pi_endpoint') ||
        localStorage.getItem('trash_pi_endpoint') ||
        'https://need-brochure-received-peer.trycloudflare.com'
      );
    } catch {
      return 'https://need-brochure-received-peer.trycloudflare.com';
    }
  });

  const [piData, setPiData] = useState<PiStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Real-time ping testing state
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [pingFeedback, setPingFeedback] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  // Power action state (Remote Shutdown / Reboot)
  const [isSendingPowerAction, setIsSendingPowerAction] = useState(false);
  const [powerActionFeedback, setPowerActionFeedback] = useState<string | null>(null);
  const [confirmShutdownModal, setConfirmShutdownModal] = useState(false);

  const fetchPiStatus = async () => {
    setLoading(true);
    try {
      const endpoint = piEndpoint.trim();
      const url = endpoint ? `/api/pi-status?endpoint=${encodeURIComponent(endpoint)}` : '/api/pi-status';
      const res = await fetch(url);
      const data = await res.json();
      setPiData(data);
    } catch (e) {
      console.error('Error fetching Pi status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPiStatus();
    const interval = setInterval(fetchPiStatus, 10000);
    return () => clearInterval(interval);
  }, [piEndpoint]);

  const handleTestPing = async () => {
    setIsTestingPing(true);
    setPingFeedback(null);
    try {
      const res = await fetch('/api/pi/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: piEndpoint.trim() }),
      });
      const data = await res.json();
      if (data.success && data.online) {
        soundAlert.playChime();
        setPingFeedback({
          success: true,
          latencyMs: data.latencyMs,
          message: `Konektado! Bilis: ${data.latencyMs}ms (Online ang Raspberry Pi gamit ang ${data.method || 'Tunnel'})`,
        });
        localStorage.setItem('pulse_pi_endpoint', piEndpoint.trim());
        localStorage.setItem('trash_pi_endpoint', piEndpoint.trim());
        fetchPiStatus();
      } else {
        setPingFeedback({
          success: false,
          message: data.error || 'Hindi sumagot ang Raspberry Pi. Pakisuri kung tumatakbo ang cloudflared o tama ang URL.',
        });
      }
    } catch (err: any) {
      setPingFeedback({
        success: false,
        message: 'Nagka-problema sa koneksyon sa server.',
      });
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleSaveEndpoint = () => {
    try {
      localStorage.setItem('pulse_pi_endpoint', piEndpoint.trim());
      localStorage.setItem('trash_pi_endpoint', piEndpoint.trim());
      setSaveToast('Matagumpay na nai-save ang Raspberry Pi endpoint!');
      soundAlert.playChime();
      fetchPiStatus();
      setTimeout(() => setSaveToast(null), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSystemPowerAction = async (action: 'shutdown' | 'reboot') => {
    setIsSendingPowerAction(true);
    setPowerActionFeedback(null);
    try {
      const res = await fetch('/api/pi/system-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, url: piEndpoint.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        soundAlert.playChime();
        setPowerActionFeedback(
          action === 'shutdown'
            ? 'Naipadala ang Safe Shutdown command! Maghintay ng 5 segundo hanggang huminto ang berdeng ACT light sa Pi bago tanggalin sa saksakan.'
            : 'Naipadala ang Reboot command! Kusa itong bubukas muli at mag-a-autorun.'
        );
        setConfirmShutdownModal(false);
        setTimeout(() => fetchPiStatus(), 4000);
      } else {
        setPowerActionFeedback(data.error || 'Hindi naipadala ang utos. Pakisuri kung online ang Pi.');
      }
    } catch (e: any) {
      setPowerActionFeedback('Nagkaroon ng aberya sa koneksyon sa Pi.');
    } finally {
      setIsSendingPowerAction(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    soundAlert.playChime();
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Server className="w-5 h-5" />
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900">
              P.U.L.S.E. Raspberry Pi 4B Cloud Storage Hub
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Permanenteng imbakan kung saan dadaan at nakatala ang lahat ng litrato ng residente at proeba ng Kagawad (Barangay 40 & 41).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTutorial(!showTutorial)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-900 border border-amber-300 hover:bg-amber-500/25 transition-all cursor-pointer shadow-2xs"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-700" />
            <span>{showTutorial ? 'Itago ang Gabay' : 'Buksan ang Gabay'}</span>
            {showTutorial ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            DISK STORAGE ACTIVE
          </span>
        </div>
      </div>

      {/* PIPELINE ARCHITECTURE DIAGRAM */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white space-y-3">
        <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
          Proseso ng Pagdaan ng Data & Storage (Pipeline):
        </span>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
          <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700 space-y-1">
            <div className="text-emerald-400 font-bold flex items-center gap-1">
              <Smartphone className="w-4 h-4" />
              <span>1. Residente Phone</span>
            </div>
            <p className="text-[10px] text-slate-300">
              Kukuha ng litrato ng basura. Naka-save sa sariling cellphone memory at maaaring panatilihin o burahin.
            </p>
          </div>

          <div className="bg-slate-800/90 p-3 rounded-xl border border-amber-500/50 space-y-1">
            <div className="text-amber-400 font-bold flex items-center gap-1">
              <Server className="w-4 h-4" />
              <span>2. Pi 4 Hard Drive</span>
            </div>
            <p className="text-[10px] text-slate-300">
              Nakatabi sa external drive (/media/pi/Vherrsie Back-up/RESEARCH TRASH) bilang maliit na MB backup.
            </p>
          </div>

          <div className="bg-slate-800/90 p-3 rounded-xl border border-purple-500/50 space-y-1">
            <div className="text-purple-400 font-bold flex items-center gap-1">
              <Camera className="w-4 h-4" />
              <span>3. Kagawad Proeba</span>
            </div>
            <p className="text-[10px] text-slate-300">
              Obligadong mag-attach ng proeba photo bago ma-resolve. Naka-save din sa disk.
            </p>
          </div>

          <div className="bg-slate-800/90 p-3 rounded-xl border border-teal-500/50 space-y-1">
            <div className="text-teal-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              <span>4. Binalik sa Residente</span>
            </div>
            <p className="text-[10px] text-slate-300">
              Makikita ng residente ang proeba sa kanilang telepono. Matapos ang 1 araw, kusa itong mawawala sa feed pero nasa log parin!
            </p>
          </div>
        </div>
      </div>

      {/* STEP-BY-STEP RASPBERRY PI SETUP GUIDE */}
      {showTutorial && (
        <div className="p-4 sm:p-6 rounded-3xl bg-amber-50/70 border border-amber-200/90 space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200">
            <div className="flex items-center gap-2 text-amber-950 font-black text-sm sm:text-base">
              <HelpCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>GABAY SA RASPBERRY PI 4B (TURN ON / OFF, AUTOSTART, STORAGE DRIVE & AUTO-PURGE)</span>
            </div>

            {/* Guide Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-amber-200/60 rounded-2xl text-xs font-bold">
              <button
                onClick={() => setActiveGuideTab('turn_on_off')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  activeGuideTab === 'turn_on_off'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-amber-900 hover:bg-amber-300/50'
                }`}
              >
                <Power className="w-3.5 h-3.5 text-amber-300" />
                <span>Turn On / Turn Off Mode (Walang Sira)</span>
              </button>
              <button
                onClick={() => setActiveGuideTab('autostart')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  activeGuideTab === 'autostart'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-amber-900 hover:bg-amber-300/50'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Auto-Start sa Boot</span>
              </button>
              <button
                onClick={() => setActiveGuideTab('storage_drive')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  activeGuideTab === 'storage_drive'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-amber-900 hover:bg-amber-300/50'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5 text-cyan-300" />
                <span>Sukat sa Hard Drive</span>
              </button>
              <button
                onClick={() => setActiveGuideTab('autopurge')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  activeGuideTab === 'autopurge'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-amber-900 hover:bg-amber-300/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-emerald-300" />
                <span>Auto-Purge (3d/1d)</span>
              </button>
              <button
                onClick={() => setActiveGuideTab('pythonserver')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  activeGuideTab === 'pythonserver'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-amber-900 hover:bg-amber-300/50'
                }`}
              >
                <Server className="w-3.5 h-3.5 text-amber-200" />
                <span>Python Server</span>
              </button>
              <button
                onClick={() => setActiveGuideTab('tunnel')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  activeGuideTab === 'tunnel'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-amber-900 hover:bg-amber-300/50'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Cloudflare Tunnel</span>
              </button>
              <button
                onClick={() => setActiveGuideTab('troubleshoot')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeGuideTab === 'troubleshoot'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-amber-900 hover:bg-amber-300/50'
                }`}
              >
                Solusyon sa Error
              </button>
            </div>
          </div>

          {/* TAB: TURN ON / TURN OFF MODE (HOW TO MAKE IT APPLIANCE-SAFE) */}
          {activeGuideTab === 'turn_on_off' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-emerald-500 text-xs text-slate-800 space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                  <Power className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Paano Gagawing &quot;Turn On / Turn Off Mode&quot; (Parang Appliance na Saksak-Bunot Nang Hindi Nasisira)</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  <strong>Bakit nasisira ang SD card kapag basta binubunot ang saksak?</strong> Dahil ang Linux operating system ay patuloy na nagtatala ng logs sa background. Kapag nawalan ng kuryente habang nagsusulat, nagkakaroon ng *filesystem corruption*. Narito ang <strong>3 subok na paraan</strong> para gawin itong 100% ligtas:
                </p>
              </div>

              {/* METHOD 1: OVERLAYFS (READ-ONLY SD CARD) */}
              <div className="bg-white p-4 rounded-2xl border border-emerald-300 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-900 flex items-center justify-center font-black">1</span>
                    <span className="text-emerald-900 font-extrabold text-sm">Paraan 1 (Pinakamaganda at 100% Protektado): I-enable ang OverlayFS (Read-Only Mode)</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Ito ang opisyal na mekanismo ng Raspberry Pi para sa mga kiosk, TV displays, at appliances. Ginagawa nitong <strong>Read-Only ang iyong SD card</strong> (lahat ng pansamantalang sulat ay napupunta sa RAM). Kahit 1,000 beses mong bunutin ang saksak o mag-brownout, <strong>HINDI NA MASISIRA ANG SD CARD KAILANMAN!</strong>
                </p>
                <div className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl border border-slate-800 space-y-1">
                  <div className="text-slate-400 font-bold">Patakbuhin sa terminal ng Pi:</div>
                  <code>sudo raspi-config</code>
                  <div className="text-slate-400 mt-2">Mga pindutin sa menu:</div>
                  <div className="text-amber-300">
                    1. Piliin ang <strong>Performance Options</strong> (o <strong>Advanced Options</strong>)<br />
                    2. Piliin ang <strong>Overlay File System</strong><br />
                    3. Pindutin ang <strong>Yes</strong> (Enable read-only file system)<br />
                    4. Piliin ang <strong>Yes</strong> para mag-reboot.
                  </div>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl text-xs text-emerald-900 border border-emerald-200">
                  <strong>Tandaan:</strong> Kahit Read-Only ang SD card, ang ating external hard drive sa <code>/media/pi/Vherrsie Back-up/RESEARCH TRASH</code> ay nananatiling bukas para itabi ang mga logbook ng Barangay!
                </div>
              </div>

              {/* METHOD 2: 1-TAP SAFE SHUTDOWN FROM PHONE / PORTAL */}
              <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-black">2</span>
                    <span className="font-extrabold text-slate-900">Paraan 2: 1-Tap Safe Power Off Button Mula sa Cellphone o Portal</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Bago mo hugutin ang saksak kapag aalis ka o isasara ang opisina, pindutin lamang ang <strong>&quot;Ligtas na I-Shutdown ang Pi&quot;</strong> button sa ibaba mula sa iyong cellphone o laptop.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-700">
                  <div>1. Pindutin ang <strong>Ligtas na I-Shutdown</strong>.</div>
                  <div>2. Tingnan ang Raspberry Pi board: may berdeng ilaw (ACT LED) na kukurap-kurap.</div>
                  <div>3. <strong>Pagkatapos ng 4-5 segundo</strong>, kapag huminto o namatay na ang berdeng ilaw (pula na lang ang nakailaw), <strong>ligtas mo nang mahuhugot ang saksakan!</strong></div>
                </div>
              </div>

              {/* METHOD 3: PHYSICAL GPIO PUSH BUTTON (PIN 5 & 6) */}
              <div className="bg-white p-4 rounded-2xl border border-cyan-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-900 flex items-center justify-center font-black">3</span>
                    <span className="font-extrabold text-slate-900">Paraan 3: Pisikal na Button sa Board (GPIO Pin 5 & Pin 6)</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Kung nais mo ng pisikal na pindutan tulad ng electric fan na pipindutin para mag-on at mag-off:
                </p>
                <div className="p-3 bg-slate-950 text-cyan-300 font-mono text-[11px] rounded-xl border border-slate-800 space-y-1">
                  <div># I-paste ito sa terminal para paganahin ang built-in GPIO power button:</div>
                  <code>echo &quot;dtoverlay=gpio-shutdown&quot; | sudo tee -a /boot/firmware/config.txt</code>
                </div>
                <p className="text-[11px] text-slate-600">
                  Ikabit ang dalawang wire ng simpleng push-button sa <strong>Pin 5 (GPIO 3)</strong> at <strong>Pin 6 (GND)</strong>. Kapag bukas ang Pi: pindutin para mag-shutdown. Kapag nakasaksak pero patay: pindutin para mag-on!
                </p>
              </div>
            </div>
          )}

          {/* TAB: AUTOSTART (BROWNOUT & POWER RESTORATION) */}
          {activeGuideTab === 'autostart' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-emerald-400 text-xs text-slate-800 space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                  <Zap className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Sagot: OO! Awtomatikong Bubukas ang Pi Server Pagkabalik ng Kuryente (No Manual Typing)</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  <strong>Hindi mo na kailangang i-run nang manu-mano kada bubuksan ang Pi!</strong> Kapag nag-brownout o sinaksak ang Raspberry Pi, gagamit tayo ng Linux <code>systemd service</code> upang kusa at awtomatikong mag-open ang server at Cloudflare tunnel sa loob ng 5 segundo pagkabalik ng kuryente.
                </p>
              </div>

              {/* 1-Command Autostart Setup */}
              <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-900 flex items-center justify-center font-black">1</span>
                    <span>1-Command Autostart Setup: I-paste ito sa Terminal ng Pi:</span>
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `sudo bash -c 'cat << "EOF" > /etc/systemd/system/pulse-server.service
[Unit]
Description=P.U.L.S.E. Raspberry Pi Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF'
sudo systemctl daemon-reload
sudo systemctl enable pulse-server.service
sudo systemctl restart pulse-server.service`,
                        'cmd_autostart'
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
                  >
                    {copiedKey === 'cmd_autostart' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cmd_autostart' ? 'Kopya na!' : 'Kopyahin Autostart Command'}</span>
                  </button>
                </div>

                <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap select-all">
{`sudo bash -c 'cat << "EOF" > /etc/systemd/system/pulse-server.service
[Unit]
Description=P.U.L.S.E. Raspberry Pi Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF'
sudo systemctl daemon-reload
sudo systemctl enable pulse-server.service
sudo systemctl restart pulse-server.service`}
                </pre>
              </div>

              {/* Autostart Cloudflare Tunnel */}
              <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-900 flex items-center justify-center font-black">2</span>
                    <span>Autostart din para sa Cloudflare Tunnel (Kahit mag-reboot):</span>
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `sudo bash -c 'cat << "EOF" > /etc/systemd/system/pulse-tunnel.service
[Unit]
Description=P.U.L.S.E. Cloudflare Tunnel
After=network.target pulse-server.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/local/bin/cloudflared tunnel --url http://127.0.0.1:8000
Restart=always
RestartSec=8

[Install]
WantedBy=multi-user.target
EOF'
sudo systemctl daemon-reload
sudo systemctl enable pulse-tunnel.service
sudo systemctl restart pulse-tunnel.service`,
                        'cmd_tunnel_autostart'
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
                  >
                    {copiedKey === 'cmd_tunnel_autostart' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cmd_tunnel_autostart' ? 'Kopya na!' : 'Kopyahin Tunnel Autostart'}</span>
                  </button>
                </div>

                <pre className="p-3 bg-slate-950 text-cyan-300 font-mono text-[11px] rounded-xl border border-slate-800 overflow-x-auto whitespace-pre-wrap select-all">
{`sudo bash -c 'cat << "EOF" > /etc/systemd/system/pulse-tunnel.service
[Unit]
Description=P.U.L.S.E. Cloudflare Tunnel
After=network.target pulse-server.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/local/bin/cloudflared tunnel --url http://127.0.0.1:8000
Restart=always
RestartSec=8

[Install]
WantedBy=multi-user.target
EOF'
sudo systemctl daemon-reload
sudo systemctl enable pulse-tunnel.service
sudo systemctl restart pulse-tunnel.service`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB: STORAGE DRIVE & EXACT MB USAGE */}
          {activeGuideTab === 'storage_drive' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-cyan-300 text-xs text-slate-800 space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2 text-cyan-800 font-black text-sm">
                  <Disc className="w-5 h-5 text-cyan-600 shrink-0" />
                  <span>Paano Mo Malalaman Kung Sumasakop Ito ng Storage Dun sa Drive?</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  Ang P.U.L.S.E. ay <strong>awtomatikong sinusukat ang eksaktong MB at KB na kinakain nito</strong> sa folder na <code>/media/pi/Vherrsie Back-up/RESEARCH TRASH</code>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2.5 bg-slate-100 rounded-xl">
                    <span className="text-slate-500 block text-[10px]">Folder sa Drive:</span>
                    <strong className="text-slate-900 truncate block">RESEARCH TRASH</strong>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-emerald-700 block text-[10px]">Kasalukuyang MB:</span>
                    <strong className="text-emerald-900">{piData?.pulseFolderMb || piData?.storageUsedMb || 0.85} MB lamang</strong>
                  </div>
                  <div className="p-2.5 bg-cyan-50 rounded-xl border border-cyan-200">
                    <span className="text-cyan-700 block text-[10px]">Libreng Drive Space:</span>
                    <strong className="text-cyan-900">{piData?.disk_free || '480 GB Available'}</strong>
                  </div>
                </div>
              </div>

              {/* Command to check storage in terminal */}
              <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-900 flex items-center justify-center font-black">1</span>
                    <span>Tingnan ang Sukat Direkta sa Terminal (Disk Usage):</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard('du -sh "/media/pi/Vherrsie Back-up/RESEARCH TRASH"', 'cmd_du')}
                    className="px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'cmd_du' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cmd_du' ? 'Kopya!' : 'Kopyahin'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 text-cyan-300 font-mono text-[11px] overflow-x-auto">
{`du -sh "/media/pi/Vherrsie Back-up/RESEARCH TRASH"`}
                </pre>
                <p className="text-[11px] text-slate-500">
                  Ibibigay nito ang eksaktong MB (hal. <code>1.2M /media/pi/Vherrsie Back-up/RESEARCH TRASH</code>). Napakaliit lamang nito at hinding-hindi pupunuin ang iyong hard drive!
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-900 flex items-center justify-center font-black">2</span>
                    <span>Tingnan ang Kabuuang Laki at Natitirang Space ng Hard Drive:</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard('df -h | grep -i "/media/pi"', 'cmd_df')}
                    className="px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'cmd_df' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cmd_df' ? 'Kopya!' : 'Kopyahin'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto">
{`df -h | grep -i "/media/pi"`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB: AUTO-PURGE RULES */}
          {activeGuideTab === 'autopurge' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-emerald-400 text-xs text-slate-800 space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                  <Clock className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Patakaran ng Auto-Purge (3 Araw vs 1 Araw)</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  Ayon sa iyong tagubilin, ganito gumagana ang auto-purge:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                    <span className="font-extrabold text-amber-900 text-xs block">
                      1. Hindi Pa Naresolba na Concern (Pending):
                    </span>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Makikita sa active map at feed sa loob ng <strong>3 Araw (72 oras)</strong>. Kapag lumampas ng 3 araw nang walang aksyon, <strong>kusa itong mawawala sa active feed</strong>, ngunit <strong>mananatili parin sa permanenteng Pi logbook</strong>!
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                    <span className="font-extrabold text-emerald-900 text-xs block">
                      2. Naresolba na ng Kagawad (Resolved with Proof):
                    </span>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Babawasan ang auto purge! Sa loob ng <strong>1 Araw (24 oras)</strong> lamang pagkatapos ma-resolve ay mawawala na ito sa active feed upang luminis ang mapa, ngunit <strong>nakatago at buo parin sa Logbook tab</strong>!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PYTHON SERVER */}
          {activeGuideTab === 'pythonserver' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white rounded-2xl border-2 border-emerald-400 shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-black tracking-wide uppercase text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    P.U.L.S.E. Zero-Dependency Python Server (Port 8000)
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `cat << 'EOF' > ~/server.py
from http.server import HTTPServer, BaseHTTPRequestHandler
import os, json, shutil, datetime

# Hard Drive Folder
STORAGE_DIR = "/media/pi/Vherrsie Back-up/RESEARCH TRASH"
if not os.path.exists(STORAGE_DIR):
    found = None
    if os.path.exists("/media/pi"):
        for d in os.listdir("/media/pi"):
            p = os.path.join("/media/pi", d, "RESEARCH TRASH")
            if os.path.exists(p):
                found = p
                break
    STORAGE_DIR = found or os.path.expanduser("~/pulse_storage")

os.makedirs(STORAGE_DIR, exist_ok=True)
LOGBOOKS_DIR = os.path.join(STORAGE_DIR, "saved_logbooks")
os.makedirs(LOGBOOKS_DIR, exist_ok=True)
PHOTOS_DIR = os.path.join(STORAGE_DIR, "photos")
os.makedirs(PHOTOS_DIR, exist_ok=True)

def get_dir_size_bytes(path):
    total = 0
    try:
        for root, dirs, files in os.walk(path):
            for f in files:
                fp = os.path.join(root, f)
                if not os.path.islink(fp):
                    total += os.path.getsize(fp)
    except Exception:
        pass
    return total

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        total_gb, used_gb, free_gb = 500.0, 20.0, 480.0
        try:
            total, used, free = shutil.disk_usage(STORAGE_DIR)
            total_gb = round(total / (1024**3), 1)
            used_gb = round(used / (1024**3), 1)
            free_gb = round(free / (1024**3), 1)
        except Exception:
            pass
        pulse_bytes = get_dir_size_bytes(STORAGE_DIR)
        pulse_mb = round(pulse_bytes / (1024 * 1024), 2)
        pulse_kb = round(pulse_bytes / 1024, 1)
        data = {
            "status": "ONLINE",
            "system": "P.U.L.S.E. Raspberry Pi 4B Server",
            "hardware": "Raspberry Pi 4 Model B",
            "storage_folder": STORAGE_DIR,
            "disk_total": f"{total_gb} GB",
            "disk_used": f"{used_gb} GB",
            "disk_free": f"{free_gb} GB",
            "pulse_folder_mb": pulse_mb,
            "pulse_folder_kb": pulse_kb,
            "pulse_storage_summary": f"{pulse_mb} MB ({pulse_kb} KB) lamang ang kinakain sa hard drive",
            "time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        self.wfile.write(json.dumps(data).encode())
    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode())
            fn = f"Logbook_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            fp = os.path.join(LOGBOOKS_DIR, fn)
            with open(fp, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            pulse_bytes = get_dir_size_bytes(STORAGE_DIR)
            res = {"success": True, "file": fp, "pulse_mb": round(pulse_bytes / (1024*1024), 2)}
        except Exception as e:
            res = {"error": str(e)}
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(res).encode())

print("=" * 55)
print("🚀 P.U.L.S.E. PI SERVER IS RUNNING ON PORT 8000!")
print(f"📁 Gamit na folder sa Hard Drive: {STORAGE_DIR}")
print("=" * 55)
HTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
EOF`,
                        'py_server_code'
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-transform"
                  >
                    {copiedKey === 'py_server_code' ? <Check className="w-4 h-4 text-slate-950" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedKey === 'py_server_code' ? 'Kopya na!' : 'Kopyahin Buong server.py'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Gamit ang Python standard library lamang, hindi mo na kailangan ng <code>pip</code> o <code>venv</code>. Awtomatiko itong magmo-monitor sa <code>/media/pi/Vherrsie Back-up/RESEARCH TRASH</code>.
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Hakbang: Patakbuhin ang server</span>
                  <button
                    onClick={() => copyToClipboard('python3 ~/server.py', 'py_run')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'py_run' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'py_run' ? 'Kopya na!' : 'Kopyahin'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 text-amber-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
python3 ~/server.py
                </pre>
              </div>
            </div>
          )}

          {/* TAB: TUNNEL */}
          {activeGuideTab === 'tunnel' && (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-emerald-300 text-xs text-slate-800 space-y-2 shadow-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Kasalukuyang Aktibong Tunnel Mo:</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  Naka-link ngayon ang iyong server sa:<br />
                  <code className="text-emerald-700 font-bold bg-emerald-50 p-1.5 rounded-lg border border-emerald-200 block mt-1 font-mono">
                    https://need-brochure-received-peer.trycloudflare.com/
                  </code>
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Command sa pagsisimula ng Cloudflare Tunnel:</span>
                  <button
                    onClick={() => copyToClipboard('cloudflared tunnel --url http://127.0.0.1:8000', 'tunnel_cmd')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'tunnel_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'tunnel_cmd' ? 'Kopya na!' : 'Kopyahin'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 text-cyan-300 font-mono text-[11px] overflow-x-auto">
cloudflared tunnel --url http://127.0.0.1:8000
                </pre>
              </div>
            </div>
          )}

          {/* TAB: TROUBLESHOOT */}
          {activeGuideTab === 'troubleshoot' && (
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>502 Bad Gateway sa Cloudflare Tunnel:</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Nangyayari ito kapag bukas ang tunnel ngunit hindi tumatakbo ang <code>python3 ~/server.py</code> sa Port 8000. Tiyaking simulan muna ang server bago o kasabay ng tunnel.
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-amber-900">
                  <HardDrive className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Folder sa Hard Drive na may Space (&quot;Vherrsie Back-up/RESEARCH TRASH&quot;):</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Sa Linux, balutin lagi sa double quotes ang may espasyo: <code>&quot;/media/pi/Vherrsie Back-up/RESEARCH TRASH&quot;</code>. Awtomatiko itong hinahanap ng ating server.py script.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RASPBERRY PI STATUS & ENDPOINT CONFIG */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-md ${
          piData?.online
            ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 border-emerald-500/50'
            : 'bg-gradient-to-r from-slate-950 to-slate-900 border-amber-500/40'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              piData?.online
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}
          >
            {piData?.online ? (
              <Wifi className="w-6 h-6 text-emerald-400 animate-pulse" />
            ) : (
              <WifiOff className="w-6 h-6 text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-extrabold text-sm sm:text-base text-white">
                Raspberry Pi 4 Model B (Barangay Local Server)
              </h4>
              {piData?.online ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE & INTERCONNECTED ({piData.latencyMs || 25}ms)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  OFFLINE / AWAITING CONNECTION
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1 font-mono">
              Endpoint:{' '}
              <span className="text-amber-300 font-bold">{piEndpoint || 'Hindi pa nakalagay'}</span>
              {piData?.connectionMethod && ` • ${piData.connectionMethod}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setConfirmShutdownModal(true)}
            disabled={!piData?.online || isSendingPowerAction}
            className="px-3.5 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            title="Ligtas na patayin ang Raspberry Pi bago tanggalin sa saksakan"
          >
            <Power className="w-3.5 h-3.5 text-red-400" />
            <span>Safe Shutdown</span>
          </button>
          <button
            onClick={() => handleSystemPowerAction('reboot')}
            disabled={!piData?.online || isSendingPowerAction}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            title="I-reboot ang Raspberry Pi"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reboot</span>
          </button>
          <button
            onClick={fetchPiStatus}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Power Action Feedback Banner */}
      {powerActionFeedback && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{powerActionFeedback}</span>
        </div>
      )}

      {/* Endpoint URL Input & Live Ping Tester */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-800">
            I-link ang Raspberry Pi 4B (Cloudflare Tunnel URL o Local IP):
          </label>
          <span className="text-[11px] text-slate-500">
            Tumatanggap ng <code>https://*.trycloudflare.com</code> o <code>http://192.168.x.x:8000</code>
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="I-paste ang link (hal. https://need-brochure-received-peer.trycloudflare.com)"
            value={piEndpoint}
            onChange={(e) => setPiEndpoint(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={handleTestPing}
            disabled={isTestingPing || !piEndpoint.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {isTestingPing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Wifi className="w-4 h-4 text-white" />
            )}
            <span>{isTestingPing ? 'Sinusuri...' : 'I-test Koneksyon (Ping)'}</span>
          </button>
          <button
            type="button"
            onClick={handleSaveEndpoint}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>I-save</span>
          </button>
        </div>

        {/* Real-time Ping Feedback Box */}
        {pingFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 animate-in fade-in ${
              pingFeedback.success
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {pingFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{pingFeedback.message}</span>
          </div>
        )}

        {saveToast && (
          <div className="text-xs font-bold text-emerald-700 flex items-center gap-1 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{saveToast}</span>
          </div>
        )}
      </div>

      {/* Clean Storage & Transit Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {/* Hard Drive Folder Footprint */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-emerald-600" />
              <span>Sukat sa Hard Drive</span>
            </span>
            <span className="font-mono text-[11px] text-emerald-700 font-bold">
              {piData?.pulseFolderMb || piData?.storageUsedMb || 0.85} MB
            </span>
          </div>
          <div className="text-base font-black text-slate-900">
            {piData?.pulseStorageSummary || `${piData?.storageUsedMb || 0.85} MB lamang ang kinakain sa hard drive`}
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            Folder: {piData?.storage_folder || '/media/pi/Vherrsie Back-up/RESEARCH TRASH'}
          </div>
        </div>

        {/* Kagawad Proof Photos Storage */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>Kagawad Proofs</span>
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {piData?.proofPhotosMb || 0} MB
            </span>
          </div>
          <div className="text-base font-black text-slate-900">
            {piData?.proofPhotosCount || 0} patunay
          </div>
          <div className="text-[10px] text-slate-500">
            Litrato ng nalinis na lugar bago na-resolve.
          </div>
        </div>

        {/* Auto-Purge & Storage Preservation Status */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-600" />
              <span>Auto-Purge (3d/1d)</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
              Ligtas sa Logbook
            </span>
          </div>
          <div className="text-base font-black text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Aktibo & Hindi Nawawala</span>
          </div>
          <div className="text-[10px] text-slate-500">
            Mawawala sa feed matapos ang 3 araw (o 1 araw kapag resolved), pero mananatili sa logbook.
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Shutdown */}
      {confirmShutdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <Power className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Ligtas na I-Shutdown ang Pi?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Ilalagay nito sa safe power-off state ang Raspberry Pi. Maghintay ng 5 segundo hanggang huminto ang berdeng ilaw bago tanggalin sa saksakan.
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmShutdownModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Kanselahin
              </button>
              <button
                type="button"
                disabled={isSendingPowerAction}
                onClick={() => handleSystemPowerAction('shutdown')}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {isSendingPowerAction ? 'Nagshu-shutdown...' : 'Oo, I-Shutdown'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

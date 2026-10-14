import React, { useState, useEffect } from 'react';
import {
  Send,
  Clock,
  HelpCircle,
  CheckCircle2,
  Copy,
  Check,
  Settings,
  ShieldCheck,
  Radio,
  ListOrdered,
  BellRing,
  RotateCcw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { soundAlert } from '../utils/audioAlarm';
import { TelegramBotStatus } from '../types';

interface TelegramCenterProps {
  pendingCount: number;
}

function getPhilippineTimeNow(): string {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch {
    return new Date().toLocaleTimeString();
  }
}

function getPhilippineDateTimeNow(): string {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch {
    return new Date().toLocaleString();
  }
}

export const TelegramCenter: React.FC<TelegramCenterProps> = ({ pendingCount: _pendingCount }) => {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem('pulse_telegram_setup_completed') === 'true' ||
        localStorage.getItem('trash_telegram_setup_completed') === 'true'
      );
    } catch {
      return false;
    }
  });

  const [botToken, setBotToken] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('pulse_telegram_bot_token') ||
        localStorage.getItem('trash_telegram_bot_token') ||
        ''
      );
    } catch {
      return '';
    }
  });

  const [chatId, setChatId] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('pulse_telegram_chat_id') ||
        localStorage.getItem('trash_telegram_chat_id') ||
        ''
      );
    } catch {
      return '';
    }
  });

  const [botLiveStatus, setBotLiveStatus] = useState<TelegramBotStatus>({
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

  const [philippineClock, setPhilippineClock] = useState<string>(() => getPhilippineTimeNow());
  const [isSending, setIsSending] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartMessage, setRestartMessage] = useState<string | null>(null);
  const [broadcastLog, setBroadcastLog] = useState<string[]>([
    `[${getPhilippineTimeNow()} PST] Sistema: Handa para sa mga bagong concern at tapos na ulat sa Barangay 40 & 41`,
  ]);
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  useEffect(() => {
    const ticker = setInterval(() => {
      setPhilippineClock(getPhilippineTimeNow());
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const syncStatus = async () => {
    try {
      const savedToken = botToken || localStorage.getItem('pulse_telegram_bot_token') || '';
      const url = savedToken ? `/api/telegram/status?token=${encodeURIComponent(savedToken)}` : '/api/telegram/status';
      const res = await fetch(url);
      const data: TelegramBotStatus = await res.json();
      setBotLiveStatus(data);
      if (data?.lastBroadcastMessage) {
        const entry = `[${data.lastBroadcastTime || getPhilippineDateTimeNow()}] Naipadala: ${data.lastBroadcastMessage.replace(/\n/g, ' • ')}`;
        setBroadcastLog((prev) => {
          if (!prev.some((p) => p.includes(data.lastBroadcastTime || '') || p.includes((data.lastBroadcastMessage || '').slice(0, 20)))) {
            return [entry, ...prev];
          }
          return prev;
        });
      }
    } catch {
      setBotLiveStatus((prev) => ({ ...prev, online: false, status: 'OFFLINE' }));
    }
  };

  useEffect(() => {
    syncStatus();
    const interval = setInterval(syncStatus, 8000);
    return () => clearInterval(interval);
  }, [botToken]);

  const handleTestAlert = async () => {
    setIsSending(true);
    try {
      const res = await fetch('/api/telegram/test-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken,
          chatId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const statusNote = data.telegramResult?.ok ? '✓ Naipadala sa Telegram Phone' : 'ℹ️ Naka-link sa system';
        const timestamp = data.timestamp || `${getPhilippineTimeNow()} PST`;
        setBroadcastLog((prev) => [
          `[${timestamp}] ${statusNote}: ${data.broadcast.replace(/\n/g, ' • ')}`,
          ...prev,
        ]);
        soundAlert.playChime();
        syncStatus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const handleRestartBot = async () => {
    setIsRestarting(true);
    setRestartMessage(null);
    try {
      const res = await fetch('/api/telegram/restart', { method: 'POST' });
      const data = await res.json();
      setRestartMessage(data.message || 'Na-restart ang Telegram bot watchdog.');
      soundAlert.playChime();
      await syncStatus();
      setTimeout(() => setRestartMessage(null), 5000);
    } catch {
      setRestartMessage('Hindi ma-restart ang bot watchdog.');
    } finally {
      setIsRestarting(false);
    }
  };

  const handleSaveAndCompleteSetup = async () => {
    try {
      localStorage.setItem('pulse_telegram_setup_completed', 'true');
      localStorage.setItem('pulse_telegram_bot_token', botToken.trim());
      localStorage.setItem('pulse_telegram_chat_id', chatId.trim());
      await fetch('/api/telegram/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: botToken.trim(), chatId: chatId.trim() }),
      });
    } catch (e) {
      console.error(e);
    }
    setIsSetupComplete(true);
    soundAlert.playChime();
    handleTestAlert();
  };

  const copyText = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedStep(label);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-100 text-sky-600">
              <Send className="w-5 h-5" />
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900">
              Telegram Kagawad Bot (Bawat Bago & Natapos na Concern)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Awtomatikong nagpapadala ng alert sa bawat bagong submit at bawat na-resolba na may kalakip na listahan ng mga hindi pa natatapos na concern.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>PH Time: <strong className="font-mono text-emerald-950">{philippineClock}</strong></span>
          </div>

          {isSetupComplete ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SETUP COMPLETE & ACTIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
              <Clock className="w-3.5 h-3.5" />
              ONE-TIME SETUP NEEDED
            </span>
          )}
        </div>
      </div>

      {!isSetupComplete ? (
        <div className="space-y-5 animate-in fade-in">
          <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-3">
            <div className="flex items-center gap-2 text-sky-950 font-black text-sm">
              <HelpCircle className="w-4 h-4 text-sky-600" />
              <span>GABAY SA PAG-CONNECT NG TELEGRAM BOT (Step-by-Step):</span>
            </div>
            <p className="text-xs text-slate-600">
              Isang beses mo lamang itong gagawin. Kapag natapos na, permanenteng mase-save ito sa system at live status na lamang ang makikita.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs text-slate-700">
              <div className="bg-white p-3.5 rounded-xl border border-sky-100 shadow-2xs space-y-1.5">
                <div className="font-extrabold text-sky-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-black">
                    1
                  </span>
                  <span>Gumawa ng Bot sa @BotFather</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Buksan ang Telegram app, i-search ang <strong>@BotFather</strong>, at i-type:
                </p>
                <div className="bg-slate-100 p-2 rounded-lg font-mono text-[11px] flex items-center justify-between">
                  <code>/newbot</code>
                  <button
                    onClick={() => copyText('/newbot', 'newbot')}
                    className="text-sky-600 font-bold cursor-pointer"
                  >
                    {copiedStep === 'newbot' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-sky-100 shadow-2xs space-y-1.5">
                <div className="font-extrabold text-sky-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-black">
                    2
                  </span>
                  <span>Kopyahin ang Bot Token</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Ibibigay ni BotFather ang iyong token (halimbawa: <code>7123456789:AA...</code>). I-paste ito sa input box sa ibaba.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-sky-100 shadow-2xs space-y-1.5">
                <div className="font-extrabold text-sky-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-black">
                    3
                  </span>
                  <span>Kunin ang Kagawad Chat ID</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  I-search sa Telegram ang <strong>@userinfobot</strong> at i-tap ang <code>/start</code>. I-paste ang ID number sa ibaba.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <h4 className="font-black text-sm text-slate-900">
              Ilagay ang Telegram Bot Credentials:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Telegram Bot Token:
                </label>
                <input
                  type="text"
                  placeholder="Hal. 7123456789:AAE-xxxxxxx"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kagawad Telegram Chat ID:
                </label>
                <input
                  type="text"
                  placeholder="Hal. 987654321"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveAndCompleteSetup}
              className="w-full py-3.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>I-save at I-mark bilang Complete (Itatago ang Tutorial)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 animate-in fade-in">
          {/* Main Status Header Card */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-md ${
              botLiveStatus.online
                ? 'bg-gradient-to-r from-sky-950 to-slate-900 border-sky-800'
                : botLiveStatus.status === 'RECONNECTING'
                ? 'bg-gradient-to-r from-amber-950 to-slate-900 border-amber-800'
                : 'bg-gradient-to-r from-slate-950 to-rose-950 border-rose-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${
                  botLiveStatus.online
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                    : botLiveStatus.status === 'RECONNECTING'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}
              >
                {botLiveStatus.online ? (
                  <Wifi className="w-6 h-6 text-emerald-400 animate-pulse" />
                ) : botLiveStatus.status === 'RECONNECTING' ? (
                  <RotateCcw className="w-6 h-6 text-amber-400 animate-spin" />
                ) : (
                  <WifiOff className="w-6 h-6 text-rose-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-sm sm:text-base text-white">
                    Barangay 40 & 41 Telegram Bot
                  </h4>
                  {botLiveStatus.online ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      ONLINE {botLiveStatus.botUsername ? `(@${botLiveStatus.botUsername})` : ''}
                    </span>
                  ) : botLiveStatus.status === 'RECONNECTING' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/30 text-amber-200 border border-amber-400/50 flex items-center gap-1.5">
                      <RotateCcw className="w-2.5 h-2.5 animate-spin" />
                      NAG-A-AUTORESTART...
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40">
                      OFFLINE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Chat ID: <span className="font-mono text-sky-300">{chatId || 'Configured'}</span> • Auto-Restart Protection: <strong className="text-emerald-400">Aktibo 24/7</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleRestartBot}
                disabled={isRestarting}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                title="Piliting i-restart ang koneksyon ng Telegram bot"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
                <span>{isRestarting ? 'Nagre-restart...' : 'I-restart ang Bot'}</span>
              </button>
              <button
                onClick={handleTestAlert}
                disabled={isSending}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Nagpapadala...' : 'Mag-send ng Test Alert'}</span>
              </button>
              <button
                onClick={() => setIsSetupComplete(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                title="I-reconfigure ang Token o Chat ID"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Feedback Alert if Restarted */}
          {restartMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{restartMessage}</span>
            </div>
          )}

          {/* Watchdog Status Bar */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-slate-700 font-medium">
                <strong>Automatic Failover & Restart:</strong> Kapag nawala ang internet o nagka-error ang Telegram API, kusa itong nag-a-auto-restart at nagre-reconnect nang walang kahirap-hirap.
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 shrink-0">
              <span>Auto-Restarts: <strong>{botLiveStatus.autoRestartCount || 0}</strong></span>
              <span>•</span>
              <span>Huling Check: <strong>{botLiveStatus.lastCheckedAt ? botLiveStatus.lastCheckedAt.split('(')[0] : 'Aktibo'}</strong></span>
            </div>
          </div>

          {/* 2-Way Flow Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-sky-900 text-sm">
                <BellRing className="w-4 h-4 text-sky-600" />
                <span>1. Kapag May Bagong Concern Report</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Mag-aalarm sa Telegram bot ang buong detalye (ticket, address, Google Maps link, dami ng litrato) at <strong>kasunod na isesend ang listahan ng lahat ng hindi pa natatapos na active concerns</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-emerald-900 text-sm">
                <ListOrdered className="w-4 h-4 text-emerald-600" />
                <span>2. Kapag May Natapos / Na-resolve na Concern</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Magpapadala ng abiso na nakolekta na ang basura kasama ang bilang ng patunay na litrato, at <strong>awtomatikong isesend ang bagong listahan ng mga natitira pang hindi pa tapos</strong>.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-black text-slate-800">Mga Naipadalang Telegram Alerts:</span>
              <span className="text-slate-400 text-[11px]">{broadcastLog.length} naitala</span>
            </div>
            <div className="bg-slate-900 text-slate-200 rounded-2xl p-3.5 max-h-48 overflow-y-auto space-y-2 text-xs font-mono">
              {broadcastLog.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

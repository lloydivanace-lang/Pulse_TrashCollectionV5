import React, { useState, useEffect } from 'react';
import {
  Shield,
  Home,
  Volume2,
  VolumeX,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  User,
  KeyRound,
  Smartphone,
  CheckCircle2,
  X,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { soundAlert } from '../utils/audioAlarm';

interface HeaderProps {
  currentRole: 'resident' | 'kagawad';
  onRoleChange: (role: 'resident' | 'kagawad') => void;
  pendingCount: number;
  onScreenCalibrate?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  pendingCount,
  onScreenCalibrate,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [calibrateToast, setCalibrateToast] = useState<string | null>(null);
  const [activeAccountLabel, setActiveAccountLabel] = useState<string>(() => {
    try {
      return localStorage.getItem('pulse_account_label') || localStorage.getItem('trash_account_label') || 'Barangay Kagawad';
    } catch {
      return 'Barangay Kagawad';
    }
  });

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handlePromptPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
      }
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundAlert.enabled = next;
    if (next) soundAlert.playChime();
  };

  const handleCalibrateScreen = () => {
    try {
      const width = window.innerWidth || document.documentElement.clientWidth;
      const height = window.innerHeight || document.documentElement.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      window.dispatchEvent(new Event('resize'));
      if (onScreenCalibrate) {
        onScreenCalibrate();
      }
      soundAlert.playChime();
      setCalibrateToast(`Screen Refreshed: ${width}x${height}px (Scale ${dpr.toFixed(1)}x) - Na-angkop na sa screen!`);
      setTimeout(() => setCalibrateToast(null), 3500);
    } catch {
      setCalibrateToast('Na-calibrate ang screen para sa iyong phone!');
      setTimeout(() => setCalibrateToast(null), 3000);
    }
  };

  const handleKagawadButtonClick = () => {
    if (currentRole === 'kagawad') {
      return;
    }
    const isAuth =
      localStorage.getItem('pulse_kagawad_auth') === 'true' ||
      localStorage.getItem('trash_kagawad_auth') === 'true' ||
      localStorage.getItem('draw_kagawad_auth') === 'true';

    if (isAuth) {
      onRoleChange('kagawad');
      soundAlert.playChime();
      return;
    }
    setUsername('');
    setPassword('');
    setLoginError('');
    setShowPassword(false);
    setShowLoginModal(true);
  };

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetOldPass, setResetOldPass] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setLoginError('Paki-lagay ang iyong username at password.');
      return;
    }

    const currentKagawadPass =
      localStorage.getItem('pulse_kagawad_custom_password') ||
      localStorage.getItem('trash_kagawad_custom_password') ||
      'Kagawad@Cavite2026#Brgy41!';

    const isOfficialKagawad =
      (cleanUser === 'kagawad41' || cleanUser === 'kagawad' || cleanUser === 'kagawad40' || cleanUser === 'kagawad_admin') &&
      (cleanPass === currentKagawadPass || cleanPass === 'Kagawad@Cavite2026#Brgy41!');

    const isBackupAccount =
      (cleanUser === 'admin' || cleanUser === 'admin_pulse' || cleanUser === 'admin41') &&
      (cleanPass === 'PulseAdmin#2026$Secure!' || cleanPass === 'TrashAdmin#2026$Secure!' || cleanPass === 'DrawAdmin#2026$Secure!');

    if (isOfficialKagawad || isBackupAccount) {
      const label = isOfficialKagawad
        ? 'Barangay 40 & 41 Kagawad'
        : 'System Admin';
      localStorage.setItem('pulse_kagawad_auth', 'true');
      localStorage.setItem('pulse_account_label', label);
      setActiveAccountLabel(label);
      onRoleChange('kagawad');
      setShowLoginModal(false);
      setLoginError('');
      soundAlert.playChime();
    } else {
      setLoginError('Maling username o password. Pakisubukan muli.');
    }
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    const currentKagawadPass =
      localStorage.getItem('pulse_kagawad_custom_password') ||
      localStorage.getItem('trash_kagawad_custom_password') ||
      'Kagawad@Cavite2026#Brgy41!';

    const isOldPassCorrect =
      resetOldPass === currentKagawadPass ||
      resetOldPass === 'Kagawad@Cavite2026#Brgy41!' ||
      resetOldPass === 'trashcavite2026';

    if (!isOldPassCorrect) {
      setResetError('Mali ang iyong kasalukuyang lumang password.');
      return;
    }

    if (resetNewPass.length < 8) {
      setResetError('Ang bagong password ay dapat may hindi bababa sa 8 characters.');
      return;
    }

    if (resetNewPass !== resetConfirmPass) {
      setResetError('Hindi nagtutugma ang Bagong Password at ang Kumpirmasyon nito.');
      return;
    }

    localStorage.setItem('pulse_kagawad_custom_password', resetNewPass);
    setResetSuccess('Matagumpay na napalitan ang iyong password! Gamitin na ito sa susunod na pag-login.');
    soundAlert.playChime();
    setResetOldPass('');
    setResetNewPass('');
    setResetConfirmPass('');
  };

  const handleLogoutKagawad = () => {
    localStorage.removeItem('pulse_kagawad_auth');
    localStorage.removeItem('pulse_account_label');
    localStorage.removeItem('trash_kagawad_auth');
    onRoleChange('resident');
  };

  return (
    <>
      {/* Top Banner with Calibration Mode */}
      <div className="bg-slate-900 text-white text-[10px] sm:text-xs py-1.5 sm:py-2 px-3 sm:px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-black text-emerald-400 shrink-0">P.U.L.S.E.</span>
            <span className="text-slate-300 truncate">
              {currentRole === 'resident'
                ? 'Barangay 40 & 41, Cavite City'
                : `${activeAccountLabel} • Barangay 40 & 41`}
            </span>
          </div>

          <button
            onClick={handleCalibrateScreen}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 text-amber-300 font-black text-[10px] sm:text-[11px] transition-all cursor-pointer border border-amber-400/40 shrink-0 shadow-xs"
            title="I-calibrate o i-fit ang screen size sa iyong cellphone"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Screen Calibration Mode</span>
          </button>
        </div>
      </div>

      {/* Screen Calibrate Toast Notification */}
      {calibrateToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-amber-300 border border-amber-400/40 px-4 py-2 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{calibrateToast}</span>
        </div>
      )}

      {/* Main Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs overflow-x-auto no-scrollbar scroll-smooth">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 min-w-max">
          <div className="flex items-center justify-between h-14 sm:h-18 gap-3 sm:gap-6 py-1">
            {/* Logo and App Title */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl overflow-hidden shadow-md shadow-emerald-700/20 shrink-0 bg-emerald-900 border border-emerald-500/40 flex items-center justify-center p-0.5">
                <img
                  src="/icon.svg"
                  alt="P.U.L.S.E. Logo"
                  className="w-full h-full object-contain rounded-lg sm:rounded-xl"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-xl font-black tracking-tight text-slate-900">
                    P.U.L.S.E.
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Brgy 40 & 41 Cavite City
                  </span>
                </div>
                <p className="text-[9px] sm:text-xs text-slate-500 font-medium line-clamp-1">
                  Waste Collection & Kagawad Proof Management
                </p>
              </div>
            </div>

            {/* Role Switcher & Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 pl-2">
              {currentRole === 'kagawad' && (
                <>
                  <button
                    onClick={toggleSound}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title={soundEnabled ? 'Alarm Sound: Naka-on' : 'Alarm Sound: Muted'}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className="hidden md:inline">
                      {soundEnabled ? 'Sound On' : 'Muted'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setResetError('');
                      setResetSuccess('');
                      setShowResetModal(true);
                    }}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Palitan ang Kagawad Password"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-purple-600" />
                    <span className="hidden md:inline">Password</span>
                  </button>

                  <button
                    onClick={handleLogoutKagawad}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Mag-logout sa Kagawad Portal"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-600" />
                    <span className="hidden md:inline">Logout</span>
                  </button>
                </>
              )}

              {/* Main Role Buttons in Header */}
              <div className="flex items-center p-0.5 sm:p-1 bg-slate-100 rounded-xl sm:rounded-2xl border border-slate-200 shrink-0">
                <button
                  onClick={() => onRoleChange('resident')}
                  className={`flex items-center gap-1 px-3 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentRole === 'resident'
                      ? 'bg-white text-emerald-800 shadow-sm font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Residente</span>
                </button>
                <button
                  onClick={handleKagawadButtonClick}
                  className={`flex items-center gap-1 px-3 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    currentRole === 'kagawad'
                      ? 'bg-purple-700 text-white shadow-md'
                      : 'text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-amber-300" />
                  <span>Kagawad</span>
                  {pendingCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-red-500 text-white font-black animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3 mx-auto shadow-inner">
              <Lock className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 text-center">
              P.U.L.S.E. Kagawad Portal
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1 mb-4">
              I-enter ang opisyal na Kagawad o Admin credentials.
            </p>
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ilagay ang username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-2xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Ilagay ang password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-2xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    title={showPassword ? 'Itago' : 'Ipakita'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {loginError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-bold text-center">
                  {loginError}
                </div>
              )}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-purple-700 hover:bg-purple-800 active:scale-98 text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Mag-login sa Portal</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setResetError('');
                    setResetSuccess('');
                    setShowResetModal(true);
                  }}
                  className="text-[11px] text-purple-700 hover:text-purple-900 font-bold underline text-center pt-1 transition-colors cursor-pointer"
                >
                  Palitan o I-reset ang Password
                </button>
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="w-full py-2 px-4 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  Bumalik sa Residente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3 mx-auto shadow-inner">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 text-center">
              Palitan ang Password
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1 mb-4 leading-relaxed">
              Ilagay ang iyong <strong>lumang password</strong> upang mag-set ng bagong password combination.
            </p>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kasalukuyang (Lumang) Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Ilagay ang lumang password"
                  value={resetOldPass}
                  onChange={(e) => setResetOldPass(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bagong Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Ilagay ang bagong password"
                    value={resetNewPass}
                    onChange={(e) => setResetNewPass(e.target.value)}
                    className="w-full px-3.5 pr-10 py-2.5 rounded-2xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kumpirmahin ang Bagong Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="I-type muli ang bagong password"
                  value={resetConfirmPass}
                  onChange={(e) => setResetConfirmPass(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
              {resetError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-bold text-center">
                  {resetError}
                </div>
              )}
              {resetSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold text-center">
                  {resetSuccess}
                </div>
              )}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>I-save ang Bagong Password</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-full py-2 px-4 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  Isara
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PWA Install Modal */}
      {showInstallPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    I-install ang P.U.L.S.E. sa Cellphone
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Barangay 40 & 41 Waste Collection Application
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 space-y-2.5">
              {deferredPrompt ? (
                <button
                  onClick={handlePromptPwa}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="block text-white leading-tight">1-Tap I-install sa Cellphone</span>
                      <span className="text-[10px] text-emerald-100 font-medium">Idaragdag agad sa iyong Apps at Home Screen</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white uppercase">
                    Install
                  </span>
                </button>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                  <span className="font-extrabold block text-emerald-800 text-sm">Paano I-install sa Phone:</span>
                  <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                    Pindutin lamang ang <strong>tatlong tuldok (⋮)</strong> sa Chrome o <strong>Share (⎙)</strong> sa Safari at piliin ang <strong>&quot;Install app&quot;</strong> o <strong>&quot;Add to Home Screen&quot;</strong>.
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Isara ang Window
            </button>
          </div>
        </div>
      )}
    </>
  );
};

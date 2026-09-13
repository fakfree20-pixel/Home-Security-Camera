import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Monitor, 
  ShieldCheck, 
  Lock, 
  HelpCircle, 
  Sparkles, 
  Radio, 
  ArrowRight,
  Flashlight,
  Headphones,
  Sliders,
  Smartphone,
  Power,
  Download
} from 'lucide-react';
import { generateRoomCode } from '../utils/webrtc';

interface DeviceSelectorProps {
  onSelectRole: (role: 'home' | 'remote', code: string) => void;
  onOpenGuide: () => void;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  onSelectRole,
  onOpenGuide,
}) => {
  const [homeCode, setHomeCode] = useState(() => generateRoomCode());
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      onOpenGuide();
    }
  };

  const handleStartHome = () => {
    if (!homeCode.trim()) {
      setHomeCode(generateRoomCode());
      return;
    }
    onSelectRole('home', homeCode.trim().toUpperCase());
  };

  const handleJoinRemote = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCode.trim().toUpperCase();
    if (!clean) {
      setJoinError('कृपया घर वाले मोबाइल का कोड दर्ज करें');
      return;
    }
    setJoinError('');
    onSelectRole('remote', clean);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center">
      {/* Header Branding */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>सुरक्षित P2P होम सिक्योरिटी कैमरा • ऑन-डिमांड एक्टिवेशन</span>
          <span className="hidden sm:inline">•</span>
          <span className="text-emerald-700 font-bold">🌐 सऊदी अरब ⇄ भारत (ग्लोबल 4G/5G/Wi-Fi फास्ट रिले)</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          होम सिक्योरिटी कैमरा
        </h1>

        <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
          घर वाले मोबाइल में कैमरा-माइक हमेशा ऑन नहीं रहता। जब बाहर वाला कोड डालकर कनेक्ट करेगा तभी ऑन होगा, और बाहर वाले के हटते ही खुद तुरंत बंद हो जाएगा।
        </p>
      </div>

      {/* Mobile App / APK Installation Banner */}
      <div className="w-full max-w-3xl mb-6 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 border border-indigo-800/40">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 text-indigo-300">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-white">
                📱 मोबाइल में ऐप इंस्टॉल करें (PWA / APK)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                बिना डाउनलोड के तुरंत चालू
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
              Chrome ब्राउज़र में 1-क्लिक में फ़ोन पर असली ऐप की तरह इंस्टॉल करें या APK डाउनलोड करें
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            id="btn-install-pwa-app"
            type="button"
            onClick={handleInstallPWA}
            className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{deferredPrompt ? 'फ़ोन में इंस्टॉल करें' : 'APK / ऐप कैसे लें?'}</span>
          </button>
        </div>
      </div>

      {/* Two Choice Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        {/* Card 1: घर वाला मोबाइल (Camera & Mic Sender) */}
        <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 hover:border-blue-500 shadow-sm transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none" />

          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <Camera className="w-6 h-6" />
            </div>

            <div className="inline-block px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold uppercase mb-2">
              डिवाइस 1
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">
              घर वाला मोबाइल (Home Device)
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              इस मोबाइल को घर पर रखें। यह स्टैंडबाय पर रहेगा। जब बाहर वाला फ़ोन जुड़ेगा तभी कैमरा व माइक खुद शुरू होंगे।
            </p>

            <div className="space-y-2 py-3 border-y border-slate-100 text-xs text-slate-600 mb-4">
              <div className="flex items-center gap-2">
                <Power className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span><b>ऑटो-ऑन / ऑटो-ऑफ:</b> बाहर वाले के हटते ही सब बंद</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span><b>केवल कोड व अनुमति:</b> परमिशन देकर फ़ोन रिटर्न मोड में शांत</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span><b>ब्लैक स्क्रीन घड़ी मोड:</b> स्क्रीन काली व सुरक्षित रहेगी</span>
              </div>
              <div className="flex items-center gap-2">
                <Flashlight className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                <span>रिमोटली कंट्रोलेबल फ्लैशलाइट (Torch)</span>
              </div>
            </div>

            {/* Generated Code display */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                इस डिवाइस का सीक्रेट कनेक्शन कोड:
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="home-custom-code"
                  type="text"
                  value={homeCode}
                  onChange={(e) => setHomeCode(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600"
                  placeholder="कोड"
                />
                <button
                  type="button"
                  onClick={() => setHomeCode(generateRoomCode())}
                  className="px-2.5 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition cursor-pointer"
                  title="नया कोड बनाएँ"
                >
                  नया कोड
                </button>
              </div>
            </div>
          </div>

          <button
            id="btn-start-home-camera"
            type="button"
            onClick={handleStartHome}
            className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>घर का स्टैंडबाय मोड चालू करें</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 2: बाहर वाला मोबाइल (Remote Viewer) */}
        <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 hover:border-emerald-500 shadow-sm transition-all flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none" />

          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <Monitor className="w-6 h-6" />
            </div>

            <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold uppercase mb-2">
              डिवाइस 2
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">
              बाहर वाला मोबाइल (Remote Monitor)
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              घर के फ़ोन का कोड डालकर दुनिया में कहीं से भी <b>लाइव वीडियो देखें या केवल आवाज़ सुनें</b>।
            </p>

            <div className="space-y-2 py-3 border-y border-slate-100 text-xs text-slate-600 mb-4">
              <div className="flex items-center gap-2">
                <Camera className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span><b>कैमरा विकल्प:</b> लाइव वीडियो, कैमरा स्विच व स्क्रीनशॉट</span>
              </div>
              <div className="flex items-center gap-2">
                <Flashlight className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                <span><b>फ्लैशलाइट बटन:</b> दूर से ही घर के फ़ोन की टॉर्च ऑन/ऑफ</span>
              </div>
              <div className="flex items-center gap-2">
                <Headphones className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span><b>वॉइस बटन:</b> शुद्ध साफ़ आवाज़ सुनें (म्यूट/अनम्यूट व वॉल्यूम)</span>
              </div>
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span><b>वॉइस फ़िल्टर बटन:</b> सामान्य, भारी, पतली, रोबोट व इको</span>
              </div>
            </div>

            {/* Input Room Code Form */}
            <form onSubmit={handleJoinRemote} className="mb-4">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                घर वाले मोबाइल का कोड यहाँ दर्ज करें:
              </label>
              <input
                id="remote-input-code"
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  setJoinError('');
                }}
                placeholder="जैसे 786-921"
                className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-600"
              />
              {joinError && (
                <p className="text-xs text-red-600 mt-1">{joinError}</p>
              )}
            </form>
          </div>

          <button
            id="btn-connect-remote-monitor"
            type="button"
            onClick={handleJoinRemote}
            className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>घर से कनेक्ट करें</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detailed Guide & OS Limitations Banner */}
      <div className="w-full max-w-3xl mt-8 p-4 rounded-xl bg-slate-100 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-xs sm:text-sm font-bold text-slate-800">
              ऑटो-ऑन/ऑफ, गाड़ी आवाज़ व सुरक्षा गाइड
            </p>
            <p className="text-[11px] text-slate-600">
              समझें कि ऑन-डिमांड कैमरा कैसे काम करता है और बैटरी व प्राइवेसी कैसे सुरक्षित रहती है
            </p>
          </div>
        </div>

        <button
          id="btn-read-os-guide"
          type="button"
          onClick={onOpenGuide}
          className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0"
        >
          गाइड पढ़ें
        </button>
      </div>
    </div>
  );
};

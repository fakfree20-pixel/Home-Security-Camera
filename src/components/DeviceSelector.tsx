import React, { useState } from 'react';
import { 
  Camera, 
  Monitor, 
  ArrowRight,
  RefreshCw,
  Shield
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
  const [homeCode, setHomeCode] = useState('');
  const [homeError, setHomeError] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const handleStartHome = () => {
    const clean = homeCode.trim().toUpperCase().replace(/[^A-Z0-9]/gi, '');
    if (!clean) {
      setHomeError('कृपया कोड दर्ज करें');
      return;
    }
    setHomeError('');
    onSelectRole('home', clean);
  };

  const handleJoinRemote = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/gi, '');
    if (!clean) {
      setJoinError('कृपया कोड दर्ज करें');
      return;
    }
    setJoinError('');
    onSelectRole('remote', clean);
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-6 flex flex-col items-center justify-center min-h-[90vh]">
      {/* Simple Clean Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white mb-2 shadow-sm">
          <Camera className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          होम सिक्योरिटी कैमरा
        </h1>
      </div>

      {/* Two Essential Cards */}
      <div className="w-full space-y-4">
        {/* Card 1: घर का कैमरा */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                1. घर का कैमरा
              </h2>
              <p className="text-xs text-slate-500">
                इस फ़ोन को घर पर रखें
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              इस फ़ोन का कोड:
            </label>
            <div className="flex items-center gap-2">
              <input
                id="home-custom-code"
                type="text"
                value={homeCode}
                onChange={(e) => {
                  setHomeCode(e.target.value.toUpperCase());
                  setHomeError('');
                }}
                className="flex-1 px-3 py-2 text-base font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 tracking-wider text-center focus:outline-none focus:border-blue-600"
                placeholder="कोड"
              />
              <button
                type="button"
                onClick={() => {
                  setHomeCode(generateRoomCode());
                  setHomeError('');
                }}
                className="px-3 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition flex items-center gap-1 cursor-pointer"
                title="नया कोड बनाएँ"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>नया</span>
              </button>
            </div>
            {homeError && (
              <p className="mt-2 text-xs text-red-500 font-medium">
                {homeError}
              </p>
            )}
          </div>

          <button
            id="btn-start-home-camera"
            type="button"
            onClick={handleStartHome}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <span>कैमरा चालू करें</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 2: बाहर से देखें */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                2. बाहर से देखें
              </h2>
              <p className="text-xs text-slate-500">
                घर के कैमरे का लाइव वीडियो देखें
              </p>
            </div>
          </div>

          <form onSubmit={handleJoinRemote} className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              घर के फ़ोन का कोड डालें:
            </label>
            <input
              id="remote-input-code"
              type="text"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setJoinError('');
              }}
              placeholder="उदा. 786-921"
              className="w-full px-3 py-2 text-base font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 tracking-wider text-center focus:outline-none focus:border-emerald-600"
            />
            {joinError && (
              <p className="text-xs text-red-600 mt-1.5 text-center font-medium">{joinError}</p>
            )}
          </form>

          <button
            id="btn-connect-remote-monitor"
            type="button"
            onClick={handleJoinRemote}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <span>लाइव देखें</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subtle Footer Link */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onOpenGuide}
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mx-auto transition cursor-pointer"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>सुरक्षा व जानकारी</span>
        </button>
      </div>
    </div>
  );
};

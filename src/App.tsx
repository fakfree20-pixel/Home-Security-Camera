import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  HelpCircle, 
  Lock, 
  RefreshCw,
  FolderArchive
} from 'lucide-react';
import { DeviceRole } from './types/camera';
import { DeviceSelector } from './components/DeviceSelector';
import { HomeCameraView } from './components/HomeCameraView';
import { RemoteMonitorView } from './components/RemoteMonitorView';
import { PrivacyGuideModal } from './components/PrivacyGuideModal';

export default function App() {
  const [role, setRole] = useState<DeviceRole | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Check URL parameters on mount for easy auto-join (e.g. ?code=123-456&role=remote)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    const roleParam = params.get('role');

    if (codeParam && (roleParam === 'home' || roleParam === 'remote')) {
      setRoomCode(codeParam.toUpperCase());
      setRole(roleParam as DeviceRole);
    }
  }, []);

  const handleSelectRole = (selectedRole: DeviceRole, code: string) => {
    setRole(selectedRole);
    setRoomCode(code);

    // Update URL without reloading for bookmarking/sharing
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('code', code);
    newUrl.searchParams.set('role', selectedRole);
    window.history.pushState({}, '', newUrl.toString());
  };

  const handleBackToSelector = () => {
    setRole(null);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('code');
    newUrl.searchParams.delete('role');
    window.history.pushState({}, '', newUrl.toString());
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 select-none">
      {/* View routing based on role */}
      {role === 'home' ? (
        <HomeCameraView
          roomCode={roomCode}
          onBack={handleBackToSelector}
          onOpenGuide={() => setIsGuideOpen(true)}
        />
      ) : role === 'remote' ? (
        <RemoteMonitorView
          roomCode={roomCode}
          onBack={handleBackToSelector}
          onOpenGuide={() => setIsGuideOpen(true)}
        />
      ) : (
        <div className="flex-1 flex flex-col overflow-y-auto">
          <DeviceSelector
            onSelectRole={handleSelectRole}
            onOpenGuide={() => setIsGuideOpen(true)}
          />
        </div>
      )}

      {/* Privacy & Technical Guide Modal */}
      <PrivacyGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}

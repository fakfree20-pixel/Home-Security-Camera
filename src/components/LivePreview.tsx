import React, { useState, useEffect, useMemo } from 'react';
import { 
  Monitor, 
  Tablet, 
  Smartphone, 
  RotateCw, 
  ExternalLink, 
  AlertCircle,
  Code2
} from 'lucide-react';
import { ExtractedFile } from '../types';
import { buildPreviewDoc } from '../utils/zipHandler';

interface LivePreviewProps {
  files: ExtractedFile[];
  activeHtmlPath?: string;
  onSelectHtmlFile: (path: string) => void;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export const LivePreview: React.FC<LivePreviewProps> = ({
  files,
  activeHtmlPath,
  onSelectHtmlFile,
}) => {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [key, setKey] = useState(0);

  // Find all HTML files
  const htmlFiles = useMemo(() => {
    return files.filter(f => f.extension === 'html' || f.name.toLowerCase().endsWith('.html'));
  }, [files]);

  const previewDoc = useMemo(() => {
    return buildPreviewDoc(files, activeHtmlPath);
  }, [files, activeHtmlPath, key]);

  const handleRefresh = () => {
    setKey(prev => prev + 1);
  };

  const handleOpenNewWindow = () => {
    const blob = new Blob([previewDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const getContainerWidth = () => {
    switch (device) {
      case 'mobile':
        return 'max-w-[375px] h-[667px] shadow-2xl rounded-2xl border-8 border-slate-800';
      case 'tablet':
        return 'max-w-[768px] h-[850px] shadow-2xl rounded-xl border-8 border-slate-800';
      case 'desktop':
      default:
        return 'w-full h-full';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Preview Controls Bar */}
      <div className="px-4 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">लाइव प्रीव्यू (Live Preview):</span>
          {htmlFiles.length > 1 ? (
            <select
              id="html-file-selector"
              value={activeHtmlPath || ''}
              onChange={(e) => onSelectHtmlFile(e.target.value)}
              className="text-xs bg-slate-100 border border-slate-300 rounded px-2 py-1 font-mono text-slate-800 focus:outline-none focus:border-blue-500"
            >
              {htmlFiles.map(f => (
                <option key={f.path} value={f.path}>
                  {f.path}
                </option>
              ))}
            </select>
          ) : htmlFiles.length === 1 ? (
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {htmlFiles[0].path}
            </span>
          ) : (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              कोई HTML फ़ाइल नहीं मिली
            </span>
          )}
        </div>

        {/* Device Mode Selectors */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            id="device-btn-desktop"
            type="button"
            onClick={() => setDevice('desktop')}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              device === 'desktop' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Desktop View"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            id="device-btn-tablet"
            type="button"
            onClick={() => setDevice('tablet')}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              device === 'tablet' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Tablet View (768px)"
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            id="device-btn-mobile"
            type="button"
            onClick={() => setDevice('mobile')}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              device === 'mobile' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Mobile View (375px)"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <button
            id="btn-refresh-preview"
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            title="रिफ्रेश करें (Reload Preview)"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            id="btn-open-preview-newtab"
            type="button"
            onClick={handleOpenNewWindow}
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            title="नए टैब में खोलें (Open in new window)"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-200/60">
        <div className={`transition-all duration-300 overflow-hidden bg-white ${getContainerWidth()}`}>
          <iframe
            key={key}
            id="preview-sandboxed-iframe"
            title="App Preview"
            srcDoc={previewDoc}
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
            className="w-full h-full border-none bg-white"
          />
        </div>
      </div>
    </div>
  );
};

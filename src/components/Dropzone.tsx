import React, { useRef, useState } from 'react';
import { Upload, FileArchive, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

interface DropzoneProps {
  onFileLoaded: (file: File) => void;
  onLoadDemo: () => void;
  isLoading: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFileLoaded, onLoadDemo, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.zip') || file.type.includes('zip') || file.type.includes('octet-stream')) {
        onFileLoaded(file);
      } else {
        alert('कृपया केवल .zip फ़ाइल चुनें (Please select a .zip file)');
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileLoaded(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto my-8 px-4">
      <div
        id="zip-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
            : 'border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/50 shadow-sm'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleFileInput}
          className="hidden"
          id="zip-file-input"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-100/80 text-blue-600 flex items-center justify-center shadow-inner">
            <FileArchive className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-800">
              अपनी ZIP फ़ाइल यहाँ ड्रॉप करें या चुनें
            </h3>
            <p className="text-sm font-medium text-slate-500">
              Drop your .zip file here, or click to browse from device
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition shadow-sm">
            <Upload className="w-4 h-4" />
            <span>फ़ाइल अपलोड करें (Upload ZIP)</span>
          </div>

          <p className="text-xs text-slate-400">
            HTML/CSS/JS, React, Vue, Node.js या किसी भी प्रकार का वेब प्रोजेक्ट समर्थित है
          </p>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center rounded-2xl">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-slate-700">फ़ाइल खोली जा रही है...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Demo Button and Instructions */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-100 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-800">अभी टेस्ट करना चाहते हैं?</p>
            <p className="text-xs text-slate-600">बिना फ़ाइल अपलोड किए एक लाइव सैंपल प्रोजेक्ट चलाकर देखें</p>
          </div>
        </div>

        <button
          id="btn-load-demo"
          type="button"
          onClick={onLoadDemo}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs hover:shadow-xs transition cursor-pointer"
        >
          <span>सैंपल प्रोजेक्ट लोड करें</span>
          <ArrowRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Guidance Note */}
      <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-100 text-left">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-slate-700 space-y-1.5">
            <p className="font-semibold text-blue-900">चैट में ZIP कैसे उपयोग करें?</p>
            <p>1. आप अपनी ZIP फ़ाइल को यहाँ स्क्रीन पर सीधे ड्रैग करके खोल सकते हैं और यहीं कोड देख/संपादित कर सकते हैं।</p>
            <p>2. अगर आप चाहते हैं कि मैं (AI) सीधे पूरे ऐप का कोड बदलूँ, तो चैट में फ़ाइल अटैच करें या बताएँ कि क्या कोड बदलना है!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

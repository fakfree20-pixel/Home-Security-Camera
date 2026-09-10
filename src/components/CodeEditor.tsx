import React, { useState, useEffect } from 'react';
import { 
  Copy, 
  Check, 
  Save, 
  RotateCcw, 
  Edit3, 
  Eye, 
  FileText,
  AlertTriangle 
} from 'lucide-react';
import { ExtractedFile } from '../types';

interface CodeEditorProps {
  file: ExtractedFile | null;
  onSaveContent: (path: string, newContent: string) => void;
  isModified: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  file,
  onSaveContent,
  isModified,
}) => {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (file && file.content !== undefined) {
      setContent(file.content);
      setIsEditing(false);
    }
  }, [file]);

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 text-slate-400">
        <FileText className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">बाईं ओर से कोई फ़ाइल चुनें (Select a file to inspect)</p>
        <p className="text-xs text-slate-400 mt-1">आप कोड देख सकते हैं और उसमें बदलाव कर सकते हैं</p>
      </div>
    );
  }

  // Handle Images
  if (file.blobUrl) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-900 text-white">
        <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-300">{file.path}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 uppercase">
            {file.extension} Image
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          <div className="text-center">
            <img 
              src={file.blobUrl} 
              alt={file.name} 
              className="max-h-[60vh] max-w-full rounded-lg shadow-lg border border-slate-700 object-contain mx-auto"
            />
            <p className="text-xs text-slate-400 mt-4 font-mono">{file.name}</p>
          </div>
        </div>
      </div>
    );
  }

  // Non-text binary file
  if (file.content === undefined) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 text-slate-500">
        <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
        <p className="text-sm font-semibold text-slate-700">बाइनरी फ़ाइल (Binary File)</p>
        <p className="text-xs text-slate-500 mt-1">इस फ़ाइल को सीधे टेक्स्ट के रूप में नहीं देखा जा सकता</p>
        <span className="text-xs font-mono mt-3 px-2 py-1 bg-slate-200 rounded text-slate-700">{file.path}</span>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (file) {
      onSaveContent(file.path, content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const handleReset = () => {
    if (file && file.content !== undefined) {
      setContent(file.content);
    }
  };

  const lines = content.split('\n');

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 min-w-0">
      {/* Action Bar */}
      <div className="px-4 py-2.5 bg-slate-800/90 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-slate-300 truncate max-w-xs sm:max-w-md">
            {file.path}
          </span>
          {isModified && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium shrink-0">
              बदला हुआ (Modified)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-toggle-edit"
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
              isEditing 
                ? 'bg-blue-600 text-white shadow-2xs' 
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            <span>{isEditing ? 'एडिट मोड चालू' : 'एडिट करें'}</span>
          </button>

          {isEditing && (
            <button
              id="btn-save-file"
              type="button"
              onClick={handleSave}
              className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saveSuccess ? 'सेव हो गया!' : 'सेव करें'}</span>
            </button>
          )}

          {isEditing && (
            <button
              id="btn-revert-file"
              type="button"
              onClick={handleReset}
              className="px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition cursor-pointer"
              title="बदलाव वापस लें (Discard changes)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            id="btn-copy-code"
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'कॉपी हुआ' : 'कॉपी'}</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative overflow-hidden flex">
        {isEditing ? (
          <textarea
            id="code-textarea-editor"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full p-4 font-mono text-xs sm:text-sm bg-slate-950 text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed overflow-auto"
            placeholder="फ़ाइल का कोड यहाँ लिखें..."
            spellCheck={false}
          />
        ) : (
          <div className="flex-1 flex overflow-auto bg-slate-950 font-mono text-xs sm:text-sm">
            {/* Line numbers */}
            <div className="py-4 pl-3 pr-3 text-right select-none text-slate-600 border-r border-slate-800 shrink-0">
              {lines.map((_, i) => (
                <div key={i} className="leading-relaxed">
                  {i + 1}
                </div>
              ))}
            </div>
            {/* Code Content */}
            <pre className="p-4 text-slate-200 leading-relaxed overflow-x-auto whitespace-pre">
              {content}
            </pre>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-4 py-1.5 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="font-mono">{lines.length} पंक्तियाँ (Lines) • {content.length} अक्षर</span>
        <span>{isEditing ? '✎ संपादन सक्रिय (Editing Active)' : 'केवल देखने के लिए (Read Only)'}</span>
      </div>
    </div>
  );
};

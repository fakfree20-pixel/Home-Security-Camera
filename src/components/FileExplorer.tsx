import React, { useState } from 'react';
import { 
  File, 
  FileCode, 
  FileText, 
  FileImage, 
  Search, 
  FolderOpen, 
  Check, 
  Download, 
  RefreshCw,
  Edit2
} from 'lucide-react';
import { ExtractedFile, ProjectMetadata } from '../types';

interface FileExplorerProps {
  files: ExtractedFile[];
  selectedFile: ExtractedFile | null;
  onSelectFile: (file: ExtractedFile) => void;
  onDownloadZip: () => void;
  onReset: () => void;
  metadata: ProjectMetadata;
  modifiedFiles: Set<string>;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  selectedFile,
  onSelectFile,
  onDownloadZip,
  onReset,
  metadata,
  modifiedFiles,
}) => {
  const [search, setSearch] = useState('');

  const filteredFiles = files.filter(f =>
    f.path.toLowerCase().includes(search.toLowerCase())
  );

  const getFileIcon = (file: ExtractedFile) => {
    const ext = file.extension.toLowerCase();
    if (['html', 'htm'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-orange-500 shrink-0" />;
    }
    if (['css', 'scss', 'sass'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-blue-500 shrink-0" />;
    }
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-amber-500 shrink-0" />;
    }
    if (['json', 'yaml', 'yml'].includes(ext)) {
      return <FileText className="w-4 h-4 text-yellow-600 shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext)) {
      return <FileImage className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    if (['md', 'txt'].includes(ext)) {
      return <FileText className="w-4 h-4 text-slate-500 shrink-0" />;
    }
    return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
      {/* Header Info */}
      <div className="p-3 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-800 truncate" title={metadata.fileName}>
              {metadata.fileName}
            </span>
          </div>
          <button
            id="btn-reupload-zip"
            type="button"
            onClick={onReset}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="नई ZIP लोड करें (Load another ZIP)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stats Chips */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
            {files.length} फ़ाइलें
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
            {formatBytes(metadata.totalSize)}
          </span>
          {modifiedFiles.size > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-medium">
              {modifiedFiles.size} संशोधित
            </span>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-slate-200 bg-white">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            id="file-search-input"
            type="text"
            placeholder="फ़ाइल खोजें (Search files)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 rounded-md border border-slate-200 focus:outline-none focus:bg-white focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {filteredFiles.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            कोई फ़ाइल नहीं मिली
          </div>
        ) : (
          filteredFiles.map((file) => {
            const isSelected = selectedFile?.path === file.path;
            const isModified = modifiedFiles.has(file.path);

            return (
              <button
                key={file.path}
                id={`file-item-${file.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                type="button"
                onClick={() => onSelectFile(file)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition cursor-pointer text-xs ${
                  isSelected
                    ? 'bg-blue-100/80 text-blue-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
                title={file.path}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  {getFileIcon(file)}
                  <span className="truncate">{file.name}</span>
                  {isModified && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Modified" />
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {formatBytes(file.size)}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Footer Download Action */}
      <div className="p-2 border-t border-slate-200 bg-white">
        <button
          id="btn-download-updated-zip"
          type="button"
          onClick={onDownloadZip}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>ZIP डाउनलोड करें (Export)</span>
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { Battery, BatteryCharging, BatteryWarning, Zap } from 'lucide-react';

export interface BatteryIndicatorProps {
  level: number | null; // 0 to 100
  isCharging?: boolean;
  label?: string;
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
}

export const BatteryIndicator: React.FC<BatteryIndicatorProps> = ({
  level,
  isCharging = false,
  label,
  compact = false,
  size = 'md',
  showPercentage = true,
  className = '',
}) => {
  // If battery info is unavailable
  if (level === null || level === undefined) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-400 text-xs font-mono ${className}`}
        title="बैटरी स्थिति डिवाइस द्वारा उपलब्ध नहीं कराई गई"
      >
        <Battery className="w-3.5 h-3.5 text-slate-500" />
        {label && <span className="text-slate-400 font-sans text-[11px]">{label}:</span>}
        <span>बैटरी N/A</span>
      </div>
    );
  }

  const clampedLevel = Math.max(0, Math.min(100, Math.round(level)));
  const isLow = clampedLevel <= 20;
  const isCritical = clampedLevel <= 10;

  // Determine styling theme
  let theme = {
    bg: 'bg-emerald-950/60',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    fill: 'bg-emerald-400',
    glow: '',
  };

  if (isCharging) {
    theme = {
      bg: 'bg-teal-950/70',
      border: 'border-teal-400/50',
      text: 'text-teal-300',
      fill: 'bg-teal-400',
      glow: 'shadow-[0_0_8px_rgba(45,212,191,0.25)]',
    };
  } else if (isLow) {
    theme = {
      bg: 'bg-rose-950/70',
      border: 'border-rose-500/50',
      text: 'text-rose-400',
      fill: 'bg-rose-500',
      glow: 'animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.3)]',
    };
  } else if (clampedLevel <= 45) {
    theme = {
      bg: 'bg-amber-950/60',
      border: 'border-amber-500/40',
      text: 'text-amber-400',
      fill: 'bg-amber-400',
      glow: '',
    };
  }

  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-sm' : 'text-xs';

  if (compact) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${theme.bg} border ${theme.border} ${theme.text} ${theme.glow} ${textSize} font-mono ${className}`}
        title={`बैटरी: ${clampedLevel}% ${isCharging ? '(चार्जिंग जारी है)' : ''}`}
      >
        {isCharging ? (
          <Zap className={`${iconSize} text-teal-300 animate-pulse`} />
        ) : isCritical ? (
          <BatteryWarning className={`${iconSize} text-rose-400 animate-bounce`} />
        ) : (
          <Battery className={iconSize} />
        )}
        {showPercentage && <span>{clampedLevel}%</span>}
      </div>
    );
  }

  return (
    <div 
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${theme.bg} border ${theme.border} ${theme.glow} ${textSize} transition-all ${className}`}
    >
      <div className="flex items-center gap-1.5">
        {isCharging ? (
          <div className="relative flex items-center justify-center">
            <BatteryCharging className={`${iconSize} ${theme.text}`} />
            <Zap className="w-2.5 h-2.5 text-yellow-300 absolute -top-1 -right-1 animate-pulse" />
          </div>
        ) : isCritical ? (
          <BatteryWarning className={`${iconSize} text-rose-400 animate-bounce`} />
        ) : (
          <div className="relative flex items-center">
            {/* Custom Battery Visual Cell */}
            <div className="w-5 h-3 border border-current rounded-[3px] p-[1.5px] flex items-center relative">
              <div 
                className={`h-full ${theme.fill} rounded-[1px] transition-all duration-500`}
                style={{ width: `${clampedLevel}%` }}
              />
              <div className="w-[1.5px] h-1.5 bg-current rounded-r-[1px] absolute -right-[2.5px] top-[2.5px]" />
            </div>
          </div>
        )}

        {label && (
          <span className="text-slate-300 text-[11px] font-sans font-medium whitespace-nowrap">
            {label}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 font-mono font-bold tracking-tight">
        <span className={theme.text}>{clampedLevel}%</span>
        {isCharging && (
          <span className="text-[10px] text-teal-300 font-sans font-normal flex items-center gap-0.5">
            <Zap className="w-2.5 h-2.5 inline" />
            चार्जिंग
          </span>
        )}
      </div>

      {isLow && !isCharging && (
        <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-sans whitespace-nowrap">
          चार्जर लगाएँ
        </span>
      )}
    </div>
  );
};

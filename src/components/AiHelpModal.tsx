import React from 'react';
import { X, MessageSquareCode, FolderSync, Sparkles, CheckCircle2 } from 'lucide-react';

interface AiHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiHelpModal: React.FC<AiHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative">
        <button
          id="btn-close-help-modal"
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              अपनी ZIP फ़ाइल को कैसे बदलें और ऐप बनाएँ?
            </h3>
            <p className="text-xs text-slate-500">How to convert & modify your ZIP project</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-700">
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-blue-900 text-xs sm:text-sm">
              <MessageSquareCode className="w-4 h-4 text-blue-600" />
              <span>तरीका 1: चैट में सीधे ZIP फ़ाइल भेजें (Recommended)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              आप नीचे AI Studio चैट के अटैचमेंट बटन (📎) से अपनी <b>.zip फ़ाइल</b> सीधे अपलोड कर सकते हैं और लिख सकते हैं कि आपको इसमें क्या बदलाव करने हैं। मैं पूरी फ़ाइल एक्सट्रैक्ट करके आपके निर्देश अनुसार सीधे ऐप तैयार कर दूँगा!
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-900 text-xs sm:text-sm">
              <FolderSync className="w-4 h-4 text-amber-600" />
              <span>तरीका 2: यहाँ स्क्रीन पर ड्रैग-एंड-ड्रॉप करें</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              आप स्क्रीन पर किसी भी .zip फ़ाइल को ड्रैग-एंड-ड्रॉप कर सकते हैं। यह तुरंत सारी फ़ाइलें खोल देगा, आप सीधे इन-ब्राउज़र कोड एडिट कर सकते हैं और लाइव प्रीव्यू देख सकते हैं।
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              आपको जो भी बदलाव करवाने हैं (जैसे रंग बदलना, नया बटन जोड़ना, कोई फ़ीचर जोड़ना), बस चैट में बताएँ!
            </span>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            id="btn-understand-help"
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            समझ गया (Got it)
          </button>
        </div>
      </div>
    </div>
  );
};

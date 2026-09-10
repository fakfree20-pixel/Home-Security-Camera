import React from 'react';
import { X, CheckCircle2, AlertTriangle, Smartphone, Power, Flashlight, Volume2, Sliders, ShieldCheck, PhoneCall } from 'lucide-react';

interface PrivacyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyGuideModal: React.FC<PrivacyGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative my-8">
        <button
          id="btn-close-privacy-guide"
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              होम सिक्योरिटी कैमरा गाइड
            </h3>
            <p className="text-xs text-slate-500">ऑटो-ऑन/ऑफ, रिटर्न मोड, वॉइस व सुरक्षा निर्देश</p>
          </div>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-700 max-h-[70vh] overflow-y-auto pr-1">
          {/* Section 1: Auto On/Off Standby Policy */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-xs sm:text-sm">
              <Power className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>1. रिटर्न मोड (स्टैंडबाय) व ऑटो-ऑन/ऑफ</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              घर वाले मोबाइल में कैमरा और माइक हर समय चालू <b>नहीं</b> रहते:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
              <li><b>एक बार अनुमति (Pre-grant):</b> ऐप खुलते ही कैमरा व माइक की अनुमति ले ली जाती है और तुरंत हार्डवेयर बंद करके फ़ोन शांत रिटर्न मोड में चला जाता है।</li>
              <li><b>केवल कोड का विकल्प:</b> स्क्रीन पर केवल सीक्रेट कोड रहता है जो बाहर वाले फ़ोन में दर्ज करना होता है।</li>
              <li><b>ऑटोमैटिक एक्टिवेशन:</b> बाहर वाले के कोड डालकर जुड़ते ही घर के फ़ोन का कैमरा व माइक खुद-ब-खुद ऑन हो जाते हैं।</li>
              <li><b>ऑटोमैटिक शटडाउन:</b> जैसे ही बाहर वाला फ़ोन ऐप बंद करता है या 'बाहर निकलें' दबाता है, घर का कैमरा व माइक तुरंत स्वतः बंद हो जाते हैं।</li>
            </ul>
          </div>

          {/* Section 2: Remote Controls */}
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-blue-900 text-xs sm:text-sm">
              <Sliders className="w-4 h-4 text-blue-600 shrink-0" />
              <span>2. बाहर वाले मोबाइल के 4 मुख्य कंट्रोल्स</span>
            </div>
            <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
              <li><b>कैमरा विकल्प:</b> लाइव वीडियो देखना, आगे/पीछे कैमरा बदलना व स्क्रीनशॉट लेना।</li>
              <li><b>फ्लैशलाइट बटन:</b> दूर से ही घर के फ़ोन की टॉर्च ऑन या ऑफ करना।</li>
              <li><b>वॉइस बटन:</b> घर की साफ़ माइक आवाज़ सुनना (म्यूट/अनम्यूट और वॉल्यूम स्लाइडर)।</li>
              <li><b>वॉइस फ़िल्टर बटन:</b> सामान्य आवाज़, भारी बेस, पतली आवाज़, रोबोट, वॉकी-टॉकी व इको प्रभाव लागू करना।</li>
            </ul>
          </div>

          {/* Section 3: Clean Audio Only */}
          <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-indigo-900 text-xs sm:text-sm">
              <Volume2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>3. केवल शुद्ध माइक आवाज़ (बिना गाड़ी/हॉर्न/डीजे शोर के)</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              घर वाले मोबाइल से केवल शुद्ध माइक आवाज़ प्रसारित की जाती है। किसी भी प्रकार का कृत्रिम गाड़ी, मोटर, हॉर्न या डीजे का शोर नहीं बजाया जाता।
            </p>
          </div>

          {/* Section 4: Best Practice */}
          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>4. घर पर फ़ोन रखने का सबसे सही तरीका</span>
            </div>
            <div className="space-y-1 text-xs text-slate-600">
              <p>• फ़ोन को चार्जर पर लगाएँ और घर के कमरे में उपयुक्त दिशा में रख दें।</p>
              <p>• ऐप में <b>"ब्लैक स्क्रीन (घड़ी सेवर)"</b> चालू कर दें, जिससे स्क्रीन काली रहे और बैटरी बचे।</p>
              <p>• बाहर से जब चाहें कोड डालकर देखें; काम समाप्त होते ही ऐप बंद कर दें—घर का फ़ोन स्वतः स्टैंडबाय पर चला जाएगा।</p>
            </div>
          </div>

          {/* Section 5: Global Connectivity (Saudi Arabia ⇄ India, Wi-Fi & Mobile SIM) */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-xs sm:text-sm">
              <span className="text-base">🌐</span>
              <span>5. ग्लोबल कनेक्टिविटी (सऊदी अरब ⇄ भारत व विश्वभर)</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              यह ऐप विशेष रूप से अंतरराष्ट्रीय स्तर पर मोबाइल नेटवर्क (SIM) और वाई-फ़ाई पर काम करने के लिए डिज़ाइन किया गया है:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
              <li><b>STUN + TURN रिले सर्वर:</b> मोबाइल सिम कंपनियों (सऊदी में STC, Mobily, Zain और भारत में Jio, Airtel, Vi) के कड़े NAT व फ़ायरवॉल को बिना किसी रुकावट के सीधे जोड़ते हैं।</li>
              <li><b>सुपरफास्ट व लैग-फ्री वीडियो:</b> डायनामिक बिटरेट और फ्रेमरेट ऑप्टिमाइजेशन से वीडियो बिना अटके (No Lag) रियल-टाइम में चलता है।</li>
              <li><b>ऑटोमैटिक री-कनेक्शन:</b> नेटवर्क बदलने (Wi-Fi से मोबाइल डेटा या सिग्नल ड्रॉप) पर कनेक्शन अपने-आप पुनः जुड़ जाता है।</li>
            </ul>
          </div>

          {/* Section 6: Zero Interference with WhatsApp & IMO */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950 text-xs sm:text-sm">
              <PhoneCall className="w-4 h-4 text-amber-600 shrink-0" />
              <span>6. व्हाट्सएप, इमो और सामान्य कॉल पर कोई असर नहीं</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              घर वाले मोबाइल पर कैमरा व माइक परमिशन चालू रहने पर भी आपके दूसरे ऐप पर 0% कोई असर नहीं होगा:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
              <li><b>हार्डवेयर स्वतः रिलीज:</b> रिटर्न स्टैंडबाय मोड में ऐप कैमरा और माइक को पूरी तरह बंद (Release) रखता है। इससे व्हाट्सएप और इमो को माइक का पूरा एक्सेस मिलता है।</li>
              <li><b>कॉल आने पर प्राथमिकता:</b> अगर बाहर वाला देख भी रहा हो और उस दौरान घर वाले फ़ोन पर व्हाट्सएप/इमो कॉल या फोन कॉल आ जाए, तो ऐप तुरंत माइक-कैमरा छोड़ देता है ताकि आपकी बातचीत बिना किसी रुकावट के हो सके।</li>
              <li><b>कोई व्यवधान नहीं:</b> आप बेझिझक इमो और व्हाट्सएप पर बात कर सकते हैं, आवाज़ साफ़ आएगी और कोई एरर नहीं आएगा।</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            id="btn-close-privacy-guide-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            समझ गया
          </button>
        </div>
      </div>
    </div>
  );
};

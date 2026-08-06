"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { LocationData } from "../lib/firestoreLocations";
import {
  collection,
  query,
  getDocs,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const IndiaMap = dynamic(() => import("../components/IndiaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[620px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center text-emerald-400 font-medium animate-pulse gap-3">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <span>📍 Initializing Pan-India Geospatial Intelligence Engine...</span>
    </div>
  ),
});

interface Article {
  id: string;
  title: string;
  category: string;
  sub_category?: string;
  market_scope?: string;
  summary: string;
  full_content?: string;
  region: string;
  published_at?: string;
  date?: string;
  createdAt?: string | { seconds: number };
  source_name?: string;
  source_url?: string;
  key_takeaway?: string;
  regulatory_update?: boolean;
}

// 10 Major Indian Languages UI Translation Dictionary
const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    headerTitle: "FMCG News Desk",
    headerSubtitle: "Multi-Category Executive Bulletins, Regional Trends & Consumer Insights",
    aiTitle: "✨ AI MARKET INSIGHTS",
    aiSubtitle: "Synthesis of Active FMCG Market Intelligence",
    outlook: "Market Outlook: Bullish",
    execSummaryLabel: "Executive Summary:",
    bulletinsTitle: "📰 Executive Market Bulletins",
    readDetail: "Read Detail Bulletin",
    share: "Share",
    source: "Source",
    published: "Published",
    keyTakeaway: "💡 Executive Strategic Takeaway:",
    readFullArticle: "🔗 Read full article on original publisher",
    noLink: "Source link unavailable",
    mapTab: "🗺️ India Geospatial Map",
    intelTab: "📊 Market Intelligence",
    updatesFound: "Updates Found",
    noNews: "No active bulletins found for the selected region, category, and sub-category within the past 30 days.",
    subAll: "🌐 All Bulletins",
    subDomestic: "🇮🇳 Domestic Market",
    subIB: "🚢 IB - International Business & Exports",
    subReg: "📜 Regulatory & Food Safety",
  },
  hi: {
    headerTitle: "FMCG न्यूज डेस्क",
    headerSubtitle: "बहु-श्रेणी कार्यकारी बुलेटिन, क्षेत्रीय रुझान और उपभोक्ता अंतर्दृष्टि",
    aiTitle: "✨ एआई बाजार अंतर्दृष्टि",
    aiSubtitle: "सक्रिय एफएमसीजी बाजार खुफिया का संश्लेषण",
    outlook: "बाजार दृष्टिकोण: तेजी",
    execSummaryLabel: "कार्यकारी सारांश:",
    bulletinsTitle: "📰 कार्यकारी बाजार बुलेटिन",
    readDetail: "विस्तृत बुलेटिन पढ़ें",
    share: "साझा करें",
    source: "स्रोत",
    published: "प्रकाशित",
    keyTakeaway: "💡 कार्यकारी रणनीतिक निष्कर्ष:",
    readFullArticle: "🔗 मूल प्रकाशक पर पूरा लेख पढ़ें",
    noLink: "स्रोत लिंक उपलब्ध नहीं है",
    mapTab: "🗺️ भारत भू-स्थानिक मानचित्र",
    intelTab: "📊 बाजार इंटेलिजेंस",
    updatesFound: "अपडेट मिले",
    noNews: "पिछले 30 दिनों में चयनित क्षेत्र, श्रेणी और उप-श्रेणी के लिए कोई सक्रिय बुलेटिन नहीं मिला।",
    subAll: "🌐 सभी बुलेटिन",
    subDomestic: "🇮🇳 घरेलू बाजार",
    subIB: "🚢 अंतराष्ट्रीय व्यापार (IB) और निर्यात",
    subReg: "📜 नियामक और खाद्य सुरक्षा",
  },
  mr: {
    headerTitle: "FMCG न्यूज डेस्क",
    headerSubtitle: "बहु-श्रेणी कार्यकारी बुलेटिन, प्रादेशिक प्रवाह आणि ग्राहक मते",
    aiTitle: "✨ AI मार्केट इनसाइट्स",
    aiSubtitle: "सक्रिय FMCG मार्केट बुद्धिमत्तेचे संश्लेषण",
    outlook: "बाजार दृष्टीकोन: तेजी",
    execSummaryLabel: "कार्यकारी सारांश:",
    bulletinsTitle: "📰 कार्यकारी बाजार बुलेटिन",
    readDetail: "सविस्तर बुलेटिन वाचा",
    share: "शेअर करा",
    source: "स्रोत",
    published: "प्रसिद्ध झाले",
    keyTakeaway: "💡 कार्यकारी धोरणात्मक निष्कर्ष:",
    readFullArticle: "🔗 मूळ बातमी लिंकवर वाचा",
    noLink: "स्रोत लिंक उपलब्ध नाही",
    mapTab: "🗺️ भारत नकाशा",
    intelTab: "📊 मार्केट इंटेलिजन्स",
    updatesFound: "अपडेट्स सापडले",
    noNews: "गेल्या ३० दिवसांत निवडलेल्या प्रदेश, श्रेणी आणि उप-श्रेणीसाठी कोणतीही बातमी सापडली नाही.",
    subAll: "🌐 सर्व बुलेटिन",
    subDomestic: "🇮🇳 अंतर्गत बाजार",
    subIB: "🚢 आंतरराष्ट्रीय व्यवसाय (IB) आणि निर्यात",
    subReg: "📜 नियामक आणि अन्न सुरक्षा",
  },
  gu: {
    headerTitle: "FMCG ન્યૂઝ ડેસ્ક",
    headerSubtitle: "મલ્ટિ-કેટેગરી એક્ઝિક્યુટિવ બુલેટિન અને પ્રાદેશિક વલણો",
    aiTitle: "✨ AI માર્કેટ ઇનસાઇટ્સ",
    aiSubtitle: "સક્રિય FMCG માર્કેટ ઇન્ટેલિજન્સ સંશ્લેષણ",
    outlook: "માર્કેટ આઉટલુક: તેજી",
    execSummaryLabel: "એક્ઝિક્યુટિવ સારાંશ:",
    bulletinsTitle: "📰 એક્ઝિક્યુટિવ માર્કેટ બુલેટિન",
    readDetail: "વિગતવાર બુલેટિન વાંચો",
    share: "શેર કરો",
    source: "સ્રોત",
    published: "પ્રકાશિત",
    keyTakeaway: "💡 વ્યવહારે મુખ્ય નિર્ણય:",
    readFullArticle: "🔗 મૂળ પ્રકાશક પર સંપૂર્ણ લેખ વાંચો",
    noLink: "સ્રોત લિંક ઉપલબ્ધ નથી",
    mapTab: "🗺️ ભારત નકશો",
    intelTab: "📊 માર્કેટ ઇન્ટેલિજન્સ",
    updatesFound: "અપડેટ્સ મળ્યા",
    noNews: "છેલ્લા 30 દિવસમાં કોઈ બુલેટિન મળ્યા નથી.",
    subAll: "🌐 તમામ બુલેટિન",
    subDomestic: "🇮🇳 સ્થાનિક માર્કેટ",
    subIB: "🚢 ઇન્ટરનેશનલ બિઝનેસ (IB) અને નિકાસ",
    subReg: "📜 રેગ્યુલેટરી અને ફૂડ સેફ્ટી",
  },
  ta: {
    headerTitle: "FMCG செய்திப் பிரிவு",
    headerSubtitle: "செயல்பாட்டு புல்லட்டின்கள் மற்றும் பிராந்திய சந்தை நுண்ணறிவு",
    aiTitle: "✨ AI சந்தை நுண்ணறிவு",
    aiSubtitle: "சந்தை நுண்ணறிவின் தொகுப்பு",
    outlook: "சந்தை பார்வை: நேர்மறை",
    execSummaryLabel: "நிர்வாக சுருக்கம்:",
    bulletinsTitle: "📰 நிர்வாக சந்தை செய்திகள்",
    readDetail: "முழு விவரம் படிக்க",
    share: "பகிர்",
    source: "ஆதாரம்",
    published: "வெளியிடப்பட்டது",
    keyTakeaway: "💡 முக்கிய உத்தி:",
    readFullArticle: "🔗 அசல் செய்தி தளத்தில் படிக்க",
    noLink: "இணைப்பு கிடைக்கவில்லை",
    mapTab: "🗺️ இந்திய வரைபடம்",
    intelTab: "📊 சந்தை தகவல்",
    updatesFound: "செய்திகள் கிடைத்துள்ளன",
    noNews: "கடந்த 30 நாட்களில் செய்திகள் எதுவும் கிடைக்கவில்லை.",
    subAll: "🌐 அனைத்து செய்திகள்",
    subDomestic: "🇮🇳 உள்நாட்டு சந்தை",
    subIB: "🚢 சர்வதேச வணிகம் (IB) & ஏற்றுமதி",
    subReg: "📜 ஒழுங்குமுறை & உணவு பாதுகாப்பு",
  },
  te: {
    headerTitle: "FMCG న్యూస్ డెస్క్",
    headerSubtitle: "మల్టీ-కేటగిరీ ఎగ్జిక్యూటివ్ బులెటిన్లు మరియు ప్రాంతీయ ట్రెండ్లు",
    aiTitle: "✨ AI మార్కెట్ ఇన్సైట్స్",
    aiSubtitle: "యాక్టివ్ మార్కెట్ ఇంటెలిజెన్స్ నివేదిక",
    outlook: "మార్కెట్ దృక్పథం: బుల్లిష్",
    execSummaryLabel: "ఎగ్జిక్యూటివ్ సారాంశం:",
    bulletinsTitle: "📰 ఎగ్జిక్యూటివ్ మార్కెట్ బులెటిన్లు",
    readDetail: "పూర్తి వివరాలు చదవండి",
    share: "షేర్ చేయండి",
    source: "మూలం",
    published: "ప్రచురించబడింది",
    keyTakeaway: "💡 ప్రధాన వ్యూహాత్మక అంశం:",
    readFullArticle: "🔗 మూల ప్రచురణకర్త వద్ద పూర్తి వ్యాసం చదవండి",
    noLink: "లింక్ లభ్యం కాలేదు",
    mapTab: "🗺️ ఇండియా మ్యాప్",
    intelTab: "📊 మార్కెట్ ఇంటెలిజెన్స్",
    updatesFound: "అప్‌డేట్‌లు లభించాయి",
    noNews: "గత 30 రోజుల్లో ఎటువంటి అప్‌డేట్‌లు లభించలేదు.",
    subAll: "🌐 అన్ని బులెటిన్లు",
    subDomestic: "🇮🇳 దేశీయ మార్కెట్",
    subIB: "🚢 అంతర్జాతీయ వ్యాపారం (IB) & ఎగుమతులు",
    subReg: "📜 నియంత్రణ & ఆహార భద్రత",
  },
  kn: {
    headerTitle: "FMCG ನ್ಯೂಸ್ ಡೆಸ್ಕ್",
    headerSubtitle: "ಮಲ್ಟಿ-ಕ್ಯಾಟಗರಿ ಎಕ್ಸಿಕ್ಯುಟಿವ್ ಬುಲೆಟಿನ್‌ಗಳು ಮತ್ತು ಪ್ರಾದೇಶಿಕ ಟ್ರೆಂಡ್‌ಗಳು",
    aiTitle: "✨ AI ಮಾರುಕಟ್ಟೆ ಒಳನೋಟಗಳು",
    aiSubtitle: "ಸಕ್ರಿಯ ಮಾರುಕಟ್ಟೆ ಬುದ್ಧಿವಂತಿಕೆಯ ಸಂಶ್ಲೇಷಣೆ",
    outlook: "ಮಾರುಕಟ್ಟೆ ದೃಷ್ಟಿಕೋನ: ಆಶಾದಾಯಕ",
    execSummaryLabel: "ಕಾರ್ಯನಿರ್ವಾಹಕ ಸಾರಾಂಶ:",
    bulletinsTitle: "📰 ಕಾರ್ಯನಿರ್ವಾಹಕ ಮಾರುಕಟ್ಟೆ ಬುಲೆಟಿನ್‌ಗಳು",
    readDetail: "ವಿವರವಾಗಿ ಓದಿ",
    share: "ಹಂಚಿಕೊಳ್ಳಿ",
    source: "ಮೂಲ",
    published: "ಪ್ರಕಟಿಸಲಾಗಿದೆ",
    keyTakeaway: "💡 ಕಾರ್ಯತಂತ್ರದ ಪ್ರಮುಖ ಅಂಶ:",
    readFullArticle: "🔗 ಮೂಲ ಪ್ರಕಾಶಕರಲ್ಲಿ ಸಂಪೂರ್ಣ ಲೇಖನ ಓದಿ",
    noLink: "ಲಿಂಕ್ ಲಭ್ಯವಿಲ್ಲ",
    mapTab: "🗺️ ಭಾರತದ ನಕ್ಷೆ",
    intelTab: "📊 ಮಾರುಕಟ್ಟೆ ಬುದ್ಧಿವಂತಿಕೆ",
    updatesFound: "ಅಪ್‌ಡೇಟ್‌ಗಳು ಸಿಕ್ಕಿವೆ",
    noNews: "ಕಳೆದ 30 ದಿನಗಳಲ್ಲಿ ಯಾವುದೇ ಸುದ್ದಿಗಳು ಕಂಡುಬಂದಿಲ್ಲ.",
    subAll: "🌐 ಎಲ್ಲಾ ಬುಲೆಟಿನ್‌ಗಳು",
    subDomestic: "🇮🇳 ದೇಶೀಯ ಮಾರುಕಟ್ಟೆ",
    subIB: "🚢 ಅಂತಾರಾಷ್ಟ್ರೀಯ ವ್ಯವಹಾರ (IB) & ರಫ್ತು",
    subReg: "📜 ನಿಯಂತ್ರಣ & ಆಹಾರ ಸುರಕ್ಷತೆ",
  },
  ml: {
    headerTitle: "FMCG ന്യൂസ് ഡെസ്ക്",
    headerSubtitle: "എക്സിക്യൂട്ടീവ് ബുളറ്റിനുകളും റീജിയണൽ മാർക്കറ്റ് വിവരങ്ങളും",
    aiTitle: "✨ AI മാർക്കറ്റ് ഇൻസൈറ്റുകൾ",
    aiSubtitle: "മാർക്കറ്റ് ഇന്റലിജൻസ് വിശകലനം",
    outlook: "മാർക്കറ്റ് ഔട്ട്‌ലുക്ക്: ശുഭപ്രതീക്ഷ",
    execSummaryLabel: "എക്സിക്യൂട്ടീവ് സമ്മറി:",
    bulletinsTitle: "📰 മാർക്കറ്റ് ബുളറ്റിനുകൾ",
    readDetail: "വിശദമായി വായിക്കുക",
    share: "പങ്കുവെക്കുക",
    source: "ഉറവിടം",
    published: "പ്രസിദ്ധീകരിച്ചത്",
    keyTakeaway: "💡 പ്രധാന തന്ത്രം:",
    readFullArticle: "🔗 പ്രധാന വെബ്‌സൈറ്റിൽ പൂർണ്ണ ലേഖനം വായിക്കുക",
    noLink: "ലിങ്ക് ലഭ്യമല്ല",
    mapTab: "🗺️ ഇന്ത്യ മാപ്പ്",
    intelTab: "📊 മാർക്കറ്റ് ഇന്റലിജൻസ്",
    updatesFound: "അപ്‌ഡേറ്റുകൾ ലഭ്യമാണ്",
    noNews: "കഴിഞ്ഞ 30 ദിവസത്തിനുള്ളിൽ വാർത്തകളൊന്നും ലഭ്യമായിട്ടില്ല.",
    subAll: "🌐 എല്ലാ വാർത്തകളും",
    subDomestic: "🇮🇳 പ്രാദേശിക വിപണി",
    subIB: "🚢 അന്താരാഷ്ട്ര ബിസിനസ്സ് (IB) & കയറ്റുമതി",
    subReg: "📜 റഗുലേറ്ററി & ഫുഡ് സേഫ്റ്റി",
  },
  bn: {
    headerTitle: "FMCG নিউজ ডেস্ক",
    headerSubtitle: "মাল্টি-ক্যাটাগরি এক্সিকিউটিভ বুলেটিন এবং আঞ্চলিক বাজারের ট্রেন্ড",
    aiTitle: "✨ AI মার্কেট ইনসাইটস",
    aiSubtitle: "সক্রিয় বাজার ইন্টেলিজেন্সের সংশ্লেষণ",
    outlook: "বাজার আউটলুক: চাঙ্গা",
    execSummaryLabel: "নির্বাহী সারাংশ:",
    bulletinsTitle: "📰 এক্সিকিউটিভ মার্কেট বুলেটিন",
    readDetail: "বিস্তারিত পড়ুন",
    share: "শেয়ার করুন",
    source: "উৎস",
    published: "প্রকাশিত",
    keyTakeaway: "💡 কৌশলগত সিদ্ধান্ত:",
    readFullArticle: "🔗 মূল প্রকাশকের সাইটে পুরো নিবন্ধটি পড়ুন",
    noLink: "লিঙ্ক পাওয়া যায়নি",
    mapTab: "🗺️ ভারত মানচিত্র",
    intelTab: "📊 মার্কেট ইন্টেলিজেন্স",
    updatesFound: "আপডেট পাওয়া গেছে",
    noNews: "গত ৩০ দিনে কোনো আপডেট পাওয়া যায়নি।",
    subAll: "🌐 সমস্ত বুলেটিন",
    subDomestic: "🇮🇳 অভ্যন্তরীণ বাজার",
    subIB: "🚢 আন্তর্জাতিক ব্যবসা (IB) এবং রফতানি",
    subReg: "📜 রেগুলেটরি এবং খাদ্য সুরক্ষা",
  },
  pa: {
    headerTitle: "FMCG ਨਿਊਜ਼ ਡੈਸਕ",
    headerSubtitle: "ਮਲਟੀ-ਕੈਟੇਗਰੀ ਐਗਜ਼ੀਕਿਊਟਿਵ ਬੁਲੇਟਿਨ ਅਤੇ ਖੇਤਰੀ ਰੁਝਾਨ",
    aiTitle: "✨ AI ਮਾਰਕੀਟ ਇਨਸਾਈਟਸ",
    aiSubtitle: "ਮਾਰਕੀਟ ਇੰਟੈਲੀਜੈਂਸ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ",
    outlook: "ਮਾਰਕੀਟ ਆਊਟਲੁੱਕ: ਤੇਜ਼ੀ",
    execSummaryLabel: "ਐਗਜ਼ੀਕਿਊਟਿਵ ਸੰਖੇਪ:",
    bulletinsTitle: "📰 ਮਾਰਕੀਟ ਬੁਲੇਟਿਨ",
    readDetail: "ਵਿਸਤਾਰ ਵਿੱਚ ਪੜ੍ਹੋ",
    share: "ਸ਼ੇਅਰ ਕਰੋ",
    source: "ਸਰੋਤ",
    published: "ਪ੍ਰਕਾਸ਼ਿਤ",
    keyTakeaway: "💡 ਮੁੱਖ ਰਣਨੀਤਕ ਨੁਕਤਾ:",
    readFullArticle: "🔗 ਅਸਲ ਪ੍ਰਕਾਸ਼ਕ 'ਤੇ ਪੂਰਾ ਲੇਖ ਪੜ੍ਹੋ",
    noLink: "ਲਿੰਕ ਉਪਲਬਧ ਨਹੀਂ ਹੈ",
    mapTab: "🗺️ ਭਾਰਤ ਦਾ ਨਕਸ਼ਾ",
    intelTab: "📊 ਮਾਰਕੀਟ ਇੰਟੈਲੀਜੈਂਸ",
    updatesFound: "ਅੱਪਡੇਟ ਮਿਲੇ",
    noNews: "ਪਿਛਲੇ 30 ਦਿਨਾਂ ਵਿੱਚ ਕੋਈ ਅੱਪਡੇਟ ਨਹੀਂ ਮਿਲਿਆ।",
    subAll: "🌐 ਸਾਰੇ ਬੁਲੇਟਿਨ",
    subDomestic: "🇮🇳 ਘਰੇਲੂ ਬਾਜ਼ਾਰ",
    subIB: "🚢 ਅੰਤਰਰਾਸ਼ਟਰੀ ਵਪਾਰ (IB) ਅਤੇ ਬਰਾਮਦ",
    subReg: "📜 ਰੈਗੂਲੇਟਰੀ ਅਤੇ ਭੋਜਨ ਸੁਰੱਖਿਆ",
  },
};

export default function Home() {
  const [activeViewTab, setActiveViewTab] = useState<"intelligence" | "map">("intelligence");
  const [selectedRegion, setSelectedRegion] = useState<string>("All");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [selectedCategory, setSelectedCategory] = useState<string>("Spices & Pickles");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("All");

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      try {
        const newsRef = collection(db, "news_articles");
        const q = query(newsRef, limit(50));
        const snapshot = await getDocs(q);

        let docs: Article[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Article, "id">),
        }));

        // Date Filter (30 Days Limit)
        const now = new Date();
        const maxAgeDays = 30;

        docs = docs.filter((item) => {
          const rawDate = item.published_at || item.date;
          if (!rawDate) return true;
          const pubDate = new Date(rawDate);
          if (isNaN(pubDate.getTime())) return true;
          const diffDays = (now.getTime() - pubDate.getTime()) / (1000 * 3600 * 24);
          return diffDays <= maxAgeDays || diffDays < 0;
        });

        // Filter by Sub-Category (e.g. IB - International Business)
        if (selectedSubCategory !== "All") {
          docs = docs.filter((item) => {
            if (selectedSubCategory === "IB") {
              return (
                item.sub_category === "IB - International Business" ||
                item.market_scope === "Export"
              );
            }
            if (selectedSubCategory === "Domestic") {
              return item.sub_category === "Domestic Market" || item.market_scope === "Domestic";
            }
            if (selectedSubCategory === "Regulatory") {
              return item.regulatory_update === true || item.sub_category === "Regulatory & Compliance";
            }
            return true;
          });
        }

        // Filter by Region
        if (selectedRegion !== "All") {
          docs = docs.filter(
            (item) => item.region?.toLowerCase() === selectedRegion.toLowerCase()
          );
        }

        setArticles(docs);
      } catch (error) {
        console.error("Error fetching articles:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [selectedCategory, selectedSubCategory, selectedRegion]);

  // Executive AI Summary Synthesis
  const dynamicExecutiveSummary = useMemo(() => {
    if (articles.length === 0) {
      return t.noNews;
    }
    const keySummaries = articles.slice(0, 3).map((a) => a.summary).join(" ");
    return `Synthesis of ${articles.length} active updates: ${keySummaries}`;
  }, [articles, t]);

  const handleWhatsAppShare = (title: string, link?: string) => {
    const text = encodeURIComponent(`*FMCG News Desk Bulletin:* ${title}\nRead full story: ${link || "https://fmcgdesk.web.app"}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-6 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-xl shadow-lg shadow-emerald-950/50">
              🌐
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              {t.headerTitle.split(" ")[0]} <span className="text-emerald-400">{t.headerTitle.split(" ").slice(1).join(" ")}</span>
            </h1>
          </div>
          <p className="text-slate-400 text-xs mt-1.5 font-mono tracking-wide">
            {t.headerSubtitle}
          </p>
        </div>

        {/* Global Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Multi-Language Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl shadow-lg">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">🌐</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-slate-950 text-emerald-400 font-bold text-xs border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="gu">ગુજરાતી (Gujarati)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="ml">മലയാളം (Malayalam)</option>
              <option value="bn">বাংলা (Bengali)</option>
              <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
            </select>
          </div>

          {/* Region Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl shadow-lg">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">Region:</span>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-slate-950 text-emerald-400 font-bold text-xs border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="All">IN All Regions (Pan-India)</option>
              <option value="West">West (Pune, Gandhinagar, Mumbai)</option>
              <option value="North">North (Srinagar, Jaipur, Delhi)</option>
              <option value="South">South (Bengaluru, Kochi, Chennai)</option>
              <option value="East">East (Kolkata, Patna)</option>
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Primary Category Switcher & View Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-800/80 pb-4 gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("Spices & Pickles")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                selectedCategory === "Spices & Pickles"
                  ? "bg-emerald-950 border border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-950/50"
                  : "bg-slate-900 text-slate-400 border border-slate-800"
              }`}
            >
              🌶️ Spices & Pickles <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">Live</span>
            </button>
          </div>

          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 self-start lg:self-auto">
            <button
              onClick={() => setActiveViewTab("intelligence")}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeViewTab === "intelligence"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.intelTab}
            </button>
            <button
              onClick={() => setActiveViewTab("map")}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeViewTab === "map"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.mapTab}
            </button>
          </div>
        </div>

        {/* Sub-Category Filtering Bar (Domestic vs IB Exports vs Regulatory) */}
        {activeViewTab === "intelligence" && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedSubCategory("All")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition border shrink-0 ${
                selectedSubCategory === "All"
                  ? "bg-slate-800 border-slate-600 text-white"
                  : "bg-slate-950/50 border-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.subAll}
            </button>
            <button
              onClick={() => setSelectedSubCategory("Domestic")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition border shrink-0 ${
                selectedSubCategory === "Domestic"
                  ? "bg-emerald-950 border-emerald-600 text-emerald-300"
                  : "bg-slate-950/50 border-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.subDomestic}
            </button>
            <button
              onClick={() => setSelectedSubCategory("IB")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition border shrink-0 ${
                selectedSubCategory === "IB"
                  ? "bg-blue-950 border-blue-500 text-blue-300 shadow-lg shadow-blue-950/50"
                  : "bg-slate-950/50 border-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.subIB}
            </button>
            <button
              onClick={() => setSelectedSubCategory("Regulatory")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition border shrink-0 ${
                selectedSubCategory === "Regulatory"
                  ? "bg-amber-950 border-amber-500 text-amber-300"
                  : "bg-slate-950/50 border-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.subReg}
            </button>
          </div>
        )}

        {/* TAB 1: EXECUTIVE MARKET INTELLIGENCE VIEW */}
        {activeViewTab === "intelligence" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Dynamic AI Executive Summary Hero Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-4 mb-4 gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                    {t.aiTitle}
                  </h2>
                  <span className="text-slate-500 text-xs">| {t.aiSubtitle}</span>
                </div>
                <span className="text-xs font-semibold bg-emerald-950 border border-emerald-700/50 text-emerald-300 px-3 py-1 rounded-full">
                  {t.outlook}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-2">
                <p className="text-xs md:text-sm text-slate-200 leading-relaxed">
                  <strong className="text-emerald-400 font-semibold">{t.execSummaryLabel}</strong>{" "}
                  {dynamicExecutiveSummary}
                </p>
              </div>
            </div>

            {/* Bulletins Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {t.bulletinsTitle}
              </h3>
              <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
                {articles.length} {t.updatesFound}
              </span>
            </div>

            {/* News Cards */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-52 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 transition-all hover:translate-y-[-2px] flex flex-col justify-between shadow-xl"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-slate-950 text-emerald-400 border border-emerald-800/60 px-2.5 py-0.5 rounded-md font-semibold font-mono">
                            📍 {article.region || "Pan-India"}
                          </span>
                          {article.market_scope === "Export" && (
                            <span className="bg-blue-950 text-blue-300 border border-blue-800/60 px-2 py-0.5 rounded-md font-semibold font-mono text-[10px]">
                              🚢 Export / IB
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 font-mono text-[11px]">
                          📅 {article.published_at || article.date || "Recent"}
                        </span>
                      </div>

                      <h4
                        onClick={() => setSelectedArticle(article)}
                        className="text-base font-bold text-white leading-snug hover:text-emerald-400 transition cursor-pointer"
                      >
                        {article.title}
                      </h4>

                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                        {article.summary}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 gap-2">
                      <button
                        onClick={() => setSelectedArticle(article)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>{t.readDetail}</span>
                        <span>→</span>
                      </button>

                      <button
                        onClick={() => handleWhatsAppShare(article.title, article.source_url)}
                        className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <span>💬</span>
                        <span>{t.share}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GEOSPATIAL MAP VIEW */}
        {activeViewTab === "map" && (
          <div className="space-y-4 animate-fadeIn">
            <IndiaMap onSelectLocation={(loc) => setSelectedLocation(loc)} />
          </div>
        )}
      </div>

      {/* DETAIL BULLETIN MODAL */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full space-y-5 relative shadow-2xl animate-scaleUp">
            <button
              onClick={() => setSelectedArticle(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer"
            >
              ✕
            </button>

            <div className="border-b border-slate-800 pb-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-800/50 font-semibold">
                  {selectedArticle.region || "Pan-India"} Region • Bulletin Detail
                </span>
                {selectedArticle.sub_category && (
                  <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md font-semibold">
                    {selectedArticle.sub_category}
                  </span>
                )}
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white leading-snug">
                {selectedArticle.title}
              </h3>
              
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1 font-mono">
                <span>📅 {t.published}: <strong className="text-slate-200">{selectedArticle.published_at || selectedArticle.date || 'Recent'}</strong></span>
                <span>📰 {t.source}: <strong className="text-emerald-400">{selectedArticle.source_name || 'FMCG Intelligence Desk'}</strong></span>
              </div>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-200 leading-relaxed space-y-3">
                <p>{selectedArticle.full_content || selectedArticle.summary}</p>
              </div>

              {selectedArticle.key_takeaway && (
                <div className="bg-emerald-950/40 border border-emerald-800/60 p-4 rounded-xl text-xs text-emerald-300 font-medium space-y-1">
                  <strong className="text-emerald-400 uppercase tracking-wider block font-mono flex items-center gap-1">
                    {t.keyTakeaway}
                  </strong>
                  <p className="text-slate-200 leading-relaxed">{selectedArticle.key_takeaway}</p>
                </div>
              )}
            </div>

            {/* Direct Source Link */}
            <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
              {selectedArticle.source_url ? (
                <a
                  href={selectedArticle.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium flex items-center gap-1"
                >
                  {t.readFullArticle} ↗
                </a>
              ) : (
                <span className="text-xs text-slate-500 font-mono">{t.noLink}</span>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => handleWhatsAppShare(selectedArticle.title, selectedArticle.source_url)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>💬 {t.share}</span>
                </button>

                <button
                  onClick={() => setSelectedArticle(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
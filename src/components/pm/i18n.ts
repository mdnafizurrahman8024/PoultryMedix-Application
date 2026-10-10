import { BASE } from "./base-i18n";
import { V12 } from "./i18n2";

const EXTRA = {
  en: {
    location: "Rajshahi, Bangladesh", gpsDetected: "GPS detected",
    uv: "UV Index", heatStress: "Heat Stress", heatHigh: "High — add ventilation & cool water", heatOk: "Normal — flock comfortable",
    // auth
    phoneEmail: "Phone or Email", password: "Password", remember: "Remember me", country: "Select Country / Location",
    countries: ["Bangladesh — Rajshahi", "Bangladesh — Dhaka", "Bangladesh — Khulna", "India — West Bengal", "Other"],
    signIn: "Sign In", or: "or",
    // header / profile
    points: "pts", profile: "Profile Settings", displayName: "Display name", uploadPhoto: "Upload profile picture",
    save: "Save changes", saved: "Saved!", back: "Back",
    // noticeboard
    notice: "Govt Noticeboard", noticeSub: "Auto-updated from DLS & Upazila offices",
    notices: [
      { tag: "AMR Alert", text: "Colistin use in poultry banned — report suppliers to Upazila office.", time: "2h ago", c: "bg-destructive" },
      { tag: "Outbreak", text: "Newcastle cases rising in Paba & Godagari. Vaccinate flocks this week.", time: "5h ago", c: "bg-warning" },
      { tag: "Vaccination", text: "Free ND/IB vaccine camp at Rajshahi DLS, Thursday 10 AM.", time: "1d ago", c: "bg-success" },
    ],
    // grid
    aiScanner: "AI Scanner", aiScannerSub: "Image · Audio · Chatbot",
    scanImage: "Scan Image", recordAudio: "Record Audio", askBot: "Ask AI Chatbot",
    drugInfo: "Drug Withdrawal Info", drugInfoSub: "Local & WHO/OIE guidelines",
    contribute: "🧠 Contribute Data", contributeSub: "Earn research points",
    feedback: "💬 Feedback", feedbackSub: "Ideas & solutions",
    // drug
    drugName: "Enrofloxacin 10% oral solution", drugClass: "Fluoroquinolone · Critically important",
    withdrawal: "Withdrawal Period", local: "Local Guidelines (BD DLS)", intl: "International Guidelines (WHO/OIE)",
    meat: "Meat", eggs: "Eggs", days: "days", notEggs: "Not for laying hens",
    drugNote: "Your location is Bangladesh, so local DLS rules are shown first.",
    // chat
    chatTitle: "AI Diagnosis Chat", chatHello: "Hi! Send a photo, a sound recording, or describe the symptoms of your birds.",
    chatPh: "Describe symptoms…", localModel: "Checking local model…", cloud: "Not recognised locally — Analyzing via Cloud AI…",
    srcDb: "Source: Validated Database", srcWeb: "Source: Web Search", srcCloud: "Source: Cloud AI",
    imgSent: "📷 Image uploaded", audioSent: "🎤 Audio recorded",
    botImg: "Likely Coccidiosis (78%). Bloody droppings pattern detected. Give Amprolium in water for 5 days and keep litter dry. Consult a vet to confirm.",
    botAudio: "Snicking sounds suggest Infectious Bronchitis or Mycoplasma. Improve ventilation and isolate affected birds.",
    botText: "Based on your description, this may be Newcastle Disease. Isolate sick birds and call your Upazila Livestock Office immediately.",
    // data hub
    hub: "Data Hub", hubSub: "Your data powers national AMR research",
    upImg: "Disease Image", upAc: "Bird Acoustic", upGps: "GPS Location", upVoice: "Voice Note",
    topic: "Topic", topics: ["Disease outbreak", "Antibiotic use", "Mortality report", "Feed & water"],
    severity: "AMR Severity", synced: "Synced", offline: "Offline — will sync", submit: "Submit (+20 pts)", thanks: "Thank you! +20 research points",
    added: "Added",
    // feedback
    fbTitle: "Feedback & Solutions", category: "Category", categories: ["App bug", "New feature idea", "Disease info", "Other"],
    message: "Your message", send: "Send feedback", resolved: "Resolved Community Ideas",
    ideas: [
      { t: "Add Bangla voice input", by: "Rahim, Bogura" },
      { t: "Show vaccine schedule reminders", by: "Salma, Natore" },
      { t: "Offline mode for remote farms", by: "Karim, Naogaon" },
    ],
    resolvedTag: "Resolved",
    exportPdf: "Export PDF Report",
    contribN: "Contribute",
    coName: "Md Sojib Hossain", coRole: "Co-Member & Supporter",
    coAcad: "Doctor of Veterinary Medicine Student, Intern Doctor, University of Rajshahi, Bangladesh.",
    coBadge: "Co-Member", photoSoon: "Photo coming soon",
  },
  bn: {
    location: "রাজশাহী, বাংলাদেশ", gpsDetected: "জিপিএস শনাক্ত",
    uv: "ইউভি সূচক", heatStress: "তাপ চাপ", heatHigh: "উচ্চ — বাতাস চলাচল ও ঠান্ডা পানি দিন", heatOk: "স্বাভাবিক — মুরগি আরামে আছে",
    phoneEmail: "ফোন বা ইমেইল", password: "পাসওয়ার্ড", remember: "আমাকে মনে রাখুন", country: "দেশ / এলাকা নির্বাচন করুন",
    countries: ["বাংলাদেশ — রাজশাহী", "বাংলাদেশ — ঢাকা", "বাংলাদেশ — খুলনা", "ভারত — পশ্চিমবঙ্গ", "অন্যান্য"],
    signIn: "সাইন ইন", or: "অথবা",
    points: "পয়েন্ট", profile: "প্রোফাইল সেটিংস", displayName: "প্রদর্শিত নাম", uploadPhoto: "প্রোফাইল ছবি আপলোড",
    save: "পরিবর্তন সংরক্ষণ", saved: "সংরক্ষিত!", back: "ফিরে যান",
    notice: "সরকারী নোটিশবোর্ড", noticeSub: "প্রাণিসম্পদ অধিদপ্তর ও উপজেলা অফিস থেকে স্বয়ংক্রিয় হালনাগাদ",
    notices: [
      { tag: "AMR সতর্কতা", text: "পোল্ট্রিতে কলিস্টিন নিষিদ্ধ — সরবরাহকারীদের তথ্য উপজেলা অফিসে জানান।", time: "২ ঘণ্টা আগে", c: "bg-destructive" },
      { tag: "প্রাদুর্ভাব", text: "পবা ও গোদাগাড়ীতে রাণীক্ষেত বাড়ছে। এই সপ্তাহেই টিকা দিন।", time: "৫ ঘণ্টা আগে", c: "bg-warning" },
      { tag: "টিকাদান", text: "রাজশাহী প্রাণিসম্পদ অফিসে বৃহস্পতিবার সকাল ১০টায় বিনামূল্যে ND/IB টিকা ক্যাম্প।", time: "১ দিন আগে", c: "bg-success" },
    ],
    aiScanner: "এআই স্ক্যানার", aiScannerSub: "ছবি · শব্দ · চ্যাটবট",
    scanImage: "ছবি স্ক্যান", recordAudio: "শব্দ রেকর্ড", askBot: "এআই চ্যাটবটকে জিজ্ঞাসা",
    drugInfo: "ওষুধ প্রত্যাহার তথ্য", drugInfoSub: "স্থানীয় ও WHO/OIE নির্দেশিকা",
    contribute: "🧠 গবেষণায় অবদান", contributeSub: "গবেষণা পয়েন্ট অর্জন করুন",
    feedback: "💬 পরামর্শ ও সমাধান", feedbackSub: "ধারণা ও সমাধান",
    drugName: "এনরোফ্লক্সাসিন ১০% খাবার দ্রবণ", drugClass: "ফ্লুরোকুইনোলোন · অত্যন্ত গুরুত্বপূর্ণ",
    withdrawal: "প্রত্যাহার সময়", local: "স্থানীয় নির্দেশিকা (বাংলাদেশ প্রাণিসম্পদ অধিদপ্তর)", intl: "আন্তর্জাতিক নির্দেশিকা (WHO/OIE)",
    meat: "মাংস", eggs: "ডিম", days: "দিন", notEggs: "ডিম পাড়া মুরগিতে ব্যবহার নিষেধ",
    drugNote: "আপনার অবস্থান বাংলাদেশ, তাই স্থানীয় নিয়ম আগে দেখানো হচ্ছে।",
    chatTitle: "এআই রোগ নির্ণয় চ্যাট", chatHello: "আসসালামু আলাইকুম! মুরগির ছবি, শব্দ রেকর্ড পাঠান অথবা লক্ষণ লিখুন।",
    chatPh: "লক্ষণ লিখুন…", localModel: "স্থানীয় মডেল যাচাই হচ্ছে…", cloud: "স্থানীয়ভাবে শনাক্ত হয়নি — ক্লাউড এআই দিয়ে বিশ্লেষণ হচ্ছে…",
    srcDb: "উৎস: যাচাইকৃত ডেটাবেস", srcWeb: "উৎস: ওয়েব অনুসন্ধান", srcCloud: "উৎস: ক্লাউড এআই",
    imgSent: "📷 ছবি আপলোড হয়েছে", audioSent: "🎤 শব্দ রেকর্ড হয়েছে",
    botImg: "সম্ভবত রক্ত আমাশয় (ককসিডিওসিস) (৭৮%)। রক্তমিশ্রিত মল শনাক্ত হয়েছে। ৫ দিন পানিতে অ্যামপ্রোলিয়াম দিন ও লিটার শুকনো রাখুন। নিশ্চিত হতে ভেটের পরামর্শ নিন।",
    botAudio: "হাঁচির শব্দ সংক্রামক ব্রঙ্কাইটিস বা মাইকোপ্লাজমা নির্দেশ করে। বাতাস চলাচল বাড়ান ও আক্রান্ত মুরগি আলাদা রাখুন।",
    botText: "আপনার বর্ণনা অনুযায়ী এটি রাণীক্ষেত রোগ হতে পারে। অসুস্থ মুরগি আলাদা করুন এবং এখনই উপজেলা প্রাণিসম্পদ অফিসে কল করুন।",
    hub: "ডেটা হাব", hubSub: "আপনার তথ্য জাতীয় AMR গবেষণাকে এগিয়ে নেয়",
    upImg: "রোগের ছবি", upAc: "মুরগির শব্দ", upGps: "জিপিএস অবস্থান", upVoice: "ভয়েস নোট",
    topic: "বিষয়", topics: ["রোগের প্রাদুর্ভাব", "অ্যান্টিবায়োটিক ব্যবহার", "মৃত্যুর তথ্য", "খাদ্য ও পানি"],
    severity: "AMR তীব্রতা", synced: "সিঙ্ক হয়েছে", offline: "অফলাইন — পরে সিঙ্ক হবে", submit: "জমা দিন (+২০ পয়েন্ট)", thanks: "ধন্যবাদ! +২০ গবেষণা পয়েন্ট",
    added: "যুক্ত",
    fbTitle: "পরামর্শ ও সমাধান", category: "বিভাগ", categories: ["অ্যাপের সমস্যা", "নতুন ফিচারের ধারণা", "রোগ সংক্রান্ত তথ্য", "অন্যান্য"],
    message: "আপনার বার্তা", send: "পরামর্শ পাঠান", resolved: "সমাধানকৃত কমিউনিটি ধারণা",
    ideas: [
      { t: "বাংলা ভয়েস ইনপুট যোগ করা", by: "রহিম, বগুড়া" },
      { t: "টিকার সময়সূচি রিমাইন্ডার", by: "সালমা, নাটোর" },
      { t: "প্রত্যন্ত খামারের জন্য অফলাইন মোড", by: "করিম, নওগাঁ" },
    ],
    resolvedTag: "সমাধানকৃত",
    exportPdf: "পিডিএফ রিপোর্ট এক্সপোর্ট",
    contribN: "অবদান",
    coName: "মো. সজীব হোসেন", coRole: "সহ-সদস্য ও সহায়তাকারী",
    coAcad: "ডক্টর অব ভেটেরিনারি মেডিসিন শিক্ষার্থী, ইন্টার্ন চিকিৎসক, রাজশাহী বিশ্ববিদ্যালয়, বাংলাদেশ।",
    coBadge: "সহ-সদস্য", photoSoon: "ছবি শীঘ্রই আসছে",
  },
};

export const T = {
  en: { ...BASE.en, ...EXTRA.en, ...V12.en },
  bn: { ...BASE.bn, ...EXTRA.bn, ...V12.bn, histN: "ক্লিনিক্যাল লগ" },
};
export type TT = typeof T.en;
export type Lang = "en" | "bn";

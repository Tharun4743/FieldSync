// ============================================================
// FieldSync Bundled Offline Language Dictionaries
// Zero external API calls. Bundled directly in PWA shell.
// Supported: English (en), Tamil (ta), Hindi (hi), Telugu (te), Kannada (kn), Malayalam (ml)
// ============================================================

export const TRANSLATION_RESOURCE_VERSION = 1;

export type SupportedLanguage = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
];

export interface TranslationDictionary {
  // Navigation
  dashboard: string;
  inspections: string;
  conflicts: string;
  sync: string;
  history: string;
  profile: string;
  admin: string;

  // Actions
  save: string;
  cancel: string;
  next: string;
  previous: string;
  record: string;
  takePhoto: string;
  addNote: string;
  resume: string;
  resumeInspection: string;
  search: string;
  searchPlaceholder: string;
  syncNow: string;
  readAloud: string;
  saveAndNext: string;
  prepareOffline: string;
  quickMode: string;
  standardMode: string;

  // Statuses
  online: string;
  offline: string;
  syncing: string;
  pending: string;
  failed: string;
  completed: string;
  conflict: string;
  resolved: string;
  savedOffline: string;
  uploadPending: string;
  uploaded: string;

  // Inspection terminology
  inspection: string;
  checklist: string;
  measurement: string;
  note: string;
  photo: string;
  voiceNote: string;
  issue: string;
  remaining: string;
  progress: string;
  good: string;
  damaged: string;
  pass: string;
  fail: string;
  na: string;
  yes: string;
  no: string;

  // Warnings & Alerts
  offlineAlert: string;
  syncFailed: string;
  photoPending: string;
  conflictDetected: string;
  requiredField: string;
  invalidMeasurement: string;
  audioNotSupported: string;
  ttsNotAvailable: string;
}

export const translations: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    dashboard: 'Dashboard',
    inspections: 'Inspections',
    conflicts: 'Conflicts',
    sync: 'Sync Center',
    history: 'History',
    profile: 'Profile',
    admin: 'Admin',

    save: 'Save',
    cancel: 'Cancel',
    next: 'Next',
    previous: 'Previous',
    record: 'Record Voice Note',
    takePhoto: 'Take Photo',
    addNote: 'Add Note',
    resume: 'Resume',
    resumeInspection: 'Resume Inspection',
    search: 'Search',
    searchPlaceholder: 'Search assets, inspections, codes...',
    syncNow: 'Sync Now',
    readAloud: 'Read',
    saveAndNext: 'SAVE & NEXT →',
    prepareOffline: 'Prepare Offline Work',
    quickMode: 'Quick Mode',
    standardMode: 'Standard Mode',

    online: 'Online',
    offline: 'Offline',
    syncing: 'Syncing',
    pending: 'Pending',
    failed: 'Failed',
    completed: 'Completed',
    conflict: 'Conflict',
    resolved: 'Resolved',
    savedOffline: 'Saved offline',
    uploadPending: 'Upload pending',
    uploaded: 'Uploaded',

    inspection: 'Inspection',
    checklist: 'Checklist',
    measurement: 'Measurement',
    note: 'Note',
    photo: 'Photo',
    voiceNote: 'Voice Note',
    issue: 'Issue',
    remaining: 'Remaining',
    progress: 'Progress',
    good: 'GOOD',
    damaged: 'DAMAGED',
    pass: 'PASS',
    fail: 'FAIL',
    na: 'N/A',
    yes: 'YES',
    no: 'NO',

    offlineAlert: 'Your work is saved locally.',
    syncFailed: 'Sync failed',
    photoPending: 'Photo pending',
    conflictDetected: 'Conflict detected',
    requiredField: 'Required field',
    invalidMeasurement: 'Invalid measurement',
    audioNotSupported: 'Audio recording is not supported on this device.',
    ttsNotAvailable: 'Read Aloud is not available for this language on this device.',
  },

  ta: {
    dashboard: 'முகப்பு பலகை',
    inspections: 'ஆய்வுகள்',
    conflicts: 'முரண்பாடுகள்',
    sync: 'ஒத்திசைவு மையம்',
    history: 'வரலாறு',
    profile: 'சுயவிவரம்',
    admin: 'நிர்வாகி',

    save: 'சேமி',
    cancel: 'ரத்து செய்',
    next: 'அடுத்து',
    previous: 'முந்தையது',
    record: 'குரல் பதிவு செய்',
    takePhoto: 'படம் எடு',
    addNote: 'குறிப்பு சேர்',
    resume: 'தொடரவும்',
    resumeInspection: 'ஆய்வை மீண்டும் தொடரவும்',
    search: 'தேடு',
    searchPlaceholder: 'சொத்துக்கள், ஆய்வுகள், குறியீடுகளைத் தேடுங்கள்...',
    syncNow: 'இப்போதே ஒத்திசை',
    readAloud: 'வாசி',
    saveAndNext: 'சேமித்து அடுத்து →',
    prepareOffline: 'ஆஃப்லைன் தொகுப்பைத் தயார் செய்',
    quickMode: 'விரைவு முறை',
    standardMode: 'வழக்கமான முறை',

    online: 'இணையத்தில்',
    offline: 'ஆஃப்லைன்',
    syncing: 'ஒத்திசைக்கிறது',
    pending: 'நிலுவையில்',
    failed: 'தோல்வி',
    completed: 'முடிந்தது',
    conflict: 'முரண்பாடு',
    resolved: 'தீர்க்கப்பட்டது',
    savedOffline: 'ஆஃப்லைனில் சேமிக்கப்பட்டது',
    uploadPending: 'பதிவேற்றம் நிலுவை',
    uploaded: 'பதிவேற்றப்பட்டது',

    inspection: 'ஆய்வு',
    checklist: 'சரிபார்ப்புப் பட்டியல்',
    measurement: 'அளவீடு',
    note: 'குறிப்பு',
    photo: 'புகைப்படம்',
    voiceNote: 'குரல் குறிப்பு',
    issue: 'பிரச்சனை',
    remaining: 'மீதமுள்ளவை',
    progress: 'முன்னேற்றம்',
    good: 'நன்று',
    damaged: 'சேதமடைந்தது',
    pass: 'தேர்ச்சி',
    fail: 'தோல்வி',
    na: 'பொருந்தாது',
    yes: 'ஆம்',
    no: 'இல்லை',

    offlineAlert: 'உங்கள் வேலை சாதனத்தில் சேமிக்கப்பட்டுள்ளது.',
    syncFailed: 'ஒத்திசைவு தோல்வியடைந்தது',
    photoPending: 'புகைப்படம் நிலுவையில் உள்ளது',
    conflictDetected: 'முரண்பாடு கண்டறியப்பட்டது',
    requiredField: 'கட்டாய புலம்',
    invalidMeasurement: 'தவறான அளவீடு',
    audioNotSupported: 'இந்த சாதனத்தில் ஆடியோ பதிவு ஆதரிக்கப்படவில்லை.',
    ttsNotAvailable: 'இந்த சாதனத்தில் தமிழ் குரல் வாசிப்பு கிடைக்கவில்லை.',
  },

  hi: {
    dashboard: 'डैशबोर्ड',
    inspections: 'निरीक्षण',
    conflicts: 'विवाद',
    sync: 'सिंक केंद्र',
    history: 'इतिहास',
    profile: 'प्रोफ़ाइल',
    admin: 'व्यवस्थापक',

    save: 'सहेजें',
    cancel: 'रद्द करें',
    next: 'आगे',
    previous: 'पीछे',
    record: 'वॉइस नोट रिकॉर्ड करें',
    takePhoto: 'फ़ोटो लें',
    addNote: 'नोट जोड़ें',
    resume: 'जारी रखें',
    resumeInspection: 'निरीक्षण फिर से शुरू करें',
    search: 'खोजें',
    searchPlaceholder: 'उपकरण, निरीक्षण, कोड खोजें...',
    syncNow: 'अभी सिंक करें',
    readAloud: 'पढ़ें',
    saveAndNext: 'सहेजें और अगला →',
    prepareOffline: 'ऑफ़लाइन कार्य तैयार करें',
    quickMode: 'त्वरित मोड',
    standardMode: 'मानक मोड',

    online: 'ऑनलाइन',
    offline: 'ऑफ़लाइन',
    syncing: 'सिंक हो रहा है',
    pending: 'लंबित',
    failed: 'विफल',
    completed: 'पूर्ण',
    conflict: 'विवाद',
    resolved: 'सुलझाया गया',
    savedOffline: 'ऑफ़लाइन सहेजा गया',
    uploadPending: 'अपलोड लंबित',
    uploaded: 'अपलोड हो गया',

    inspection: 'निरीक्षण',
    checklist: 'चेकलिस्ट',
    measurement: 'माप',
    note: 'नोट',
    photo: 'फ़ोटो',
    voiceNote: 'वॉइस नोट',
    issue: 'समस्या',
    remaining: 'शेष',
    progress: 'प्रगति',
    good: 'अच्छा',
    damaged: 'क्षतिग्रस्त',
    pass: 'उत्तीर्ण',
    fail: 'अनुत्तीर्ण',
    na: 'लागू नहीं',
    yes: 'हाँ',
    no: 'नहीं',

    offlineAlert: 'आपका कार्य स्थानीय रूप से सुरक्षित है।',
    syncFailed: 'सिंक विफल',
    photoPending: 'फ़ोटो लंबित',
    conflictDetected: 'विवाद का पता चला',
    requiredField: 'आवश्यक फ़ील्ड',
    invalidMeasurement: 'अमान्य माप',
    audioNotSupported: 'इस डिवाइस पर ऑडियो रिकॉर्डिंग समर्थित नहीं है।',
    ttsNotAvailable: 'इस डिवाइस पर हिंदी वाक् उपलब्ध नहीं है।',
  },

  te: {
    dashboard: 'డాష్‌బోర్డ్',
    inspections: 'తనిఖీలు',
    conflicts: 'వివాదాలు',
    sync: 'సింక్ కేంద్రం',
    history: 'చరిత్ర',
    profile: 'ప్రొఫైల్',
    admin: 'నిర్వాహకుడు',

    save: 'సేవ్ చేయి',
    cancel: 'రద్దు చేయి',
    next: 'తరువాత',
    previous: 'మునుపటిది',
    record: 'వాయిస్ నోట్ రికార్డ్ చేయి',
    takePhoto: 'ఫోటో తీయండి',
    addNote: 'గమనిక జోడించు',
    resume: 'కొనసాగించు',
    resumeInspection: 'తనిఖీని కొనసాగించండి',
    search: 'శోధించండి',
    searchPlaceholder: 'ఆస్తులు, తనిఖీలను శోధించండి...',
    syncNow: 'ఇప్పుడే సింక్ చేయి',
    readAloud: 'చదువు',
    saveAndNext: 'సేవ్ & తరువాత →',
    prepareOffline: 'ఆఫ్‌లైన్ ప్యాకేజీని సిద్ధం చేయి',
    quickMode: 'శీఘ్ర మోడ్',
    standardMode: 'సాధారణ మోడ్',

    online: 'ఆన్‌లైన్',
    offline: 'ఆఫ్‌లైన్',
    syncing: 'సింక్ అవుతోంది',
    pending: 'పెండింగ్',
    failed: 'విఫలమైంది',
    completed: 'పూర్తయింది',
    conflict: 'వివాదం',
    resolved: 'పరిష్కరించబడింది',
    savedOffline: 'ఆఫ్‌లైన్‌లో భద్రపరచబడింది',
    uploadPending: 'అప్‌లోడ్ పెండింగ్',
    uploaded: 'అప్‌లోడ్ అయింది',

    inspection: 'తనిఖీ',
    checklist: 'చెక్‌లిస్ట్',
    measurement: 'కొలత',
    note: 'గమనిక',
    photo: 'ఫోటో',
    voiceNote: 'వాయిస్ నోట్',
    issue: 'సమస్య',
    remaining: 'మిగిలినవి',
    progress: 'పురోగతి',
    good: 'బాగుంది',
    damaged: 'దెబ్బతిన్నది',
    pass: 'పాస్',
    fail: 'ఫెయిల్',
    na: 'వర్తించదు',
    yes: 'అవును',
    no: 'కాదు',

    offlineAlert: 'మీ పని పరికరంలో భద్రపరచబడింది.',
    syncFailed: 'సింక్ విఫలమైంది',
    photoPending: 'ఫోటో పెండింగ్‌లో ఉంది',
    conflictDetected: 'వివాదం గుర్తించబడింది',
    requiredField: 'తప్పనిసరి ఫీల్డ్',
    invalidMeasurement: 'చెల్లని కొలత',
    audioNotSupported: 'ఈ పరికరంలో ఆడియో రికార్డింగ్ అందుబాటులో లేదు.',
    ttsNotAvailable: 'ఈ పరికరంలో తెలుగు వాయిస్ రీడింగ్ అందుబాటులో లేదు.',
  },

  kn: {
    dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    inspections: 'ತಪಾಸಣೆಗಳು',
    conflicts: 'ಘರ್ಷಣೆಗಳು',
    sync: 'ಸಿಂಕ್ ಕೇಂದ್ರ',
    history: 'ಇತಿಹಾಸ',
    profile: 'ಪ್ರೊಫೈಲ್',
    admin: 'ನಿರ್ವಾಹಕ',

    save: 'ಉಳಿಸು',
    cancel: 'ರದ್ದುಮಾಡು',
    next: 'ಮುಂದೆ',
    previous: 'ಹಿಂದೆ',
    record: 'ಧ್ವನಿ ಟಿಪ್ಪಣಿ ರೆಕಾರ್ಡ್ ಮಾಡಿ',
    takePhoto: 'ಫೋಟೋ ತೆಗೆಯಿರಿ',
    addNote: 'ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ',
    resume: 'ಮುಂದುವರಿಸಿ',
    resumeInspection: 'ತಪಾಸಣೆಯನ್ನು ಪುನರಾರಂಭಿಸಿ',
    search: 'ಹುಡುಕಿ',
    searchPlaceholder: 'ಆಸ್ತಿಗಳು, ತಪಾಸಣೆಗಳನ್ನು ಹುಡುಕಿ...',
    syncNow: 'ಈಗಲೇ ಸಿಂಕ್ ಮಾಡಿ',
    readAloud: 'ಓದಿ',
    saveAndNext: 'ಉಳಿಸಿ & ಮುಂದೆ →',
    prepareOffline: 'ಆಫ್‌ಲೈನ್ ಕೆಲಸ ಸಿದ್ಧಪಡಿಸಿ',
    quickMode: 'ತ್ವರಿತ ಮೋಡ್',
    standardMode: 'ಸಾಮಾನ್ಯ ಮೋಡ್',

    online: 'ಆನ್‌ಲೈನ್',
    offline: 'ಆಫ್‌ಲೈನ್',
    syncing: 'ಸಿಂಕ್ ಆಗುತ್ತಿದೆ',
    pending: 'ಬಾಕಿ ಇದೆ',
    failed: 'ವಿಫಲವಾಗಿದೆ',
    completed: 'ಪೂರ್ಣಗೊಂಡಿದೆ',
    conflict: 'ಘರ್ಷಣೆ',
    resolved: 'ಪರಿಹರಿಸಲಾಗಿದೆ',
    savedOffline: 'ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ',
    uploadPending: 'ಅಪ್‌ಲೋಡ್ ಬಾಕಿ ಇದೆ',
    uploaded: 'ಅಪ್‌ಲೋಡ್ ಆಗಿದೆ',

    inspection: 'ತಪಾಸಣೆ',
    checklist: 'ಪರಿಶೀಲನಾ ಪಟ್ಟಿ',
    measurement: 'ಅಳತೆ',
    note: 'ಟಿಪ್ಪಣಿ',
    photo: 'ಫೋಟೋ',
    voiceNote: 'ಧ್ವನಿ ಟಿಪ್ಪಣಿ',
    issue: 'ಸಮಸ್ಯೆ',
    remaining: 'ಉಳಿದಿದೆ',
    progress: 'ಪ್ರಗತಿ',
    good: 'ಉತ್ತಮ',
    damaged: 'ಹಾನಿಯಾಗಿದೆ',
    pass: 'ಪಾಸು',
    fail: 'ಫೇಲು',
    na: 'ಅನ್ವಯಿಸುವುದಿಲ್ಲ',
    yes: 'ಹೌದು',
    no: 'ಇಲ್ಲ',

    offlineAlert: 'ನಿಮ್ಮ ಕೆಲಸವನ್ನು ಸಾಧನದಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ.',
    syncFailed: 'ಸಿಂಕ್ ವಿಫಲವಾಗಿದೆ',
    photoPending: 'ಫೋಟೋ ಬಾಕಿ ಇದೆ',
    conflictDetected: 'ಘರ್ಷಣೆ ಪತ್ತೆಯಾಗಿದೆ',
    requiredField: 'ಅಗತ್ಯ ಕ್ಷೇತ್ರ',
    invalidMeasurement: 'ಅಮಾನ್ಯ ಅಳತೆ',
    audioNotSupported: 'ಈ ಸಾಧನದಲ್ಲಿ ಆಡಿಯೋ ರೆಕಾರ್ಡಿಂಗ್ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ.',
    ttsNotAvailable: 'ಈ ಸಾಧನದಲ್ಲಿ ಕನ್ನಡ ಓದುವಿಕೆ ಲಭ್ಯವಿಲ್ಲ.',
  },

  ml: {
    dashboard: 'ഡാഷ്‌ബോർഡ്',
    inspections: 'പരിശോധനകൾ',
    conflicts: 'തർക്കങ്ങൾ',
    sync: 'സിങ്ക് കേന്ദ്രം',
    history: 'ചരിത്രം',
    profile: 'പ്രൊഫൈൽ',
    admin: 'അഡ്മിൻ',

    save: 'സേവ് ചെയ്യുക',
    cancel: 'റദ്ദാക്കുക',
    next: 'അടുത്തത്',
    previous: 'മുമ്പത്തേത്',
    record: 'ശബ്ദം റെക്കോർഡ് ചെയ്യുക',
    takePhoto: 'ഫോട്ടോ എടുക്കുക',
    addNote: 'കുറിപ്പ് ചേർക്കുക',
    resume: 'തുടരുക',
    resumeInspection: 'പരിശോധന പുനരാരംഭിക്കുക',
    search: 'തിരയുക',
    searchPlaceholder: 'ആസ്തികൾ, പരിശോധനകൾ തിരയുക...',
    syncNow: 'ഇപ്പോൾ സിങ്ക് ചെയ്യുക',
    readAloud: 'വായിക്കുക',
    saveAndNext: 'സേവ് & അടുത്തത് →',
    prepareOffline: 'ഓഫ്‌ലൈൻ പാക്കേജ് തയ്യാറാക്കുക',
    quickMode: 'ദ്രുത മോഡ്',
    standardMode: 'സാധാരണ മോഡ്',

    online: 'ഓൺലൈൻ',
    offline: 'ഓഫ്‌ലൈൻ',
    syncing: 'സിങ്ക് ചെയ്യുന്നു',
    pending: 'തീർച്ചപ്പെടുത്താത്തത്',
    failed: 'പരാജയപ്പെട്ടു',
    completed: 'പൂർത്തിയായി',
    conflict: 'തർക്കം',
    resolved: 'പരിഹരിച്ചു',
    savedOffline: 'ഓഫ്‌ലൈനിൽ സേവ് ചെയ്തു',
    uploadPending: 'അപ്‌ലോഡ് ബാക്കിയുണ്ട്',
    uploaded: 'അപ്‌ലോഡ് ചെയ്തു',

    inspection: 'പരിശോധന',
    checklist: 'ചെക്ക്‌ലിസ്റ്റ്',
    measurement: 'അളവ്',
    note: 'കുറിപ്പ്',
    photo: 'ഫോട്ടോ',
    voiceNote: 'വോയ്‌സ് നോട്ട്',
    issue: 'പ്രശ്നം',
    remaining: 'ബാക്കി',
    progress: 'പുരോഗതി',
    good: 'നല്ലത്',
    damaged: 'കേടായത്',
    pass: 'പാസ്സ്',
    fail: 'പരാജയം',
    na: 'ബാധകമല്ല',
    yes: 'അതെ',
    no: 'അല്ല',

    offlineAlert: 'നിങ്ങളുടെ വിവരങ്ങൾ ഫോണിൽ സുരക്ഷിതമായി സൂക്ഷിച്ചിരിക്കുന്നു.',
    syncFailed: 'സിങ്ക് പരാജയപ്പെട്ടു',
    photoPending: 'ഫോട്ടോ ബാക്കിയുണ്ട്',
    conflictDetected: 'തർക്കം കണ്ടെത്തി',
    requiredField: 'ആവശ്യമായ ഫീൽഡ്',
    invalidMeasurement: 'തെറ്റായ അളവ്',
    audioNotSupported: 'ഈ ഉപകരണത്തിൽ ഓഡിയോ റെക്കോർഡിംഗ് ലഭ്യമല്ല.',
    ttsNotAvailable: 'ഈ ഉപകരണത്തിൽ മലയാളം വായന ലഭ്യമല്ല.',
  },
};

export function getTranslation(
  lang: SupportedLanguage,
  key: string,
  fallback?: string
): string {
  const dict = translations[lang] || translations.en;
  if (key in dict) {
    return (dict as unknown as Record<string, string>)[key];
  }
  // Try English dictionary as fallback
  if (key in translations.en) {
    return (translations.en as unknown as Record<string, string>)[key];
  }
  return fallback ?? key;
}


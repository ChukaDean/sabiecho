import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'fr' | 'en';

const STRINGS = {
  tagline: { en: 'Global visitors. Local understanding.', fr: 'Visiteurs du monde. Compréhension locale.' },
  inputLabel: { en: 'Visitor’s review', fr: 'Avis du visiteur' },
  tabNew: { en: 'New review', fr: 'Nouvel avis' },
  tabReviews: { en: 'Reviews', fr: 'Avis' },
  tabInsights: { en: 'Insights', fr: 'Tendances' },
  tabPhrasebook: { en: 'Phrasebook', fr: 'Phrases' },
  tabOffline: { en: 'Offline', fr: 'Hors ligne' },

  inputPlaceholder: {
    en: "Paste or type the visitor's review in English or French…",
    fr: "Collez ou saisissez l'avis du visiteur en anglais ou en français…",
  },
  record: { en: 'Record voice', fr: 'Enregistrer la voix' },
  stop: { en: 'Stop recording', fr: "Arrêter l'enregistrement" },
  upload: { en: 'Upload voice note', fr: 'Importer une note vocale' },
  speechLanguage: { en: 'Spoken language', fr: 'Langue parlée' },
  auto: { en: 'Detect automatically', fr: 'Détection automatique' },
  analyze: { en: 'Analyze review', fr: "Analyser l'avis" },
  clear: { en: 'Clear', fr: 'Effacer' },
  transcribing: { en: 'Transcribing voice on this device…', fr: 'Transcription de la voix sur cet appareil…' },
  analyzing: { en: 'Identifying what matters…', fr: 'Identification de ce qui compte…' },
  voiceAttached: { en: 'Voice note ready', fr: 'Note vocale prête' },
  transcript: { en: 'Transcript', fr: 'Transcription' },
  micError: {
    en: 'Could not access the microphone. Check browser permissions.',
    fr: "Impossible d'accéder au micro. Vérifiez les autorisations du navigateur.",
  },
  decodeError: {
    en: 'This audio format could not be read on this device.',
    fr: "Ce format audio n'a pas pu être lu sur cet appareil.",
  },
  firstDownload: {
    en: 'First use downloads the model once ({mb} MB). After that it works offline.',
    fr: 'La première utilisation télécharge le modèle une fois ({mb} Mo). Ensuite, tout fonctionne hors ligne.',
  },

  resultTitle: { en: 'What the visitor said', fr: 'Ce que le visiteur a dit' },
  playAll: { en: 'Play all in {language}', fr: 'Tout écouter en {language}' },
  play: { en: 'Play', fr: 'Écouter' },
  stopPlayback: { en: 'Stop', fr: 'Arrêter' },
  noRecording: { en: 'No {language} recording yet', fr: 'Pas encore d’enregistrement en {language}' },
  uncertainNote: {
    en: 'SabiEcho is not sure what this review means. It has been saved for someone to read.',
    fr: "SabiEcho n'est pas sûr du sens de cet avis. Il a été gardé pour que quelqu'un le lise.",
  },
  saved: { en: 'Saved on this device', fr: 'Enregistré sur cet appareil' },
  evidence: { en: 'Based on', fr: "D'après" },

  reviewsEmpty: { en: 'No reviews yet.', fr: "Pas encore d'avis." },
  toRead: { en: 'To read', fr: 'À lire' },
  voice: { en: 'Voice', fr: 'Voix' },
  text: { en: 'Text', fr: 'Texte' },
  delete: { en: 'Delete', fr: 'Supprimer' },
  originalVoice: { en: 'Original voice note', fr: 'Note vocale originale' },

  insightsEmpty: { en: 'Insights appear once reviews are saved.', fr: 'Les tendances apparaissent une fois des avis enregistrés.' },
  period7: { en: '7 days', fr: '7 jours' },
  period30: { en: '30 days', fr: '30 jours' },
  periodAll: { en: 'All time', fr: 'Tout' },
  periodEmpty: { en: 'No reviews in this period.', fr: 'Aucun avis sur cette période.' },
  periodToRead: { en: '{n} waiting for a language reviewer', fr: '{n} en attente d’un relecteur' },
  moodTitle: { en: 'How visitors felt', fr: 'Ce que les visiteurs ont ressenti' },
  moodHeadHappy: { en: 'Most visitors were happy', fr: 'La plupart des visiteurs étaient contents' },
  moodHeadMixed: { en: 'Visitors had mixed feelings', fr: 'Les visiteurs avaient un avis partagé' },
  moodHeadUnhappy: { en: 'Many visitors were not happy', fr: 'Beaucoup de visiteurs n’étaient pas contents' },
  moodHeadUnknown: { en: 'Not enough to tell yet', fr: 'Pas encore assez d’avis pour le dire' },
  moodHappy: { en: 'Happy', fr: 'Contents' },
  moodMixed: { en: 'Mixed', fr: 'Partagés' },
  moodUnhappy: { en: 'Not happy', fr: 'Pas contents' },
  moodUnknown: { en: 'Not understood yet', fr: 'Pas encore compris' },
  trendUp: { en: 'Better than the {days} days before', fr: 'Mieux que les {days} jours d’avant' },
  trendDown: { en: 'Worse than the {days} days before', fr: 'Moins bien que les {days} jours d’avant' },
  trendSame: { en: 'About the same as the {days} days before', fr: 'Comme les {days} jours d’avant' },
  listen: { en: 'Listen', fr: 'Écouter' },
  workOnTitle: { en: 'What to work on', fr: 'Ce qu’il faut améliorer' },
  workOnEmpty: {
    en: 'Nothing stands out to fix yet. Keep collecting reviews.',
    fr: 'Rien de particulier à corriger pour l’instant. Continuez à recueillir des avis.',
  },
  evidenceProblem: { en: '{count} of {total} reviews mentioned this', fr: '{count} avis sur {total} en ont parlé' },
  evidenceHappy: { en: '{count} of {total} visitors were happy', fr: '{count} visiteurs sur {total} étaient contents' },
  earlySignal: {
    en: 'Early signal: only {n} reviews so far, so this may change.',
    fr: 'Premier signal : seulement {n} avis pour l’instant, cela peut changer.',
  },
  rising: { en: 'More than before', fr: 'Plus qu’avant' },
  showQuotes: { en: 'What visitors said', fr: 'Ce que les visiteurs ont dit' },
  watchTitle: { en: 'Worth watching, not enough reviews yet to be sure:', fr: 'À surveiller, pas encore assez d’avis pour en être sûr :' },
  lovedTitle: { en: 'What visitors love', fr: 'Ce que les visiteurs aiment' },
  lovedTip: {
    en: 'Keep doing these, and mention them when you invite new visitors.',
    fr: 'Continuez ainsi, et parlez-en quand vous invitez de nouveaux visiteurs.',
  },
  topicsTitle: { en: 'Every topic', fr: 'Tous les sujets' },
  topicsBad: { en: 'Complaints', fr: 'Plaintes' },
  topicsGood: { en: 'Praise', fr: 'Compliments' },
  topicsUnmentioned: { en: 'Not mentioned yet: {list}', fr: 'Pas encore mentionné : {list}' },
  weeksTitle: { en: 'Last 8 weeks', fr: 'Les 8 dernières semaines' },
  topic_explanations: { en: 'Explanations', fr: 'Explications' },
  topic_welcome: { en: 'Welcome', fr: 'Accueil' },
  topic_understanding: { en: 'Being understood', fr: 'Compréhension' },
  topic_participation: { en: 'Taking part', fr: 'Participation' },
  topic_place: { en: 'The place', fr: 'Le lieu' },
  topic_food: { en: 'Food and drink', fr: 'Nourriture et boissons' },
  topic_shopping: { en: 'Things to buy', fr: 'Achats' },
  topic_comfort: { en: 'Comfort and safety', fr: 'Confort et sécurité' },
  topic_organisation: { en: 'Organisation and timing', fr: 'Organisation et horaires' },
  topic_price: { en: 'Price', fr: 'Prix' },
  topic_access: { en: 'Finding the place', fr: 'Trouver le lieu' },

  messagesIntro: {
    en: 'SabiEcho can only say these 27 messages. Audio is played only where a person has recorded it in the local language.',
    fr: "SabiEcho ne peut dire que ces 27 messages. L'audio n'est joué que si une personne l'a enregistré dans la langue locale.",
  },
  newEyebrow: { en: 'Text or voice · English or French · Works offline', fr: 'Texte ou voix · Anglais ou français · Hors ligne' },
  newTitle: { en: 'What did your visitor say?', fr: 'Qu’a dit votre visiteur ?' },
  newIntro: {
    en: 'Type, paste or record their review. SabiEcho finds what it means and plays it back to you in {language}.',
    fr: 'Tapez, collez ou enregistrez son avis. SabiEcho trouve ce qu’il veut dire et vous le fait écouter en {language}.',
  },
  reviewsEyebrow: { en: 'Saved on this device only', fr: 'Enregistrés sur cet appareil uniquement' },
  reviewsTitle: { en: 'What visitors told you', fr: 'Ce que les visiteurs vous ont dit' },
  reviewsStat: { en: 'review(s) saved', fr: 'avis enregistré(s)' },
  insightsEyebrow: { en: 'Insights from your reviews', fr: 'Tendances tirées de vos avis' },
  insightsTitle: { en: 'What your visitors are telling you', fr: 'Ce que vos visiteurs vous disent' },
  insightsStat: { en: 'review(s) in this period', fr: 'avis sur cette période' },
  improveEyebrow: { en: 'Language reviewers only', fr: 'Réservé aux relecteurs' },
  improveTitle: { en: 'Make SabiEcho better', fr: 'Améliorez SabiEcho' },
  offlineEyebrow: { en: 'No internet needed after this', fr: 'Plus besoin d’internet ensuite' },
  offlineTitle: { en: 'Get SabiEcho ready for offline use', fr: 'Préparez SabiEcho pour le hors-ligne' },
  offlineStat: { en: 'of 2 models ready on this device', fr: 'modèles sur 2 prêts sur cet appareil' },
  messagesEyebrow: { en: 'Recorded by people, never synthesized', fr: 'Enregistré par des personnes, jamais synthétisé' },
  messagesTitle: { en: 'What SabiEcho can say in {language}', fr: 'Ce que SabiEcho sait dire en {language}' },
  recordedOf: { en: 'of 27 messages recorded in {language}', fr: 'messages sur 27 enregistrés en {language}' },

  offlineIntro: {
    en: 'Download the models once while connected. After that, transcription, analysis and local-language playback work without internet.',
    fr: "Téléchargez les modèles une fois avec une connexion. Ensuite, la transcription, l'analyse et l'écoute en langue locale fonctionnent sans internet.",
  },
  modelEmbedder: { en: 'Review analysis (multilingual)', fr: 'Analyse des avis (multilingue)' },
  modelAsr: { en: 'Speech recognition (Whisper, EN/FR)', fr: 'Reconnaissance vocale (Whisper, EN/FR)' },
  download: { en: 'Download', fr: 'Télécharger' },
  downloaded: { en: 'Ready offline', fr: 'Prêt hors ligne' },
  downloading: { en: 'Downloading', fr: 'Téléchargement' },
  loadingModel: { en: 'Loading…', fr: 'Chargement…' },
  notDownloaded: { en: 'Not downloaded', fr: 'Non téléchargé' },
  error: { en: 'Error', fr: 'Erreur' },
  retry: { en: 'Retry', fr: 'Réessayer' },
  online: { en: 'Online', fr: 'En ligne' },
  offline: { en: 'Offline', fr: 'Hors ligne' },

  tabImprove: { en: 'Improve', fr: 'Améliorer' },
  localRecording: { en: 'recorded here', fr: 'enregistré ici' },
  noneOfThese: { en: '0. None of these messages', fr: '0. Aucun de ces messages' },
  noOverall: { en: 'No overall feeling', fr: "Pas d'avis général" },
  groupOverall: { en: 'Overall feeling', fr: 'Avis général' },
  groupTopics: { en: 'Topics', fr: 'Sujets' },
  cancel: { en: 'Cancel', fr: 'Annuler' },

  correct: { en: 'Correct', fr: 'Corriger' },
  editCorrection: { en: 'Edit correction', fr: 'Modifier la correction' },
  wrongCorrect: { en: 'Not right? Correct it', fr: 'Pas juste ? Corrigez-le' },
  correctedBy: { en: 'Corrected by {name}', fr: 'Corrigé par {name}' },
  correctTitle: { en: 'What did the visitor really mean?', fr: 'Que voulait vraiment dire le visiteur ?' },
  correctIntro: {
    en: 'Pick the right message for each part. Use "None of these" for parts that are not about the visit. Every part becomes a training example.',
    fr: 'Choisissez le bon message pour chaque partie. Utilisez « Aucun de ces messages » pour ce qui ne concerne pas la visite. Chaque partie devient un exemple d’apprentissage.',
  },
  transcriptEditable: {
    en: 'Review text (fix transcription mistakes if needed)',
    fr: "Texte de l'avis (corrigez les erreurs de transcription si besoin)",
  },
  nothingToCorrect: { en: 'There is no text to correct.', fr: "Il n'y a pas de texte à corriger." },
  overallOfWhole: { en: 'Overall feeling of the whole review', fr: "Avis général sur l'ensemble" },
  saveCorrection: { en: 'Save correction', fr: 'Enregistrer la correction' },

  improveIntro: {
    en: 'Vetted language reviewers improve SabiEcho here: correct reviews it got wrong, add example phrases, and record and vet the messages in local languages. Hosts never see this tab.',
    fr: "Les relecteurs validés améliorent SabiEcho ici : corrigez les avis mal compris, ajoutez des exemples, enregistrez et validez les messages en langues locales. Les hôtes ne voient jamais cet onglet.",
  },
  improveReviews: { en: 'Reviews to check', fr: 'Avis à vérifier' },
  improveTeach: { en: 'Teach phrases', fr: 'Enseigner des phrases' },
  improveRecordings: { en: 'Voice recordings', fr: 'Enregistrements vocaux' },
  improveShare: { en: 'Share', fr: 'Partager' },
  modelBuiltIn: { en: 'Using the built-in model', fr: 'Modèle intégré utilisé' },
  modelBuiltInDetail: {
    en: 'Add corrections or phrases, then retrain to use them.',
    fr: 'Ajoutez des corrections ou des phrases, puis réentraînez pour les utiliser.',
  },
  modelImproved: { en: 'Using the model improved on this device', fr: 'Modèle amélioré sur cet appareil utilisé' },
  modelImprovedDetail: {
    en: 'Retrained {date} with {n} local examples.',
    fr: 'Réentraîné le {date} avec {n} exemples locaux.',
  },
  newExamples: {
    en: '{n} new example(s) not yet used. Retrain to apply them.',
    fr: '{n} nouvel(s) exemple(s) pas encore utilisé(s). Réentraînez pour les appliquer.',
  },
  retrain: { en: 'Retrain now', fr: 'Réentraîner' },
  resetModel: { en: 'Back to built-in', fr: 'Revenir au modèle intégré' },
  resetConfirm: {
    en: 'Go back to the built-in model? Your examples are kept and you can retrain later.',
    fr: 'Revenir au modèle intégré ? Vos exemples sont gardés et vous pourrez réentraîner plus tard.',
  },
  trainEmbedding: { en: 'Reading examples…', fr: 'Lecture des exemples…' },
  trainTraining: { en: 'Training…', fr: 'Entraînement…' },
  queueIntro: {
    en: 'Reviews SabiEcho was unsure about or that a host flagged, including those hosts sent you as a file (import it under Share). Correct them so SabiEcho learns.',
    fr: "Avis dont SabiEcho n'était pas sûr ou signalés par un hôte, y compris ceux reçus par fichier (importez-le dans Partager). Corrigez-les pour que SabiEcho apprenne.",
  },
  queueEmpty: { en: 'Nothing to check right now.', fr: 'Rien à vérifier pour le moment.' },
  teachIntro: {
    en: 'Add a phrase visitors really say and the message it means. Short, single-idea phrases work best.',
    fr: 'Ajoutez une phrase que les visiteurs disent vraiment et le message correspondant. Les phrases courtes, avec une seule idée, fonctionnent le mieux.',
  },
  teachPlaceholder: { en: 'e.g. The guide knew so much about the history', fr: "ex. Le guide connaissait très bien l'histoire" },
  addExample: { en: 'Add example', fr: "Ajouter l'exemple" },
  examplesOnDevice: { en: 'Examples on this device ({n})', fr: 'Exemples sur cet appareil ({n})' },
  examplesEmpty: { en: 'No examples yet.', fr: "Pas encore d'exemples." },
  fromCorrection: { en: 'correction', fr: 'correction' },
  fromTeach: { en: 'taught', fr: 'enseigné' },

  recordMessage: { en: 'Record a message', fr: 'Enregistrer un message' },
  message: { en: 'Message', fr: 'Message' },
  sayIn: { en: 'Say in {language}:', fr: 'Dites en {language} :' },
  recordingText: { en: 'Written in {language}, as spoken (optional)', fr: 'Écrit en {language}, tel que prononcé (facultatif)' },
  listenBack: { en: 'Listen back', fr: 'Réécouter' },
  saveForVetting: { en: 'Save for vetting', fr: 'Envoyer pour validation' },
  savedForVetting: {
    en: 'Saved. Another person must approve it before SabiEcho plays it.',
    fr: "Enregistré. Une autre personne doit le valider avant que SabiEcho ne le joue.",
  },
  awaitingVetting: { en: 'Waiting for vetting', fr: 'En attente de validation' },
  nothingToVet: { en: 'No recordings waiting.', fr: 'Aucun enregistrement en attente.' },
  vettedRecordings: { en: 'Vetted recordings ({n})', fr: 'Enregistrements validés ou refusés ({n})' },
  recordedBy: { en: 'Recorded by {name}', fr: 'Enregistré par {name}' },
  approvedBy: { en: 'approved by {name}', fr: 'validé par {name}' },
  rejectedBy: { en: 'rejected by {name}', fr: 'refusé par {name}' },
  approve: { en: 'Approve', fr: 'Valider' },
  reject: { en: 'Reject', fr: 'Refuser' },
  approved: { en: 'Approved', fr: 'Validé' },
  rejected: { en: 'Rejected', fr: 'Refusé' },
  vetterMustDiffer: {
    en: 'Someone other than the recorder must vet this.',
    fr: "Une autre personne que celle qui a enregistré doit valider.",
  },

  shareIntro: {
    en: 'Export your examples and recordings in one file for the SabiEcho team, who check it and ship the improvements to every host in an app update. Import a host’s “reviews to check” file, or another language reviewer’s file.',
    fr: 'Exportez vos exemples et enregistrements dans un fichier pour l’équipe SabiEcho, qui le vérifie et envoie les améliorations à tous les hôtes dans une mise à jour. Importez le fichier « avis à vérifier » d’un hôte, ou celui d’un autre relecteur.',
  },
  exportFile: { en: 'Export improvements', fr: 'Exporter les améliorations' },
  importFile: { en: 'Import a file', fr: 'Importer un fichier' },
  importDone: {
    en: 'Imported {examples} examples and {recordings} recordings. Retrain to use the examples.',
    fr: 'Importé {examples} exemples et {recordings} enregistrements. Réentraînez pour utiliser les exemples.',
  },

  localLanguage: { en: 'Local language', fr: 'Langue locale' },
  recordLanguage: { en: 'Language', fr: 'Langue' },
  languagesTitle: { en: 'Local languages', fr: 'Langues locales' },
  languagesIntro: {
    en: 'Visitors write or speak English or French. SabiEcho answers in the local language using human recordings, so each language only needs its 27 messages recorded and vetted by local speakers.',
    fr: 'Les visiteurs écrivent ou parlent en anglais ou en français. SabiEcho répond dans la langue locale grâce à des enregistrements humains : chaque langue a seulement besoin de ses 27 messages, enregistrés et validés par des locuteurs.',
  },
  inUse: { en: 'in use', fr: 'utilisée' },
  useLanguage: { en: 'Use', fr: 'Utiliser' },
  vetterSpeaker: {
    en: 'Approve only if you speak {language} and the recording says exactly this message.',
    fr: 'Validez seulement si vous parlez {language} et que l’enregistrement dit exactement ce message.',
  },

  volunteer: { en: 'Language reviewer', fr: 'Relecteur' },
  volunteerSignIn: { en: 'Language reviewer sign-in', fr: 'Connexion relecteur' },
  signInIntro: {
    en: 'For vetted language reviewers only. Paste the access code the SabiEcho team sent you. Hosts do not need to sign in.',
    fr: "Réservé aux relecteurs validés. Collez le code d'accès envoyé par l'équipe SabiEcho. Les hôtes n'ont pas besoin de se connecter.",
  },
  signIn: { en: 'Sign in', fr: 'Se connecter' },
  signOut: { en: 'Sign out ({name})', fr: 'Se déconnecter ({name})' },
  codeInvalid: { en: 'This access code is not valid.', fr: "Ce code d'accès n'est pas valide." },
  codeExpired: {
    en: 'This access code has expired. Ask the SabiEcho team for a new one.',
    fr: "Ce code d'accès a expiré. Demandez-en un nouveau à l'équipe SabiEcho.",
  },
  signedInAs: { en: 'Signed in as {name}', fr: 'Connecté : {name}' },
  role_correct: { en: 'corrects reviews', fr: 'corrige les avis' },
  role_record: { en: 'records', fr: 'enregistre' },
  role_vet: { en: 'vets recordings', fr: 'valide les enregistrements' },
  cannotVet: {
    en: 'Waiting for a language reviewer vetted for {language}.',
    fr: 'En attente d’un relecteur validé en {language}.',
  },

  flag: { en: 'Looks wrong', fr: 'Semble faux' },
  unflag: { en: 'Unflag', fr: 'Retirer le signalement' },
  flagged: { en: 'Flagged', fr: 'Signalé' },
  flagForVolunteer: { en: 'Looks wrong? Flag it for a language reviewer', fr: 'Semble faux ? Signalez-le à un relecteur' },
  flaggedNote: {
    en: 'Flagged. Send it for checking from the Reviews tab.',
    fr: "Signalé. Envoyez-le pour vérification depuis l'onglet Avis.",
  },
  needVolunteer: { en: '{n} review(s) need a language reviewer', fr: '{n} avis à faire vérifier' },
  sendIntro: {
    en: 'SabiEcho was unsure about these, or you flagged them. Send them to the language reviewers, for example on WhatsApp.',
    fr: "SabiEcho n'était pas sûr de ces avis, ou vous les avez signalés. Envoyez-les aux relecteurs, par exemple sur WhatsApp.",
  },
  lastSent: { en: 'Last sent {date}', fr: 'Dernier envoi : {date}' },
  sendForChecking: { en: 'Send for checking', fr: 'Envoyer pour vérification' },
  sendTitle: { en: 'SabiEcho reviews to check', fr: 'Avis SabiEcho à vérifier' },
  sentForChecking: { en: 'Sent for checking', fr: 'Envoyé pour vérification' },
  fromHost: { en: 'From a host', fr: "D'un hôte" },
  importReviewsDone: {
    en: 'Imported {n} review(s) to check. They are in “Reviews to check”.',
    fr: 'Importé {n} avis à vérifier. Ils sont dans « Avis à vérifier ».',
  },
  importRejected: {
    en: '{n} item(s) were not accepted because they were not done by vetted language reviewers:',
    fr: "{n} élément(s) refusé(s) car non réalisés par des relecteurs validés :",
  },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof STRINGS;

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const initial = localStorage.getItem('echoloc:lang') === 'fr' ? 'fr' : 'en';
    document.documentElement.lang = initial;
    return initial;
  });
  const setLang = (l: Lang) => {
    localStorage.setItem('echoloc:lang', l);
    document.documentElement.lang = l;
    setLangState(l);
  };
  const t: I18n['t'] = (key, vars) =>
    Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), STRINGS[key][lang]);
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

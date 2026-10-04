/**
 * Local languages SabiEcho can speak back in. Visitors still write or speak English or French; the 27 meanings
 * are the same for every language, so adding one only takes 27 human recordings, never a new model.
 */
export interface LocalLanguage {
  /** ISO 639-3 code, also the folder name under public/audio/. */
  code: string;
  /** Name in the language itself, when there is a settled one. */
  endonym: string;
  en: string;
  /** Lower-case, as used mid-sentence in French ("en fon"). */
  fr: string;
  country: { en: string; fr: string };
  /** Where visitors meet speakers of this language. */
  places: string;
}

export const DEFAULT_LANGUAGE = 'fon';

export const LOCAL_LANGUAGES: LocalLanguage[] = [
  {
    code: 'fon',
    endonym: 'Fɔngbè',
    en: 'Fon',
    fr: 'fon',
    country: { en: 'Benin', fr: 'Bénin' },
    places: 'Ouidah, Abomey, Ganvié',
  },
  {
    code: 'aka',
    endonym: 'Akan (Twi, Fante)',
    en: 'Akan',
    fr: 'akan',
    country: { en: 'Ghana', fr: 'Ghana' },
    places: 'Cape Coast, Elmina, Kumasi',
  },
  {
    code: 'wol',
    endonym: 'Wolof',
    en: 'Wolof',
    fr: 'wolof',
    country: { en: 'Senegal', fr: 'Sénégal' },
    places: 'Gorée, Saint-Louis, Saly',
  },
  {
    code: 'mnk',
    endonym: 'Mandinka',
    en: 'Mandinka',
    fr: 'mandinka',
    country: { en: 'The Gambia', fr: 'Gambie' },
    places: 'Kunta Kinteh Island, Juffureh, coastal resorts',
  },
  {
    code: 'shi',
    endonym: 'Taclḥit',
    en: 'Tashelhit (Amazigh)',
    fr: 'tachelhit (amazigh)',
    country: { en: 'Morocco', fr: 'Maroc' },
    places: 'High Atlas, Agadir, Taroudant',
  },
  {
    code: 'fia',
    endonym: 'Nobiin',
    en: 'Nobiin (Nubian)',
    fr: 'nobiin (nubien)',
    country: { en: 'Egypt', fr: 'Égypte' },
    places: 'Aswan, Nubian villages, Abu Simbel',
  },
  {
    code: 'amh',
    endonym: 'አማርኛ',
    en: 'Amharic',
    fr: 'amharique',
    country: { en: 'Ethiopia', fr: 'Éthiopie' },
    places: 'Lalibela, Gondar, Simien Mountains',
  },
  {
    code: 'mas',
    endonym: 'Maa',
    en: 'Maa (Maasai)',
    fr: 'maa (massaï)',
    country: { en: 'Kenya, Tanzania', fr: 'Kenya, Tanzanie' },
    places: 'Maasai Mara, Amboseli, Ngorongoro',
  },
  {
    code: 'kin',
    endonym: 'Ikinyarwanda',
    en: 'Kinyarwanda',
    fr: 'kinyarwanda',
    country: { en: 'Rwanda', fr: 'Rwanda' },
    places: 'Volcanoes National Park, Lake Kivu',
  },
  {
    code: 'cgg',
    endonym: 'Rukiga',
    en: 'Rukiga',
    fr: 'rukiga',
    country: { en: 'Uganda', fr: 'Ouganda' },
    places: 'Bwindi Impenetrable Forest, Lake Bunyonyi',
  },
  {
    code: 'mlg',
    endonym: 'Malagasy',
    en: 'Malagasy',
    fr: 'malgache',
    country: { en: 'Madagascar', fr: 'Madagascar' },
    places: 'Nosy Be, Andasibe, Avenue of the Baobabs',
  },
  {
    code: 'xho',
    endonym: 'isiXhosa',
    en: 'isiXhosa',
    fr: 'xhosa',
    country: { en: 'South Africa', fr: 'Afrique du Sud' },
    places: 'Cape Town township tours, Eastern Cape',
  },
  {
    code: 'tsn',
    endonym: 'Setswana',
    en: 'Setswana',
    fr: 'tswana',
    country: { en: 'Botswana', fr: 'Botswana' },
    places: 'Okavango Delta, Chobe, Maun',
  },
  {
    code: 'naq',
    endonym: 'Khoekhoegowab',
    en: 'Khoekhoe (Nama, Damara)',
    fr: 'khoekhoe (nama, damara)',
    country: { en: 'Namibia', fr: 'Namibie' },
    places: 'Damaraland, Twyfelfontein',
  },
  {
    code: 'sna',
    endonym: 'chiShona',
    en: 'Shona',
    fr: 'shona',
    country: { en: 'Zimbabwe', fr: 'Zimbabwe' },
    places: 'Great Zimbabwe, Eastern Highlands',
  },
];

export const LANGUAGES_BY_CODE = new Map(LOCAL_LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code: string): LocalLanguage {
  return LANGUAGES_BY_CODE.get(code) ?? LANGUAGES_BY_CODE.get(DEFAULT_LANGUAGE)!;
}

/** Name to use inside a sentence of the current UI language. */
export function languageName(l: LocalLanguage, ui: 'en' | 'fr') {
  return ui === 'fr' ? l.fr : l.en;
}

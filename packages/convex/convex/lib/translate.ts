/** ISO 639-3 (franc output) → ISO 639-1 (Google Translate input) mapping for common languages. */
const ISO_639_3_TO_1: Record<string, string> = {
  eng: "en", spa: "es", fra: "fr", deu: "de", por: "pt",
  ita: "it", nld: "nl", rus: "ru", jpn: "ja", zho: "zh",
  kor: "ko", ara: "ar", hin: "hi", ben: "bn", tur: "tr",
  vie: "vi", pol: "pl", ukr: "uk", ron: "ro", ell: "el",
  ces: "cs", hun: "hu", swe: "sv", dan: "da", nor: "no",
  fin: "fi", heb: "he", tha: "th", ind: "id", msa: "ms",
  fil: "tl", tam: "ta", tel: "te", mar: "mr", urd: "ur",
  fas: "fa", cat: "ca", hrv: "hr", srp: "sr", slk: "sk",
  slv: "sl", bul: "bg", lit: "lt", lav: "lv", est: "et",
  cmn: "zh", afr: "af", swa: "sw",
};

/** Converts a 3-letter ISO 639-3 code to 2-letter ISO 639-1. Returns null if unmapped. */
export function iso639_3to1(code: string): string | null {
  return ISO_639_3_TO_1[code] ?? null;
}

interface TranslateResponse {
  data: {
    translations: Array<{
      translatedText: string;
      detectedSourceLanguage?: string;
    }>;
  };
}

export interface TranslateResult {
  translatedText: string;
  detectedSourceLanguage?: string;
}

/** Translates a single text string via Google Cloud Translate v2 REST API. */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang?: string,
): Promise<TranslateResult> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_TRANSLATE_API_KEY not set");

  const params = new URLSearchParams({
    q: text,
    target: targetLang,
    format: "text",
    key: apiKey,
  });
  const validSourceLangs = new Set(Object.values(ISO_639_3_TO_1));
  if (sourceLang && validSourceLangs.has(sourceLang)) params.set("source", sourceLang);

  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?${params}`,
    { method: "POST" },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Translate API error ${res.status}: ${body}`);
  }

  const json: TranslateResponse = await res.json();
  const t = json.data.translations[0];
  return {
    translatedText: t.translatedText,
    detectedSourceLanguage: t.detectedSourceLanguage,
  };
}

/** Translates up to 128 texts in a single API call. */
export async function translateBatch(
  texts: string[],
  targetLang: string,
): Promise<string[]> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_TRANSLATE_API_KEY not set");

  const body = {
    q: texts,
    target: targetLang,
    format: "text",
  };

  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Google Translate API error ${res.status}: ${errBody}`);
  }

  const json: TranslateResponse = await res.json();
  return json.data.translations.map((t) => t.translatedText);
}

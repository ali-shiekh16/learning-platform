import type { Voice } from './engine'

const languageOf = (tag: string) => tag.split(/[-_]/)[0]!.toLowerCase()
const sameTag = (a: string, b: string) =>
  a.replace('_', '-').toLowerCase() === b.replace('_', '-').toLowerCase()

/**
 * How natural a voice sounds, judged from its name since browsers report nothing else:
 *   3  neural voices: Edge's "… Online (Natural)", Safari's "Premium"/"Enhanced"
 *   2  Google's voices in Chrome, and other online voices
 *   1  old desktop voices (e.g. Windows' Microsoft David / Hazel / Zira): robotic
 */
export function voiceQuality(voice: Voice): number {
  if (/natural|neural|premium|enhanced/i.test(voice.name)) return 3
  if (/google/i.test(voice.name) || voice.online) return 2
  return 1
}

/**
 * The voice to use: the user's saved choice if this browser still has it; otherwise the
 * best-sounding voice in the browser's language (exact region first, e.g. en-GB, then any
 * English); otherwise the best voice of all. null if there are no voices.
 */
export function pickVoice(
  voices: Voice[],
  savedId: string | null,
  browserLang: string,
): Voice | null {
  const saved = voices.find(v => v.id === savedId)
  if (saved) return saved
  // Highest quality first; on a tie, the system default.
  const best = (list: Voice[]) =>
    list.toSorted(
      (a, b) => voiceQuality(b) - voiceQuality(a) || Number(b.isDefault) - Number(a.isDefault),
    )[0]
  return (
    best(voices.filter(v => sameTag(v.lang, browserLang))) ??
    best(voices.filter(v => languageOf(v.lang) === languageOf(browserLang))) ??
    best(voices) ??
    null
  )
}

/**
 * Voices grouped by language for the dropdown ("English", "French", …), the browser's
 * language first, then alphabetically. Browsers can list dozens of voices.
 */
export function groupVoicesByLanguage(voices: Voice[], browserLang: string) {
  const names = new Intl.DisplayNames([browserLang, 'en'], { type: 'language' })
  const label = (lang: string) => {
    try {
      return names.of(languageOf(lang)) ?? lang
    } catch {
      return lang // not a valid language tag
    }
  }

  const groups = new Map<string, Voice[]>()
  for (const voice of voices) {
    const key = label(voice.lang)
    groups.set(key, [...(groups.get(key) ?? []), voice])
  }
  const mine = label(browserLang)
  return [...groups.entries()]
    .map(([language, list]) => ({
      language,
      // Best-sounding first, so the good voices aren't buried among robotic ones.
      voices: list.sort(
        (a, b) => voiceQuality(b) - voiceQuality(a) || a.name.localeCompare(b.name),
      ),
    }))
    .sort((a, b) =>
      a.language === mine ? -1 : b.language === mine ? 1 : a.language.localeCompare(b.language),
    )
}

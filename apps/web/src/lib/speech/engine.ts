/**
 * What the TTS UI needs from a speech engine (ADR 009). The UI only talks to this
 * interface; the browser's Web Speech API is the one implementation today, and a cloud
 * voice provider could be added as another without changing the UI.
 */

export interface Voice {
  id: string
  name: string
  /** BCP 47 language tag, e.g. "en-GB". */
  lang: string
  isDefault: boolean
  /** Needs a network connection (e.g. Chrome's "Google …" voices). */
  online: boolean
}

export interface SpeakOptions {
  /** null: the engine's default voice. */
  voiceId: string | null
  /** 0.5–2, 1 is normal. */
  rate: number
  /** 0–2, 1 is normal. */
  pitch: number
}

/** A [start, end) range in the text being spoken. */
export interface TextRange {
  start: number
  end: number
}

export type SpeechEndReason = 'done' | 'stopped' | 'error'

export interface SpeakHandlers {
  /** A new chunk (usually a sentence) started. Always fired. */
  onChunk?: (range: TextRange) => void
  /** A new word started. Only fired by voices that report word positions. */
  onWord?: (range: TextRange) => void
  /** Called exactly once: finished, stopped (also by a newer `speak`), or failed. */
  onEnd?: (reason: SpeechEndReason, message?: string) => void
}

export interface SpeechEngine {
  readonly supported: boolean
  getVoices(): Voice[]
  /** Voices can arrive after page load (Chrome). Returns an unsubscribe function. */
  onVoicesChanged(listener: () => void): () => void
  /** Speaks `text`, replacing anything currently being spoken. */
  speak(text: string, options: SpeakOptions, handlers?: SpeakHandlers): void
  pause(): void
  resume(): void
  stop(): void
}

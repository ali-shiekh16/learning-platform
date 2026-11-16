import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { speechEngine } from '@/lib/speech/browser-engine'
import type { SpeechEngine, TextRange, Voice } from '@/lib/speech/engine'
import { groupVoicesByLanguage, pickVoice } from '@/lib/speech/voices'

export type { Voice, TextRange }

export const TTS_MAX_LENGTH = 5000

interface Preferences {
  voiceId: string | null
  rate: number
  pitch: number
}

const STORAGE_KEY = 'tts-preferences'
const DEFAULTS: Preferences = { voiceId: null, rate: 1, pitch: 1 }
// Chrome loads voices after the page; if none arrive by then, this device has none.
const VOICES_TIMEOUT_MS = 2500

// Browser storage can be missing or blocked (private windows): preferences are a
// convenience, so failures are ignored.
function loadPreferences(): Preferences {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}
function savePreferences(preferences: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // ignored: see above
  }
}

const browserLang = () => (typeof navigator === 'undefined' ? 'en' : navigator.language || 'en')

/** The device's voices: still loading, available, or none at all. */
function useVoices(engine: SpeechEngine) {
  const [voices, setVoices] = useState<Voice[]>(() => engine.getVoices())
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const update = () => setVoices(engine.getVoices())
    update()
    const unsubscribe = engine.onVoicesChanged(update)
    const timer = setTimeout(() => setTimedOut(true), VOICES_TIMEOUT_MS)
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [engine])

  const status: 'loading' | 'ready' | 'none' =
    voices.length > 0 ? 'ready' : timedOut || !engine.supported ? 'none' : 'loading'
  return { voices, status }
}

/**
 * Text-to-speech for a component: voices, saved preferences (voice, rate, pitch), the
 * controls, and what is being spoken right now (for highlighting). Only this hook talks
 * to the speech engine (ADR 009).
 */
export function useSpeech(engine: SpeechEngine = speechEngine) {
  const { voices, status: voicesStatus } = useVoices(engine)
  const [preferences, setPreferences] = useState(loadPreferences)
  const [state, setState] = useState<'idle' | 'speaking' | 'paused'>('idle')
  const [chunk, setChunk] = useState<TextRange | null>(null)
  const [word, setWord] = useState<TextRange | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Which text this component is speaking; null when it isn't (another one may be).
  const [speakingText, setSpeakingText] = useState<string | null>(null)
  const isMine = useRef(false)

  const voice = useMemo(
    () => pickVoice(voices, preferences.voiceId, browserLang()),
    [voices, preferences.voiceId],
  )
  const voiceGroups = useMemo(() => groupVoicesByLanguage(voices, browserLang()), [voices])

  const update = useCallback((change: Partial<Preferences>) => {
    setPreferences(previous => {
      const next = { ...previous, ...change }
      savePreferences(next)
      return next
    })
  }, [])

  const speak = useCallback(
    (text: string) => {
      setError(null)
      isMine.current = true
      setState('speaking')
      setSpeakingText(text)
      engine.speak(
        text,
        { voiceId: voice?.id ?? null, rate: preferences.rate, pitch: preferences.pitch },
        {
          onChunk: range => {
            setChunk(range)
            setWord(null)
          },
          onWord: setWord,
          onEnd: (reason, message) => {
            isMine.current = false
            setState('idle')
            setChunk(null)
            setWord(null)
            setSpeakingText(null)
            if (reason === 'error') setError(message ?? 'Speech failed')
          },
        },
      )
    },
    [engine, voice, preferences.rate, preferences.pitch],
  )

  const pause = useCallback(() => {
    engine.pause()
    setState('paused')
  }, [engine])

  const resume = useCallback(() => {
    engine.resume()
    setState('speaking')
  }, [engine])

  const stop = useCallback(() => engine.stop(), [engine])

  // Leaving the page stops this component's speech (but not someone else's).
  useEffect(
    () => () => {
      if (isMine.current) engine.stop()
    },
    [engine],
  )

  return {
    supported: engine.supported,
    voices,
    voiceGroups,
    voicesStatus,
    voice,
    setVoiceId: (voiceId: string) => update({ voiceId }),
    rate: preferences.rate,
    setRate: (rate: number) => update({ rate }),
    pitch: preferences.pitch,
    setPitch: (pitch: number) => update({ pitch }),
    state,
    /** The text this component is speaking, so a list can show which item is playing. */
    speakingText,
    /** The chunk (sentence) being spoken, and the word if the voice reports words. */
    chunk,
    word,
    error,
    speak,
    pause,
    resume,
    stop,
  }
}

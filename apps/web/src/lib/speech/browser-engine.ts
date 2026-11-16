import type { SpeakHandlers, SpeechEndReason, SpeechEngine, Voice } from './engine'
import { splitIntoChunks, wordAt } from './text'

/**
 * The Web Speech API (`speechSynthesis`) as a SpeechEngine.
 *
 * Text is spoken one chunk at a time (see text.ts): each chunk is its own utterance, and
 * the next one starts when the previous ends. Positions the browser reports are relative
 * to the chunk, so they are shifted by the chunk's start to point into the full text.
 *
 * `synth` and `Utterance` are parameters so tests can pass fakes.
 */
export function createBrowserSpeechEngine(
  synth: SpeechSynthesis | undefined = globalThis.speechSynthesis,
  Utterance: typeof SpeechSynthesisUtterance | undefined = globalThis.SpeechSynthesisUtterance,
): SpeechEngine {
  if (!synth || !Utterance) return unsupportedEngine

  // The one speech in progress. Every engine call goes through one synth, so a newer
  // speak() (from any component) ends the previous one.
  let current: { handlers: SpeakHandlers; finished: boolean } | null = null

  const finish = (
    session: NonNullable<typeof current>,
    reason: SpeechEndReason,
    message?: string,
  ) => {
    if (session.finished) return
    session.finished = true
    if (current === session) current = null
    session.handlers.onEnd?.(reason, message)
  }

  const nativeVoices = () => synth.getVoices()

  const engine: SpeechEngine = {
    supported: true,

    getVoices: () =>
      nativeVoices().map((voice): Voice => ({
        id: voice.voiceURI,
        name: voice.name,
        lang: voice.lang,
        isDefault: voice.default,
        online: !voice.localService,
      })),

    onVoicesChanged(listener) {
      synth.addEventListener('voiceschanged', listener)
      return () => synth.removeEventListener('voiceschanged', listener)
    },

    speak(text, options, handlers = {}) {
      engine.stop()
      const session = { handlers, finished: false }
      current = session

      const voice = nativeVoices().find(v => v.voiceURI === options.voiceId) ?? null
      const chunks = splitIntoChunks(text, voice?.lang)

      const speakChunk = (i: number) => {
        if (session.finished) return
        const chunk = chunks[i]
        if (!chunk) return finish(session, 'done')

        const utterance = new Utterance(chunk.text)
        if (voice) {
          utterance.voice = voice
          utterance.lang = voice.lang
        }
        utterance.rate = options.rate
        utterance.pitch = options.pitch
        utterance.onstart = () =>
          handlers.onChunk?.({ start: chunk.start, end: chunk.start + chunk.text.length })
        utterance.onboundary = event => {
          if (event.name !== 'word') return
          const start = chunk.start + event.charIndex
          handlers.onWord?.(
            event.charLength ? { start, end: start + event.charLength } : wordAt(text, start),
          )
        }
        utterance.onend = () => speakChunk(i + 1)
        utterance.onerror = event => {
          // "interrupted"/"canceled" come from our own stop(); that's not a failure.
          if (event.error === 'interrupted' || event.error === 'canceled') return
          finish(session, 'error', event.error)
        }
        synth.speak(utterance)
      }

      if (chunks.length === 0) return finish(session, 'done')
      speakChunk(0)
    },

    pause: () => synth.pause(),
    resume: () => synth.resume(),

    stop() {
      const session = current
      // cancel() also clears a paused state, so the next speak() isn't stuck paused.
      synth.cancel()
      if (session) finish(session, 'stopped')
    },
  }
  return engine
}

const unsupportedEngine: SpeechEngine = {
  supported: false,
  getVoices: () => [],
  onVoicesChanged: () => () => {},
  speak: (_text, _options, handlers) =>
    handlers?.onEnd?.('error', 'Speech is not supported in this browser'),
  pause: () => {},
  resume: () => {},
  stop: () => {},
}

/** The app's engine. Shared, so the TTS tool and chat's 🔊 buttons never talk over each other. */
export const speechEngine = createBrowserSpeechEngine()

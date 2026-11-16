import { describe, expect, it, vi } from 'vitest'
import { createBrowserSpeechEngine } from './browser-engine'
import type { SpeechEndReason, TextRange } from './engine'

/** A stand-in for the browser's speechSynthesis that we can drive step by step. */
function fakeSynth(voices: Partial<SpeechSynthesisVoice>[] = []) {
  const queue: FakeUtterance[] = []
  const synth = {
    speak: vi.fn((u: FakeUtterance) => queue.push(u)),
    cancel: vi.fn(() => {
      for (const u of queue.splice(0)) u.onerror?.({ error: 'interrupted' })
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => voices as SpeechSynthesisVoice[],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  /** The browser starts the next queued utterance, reports a word, and finishes it. */
  const playNext = (wordAtChar?: number) => {
    const u = queue.shift()!
    u.onstart?.()
    if (wordAtChar !== undefined)
      u.onboundary?.({ name: 'word', charIndex: wordAtChar, charLength: 0 })
    u.onend?.()
    return u
  }
  return { synth: synth as unknown as SpeechSynthesis, queue, playNext }
}

class FakeUtterance {
  voice: unknown = null
  lang = ''
  rate = 1
  pitch = 1
  onstart?: () => void
  onend?: () => void
  onerror?: (event: { error: string }) => void
  onboundary?: (event: { name: string; charIndex: number; charLength: number }) => void
  constructor(readonly text: string) {}
}

const engineWith = (fake: ReturnType<typeof fakeSynth>) =>
  createBrowserSpeechEngine(fake.synth, FakeUtterance as unknown as typeof SpeechSynthesisUtterance)

const options = { voiceId: null, rate: 1.2, pitch: 0.9 }

describe('browser speech engine', () => {
  it('speaks sentence by sentence and reports positions in the full text', () => {
    const fake = fakeSynth()
    const engine = engineWith(fake)
    const chunks: TextRange[] = []
    const words: TextRange[] = []
    const onEnd = vi.fn()

    const text = 'Hello there. Good morning class.'
    engine.speak(text, options, { onChunk: r => chunks.push(r), onWord: r => words.push(r), onEnd })

    // Only one utterance at a time; the next starts when the previous ends.
    expect(fake.queue).toHaveLength(1)
    const first = fake.playNext(6)
    expect(first).toMatchObject({ text: 'Hello there.', rate: 1.2, pitch: 0.9 })
    fake.playNext(5) // "morning", relative to the second sentence

    expect(chunks).toEqual([
      { start: 0, end: 12 },
      { start: 13, end: 32 },
    ])
    expect(words.map(w => text.slice(w.start, w.end))).toEqual(['there.', 'morning'])
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('done', undefined)
  })

  it('uses the chosen voice and its language', () => {
    const voice = {
      voiceURI: 'v-fr',
      name: 'Amélie',
      lang: 'fr-FR',
      default: false,
      localService: true,
    }
    const fake = fakeSynth([voice])
    engineWith(fake).speak('Bonjour.', { ...options, voiceId: 'v-fr' })
    expect(fake.queue[0]).toMatchObject({ voice, lang: 'fr-FR' })
  })

  it('stopping ends the speech once, as stopped, and speaks nothing more', () => {
    const fake = fakeSynth()
    const engine = engineWith(fake)
    const onEnd = vi.fn<(reason: SpeechEndReason) => void>()
    engine.speak('One. Two. Three.', options, { onEnd })
    engine.stop()
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('stopped', undefined)
    expect(fake.queue).toHaveLength(0)
  })

  it('a new speak() ends the previous one (one voice at a time)', () => {
    const fake = fakeSynth()
    const engine = engineWith(fake)
    const firstEnd = vi.fn()
    engine.speak('First text.', options, { onEnd: firstEnd })
    engine.speak('Second text.', options)
    expect(firstEnd).toHaveBeenCalledWith('stopped', undefined)
    expect(fake.queue.map(u => u.text)).toEqual(['Second text.'])
  })

  it('reports real errors, but not its own interruptions', () => {
    const fake = fakeSynth()
    const onEnd = vi.fn()
    engineWith(fake).speak('Hi.', options, { onEnd })
    fake.queue[0]!.onerror?.({ error: 'synthesis-failed' })
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('error', 'synthesis-failed')
  })

  it('says so when the browser has no speech support', () => {
    const engine = createBrowserSpeechEngine(undefined, undefined)
    const onEnd = vi.fn()
    engine.speak('Hi.', options, { onEnd })
    expect(engine.supported).toBe(false)
    expect(onEnd).toHaveBeenCalledWith('error', expect.stringContaining('not supported'))
  })
})

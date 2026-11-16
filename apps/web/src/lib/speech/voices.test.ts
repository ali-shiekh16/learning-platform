import { describe, expect, it } from 'vitest'
import type { Voice } from './engine'
import { groupVoicesByLanguage, pickVoice, voiceQuality } from './voices'

const voice = (id: string, lang: string, extra: Partial<Voice> = {}): Voice => ({
  id,
  name: id,
  lang,
  isDefault: false,
  online: false,
  ...extra,
})

const VOICES = [
  voice('us-online', 'en-US', { online: true }),
  voice('us-local', 'en-US'),
  voice('gb', 'en-GB'),
  voice('fr', 'fr-FR', { isDefault: true }),
  voice('de', 'de-DE'),
]

describe('pickVoice', () => {
  it('keeps the saved choice when this browser has it', () => {
    expect(pickVoice(VOICES, 'de', 'en-US')?.id).toBe('de')
  })

  it('otherwise picks the best-sounding voice in the browser language', () => {
    expect(pickVoice(VOICES, null, 'en-US')?.id).toBe('us-online')
    expect(pickVoice(VOICES, 'gone', 'en-GB')?.id).toBe('gb')
  })

  it('prefers neural voices over robotic desktop ones', () => {
    const windows = [
      voice('Microsoft Hazel - English (United Kingdom)', 'en-GB', { isDefault: true }),
      voice('Google UK English Female', 'en-GB', { online: true }),
      voice('Microsoft Libby Online (Natural) - English (United Kingdom)', 'en-GB', {
        online: true,
      }),
    ]
    expect(pickVoice(windows, null, 'en-GB')?.name).toContain('Natural')
    expect(windows.map(voiceQuality)).toEqual([1, 2, 3])
  })

  it('falls back to the same language in another region, then the best of all', () => {
    expect(pickVoice(VOICES, null, 'en-AU')?.id).toBe('us-online')
    expect(pickVoice(VOICES, null, 'ja-JP')?.id).toBe('us-online')
  })

  it('returns null when there are no voices', () => {
    expect(pickVoice([], 'x', 'en-US')).toBeNull()
  })
})

describe('groupVoicesByLanguage', () => {
  it('groups by language name, with the browser language first', () => {
    const groups = groupVoicesByLanguage(VOICES, 'fr-FR')
    expect(groups[0]).toMatchObject({ language: 'français', voices: [{ id: 'fr' }] })
    expect(groups.map(g => g.voices.length)).toEqual([1, 1, 3])
  })

  it('copes with odd language tags', () => {
    const groups = groupVoicesByLanguage([voice('odd', '')], 'en-US')
    expect(groups).toHaveLength(1)
  })
})

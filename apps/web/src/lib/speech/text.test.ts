import { describe, expect, it } from 'vitest'
import { MAX_CHUNK_LENGTH, splitIntoChunks, wordAt } from './text'

describe('splitIntoChunks', () => {
  it('splits sentences and keeps their position in the full text', () => {
    const text = 'Hello there.  How are you? Fine!'
    const chunks = splitIntoChunks(text, 'en')
    expect(chunks.map(c => c.text)).toEqual(['Hello there.', 'How are you?', 'Fine!'])
    for (const chunk of chunks)
      expect(text.slice(chunk.start, chunk.start + chunk.text.length)).toBe(chunk.text)
  })

  it('does not split after common abbreviations', () => {
    const chunks = splitIntoChunks('Dr. Smith arrived at 10 a.m. today. Then he left.', 'en')
    expect(chunks.map(c => c.text)).toEqual([
      'Dr. Smith arrived at 10 a.m. today.',
      'Then he left.',
    ])
  })

  it('splits sentences that are too long to speak in one go', () => {
    const sentence = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ') + '.'
    const chunks = splitIntoChunks(sentence, 'en')
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH)
      expect(sentence.slice(chunk.start, chunk.start + chunk.text.length)).toBe(chunk.text)
    }
    // Nothing is lost: the chunks cover every word.
    expect(chunks.map(c => c.text).join(' ')).toBe(sentence)
  })

  it('prefers to cut long sentences at a comma', () => {
    const first = 'a'.repeat(120) + ', '
    const chunks = splitIntoChunks(first + 'b '.repeat(60) + 'end.', 'en')
    expect(chunks[0]!.text).toBe('a'.repeat(120) + ',')
  })

  it('ignores empty text and whitespace', () => {
    expect(splitIntoChunks('   \n  ', 'en')).toEqual([])
  })
})

describe('wordAt', () => {
  it('finds the word starting at a position', () => {
    const text = 'The quick fox'
    expect(wordAt(text, 4)).toEqual({ start: 4, end: 9 })
    expect(wordAt(text, 10)).toEqual({ start: 10, end: 13 })
  })

  it('always covers at least one character', () => {
    expect(wordAt('a b', 1)).toEqual({ start: 1, end: 2 })
  })
})

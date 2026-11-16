/**
 * Text helpers for speech. Pure functions, unit-tested.
 *
 * Speech is spoken one chunk at a time: Chrome silently stops a single utterance after
 * about 15 seconds, so long texts must be split. Chunks are whole sentences where
 * possible, and long sentences are split further at commas or spaces.
 */

export interface TextChunk {
  text: string
  /** Where the chunk starts in the full text, so positions can be mapped back. */
  start: number
}

/** Roughly 10–15 seconds of speech at normal speed. */
export const MAX_CHUNK_LENGTH = 200

// Intl.Segmenter ends a sentence after any "word." — so "Dr. Smith" would become two.
const ABBREVIATION = /\b(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|Mt|vs|etc|e\.g|i\.e|No|Fig)\.\s*$/i

/**
 * Sentences, using the browser's own sentence rules (`Intl.Segmenter`, which knows many
 * languages' punctuation), then rejoining sentences wrongly cut after an abbreviation.
 * Whitespace between sentences is dropped; `start` still points into the original text.
 */
export function splitIntoChunks(text: string, locale?: string): TextChunk[] {
  const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' })
  const sentences: TextChunk[] = []
  for (const { segment, index } of segmenter.segment(text)) {
    const previous = sentences.at(-1)
    if (previous && ABBREVIATION.test(previous.text)) previous.text += segment
    else sentences.push({ text: segment, start: index })
  }

  const chunks: TextChunk[] = []
  for (const sentence of sentences) {
    for (const part of splitLong(sentence.text, sentence.start)) {
      const leading = part.text.length - part.text.trimStart().length
      const trimmed = part.text.trim()
      if (trimmed) chunks.push({ text: trimmed, start: part.start + leading })
    }
  }
  return chunks
}

/** Splits text longer than MAX_CHUNK_LENGTH, preferring a comma, then a space. */
function splitLong(text: string, start: number): TextChunk[] {
  const parts: TextChunk[] = []
  let rest = text
  let offset = start
  while (rest.length > MAX_CHUNK_LENGTH) {
    const window = rest.slice(0, MAX_CHUNK_LENGTH)
    const comma = window.lastIndexOf(', ')
    const space = window.lastIndexOf(' ')
    // Cut after the comma or space; with neither (one huge word), cut hard.
    const cut = comma > MAX_CHUNK_LENGTH / 2 ? comma + 2 : space > 0 ? space + 1 : MAX_CHUNK_LENGTH
    parts.push({ text: rest.slice(0, cut), start: offset })
    rest = rest.slice(cut)
    offset += cut
  }
  parts.push({ text: rest, start: offset })
  return parts
}

/**
 * The word around `index` in `text`, as [start, end). Speech `boundary` events give the
 * start of the word being spoken, but not always its length.
 */
export function wordAt(text: string, index: number): { start: number; end: number } {
  let end = index
  while (end < text.length && !/\s/.test(text[end]!)) end++
  return { start: index, end: Math.max(end, index + 1) }
}

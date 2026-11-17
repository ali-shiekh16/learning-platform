import { useId, useState, type ReactNode } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TTS_MAX_LENGTH, useSpeech, type TextRange } from '@/hooks/use-speech'
import { cn } from '@/lib/utils'

const fieldClass =
  'rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/70 focus-visible:outline-none disabled:opacity-60'

/**
 * The text-to-speech tool: text box, voice, speed and pitch, Play / Pause / Resume /
 * Stop, and a read-along view highlighting the sentence and word being spoken.
 * `compact` is the narrower layout for the meeting sidebar.
 */
export function TtsPanel({ compact = false }: { compact?: boolean }) {
  const speech = useSpeech()
  const [text, setText] = useState('')
  const ids = useId()

  if (!speech.supported) {
    return (
      <p className="text-sm text-muted-foreground">
        This browser can’t read text aloud. Try a recent version of Chrome, Edge, Safari or Firefox.
      </p>
    )
  }

  const speakingThis = speech.state !== 'idle' && speech.speakingText === text
  const nearLimit = text.length > TTS_MAX_LENGTH * 0.9

  return (
    <div className={cn('grid gap-4', compact && 'gap-3')}>
      <div className="grid gap-1.5">
        <label htmlFor={`${ids}-text`} className="text-sm font-medium">
          Text
        </label>
        {speakingThis ? (
          // While speaking, show the text read-along style instead of the text box.
          <div
            className={cn(
              'overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-wrap',
              compact ? 'max-h-48' : 'max-h-80 min-h-40',
            )}
            aria-live="off"
          >
            <Highlighted text={text} chunk={speech.chunk} word={speech.word} />
          </div>
        ) : (
          <textarea
            id={`${ids}-text`}
            value={text}
            onChange={event => setText(event.target.value)}
            maxLength={TTS_MAX_LENGTH}
            rows={compact ? 5 : 8}
            placeholder="Type or paste text to read aloud…"
            className={cn(fieldClass, 'resize-y py-2 leading-relaxed')}
          />
        )}
        <p
          className={cn(
            'justify-self-end text-xs text-muted-foreground tabular-nums',
            nearLimit && 'text-destructive',
          )}
        >
          {text.length.toLocaleString()}/{TTS_MAX_LENGTH.toLocaleString()}
        </p>
      </div>

      <div className={cn('grid gap-3', !compact && 'sm:grid-cols-3')}>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${ids}-voice`} className="text-sm font-medium">
            Voice
          </label>
          <select
            id={`${ids}-voice`}
            className={cn(fieldClass, 'h-9 w-full min-w-0 truncate')}
            value={speech.voice?.id ?? ''}
            onChange={event => speech.setVoiceId(event.target.value)}
            disabled={speech.voicesStatus !== 'ready'}
          >
            {speech.voicesStatus === 'loading' && <option value="">Loading voices…</option>}
            {speech.voicesStatus === 'none' && <option value="">Browser default</option>}
            {speech.voiceGroups.map(group => (
              <optgroup key={group.language} label={group.language}>
                {group.voices.map(voice => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                    {voice.isDefault ? ' (default)' : ''}
                    {voice.online ? ' · online' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {speech.voicesStatus === 'none' && (
            <p className="text-xs text-muted-foreground">
              This device offers no voice choices; the browser’s default voice is used.
            </p>
          )}
        </div>
        <Slider
          label="Speed"
          value={speech.rate}
          min={0.5}
          max={2}
          onChange={speech.setRate}
          display={`${speech.rate.toFixed(1)}×`}
        />
        <Slider
          label="Pitch"
          value={speech.pitch}
          min={0}
          max={2}
          onChange={speech.setPitch}
          display={speech.pitch.toFixed(1)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {speech.state === 'idle' || !speakingThis ? (
          <Button onClick={() => speech.speak(text)} disabled={!text.trim()}>
            <Play /> Play
          </Button>
        ) : speech.state === 'speaking' ? (
          <Button variant="secondary" onClick={speech.pause}>
            <Pause /> Pause
          </Button>
        ) : (
          <Button onClick={speech.resume}>
            <Play /> Resume
          </Button>
        )}
        <Button variant="outline" onClick={speech.stop} disabled={!speakingThis}>
          <Square /> Stop
        </Button>
      </div>

      {speech.error && (
        <p role="alert" className="text-sm text-destructive">
          Couldn’t read the text aloud ({speech.error}).
        </p>
      )}
    </div>
  )
}

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  display: string
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="flex justify-between text-sm font-medium">
        {props.label}
        <span className="font-normal text-muted-foreground tabular-nums">{props.display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={0.1}
        value={props.value}
        onChange={event => props.onChange(Number(event.target.value))}
        className="h-9 accent-primary"
      />
    </div>
  )
}

/** The text with the current sentence shaded and the current word marked. */
function Highlighted({
  text,
  chunk,
  word,
}: {
  text: string
  chunk: TextRange | null
  word: TextRange | null
}) {
  if (!chunk) return <>{text}</>
  const parts: ReactNode[] = [text.slice(0, chunk.start)]
  const inChunk = word && word.start >= chunk.start && word.end <= chunk.end
  parts.push(
    <span key="chunk" className="rounded-sm bg-primary/10">
      {inChunk ? (
        <>
          {text.slice(chunk.start, word.start)}
          <mark className="rounded-sm bg-highlight text-highlight-foreground">
            {text.slice(word.start, word.end)}
          </mark>
          {text.slice(word.end, chunk.end)}
        </>
      ) : (
        text.slice(chunk.start, chunk.end)
      )}
    </span>,
  )
  parts.push(text.slice(chunk.end))
  return <>{parts}</>
}

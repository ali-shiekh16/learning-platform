import { useEffect, useRef, type ReactNode } from 'react'
import {
  CarouselLayout,
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from '@livekit/components-react'
import { Track } from 'livekit-client'

const CONTROL_LABELS: Record<string, string> = {
  microphone: 'Microphone',
  camera: 'Camera',
  screen_share: 'Share screen',
}

/**
 * Video tiles plus microphone, camera and screen-share controls, from LiveKit's React
 * components. Must be rendered inside <LiveKitRoom>, which provides the room.
 *
 * With `board`, the board takes the main area and everyone's video moves to a strip
 * beside it, so participants stay visible. The stage stays mounted either way, which
 * keeps audio playing and the controls available.
 */
export function VideoStage({ board }: { board?: ReactNode }) {
  // Everyone gets a tile (a placeholder when their camera is off); screen shares get
  // their own tile while active.
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  // LiveKit's minimal control bar has icon-only buttons with no accessible names; name them.
  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    for (const toggle of stageRef.current?.querySelectorAll('.lk-control-bar [data-lk-source]') ??
      []) {
      const label = CONTROL_LABELS[toggle.getAttribute('data-lk-source') ?? '']
      if (!label) continue
      toggle.setAttribute('aria-label', label)
      // The device picker sits next to its toggle in the same button group.
      toggle
        .closest('.lk-button-group')
        ?.querySelector('.lk-button-menu')
        ?.setAttribute('aria-label', `Choose ${label.toLowerCase()}`)
    }
  })

  return (
    <div ref={stageRef} className="flex h-full min-h-0 flex-col">
      {board ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 sm:flex-row">
          <div className="min-h-0 min-w-0 flex-1">{board}</div>
          {/* Orientation follows the container: a row on phones, a column beside the board.
              A className replaces LiveKit's own, so `lk-carousel` must be kept. */}
          <CarouselLayout tracks={tracks} className="lk-carousel h-28 shrink-0 sm:h-auto sm:w-44">
            <ParticipantTile />
          </CarouselLayout>
        </div>
      ) : (
        <GridLayout tracks={tracks} className="min-h-0 flex-1">
          <ParticipantTile />
        </GridLayout>
      )}
      <ControlBar
        variation="minimal"
        controls={{
          microphone: true,
          camera: true,
          screenShare: true,
          chat: false,
          leave: false,
          settings: false,
        }}
      />
      {/* Plays everyone's audio; without it remote participants are silent. */}
      <RoomAudioRenderer />
    </div>
  )
}

import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from '@livekit/components-react'
import { Track } from 'livekit-client'

/**
 * Video grid plus microphone, camera and screen-share controls, from LiveKit's React
 * components. Must be rendered inside <LiveKitRoom>, which provides the room.
 */
export function VideoStage() {
  // Everyone gets a tile (a placeholder when their camera is off); screen shares get
  // their own tile while active.
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GridLayout tracks={tracks} className="min-h-0 flex-1">
        <ParticipantTile />
      </GridLayout>
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

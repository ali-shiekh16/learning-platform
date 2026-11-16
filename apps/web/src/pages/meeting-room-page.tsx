import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { LiveKitRoom } from '@livekit/components-react'
import '@livekit/components-styles'
import { DisconnectReason } from 'livekit-client'
import { Copy, LogOut, PenLine, PhoneOff, Video } from 'lucide-react'
import { toast } from 'sonner'
import type { Meeting, PublicUser } from '@app/shared'
import { FullPageMessage, FullPageSpinner } from '@/components/full-page'
import { ChatPanel } from '@/components/meeting-room/chat-panel'
import { ParticipantsPanel } from '@/components/meeting-room/participants-panel'
import { TtsPanel } from '@/components/tts/tts-panel'
import { VideoStage } from '@/components/meeting-room/video-stage'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentUser } from '@/hooks/use-auth'
import { useEndMeeting, useMeetingRoom, useMeetingSession } from '@/hooks/use-meetings'

// Excalidraw is large: download the board only when someone first opens it.
const WhiteboardPanel = lazy(() => import('@/components/meeting-room/whiteboard-panel'))

export function MeetingRoomPage() {
  const { id = '' } = useParams()
  const { user } = useCurrentUser()
  const session = useMeetingSession(id)

  if (!user) return null
  if (session.isPending) return <FullPageSpinner />
  if (session.error)
    return <FullPageMessage title="Can't join this meeting" description={session.error.message} />

  return <MeetingRoom user={user} meeting={session.data.meeting} livekit={session.data.livekit} />
}

function MeetingRoom({
  user,
  meeting,
  livekit,
}: {
  user: PublicUser
  meeting: Meeting
  livekit: { token: string; serverUrl: string }
}) {
  const navigate = useNavigate()
  const endMeeting = useEndMeeting(meeting.id)
  const isOwner = meeting.teacher.id === user.id
  const [tab, setTab] = useState('chat')
  const [stage, setStage] = useState<'video' | 'board'>('video')

  // The socket event and LiveKit's own disconnect can both report the same thing;
  // only act on the first.
  const leaving = useRef(false)
  const leave = useCallback(
    (message?: string) => {
      if (leaving.current) return
      leaving.current = true
      if (message) toast.info(message)
      void navigate('/meetings', { replace: true })
    },
    [navigate],
  )

  useMeetingRoom(meeting.id, user.id, {
    onEnded: () => leave(isOwner ? undefined : 'The teacher ended the meeting.'),
    onRemoved: () => leave('You were removed from the meeting.'),
  })

  const onLiveKitDisconnected = (reason?: DisconnectReason) => {
    if (reason === DisconnectReason.ROOM_DELETED) leave('The meeting has ended.')
    else if (reason === DisconnectReason.PARTICIPANT_REMOVED)
      leave('You were removed from the meeting.')
  }

  const onEnd = () => {
    if (!window.confirm('End the meeting for everyone?')) return
    endMeeting.mutate(undefined, {
      onSuccess: () => leave('Meeting ended.'),
      onError: error => toast.error(error.message),
    })
  }

  const copyCode = () =>
    void navigator.clipboard
      .writeText(meeting.joinCode)
      .then(() => toast.success('Join code copied'))
      .catch(() => toast.error('Could not copy the code'))

  return (
    <div className="grid gap-3">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{meeting.title}</h1>
          <p className="text-sm text-muted-foreground">with {meeting.teacher.name}</p>
        </div>
        <Tabs value={stage} onValueChange={value => setStage(value as 'video' | 'board')}>
          <TabsList>
            <TabsTrigger value="video">
              <Video /> Video
            </TabsTrigger>
            <TabsTrigger value="board">
              <PenLine /> Whiteboard
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={copyCode} aria-label="Copy join code">
          <span className="font-mono tracking-widest">{meeting.joinCode}</span>
          <Copy />
        </Button>
        <Button variant="outline" size="sm" onClick={() => leave()}>
          <LogOut /> Leave
        </Button>
        {isOwner && (
          <Button variant="destructive" size="sm" onClick={onEnd} disabled={endMeeting.isPending}>
            <PhoneOff /> End meeting
          </Button>
        )}
      </header>

      <LiveKitRoom
        serverUrl={livekit.serverUrl}
        token={livekit.token}
        connect
        // Camera and microphone start off: nobody is broadcast before choosing to,
        // and the browser only asks for permission when they click.
        audio={false}
        video={false}
        onDisconnected={onLiveKitDisconnected}
        onError={error => toast.error(`Video connection problem: ${error.message}`)}
        onMediaDeviceFailure={() => toast.error('Could not access your camera or microphone.')}
        data-lk-theme="default"
        // `!`: LiveKit's .lk-room-container sets height: 100% and loads after Tailwind.
        className="grid h-[calc(100svh-11rem)]! min-h-[480px] gap-3 lg:grid-cols-[1fr_340px]"
      >
        <div className="min-h-0 overflow-hidden rounded-lg">
          <VideoStage
            board={
              stage === 'board' && (
                <Suspense fallback={<FullPageSpinner />}>
                  <WhiteboardPanel meetingId={meeting.id} isTeacher={isOwner} />
                </Suspense>
              )
            }
          />
        </div>

        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background text-foreground"
        >
          <TabsList className="m-2 grid grid-cols-3">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="tts">TTS</TabsTrigger>
          </TabsList>
          {/* forceMount keeps the chat mounted (and its socket listener alive) on the other tab. */}
          <TabsContent
            value="chat"
            forceMount
            className="min-h-0 flex-1 data-[state=inactive]:hidden"
          >
            <ChatPanel meetingId={meeting.id} currentUserId={user.id} />
          </TabsContent>
          <TabsContent value="participants" className="min-h-0 flex-1 overflow-y-auto p-2">
            <ParticipantsPanel meetingId={meeting.id} canModerate={isOwner} />
          </TabsContent>
          {/* Also kept mounted, so switching tabs doesn't cut off text being read aloud. */}
          <TabsContent
            value="tts"
            forceMount
            className="min-h-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden"
          >
            <TtsPanel compact />
          </TabsContent>
        </Tabs>
      </LiveKitRoom>
    </div>
  )
}

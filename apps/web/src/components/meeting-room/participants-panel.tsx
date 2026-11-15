import { useParticipants } from '@livekit/components-react'
import type { Participant } from 'livekit-client'
import { Mic, MicOff, UserMinus, Video, VideoOff } from 'lucide-react'
import { toast } from 'sonner'
import { participantAttributesSchema } from '@app/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMuteParticipant, useRemoveParticipant } from '@/hooks/use-meetings'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

/** Role comes from the attributes our server put in the participant's LiveKit token. */
const roleOf = (participant: Participant) =>
  participantAttributesSchema.safeParse(participant.attributes).data?.role

/**
 * Who is in the call, live from LiveKit (it already tracks connections and
 * microphone/camera state). Teachers get mute and remove actions.
 */
export function ParticipantsPanel({
  meetingId,
  canModerate,
}: {
  meetingId: string
  canModerate: boolean
}) {
  const participants = useParticipants()
  const mute = useMuteParticipant(meetingId)
  const remove = useRemoveParticipant(meetingId)

  const onMute = (participant: Participant) =>
    mute.mutate(participant.identity, {
      onSuccess: () => toast.success(`Muted ${participant.name}`),
      onError: error => toast.error(error.message),
    })

  const onRemove = (participant: Participant) => {
    if (
      !window.confirm(
        `Remove ${participant.name} from the meeting? They will not be able to rejoin.`,
      )
    )
      return
    remove.mutate(participant.identity, {
      onSuccess: () => toast.success(`Removed ${participant.name}`),
      onError: error => toast.error(error.message),
    })
  }

  return (
    <ul className="grid gap-1" aria-label={`${participants.length} participants`}>
      {participants.map(participant => {
        const role = roleOf(participant)
        const name = participant.name || 'Unknown'
        return (
          <li
            key={participant.identity}
            className="flex items-center gap-3 rounded-md p-2 hover:bg-muted"
          >
            <Avatar className="size-8">
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {name}
                {participant.isLocal && <span className="text-muted-foreground"> (you)</span>}
              </p>
              {role && (
                <Badge variant={role === 'TEACHER' ? 'default' : 'secondary'} className="mt-0.5">
                  {role === 'TEACHER' ? 'Teacher' : 'Student'}
                </Badge>
              )}
            </div>
            <span className="flex items-center gap-1 text-muted-foreground">
              {participant.isMicrophoneEnabled ? (
                <Mic className="size-4" aria-label="Microphone on" />
              ) : (
                <MicOff className="size-4" aria-label="Microphone off" />
              )}
              {participant.isCameraEnabled ? (
                <Video className="size-4" aria-label="Camera on" />
              ) : (
                <VideoOff className="size-4" aria-label="Camera off" />
              )}
            </span>
            {canModerate && !participant.isLocal && (
              <span className="flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Mute ${name}`}
                      disabled={!participant.isMicrophoneEnabled || mute.isPending}
                      onClick={() => onMute(participant)}
                    >
                      <MicOff />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mute</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${name}`}
                      disabled={remove.isPending}
                      onClick={() => onRemove(participant)}
                    >
                      <UserMinus />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove from meeting</TooltipContent>
                </Tooltip>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

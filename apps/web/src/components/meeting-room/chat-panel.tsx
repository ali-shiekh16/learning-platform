import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { CHAT_MESSAGE_MAX_LENGTH, type ChatMessage } from '@app/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChat } from '@/hooks/use-chat'
import { cn } from '@/lib/utils'

const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

export function ChatPanel({
  meetingId,
  currentUserId,
}: {
  meetingId: string
  currentUserId: string
}) {
  const chat = useChat(meetingId)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  // Follow new messages only if the user is already at the bottom; don't yank them
  // away while they scroll back through history.
  const onScroll = () => {
    const list = listRef.current
    if (list) stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40
  }
  useLayoutEffect(() => {
    const list = listRef.current
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight
  }, [chat.messages.length])

  useEffect(() => {
    if (chat.error) toast.error(`Could not load chat: ${chat.error.message}`)
  }, [chat.error])

  const body = draft.trim()
  const tooLong = draft.length > CHAT_MESSAGE_MAX_LENGTH

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!body || tooLong) return
    stickToBottom.current = true
    chat.send.mutate(body, {
      onSuccess: () => setDraft(''),
      onError: error => toast.error(error.message),
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={listRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {chat.hasEarlier && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={chat.isLoadingEarlier}
            onClick={chat.loadEarlier}
          >
            {chat.isLoadingEarlier ? 'Loading…' : 'Load earlier messages'}
          </Button>
        )}
        {!chat.isLoading && chat.messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>
        )}
        {chat.messages.map(message => (
          <MessageItem
            key={message.id}
            message={message}
            own={message.sender.id === currentUserId}
          />
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex items-start gap-2 border-t p-3">
        <div className="flex-1">
          <Input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder="Write a message…"
            aria-label="Message"
            aria-invalid={tooLong || undefined}
            autoComplete="off"
          />
          {draft.length > CHAT_MESSAGE_MAX_LENGTH - 100 && (
            <p
              className={cn('mt-1 text-xs', tooLong ? 'text-destructive' : 'text-muted-foreground')}
            >
              {draft.length}/{CHAT_MESSAGE_MAX_LENGTH}
            </p>
          )}
        </div>
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          disabled={!body || tooLong || chat.send.isPending}
        >
          <SendHorizontal />
        </Button>
      </form>
    </div>
  )
}

function MessageItem({ message, own }: { message: ChatMessage; own: boolean }) {
  return (
    <div className={cn('flex flex-col gap-0.5', own && 'items-end')}>
      <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{own ? 'You' : message.sender.name}</span>
        {message.sender.role === 'TEACHER' && (
          <Badge variant="outline" className="h-4 px-1 text-[10px]">
            Teacher
          </Badge>
        )}
        <time dateTime={message.createdAt}>{time.format(new Date(message.createdAt))}</time>
      </div>
      <p
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap',
          own ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {message.body}
      </p>
    </div>
  )
}

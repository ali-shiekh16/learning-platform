import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { Eraser, Lock, LockOpen } from 'lucide-react'
import { toast } from 'sonner'
import { FullPageSpinner } from '@/components/full-page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useWhiteboard } from '@/hooks/use-whiteboard'

/**
 * The meeting's shared board. This module (and Excalidraw with it) is lazy-loaded by
 * the room page, so it only downloads when someone opens the whiteboard.
 */
export default function WhiteboardPanel({
  meetingId,
  isTeacher,
}: {
  meetingId: string
  isTeacher: boolean
}) {
  const board = useWhiteboard(meetingId, isTeacher)

  if (board.isLoading) return <FullPageSpinner />
  if (board.error || !board.board)
    return <p className="p-4 text-destructive">Could not load the board: {board.error?.message}</p>

  const toggleLock = () =>
    board.setLocked.mutate(!board.locked, {
      onSuccess: () => toast.success(board.locked ? 'Board unlocked for students' : 'Board locked'),
      onError: error => toast.error(error.message),
    })

  const clearBoard = () => {
    if (!window.confirm('Clear the board for everyone?')) return
    board.clear.mutate(undefined, { onError: error => toast.error(error.message) })
  }

  return (
    // text-foreground: LiveKit's dark theme makes all text inside the room white.
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg bg-card text-card-foreground">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
        <Badge variant={board.locked ? 'secondary' : 'default'}>
          {board.locked ? <Lock /> : <LockOpen />}
          {board.locked ? 'Locked' : 'Open to everyone'}
        </Badge>
        {board.readOnly && (
          <span className="text-muted-foreground">
            The teacher will unlock the board for drawing.
          </span>
        )}
        {isTeacher && (
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleLock}
              disabled={board.setLocked.isPending}
            >
              {board.locked ? <LockOpen /> : <Lock />}
              {board.locked ? 'Unlock for students' : 'Lock'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearBoard}
              disabled={board.clear.isPending}
            >
              <Eraser /> Clear
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={board.setApi}
          initialData={{
            elements: board.board.elements as unknown as ExcalidrawElement[],
            scrollToContent: true,
          }}
          onChange={board.onChange}
          onPointerUpdate={board.onPointerUpdate}
          viewModeEnabled={board.readOnly}
          isCollaborating
          UIOptions={{
            // Images need file upload and sync, which we don't support yet.
            tools: { image: false },
            canvasActions: {
              // "Reset canvas" would delete everyone's work; teachers use Clear instead.
              clearCanvas: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
            },
          }}
        />
      </div>
    </div>
  )
}

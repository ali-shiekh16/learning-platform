import { whiteboardSchema, type BoardElement, type Whiteboard } from '@app/shared'
import { http } from './http'

/** The meeting's saved board: every element (deleted ones included) and the lock state. */
export async function getWhiteboard(meetingId: string, signal?: AbortSignal): Promise<Whiteboard> {
  const board = whiteboardSchema.parse(
    await http(`/api/meetings/${meetingId}/whiteboard`, { signal }),
  )
  return { locked: board.locked, elements: board.elements as BoardElement[] }
}

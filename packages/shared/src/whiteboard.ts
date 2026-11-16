import { z } from 'zod'

export const MAX_ELEMENTS_PER_UPDATE = 1000
export const MAX_ELEMENTS_PER_BOARD = 5000

export const boardElementSchema = z
  .looseObject({
    id: z.string().min(1).max(100),
    type: z.string().min(1).max(50),
    version: z.number().int().nonnegative(),
    versionNonce: z.number().int(),
    isDeleted: z.boolean(),
  })
  .refine(element => element.type !== 'image', 'Images are not supported on the whiteboard yet')

export type BoardElement = z.infer<typeof boardElementSchema>

export const boardUpdateSchema = z.object({
  meetingId: z.string().min(1),
  elements: z.array(boardElementSchema).min(1).max(MAX_ELEMENTS_PER_UPDATE),
})
export type BoardUpdateInput = z.infer<typeof boardUpdateSchema>

export const boardPointerSchema = z.object({
  meetingId: z.string().min(1),
  x: z.number(),
  y: z.number(),
})
export type BoardPointerInput = z.infer<typeof boardPointerSchema>

export const boardLockSchema = z.object({ meetingId: z.string().min(1), locked: z.boolean() })
export const boardClearSchema = z.object({ meetingId: z.string().min(1) })

/** The saved board, sent to whoever opens it. */
export const whiteboardSchema = z.object({
  elements: z.array(z.looseObject({ id: z.string() })),
  locked: z.boolean(),
})
export type Whiteboard = { elements: BoardElement[]; locked: boolean }

/**
 * Which of two copies of the same element to keep. Everyone applies the same rule, so all
 * boards end up identical: the higher version wins; on a tie, the lower versionNonce
 * (a random number Excalidraw sets on every change) wins.
 */
export function isNewerElement(candidate: BoardElement, current: BoardElement | undefined) {
  if (!current) return true
  if (candidate.version !== current.version) return candidate.version > current.version
  return candidate.versionNonce < current.versionNonce
}

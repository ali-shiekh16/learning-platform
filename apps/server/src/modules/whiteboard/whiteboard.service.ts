import { randomInt } from 'node:crypto'
import type { FastifyBaseLogger } from 'fastify'
import {
  boardElementSchema,
  isNewerElement,
  MAX_ELEMENTS_PER_BOARD,
  type BoardElement,
  type PublicUser,
  type Whiteboard,
} from '@app/shared'
import type { prisma as prismaClient } from '../../db/prisma'
import type { Prisma } from '../../generated/prisma/client'
import { conflict, forbidden, notFound } from '../../lib/errors'
import type { MeetingsService } from '../meetings/meetings.service'

interface Deps {
  prisma: typeof prismaClient
  meetings: MeetingsService
  log: FastifyBaseLogger
  flushIntervalMs?: number // How often changed boards are written to the database.
}

interface Board {
  teacherId: string
  elements: Map<string, BoardElement>
  locked: boolean
  dirty: boolean // Changed since it was last saved.
  lastUsed: number
}

// Boards nobody has used for this long are dropped from memory (after being saved).
const IDLE_EVICTION_MS = 10 * 60 * 1000

export type WhiteboardService = ReturnType<typeof createWhiteboardService>

/**
 * Live boards are kept in memory while in use: every stroke would otherwise be a
 * database write. Changes are saved in the background every couple of seconds and
 * when the server shuts down.
 */
export function createWhiteboardService({ prisma, meetings, log, flushIntervalMs = 2000 }: Deps) {
  const boards = new Map<string, Board>()
  const loading = new Map<string, Promise<Board>>()

  async function load(meetingId: string): Promise<Board> {
    const cached = boards.get(meetingId)
    if (cached) {
      cached.lastUsed = Date.now()
      return cached
    }
    let pending = loading.get(meetingId)
    if (!pending) {
      pending = readBoard(meetingId).finally(() => loading.delete(meetingId))
      loading.set(meetingId, pending)
    }
    return pending
  }

  async function readBoard(meetingId: string): Promise<Board> {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { teacherId: true, whiteboard: true },
    })
    if (!meeting) throw notFound('Meeting')

    const elements = new Map<string, BoardElement>()
    for (const raw of (meeting.whiteboard?.elements ?? []) as unknown[]) {
      const parsed = boardElementSchema.safeParse(raw)
      if (parsed.success) elements.set(parsed.data.id, parsed.data)
    }
    const board: Board = {
      teacherId: meeting.teacherId,
      elements,
      locked: meeting.whiteboard?.locked ?? true, // boards start locked
      dirty: false,
      lastUsed: Date.now(),
    }
    boards.set(meetingId, board)
    return board
  }

  // Only one save runs at a time. Otherwise a slow save could finish after a newer one
  // and leave an older snapshot in the database.
  let saving: Promise<void> | undefined

  function flush() {
    saving ??= saveDirtyBoards().finally(() => (saving = undefined))
    return saving
  }

  async function saveDirtyBoards() {
    for (const [meetingId, board] of boards) {
      if (board.dirty) {
        // Cleared before writing: changes arriving during the write mark it dirty again.
        board.dirty = false
        const data = {
          elements: [...board.elements.values()] as unknown as Prisma.InputJsonValue,
          locked: board.locked,
        }
        try {
          await prisma.whiteboard.upsert({
            where: { meetingId },
            create: { meetingId, ...data },
            update: data,
          })
        } catch (err) {
          board.dirty = true
          log.error({ err, meetingId }, 'Failed to save whiteboard')
        }
      } else if (Date.now() - board.lastUsed > IDLE_EVICTION_MS) boards.delete(meetingId)
    }
  }

  const timer = setInterval(() => void flush(), flushIntervalMs)
  timer.unref() // never keep the process alive just for this

  return {
    async get(user: PublicUser, meetingId: string): Promise<Whiteboard> {
      await meetings.assertCanView(user.id, meetingId)
      const board = await load(meetingId)
      return { elements: [...board.elements.values()], locked: board.locked }
    },

    /**
     * Merges incoming elements and returns the ones that actually changed
     */
    async applyUpdate(user: PublicUser, meetingId: string, incoming: BoardElement[]) {
      const board = await load(meetingId)
      if (board.locked && board.teacherId !== user.id)
        throw forbidden('The teacher has locked the board')

      // Work out the winners first, so an update is applied completely or not at all:
      const winners = new Map<string, BoardElement>()
      for (const element of incoming) {
        const current = winners.get(element.id) ?? board.elements.get(element.id)
        if (isNewerElement(element, current)) winners.set(element.id, element)
      }

      // The cap counts new shapes only, so a full board can still be edited and cleared.
      const added = [...winners.keys()].filter(id => !board.elements.has(id)).length
      if (board.elements.size + added > MAX_ELEMENTS_PER_BOARD) throw conflict('The board is full')

      for (const element of winners.values()) board.elements.set(element.id, element)
      if (winners.size > 0) board.dirty = true
      return [...winners.values()]
    },

    async setLocked(user: PublicUser, meetingId: string, locked: boolean) {
      await meetings.assertOwner(user, meetingId)
      const board = await load(meetingId)
      board.locked = locked
      board.dirty = true
    },

    /** Marks every element deleted (tombstones) and returns them for broadcasting. */
    async clear(user: PublicUser, meetingId: string) {
      await meetings.assertOwner(user, meetingId)
      const board = await load(meetingId)
      const cleared: BoardElement[] = []
      for (const element of board.elements.values()) {
        if (element.isDeleted) continue
        const tombstone = {
          ...element,
          isDeleted: true,
          version: element.version + 1,
          versionNonce: randomInt(2 ** 31),
          updated: Date.now(),
        }
        board.elements.set(element.id, tombstone)
        cleared.push(tombstone)
      }
      if (cleared.length > 0) board.dirty = true
      return cleared
    },

    flush,

    /** Stop the timer and save everything (server shutdown). */
    async close() {
      clearInterval(timer)
      await saving // let a save in progress finish, then save what changed since
      await flush()
    },
  }
}

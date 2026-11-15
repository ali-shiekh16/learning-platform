import { z } from 'zod'
import { roleSchema } from './roles'

export const CHAT_MESSAGE_MAX_LENGTH = 1000

export const sendChatMessageSchema = z.object({
  meetingId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(CHAT_MESSAGE_MAX_LENGTH, `Messages are limited to ${CHAT_MESSAGE_MAX_LENGTH} characters`),
})
export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>

export const chatMessageSchema = z.object({
  id: z.string(),
  meetingId: z.string(),
  body: z.string(),
  createdAt: z.iso.datetime(),
  sender: z.object({ id: z.string(), name: z.string(), role: roleSchema }),
})
export type ChatMessage = z.infer<typeof chatMessageSchema>

export const chatHistoryQuerySchema = z.object({
  /** Return messages older than this message id (for loading earlier pages). */
  before: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

/** A page of history, oldest first. `nextCursor` loads the page before it. */
export const chatHistorySchema = z.object({
  messages: z.array(chatMessageSchema),
  nextCursor: z.string().nullable(),
})
export type ChatHistory = z.infer<typeof chatHistorySchema>

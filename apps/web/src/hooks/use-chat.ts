import { useEffect } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import type { ChatHistory, ChatMessage } from '@app/shared'
import { ApiError } from '@/services/http'
import * as meetingsService from '@/services/meetings.service'
import { queryKeys } from './query-keys'
import { useSocket } from './use-socket'

type ChatCache = InfiniteData<ChatHistory, string | undefined>

/** Adds a message to the newest page of the cached history, ignoring duplicates. */
function appendMessage(cache: ChatCache | undefined, message: ChatMessage): ChatCache | undefined {
  if (!cache) return cache
  const [newest, ...older] = cache.pages
  if (!newest || cache.pages.some(page => page.messages.some(m => m.id === message.id)))
    return cache
  return { ...cache, pages: [{ ...newest, messages: [...newest.messages, message] }, ...older] }
}

/**
 * A meeting's chat. History comes over REST (paged, newest page first); new messages
 * arrive over the socket and are added to the same React Query cache, so there is one
 * source of truth for everything shown.
 */
export function useChat(meetingId: string) {
  const { socket } = useSocket()
  const queryClient = useQueryClient()
  const key = queryKeys.chat(meetingId)

  const history = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) =>
      meetingsService.getChatHistory(meetingId, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    staleTime: Infinity, // kept current by socket events
  })

  useEffect(() => {
    if (!socket) return
    const onMessage = (message: ChatMessage) => {
      if (message.meetingId !== meetingId) return
      queryClient.setQueryData<ChatCache>(queryKeys.chat(meetingId), cache =>
        appendMessage(cache, message),
      )
    }
    // Messages sent while this browser was disconnected are only in the database.
    const onReconnect = () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat(meetingId) })

    socket.on('chat:message', onMessage)
    socket.io.on('reconnect', onReconnect)
    return () => {
      socket.off('chat:message', onMessage)
      socket.io.off('reconnect', onReconnect)
    }
  }, [socket, meetingId, queryClient])

  const send = useMutation({
    mutationFn: async (body: string) => {
      if (!socket?.connected)
        throw new ApiError(0, 'INTERNAL_ERROR', 'Not connected. Your message was not sent.')
      const result = await socket.timeout(5000).emitWithAck('chat:send', { meetingId, body })
      if (!result.ok) throw new ApiError(0, result.error.code, result.error.message)
      return result.data
    },
    // The server confirms with the saved message; show it right away.
    onSuccess: message =>
      queryClient.setQueryData<ChatCache>(key, cache => appendMessage(cache, message)),
  })

  // Pages are newest-first; the UI wants one list, oldest at the top.
  const messages = history.data?.pages.toReversed().flatMap(page => page.messages) ?? []

  return {
    messages,
    isLoading: history.isPending,
    error: history.error,
    hasEarlier: history.hasNextPage,
    loadEarlier: () => void history.fetchNextPage(),
    isLoadingEarlier: history.isFetchingNextPage,
    send,
  }
}

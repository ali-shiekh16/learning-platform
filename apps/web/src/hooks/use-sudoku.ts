import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Difficulty, Game, MoveInput, ReportListQuery } from '@app/shared'
import * as sudokuService from '@/services/sudoku.service'
import { queryKeys } from './query-keys'

/** The student's game in progress (for "Resume"), or null. */
export function useCurrentGame() {
  return useQuery({
    queryKey: queryKeys.currentGame,
    queryFn: ({ signal }) => sudokuService.getCurrentGame(signal),
  })
}

export function useStartGame() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (difficulty: Difficulty) => sudokuService.startGame(difficulty),
    onSuccess: game => {
      queryClient.setQueryData(queryKeys.game(game.id), game)
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentGame })
    },
  })
}

/**
 * One game. The server's answer to each move is the whole updated game, written straight
 * into this cache, so the board, counters and timer all come from the server.
 */
export function useGame(gameId: string) {
  return useQuery({
    queryKey: queryKeys.game(gameId),
    queryFn: ({ signal }) => sudokuService.getGame(gameId, signal),
    retry: false,
  })
}

export function useMove(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (move: MoveInput) => sudokuService.placeValue(gameId, move),
    onSuccess: ({ game }) => onGameChanged(queryClient, game),
  })
}

export function useFinishGame(gameId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => sudokuService.finishGame(gameId),
    onSuccess: game => onGameChanged(queryClient, game),
  })
}

function onGameChanged(queryClient: ReturnType<typeof useQueryClient>, game: Game) {
  queryClient.setQueryData(queryKeys.game(game.id), game)
  // A finished game is a new report and no longer the current game.
  if (game.status !== 'IN_PROGRESS') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.currentGame })
    void queryClient.invalidateQueries({ queryKey: queryKeys.reports })
  }
}

/**
 * Seconds left, ticking every second. Counts down from the server's `secondsLeft` at the
 * moment that value arrived (`receivedAt`), so the player's clock setting doesn't matter.
 */
export function useCountdown(secondsLeft: number, receivedAt: number, running: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])
  if (!running) return secondsLeft
  return Math.max(0, secondsLeft - Math.floor((now - receivedAt) / 1000))
}

// ─── Reports ────────────────────────────────────────────────────────────────

export function useReports(query: ReportListQuery) {
  return useQuery({
    queryKey: queryKeys.reportList(query),
    queryFn: ({ signal }) => sudokuService.listReports(query, signal),
    placeholderData: keepPreviousData, // keep the table while a new filter or sort loads
  })
}

export function useReport(gameId: string) {
  return useQuery({
    queryKey: queryKeys.report(gameId),
    queryFn: ({ signal }) => sudokuService.getReport(gameId, signal),
    retry: false,
  })
}

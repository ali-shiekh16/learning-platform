import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk'
import type { Role } from '@app/shared'

export interface LiveKitGateway {
  readonly serverUrl: string // Public URL the browser connects to (wss://...).
  createToken(input: {
    roomName: string
    identity: string
    name: string
    role: Role
  }): Promise<string>
  muteMicrophone(roomName: string, identity: string): Promise<boolean> // Mutes the participant's microphone. Returns false if they have no microphone track.
  removeParticipant(roomName: string, identity: string): Promise<void> // Disconnects the participant and invalidates tokens issued to them before now.
  deleteRoom(roomName: string): Promise<void>
}

export const roomNameFor = (meetingId: string) => `meeting-${meetingId}`

// Join tokens are only checked when connecting;
const TOKEN_TTL = '10m'

export function createLiveKitGateway(config: {
  url: string
  apiKey: string
  apiSecret: string
}): LiveKitGateway {
  const rooms = new RoomServiceClient(
    // The admin API is plain HTTPS on the same host as the WebSocket URL.
    config.url.replace(/^ws/, 'http'),
    config.apiKey,
    config.apiSecret,
  )

  return {
    serverUrl: config.url,

    async createToken({ roomName, identity, name, role }) {
      const token = new AccessToken(config.apiKey, config.apiSecret, {
        identity,
        name,
        ttl: TOKEN_TTL,
        attributes: { role },
      })
      token.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        // Teachers can moderate the room from their own client as well.
        roomAdmin: role === 'TEACHER',
      })
      return token.toJwt()
    },

    async muteMicrophone(roomName, identity) {
      const participant = await rooms.getParticipant(roomName, identity)
      const microphone = participant.tracks.find(track => track.source === TrackSource.MICROPHONE)
      if (!microphone) return false
      await rooms.mutePublishedTrack(roomName, identity, microphone.sid, true)
      return true
    },

    async removeParticipant(roomName, identity) {
      await rooms.removeParticipant(roomName, identity, {
        revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)),
      })
    },

    async deleteRoom(roomName) {
      await rooms.deleteRoom(roomName)
    },
  }
}

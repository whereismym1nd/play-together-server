import { Injectable } from '@nestjs/common';
import { PlayerRole, Room } from './rooms.types';

@Injectable()
export class RoomsService {
  private rooms = new Map<string, Room>();

  createRoom(roomId: string, screenSocketId: string, name?: string): Room {
    const exists = this.rooms.get(roomId);
    if (exists) return exists;

    const room: Room = {
      id: roomId,
      screenId: screenSocketId,
      players: [{ id: screenSocketId, name, role: 'screen' }],
    }

    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, socketId: string, role: PlayerRole, name?: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    if (role === 'screen') {
      room.screenId = socketId;
    }

    if (!room.players.some((p) => p.id === socketId)) {
      room.players.push({ id: socketId, name, role });
    }

    return room;
  }

  leaveRoom(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      const before = room.players.length;
      room.players = room.players.filter((p) => p.id !== socketId);

      if (room.screenId === socketId) {
        room.screenId = undefined;
      }

      const after = room.players.length;

      if (after === 0) {
        this.rooms.delete(room.id);
        return room;
      }

      if (before !== after) {
        return room;
      }
    }
    return null;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  assignGame(roomId: string, gameType: GameType) {
    const room = this.rooms.get(roomId);
    if (room) room.gameType = gameType;
  }

  getRoomBySocket(socketId: string): Room | undefined {
    return [...this.rooms.values()].find((room) =>
      room.players.some((p) => p.id === socketId),
    );
  }
}

import { Injectable } from '@nestjs/common';

export type PlayerRole = 'screen' | 'controller';

export interface Player {
  id: string;       // socket.id
  name?: string;
  role: PlayerRole;
}

export interface Room {
  id: string;           // код комнаты
  screenId?: string;    // socket.id экрана
  players: Player[];    // включая экран (если хочешь)
}

@Injectable()
export class GameService {
  private rooms = new Map<string, Room>();

  createRoom(roomId: string, screenSocketId: string, name?: string): Room {
    const exists = this.rooms.get(roomId);
    if (exists) return exists;

    const room: Room = {
      id: roomId,
      screenId: screenSocketId,
      players: [{ id: screenSocketId, name, role: 'screen' }],
    };

    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, socketId: string, role: PlayerRole, name?: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // если это экран и его ещё нет — назначаем
    if (role === 'screen') {
      room.screenId = socketId;
    }

    // не дублируем игрока
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

      // если комната опустела — удаляем
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
}

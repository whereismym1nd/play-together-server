import { Injectable } from '@nestjs/common';
import { GameType, PlayerRole, Room } from './rooms.types';

@Injectable()
export class RoomsService {
  private rooms = new Map<string, Room>();

  serializeRoom(room: Room) {
    return {
      ...room,
      players: room.players.filter((p) => p.role !== 'screen'),
    };
  }

  getScreenId(roomId: string): string | undefined {
    const room = this.rooms.get(roomId);
    return room?.screenId;
  }

  getHostId(roomId: string): string | undefined {
    const room = this.rooms.get(roomId);
    return room?.hostId;
  }

  createRoom(roomId: string, screenSocketId: string, name?: string): Room {
    const exists = this.rooms.get(roomId);
    if (exists) return exists;

    const room: Room = {
      id: roomId,
      screenId: screenSocketId,
      players: [
        {
          id: screenSocketId,
          name,
          role: 'screen',
          ready: true,
          offline: false,
        }],
    }

    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, socketId: string, role: PlayerRole, name?: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (role === 'screen') return null;
    if (room.players.some((p) => p.id === socketId)) return room;

    const offlinePlayer = room.players.find((p) => p.offline && p.role === role);
    if (offlinePlayer) {
      offlinePlayer.id = socketId;
      offlinePlayer.offline = false;
      if (name) offlinePlayer.name = name;
      if (role === 'host') room.hostId = socketId;
      return room;
    }

    const isFirstHost = !room.hostId;
    const roleToUse = isFirstHost ? 'host' : role === 'host' ? 'controller' : role;

    room.players.push({
      id: socketId,
      name,
      role: roleToUse,
      ready: isFirstHost,
      offline: false,
    });

    if (isFirstHost) room.hostId = socketId;

    return room;

  }

  reconnectPlayer(params: {
    roomId: string;
    oldSocketId?: string;
    newSocketId: string;
    role?: PlayerRole;
    name?: string;
  }): Room | null {
    const { roomId, oldSocketId, newSocketId, role, name } = params;
    const room = this.rooms.get(roomId);
    console.log('params', params);

    if (!room) return null;

    if (oldSocketId) {
      console.log('oldSocketId', oldSocketId);

      const player = room.players.find((p) => p.id === oldSocketId);
      if (player) {
        player.id = newSocketId;
        player.offline = false;
        if (room.hostId === oldSocketId) room.hostId = newSocketId;
        if (room.screenId === oldSocketId) room.screenId = newSocketId;
        return room;
      }
    }

    if (role) {
      return this.joinRoom(roomId, newSocketId, role, name);
    }
    console.log('nothin found');

    return null;
  }

  setReady(socketId: string, ready: boolean) {
    for (const room of this.rooms.values()) {
      const player = room.players.find((p) => p.id === socketId);
      if (player) player.ready = ready;
    }
  }

  checkAllReady(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    return room.players
      .filter((p) => p.role !== 'screen')
      .every((p) => p.ready);
  }

  leaveRoom(socketId: string, options?: { forceRemove?: boolean }): Room | null {
    for (const room of this.rooms.values()) {
      console.log('players', room.players);

      const leavingPlayer = room.players.find((p) => p.id === socketId);
      if (!leavingPlayer) continue;

      if (!options?.forceRemove) {
        leavingPlayer.ready = false;
        leavingPlayer.offline = true;
        return room;
      }

      const before = room.players.length;
      room.players = room.players.filter((p) => p.id !== socketId);

      if (room.screenId === socketId) {
        room.screenId = undefined;
      }

      if (leavingPlayer?.id === room.hostId) {
        const nextHost = room.players.find((p) => p.role !== 'screen');
        if (nextHost) {
          nextHost.role = 'host';
          room.hostId = nextHost.id;
        } else {
          room.hostId = undefined;
        }
      }

      const after = room.players.length;

      if (after === 0) {
        console.log('room deleted');

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

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomsService } from './rooms.service';
import { GameRouterService } from 'src/games/gamesCore/gamesRouter.service';
import { nanoid } from 'nanoid';
import { GameType, PlayerRole, Target } from './rooms.types';

type SessionRecord = {
  sessionId: string;
  roomId?: string;
  role?: PlayerRole;
  name?: string;
  socketId?: string;
  updatedAt: number;
};

const sessions = new Map<string, SessionRecord>(); // replace with Redis if needed

const saveSession = (sessionId: string, data: Partial<SessionRecord>) => {
  const current = sessions.get(sessionId) ?? { sessionId, updatedAt: Date.now() };
  const next: SessionRecord = {
    ...current,
    ...data,
    sessionId,
    updatedAt: Date.now(),
  };
  sessions.set(sessionId, next);
  return next;
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly gameRouter: GameRouterService,
  ) { }

  handleConnection(client: Socket) {
    const incomingSessionId = client.handshake.auth?.sessionId as string | undefined;
    const requestedRoomId = client.handshake.auth?.roomId as string | undefined;
    const existing = incomingSessionId ? sessions.get(incomingSessionId) : null;

    const sessionId = existing?.sessionId ?? nanoid();
    client.emit('session', { sessionId });
    client.data.sessionId = sessionId;

    let session = saveSession(sessionId, {
      sessionId,
      roomId: existing?.roomId,
      role: existing?.role,
      name: existing?.name,
      socketId: client.id,
    });

    if (requestedRoomId && session.roomId && requestedRoomId !== session.roomId) {
      session = saveSession(sessionId, {
        roomId: undefined,
        role: undefined,
        name: undefined,
      });
    }

    const room = session.roomId ? this.roomsService.getRoom(session.roomId) : undefined;
    const canReconnect = room
      && (!requestedRoomId || requestedRoomId === room.id)
      && ['lobby', 'select', 'game'].includes(room.stage);

    if (canReconnect) {
      const restored = this.roomsService.reconnectPlayer({
        roomId: room.id,
        oldSocketId: existing?.socketId,
        newSocketId: client.id,
        role: session.role,
        name: session.name,
      });
      if (restored) {
        client.join(room.id);
        this.emitRoomUpdate(room.id, ['host', 'screen', client.id]);
      }
    }

    console.log('rooms', this.roomsService.rooms);
  }

  handleDisconnect(client: Socket) {
    const sessionId = client.data.sessionId as string | undefined;
    if (sessionId) {
      const existing = sessions.get(sessionId);
      saveSession(sessionId, { ...existing, sessionId });
    }
    const room = this.roomsService.leaveRoom(client.id);
    if (room) {
      this.server.to(room.id).emit('room:update', this.roomsService.serializeRoom(room));
    }
  }

  private emitRoomUpdate(roomId: string, targets: Target) {
    const room = this.roomsService.getRoom(roomId);
    if (!room) return;

    const hostId = this.roomsService.getHostId(room.id);
    const screenId = this.roomsService.getScreenId(room.id);

    const resolve = (t: Target): string[] => {
      if (t === 'all') return [room.id];
      if (t === 'host') return hostId ? [hostId] : [];
      if (t === 'screen') return screenId ? [screenId] : [];
      if (Array.isArray(t)) return t.flatMap(resolve);
      return [t];
    };

    const ids = Array.from(new Set(resolve(targets)));
    if (!ids.length) return;

    this.server.to(ids).emit('room:update', this.roomsService.serializeRoom(room));
  }

  // TV подключается как экран
  @SubscribeMessage('room:create')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId?: string; name?: string },
  ) {
    let roomId: string;
    const name = data.name || 'TV';

    if (data.roomId) {
      roomId = data.roomId;
    } else {
      roomId = nanoid(6).toUpperCase();
    }

    const room = this.roomsService.createRoom(roomId, client.id, name);
    const sessionId = client.data.sessionId as string | undefined;
    if (sessionId) {
      saveSession(sessionId, { roomId, role: 'screen', name })
    }
    client.join(roomId);

    client.emit('room:created', this.roomsService.serializeRoom(room));
  }

  // Телефоны присоединяются к комнате
  @SubscribeMessage('room:join')
  handleJoinRoom(
    @MessageBody() payload: any,
    @ConnectedSocket() socket: Socket,
  ): { success: boolean; message?: string } {
    const { roomId, role, name } = payload;
    const room = this.roomsService.joinRoom(roomId, socket.id, role, name);
    if (!room) {
      return { success: false, message: 'Комната не найдена' };
    }
    socket.join(roomId);
    const sessionId = socket.data.sessionId as string | undefined;
    const player = room.players.find((p) => p.id === socket.id);

    if (sessionId && player) {


      saveSession(sessionId, {
        sessionId,
        roomId,
        role: player.role,
        name: player.name,
        socketId: socket.id,
      });
    }
    this.emitRoomUpdate(roomId, ['host', 'screen', socket.id]);



    return { success: true };
  }

  // Готовность игрока
  @SubscribeMessage('player:ready')
  handleSetPlayerReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { ready: boolean; roomId: string },
  ) {
    const { ready, roomId } = payload;

    this.roomsService.setReady(client.id, ready);
    const room = this.roomsService.getRoom(roomId);

    if (room) {
      this.emitRoomUpdate(room.id, ['host', 'screen', client.id]);
    }
  }

  @SubscribeMessage('player:rename')
  handleRename(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; name: string },
  ): { success: boolean; message?: string } | void {
    const { roomId, name } = payload;
    const trimmed = (name ?? '').trim();
    if (!trimmed) return { success: false, message: 'empty name' };

    const room = this.roomsService.renamePlayer(roomId, client.id, trimmed);
    if (room) {
      this.emitRoomUpdate(room.id, ['host', 'screen', room.id]);
      return { success: true };
    }
    return { success: false, message: 'room or player not found' };
  }

  @SubscribeMessage('room:start')
  handleStartGameSelection(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string }
  ) {
    const { roomId } = data;
    const room = this.roomsService.getRoom(roomId);
    if (!roomId || !room) return;

    const isAllReady = this.roomsService.checkAllReady(roomId);
    if (!isAllReady) return { success: false, message: 'Not all players ready' };

    const hostId = this.roomsService.getHostId(roomId);
    const screenId = this.roomsService.getScreenId(roomId);

    const targetIds = [screenId, hostId].filter(Boolean) as string[];
    if (targetIds.length) {
      this.server.to(targetIds).emit('room:startGameSelect');
    }
    this.roomsService.setStage(room.id, 'select');
    return { success: true };
  }

  @SubscribeMessage('gameSelect:move')
  handleGameSelectMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; direction: 'up' | 'down' | 'left' | 'right' },
  ) {
    const room = this.roomsService.getRoom(data.roomId);
    if (!room) return;
    if (!room.screenId) return;
    this.server.to(room.screenId).emit('gameSelect:move', { direction: data.direction });
  }

  // подтверждение выбора игры
  @SubscribeMessage('gameSelect:confirm')
  handleGameSelectConfirm(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string, gameType: GameType },
  ) {
    const room = this.roomsService.setGameType(data.roomId, data.gameType);
    if (!room || room.id !== data.roomId) return;
    if (!room.screenId) return;
    this.emitRoomUpdate(room.id, 'all');
  }

  @SubscribeMessage('game-event')
  handleGameEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room || !room.gameType) return;
    this.gameRouter.route(room.gameType, { client, room, payload });
  }
}

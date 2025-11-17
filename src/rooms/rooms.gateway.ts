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
    console.log('client connected', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('client disconnected', client.id);
    const room = this.roomsService.leaveRoom(client.id);
    if (room) {
      this.server.to(room.id).emit('room:update', this.roomsService.serializeRoom(room));
    }
  }

  // TV создаёт комнату
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
    client.join(roomId);

    client.emit('room:created', this.roomsService.serializeRoom(room));
  }

  // Телефон или TV присоединяются к комнате
  @SubscribeMessage('room:join')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
    @ConnectedSocket() socket: Socket,
  ): { success: boolean; message?: string } {
    const { roomId, role, name } = payload;
    const room = this.roomsService.joinRoom(roomId, socket.id, role, name);
    if (!room) {
      return { success: false, message: "Комната не найдена" };
    }
    socket.join(roomId);
    this.server.to(roomId).emit('room:update', this.roomsService.serializeRoom(room));
    return { success: true };
  }

  // Готовность игрока
  @SubscribeMessage('player:ready')
  handleSetPlayerReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const { ready } = payload;

    this.roomsService.setReady(client.id, ready);
    const room = this.roomsService.getRoomBySocket(client.id);
    if (room?.screenId) {
      this.server.to(room.screenId).emit('room:update', this.roomsService.serializeRoom(room));
    }
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
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
import { GameRouterService } from 'src/games/gamesRouter.service';

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
      this.server.to(room.id).emit('room:update', room);
    }
  }

  // TV создаёт комнату
  @SubscribeMessage('room:create')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; name?: string },
  ) {
    const { roomId, name } = data;

    const room = this.roomsService.createRoom(roomId, client.id, name);
    client.join(roomId);

    // можно отправить только этому клиенту
    client.emit('room:created', room);

    // или состоянием на всех в комнате
    this.server.to(roomId).emit('room:update', room);
  }

  // Телефон или TV присоединяются к комнате
  @SubscribeMessage('room:join')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomDto,
  ) {
    const { roomId, role, name } = payload;

    const room = this.roomsService.joinRoom(roomId, client.id, role, name);
    if (!room) {
      client.emit('room:error', { message: 'Room not found' });
      return;
    }

    client.join(roomId);

    // отправляем обновлённое состояние всем в комнате
    this.server.to(roomId).emit('room:update', room);
  }

  @SubscribeMessage('game-event')
  handleGameEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload
  ) {
    const room = this.roomsService.getRoomBySocket(client.id);
    if (!room || !room.gameType) return;
    this.gameRouter.route(room.gameType, { client, room, payload });
  }
}
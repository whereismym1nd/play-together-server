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
import { GameService } from './game.service';
import { JoinRoomDto } from './dto/join-room.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly gameService: GameService) { }

  // вызывается при подключении нового сокета
  handleConnection(client: Socket) {
    console.log('client connected', client.id);
  }

  // вызывается при отключении
  handleDisconnect(client: Socket) {
    console.log('client disconnected', client.id);
    const room = this.gameService.leaveRoom(client.id);
    if (room) {
      // оповещаем остальных в комнате
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

    const room = this.gameService.createRoom(roomId, client.id, name);
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

    const room = this.gameService.joinRoom(roomId, client.id, role, name);
    if (!room) {
      client.emit('room:error', { message: 'Room not found' });
      return;
    }

    client.join(roomId);

    // отправляем обновлённое состояние всем в комнате
    this.server.to(roomId).emit('room:update', room);
  }

  @SubscribeMessage('cue:aim')
  handleCueAim(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      power: number; // 0..1
      angle: number; // в радианах или градусах — выберем сами
    },
  ) {
    console.log('aiming');

    const { roomId, power, angle } = data;
    // без логики — просто ретрансляция
    this.server.to(roomId).emit('cue:aim', {
      from: client.id,
      power,
      angle,
    });
  }

  // 🔹 контроллер делает удар
  @SubscribeMessage('cue:shoot')
  handleCueShoot(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      power: number; // 0..1
      angle: number;
    },
  ) {
    const { roomId, power, angle } = data;

    // здесь можно вставить валидацию: ограничить power, etc.
    const clampedPower = Math.max(0, Math.min(1, power));

    // пересылаем всем в комнате (TV ловит и бьёт шар)
    this.server.to(roomId).emit('cue:shoot', {
      from: client.id,
      power: clampedPower,
      angle,
    });
  }
}

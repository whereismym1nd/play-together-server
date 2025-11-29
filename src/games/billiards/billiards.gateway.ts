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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class BilliardsGateway {
  @WebSocketServer()
  server: Server;

  constructor() { }

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

import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { type Room } from 'src/rooms/rooms.types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class BilliardsGateway {
  @WebSocketServer()
  server: Server;

  constructor() { }

  handleGameEvent(ctx: { client: Socket; room: Room; payload: any }) {
    const { client, room, payload } = ctx;
    if (!payload?.type) return;

    const sendAim = (power: number, angle: number) => {
      this.server.to(room.id).emit('cue:aim', {
        from: client.id,
        power,
        angle,
      });
    };

    const sendShoot = (power: number, angle: number) => {
      const clampedPower = Math.max(0, Math.min(1, power));
      this.server.to(room.id).emit('cue:shoot', {
        from: client.id,
        power: clampedPower,
        angle,
      });
    };

    switch (payload.type) {
      case 'cue:aim': {
        const { power = 0, angle = 0 } = payload.data ?? {};
        sendAim(power, angle);
        break;
      }
      case 'cue:shoot': {
        const { power = 0, angle = 0 } = payload.data ?? {};
        sendShoot(power, angle);
        break;
      }
      default:
        break;
    }
  }
}

export class JoinRoomDto {
  roomId: string;
  role: 'screen' | 'controller';
  name?: string;
}

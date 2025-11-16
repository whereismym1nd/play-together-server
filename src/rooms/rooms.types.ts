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
  gameType?: GameType;
}

export type GameType = 'billiards' | 'chess';
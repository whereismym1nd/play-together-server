export type PlayerRole = 'screen' | 'host' | 'controller';

export interface Player {
  id: string;       // socket.id
  name?: string;
  role: PlayerRole;
  ready?: boolean;
}

export interface Room {
  id: string;           // код комнаты
  screenId?: string;    // socket.id экрана
  players: Player[];    // включая экран (если хочешь)
  gameType?: GameType;
}

export type GameType = 'billiards' | 'chess';
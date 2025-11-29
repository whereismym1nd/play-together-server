export type PlayerRole = 'screen' | 'host' | 'controller';

export interface Player {
  id: string;       // socket.id
  name?: string;
  role: PlayerRole;
  ready?: boolean;
  offline?: boolean;
}

export interface Room {
  id: string;           // код комнаты
  screenId?: string;    // socket.id экрана
  hostId?: string;      // socket.id хоста
  players: Player[];    // включая экран (если хочешь)
  gameType?: GameType;
  stage: StageType;
}

export type StageType = "lobby" | "select" | "game";

export type GameType = 'billiards' | 'chess';


export type Target = 'host' | 'screen' | 'all' | string | Array<'host' | 'screen' | 'all' | string>;

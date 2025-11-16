import { Injectable } from "@nestjs/common";
import { BilliardsGateway } from "./billiards/billiards.gateway";
import { GameType } from "src/rooms/rooms.types";

@Injectable()
export class GameRouterService {
  constructor(
    private readonly billiardsGateway: BilliardsGateway,
  ) { }

  route(gameType: GameType, ctx: GameContext) {
    switch (gameType) {
      case 'billiards':
        this.billiardsGateway.handleGameEvent(ctx);
        break;
    }
  }
}

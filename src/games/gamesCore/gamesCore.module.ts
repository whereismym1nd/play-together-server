import { Module } from '@nestjs/common';
import { GameRouterService } from './gamesRouter.service';
import { BilliardsGateway } from '../billiards/billiards.gateway';

@Module({
  providers: [GameRouterService, BilliardsGateway],
  exports: [GameRouterService],
})
export class GamesModule { }

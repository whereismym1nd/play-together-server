import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';
import { GamesModule } from 'src/games/gamesCore/gamesCore.module';

@Module({
  imports: [GamesModule],
  providers: [RoomsGateway, RoomsService],
  controllers: [RoomsController]
})
export class RoomsModule { }

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameModule } from './game/game.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [GameModule, RoomsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

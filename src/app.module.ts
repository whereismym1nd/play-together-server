import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RoomsModule } from './rooms/rooms.module';
import { GamesModule } from './games/gamesCore/gamesCore.module';

@Module({
  imports: [RoomsModule, GamesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

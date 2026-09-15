import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SeedUsersService } from './seed-users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, SeedUsersService],
  exports: [UsersService],
})
export class UsersModule {}

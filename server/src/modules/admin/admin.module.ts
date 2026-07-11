import { Module } from '@nestjs/common';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { PasswordHasherService } from '../auth/services/password-hasher.service';

@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminModule {}

import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { UsersModule } from "../users/users.module";
import { OperatorAuthModule } from "../auth/operator/operator-auth.module";
import { MailModule } from "../mail/mail.module";

import { OperatorUsersController } from "./operator-users.controller";
import { OperatorUsersService } from "./operator-users.service";
import { OperatorNotificationsService } from "./operator-notifications.service";

@Module({
  imports: [PrismaModule, UsersModule, OperatorAuthModule, MailModule],
  controllers: [OperatorUsersController],
  providers: [OperatorUsersService, OperatorNotificationsService],
  exports: [OperatorUsersService],
})
export class OperatorUsersModule {}

import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [AdminModule, AuthModule, NotificationsModule, UsersModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}

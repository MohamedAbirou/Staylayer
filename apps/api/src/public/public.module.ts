import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { UsersModule } from "../users/users.module";
import { PublicAuthController } from "./public-auth.controller";
import { PublicContactController } from "./public-contact.controller";
import { PublicContactService } from "./public-contact.service";
import { PublicContentController } from "./public-content.controller";
import { PublicContentService } from "./public-content.service";
import { PublicLegalController } from "./public-legal.controller";
import { PublicRegistrationService } from "./public-registration.service";

@Module({
  imports: [AuthModule, PrismaModule, UsersModule],
  controllers: [
    PublicAuthController,
    PublicContactController,
    PublicContentController,
    PublicLegalController,
  ],
  providers: [
    PublicContactService,
    PublicContentService,
    PublicRegistrationService,
  ],
})
export class PublicModule {}

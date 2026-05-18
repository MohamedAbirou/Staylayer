import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { UsersModule } from "../users/users.module";
import { OperatorAuthModule } from "../auth/operator/operator-auth.module";

import { OperatorUsersController } from "./operator-users.controller";
import { OperatorUsersService } from "./operator-users.service";

/**
 * Operator-user / permission-management surface (Phase 11).
 *
 * Wires the dedicated `/operator/users` controller into the API. We import
 * `OperatorAuthModule` for the operator JWT guard + permission registry,
 * `UsersModule` to reuse the argon2id password hashing helpers, and
 * `PrismaModule` for direct DB access.
 */
@Module({
  imports: [PrismaModule, UsersModule, OperatorAuthModule],
  controllers: [OperatorUsersController],
  providers: [OperatorUsersService],
  exports: [OperatorUsersService],
})
export class OperatorUsersModule {}

import { Global, Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { LocalStrategy } from "./strategies/local.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { RolesGuard } from "./guards/roles.guard";
import { WorkspaceAccessService } from "./workspace-access.service";
import { WorkspaceScopeGuard } from "./guards/workspace-scope.guard";
import { UsersModule } from "../users/users.module";

@Global()
@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const privateKey = configService.get<string>("JWT_PRIVATE_KEY");
        const publicKey = configService.get<string>("JWT_PUBLIC_KEY");

        if (!privateKey || !publicKey) {
          throw new Error(
            "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be defined in environment variables",
          );
        }

        return {
          privateKey,
          publicKey,
          signOptions: {
            algorithm: "RS256",
            expiresIn: "15m",
          },
          verifyOptions: {
            algorithms: ["RS256"],
          },
        };
      },
    }),
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    RolesGuard,
    WorkspaceAccessService,
    WorkspaceScopeGuard,
  ],
  controllers: [AuthController],
  exports: [
    JwtStrategy,
    RolesGuard,
    WorkspaceAccessService,
    WorkspaceScopeGuard,
  ],
})
export class AuthModule {}

import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}

/**
 * Attaches req.user when a valid JWT is present, but never throws.
 * Use this on endpoints that need to distinguish public vs authenticated access.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<T>(_err: unknown, user: T): T {
    // Return the user if authenticated, or null — never throw
    return user ?? (null as T);
  }

  // Must override to suppress the default 401 thrown by passport when no token
  override canActivate(context: ExecutionContext) {
    return super.canActivate(context) as Promise<boolean>;
  }
}

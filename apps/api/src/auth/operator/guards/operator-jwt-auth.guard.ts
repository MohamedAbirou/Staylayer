import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Guard that activates the "operator-jwt" passport strategy. Use this on
 * every operator controller. It must NEVER be combined with the customer
 * `JwtAuthGuard` — operator routes accept operator tokens only.
 */
@Injectable()
export class OperatorJwtAuthGuard extends AuthGuard("operator-jwt") {}

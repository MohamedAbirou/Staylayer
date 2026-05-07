import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { AuthenticatedRequestUser } from "../auth.types";

export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedRequestUser | undefined,
    ctx: ExecutionContext,
  ):
    | AuthenticatedRequestUser
    | AuthenticatedRequestUser[keyof AuthenticatedRequestUser]
    | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = (request.user as AuthenticatedRequestUser | undefined) ?? null;

    if (!user) {
      return null;
    }

    return data ? (user[data] ?? null) : user;
  },
);

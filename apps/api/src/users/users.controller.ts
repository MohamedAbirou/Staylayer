import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { PlatformRole } from "@prisma/client";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PlatformRoles } from "../auth/decorators/roles.decorator";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@PlatformRoles(PlatformRole.PLATFORM_OWNER)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 20,
  ): Promise<{
    data: {
      id: string;
      email: string;
      platformRole: PlatformRole | null;
      createdAt: Date;
      updatedAt: Date;
    }[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.usersService.findAll(page, limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<{
    id: string;
    email: string;
    platformRole: PlatformRole | null;
    createdAt: Date;
  }> {
    return this.usersService.createUser(dto);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<{
    id: string;
    email: string;
    platformRole: PlatformRole | null;
    updatedAt: Date;
  }> {
    return this.usersService.updateUser(id, dto);
  }

  @Delete(":id")
  async remove(
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const user = req.user as { sub: string };
    return this.usersService.deleteUser(id, user.sub);
  }
}

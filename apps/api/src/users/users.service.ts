import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { Prisma, User, PlatformRole } from "@prisma/client";

const ARGON2_CONFIG: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

const authUserSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  passwordHash: true,
  platformRole: true,
  role: true,
  failedAttempts: true,
  lockedUntil: true,
  memberships: {
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      tenantId: true,
      role: true,
      isDefault: true,
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          sites: {
            orderBy: [{ name: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              slug: true,
              name: true,
              status: true,
            },
          },
        },
      },
    },
  },
});

export type AuthUserRecord = Prisma.UserGetPayload<{
  select: typeof authUserSelect;
}>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createUser(dto: CreateUserDto): Promise<{
    id: string;
    email: string;
    platformRole: PlatformRole | null;
    createdAt: Date;
  }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "User with this email already exists",
      });
    }

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        platformRole: dto.platformRole,
      },
      select: {
        id: true,
        email: true,
        platformRole: true,
        createdAt: true,
      },
    });

    return user;
  }

  async findAll(
    page: number = 1,
    limit: number = 20,
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
    const pageNum = Math.max(1, Number.isFinite(+page) ? +page : 1);
    const limitNum = Math.max(1, Number.isFinite(+limit) ? +limit : 20);
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        where: {
          platformRole: { not: null },
        },
        select: {
          id: true,
          email: true,
          platformRole: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limitNum,
      }),
      this.prisma.user.count({
        where: {
          platformRole: { not: null },
        },
      }),
    ]);

    return { data, total, page: pageNum, limit: limitNum };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: authUserSelect,
    });
  }

  async findAuthUserById(id: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: authUserSelect,
    });
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
  ): Promise<{
    id: string;
    email: string;
    platformRole: PlatformRole | null;
    updatedAt: Date;
  }> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    if (!user.platformRole) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Platform user not found",
      });
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException({
          code: "CONFLICT",
          message: "Email already in use",
        });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.email) updateData.email = dto.email;
    if (dto.platformRole !== undefined) {
      updateData.platformRole = dto.platformRole;
    }
    if (dto.password) {
      updateData.passwordHash = await this.hashPassword(dto.password);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        platformRole: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async deleteUser(
    id: string,
    requestingUserId: string,
  ): Promise<{ message: string }> {
    if (id === requestingUserId) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Cannot delete your own account",
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    if (!user.platformRole) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Platform user not found",
      });
    }

    await this.prisma.user.delete({ where: { id } });

    return { message: "User deleted" };
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_CONFIG);
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async incrementFailedAttempts(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const failedAttempts = user.failedAttempts + 1;
    const updateData: Record<string, unknown> = { failedAttempts };

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(
        lockedUntil.getMinutes() + LOCKOUT_DURATION_MINUTES,
      );
      updateData.lockedUntil = lockedUntil;
      this.logger.warn(
        `Account locked for user ${userId} after ${failedAttempts} failed attempts`,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
  }
}

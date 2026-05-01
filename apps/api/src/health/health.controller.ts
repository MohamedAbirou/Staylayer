import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<{
    status: string;
    uptime: number;
    dbConnected: boolean;
    timestamp: string;
  }> {
    let dbConnected = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const status = dbConnected ? 'ok' : 'error';

    if (!dbConnected) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status,
      uptime,
      dbConnected,
      timestamp: new Date().toISOString(),
    };
  }
}
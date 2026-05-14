import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type CacheRecord = {
  value: string;
  expiresAt: number;
};

@Injectable()
export class PublicRuntimeCacheService {
  private readonly logger = new Logger(PublicRuntimeCacheService.name);
  private readonly inMemoryCache = new Map<string, CacheRecord>();

  constructor(private readonly configService: ConfigService) {}

  async getJson<T>(key: string): Promise<T | null> {
    const redisValue = await this.getUpstashValue(key);

    if (redisValue.handled) {
      return redisValue.value ? (JSON.parse(redisValue.value) as T) : null;
    }

    const memoryValue = this.inMemoryCache.get(key);
    if (!memoryValue) {
      return null;
    }

    if (memoryValue.expiresAt <= Date.now()) {
      this.inMemoryCache.delete(key);
      return null;
    }

    return JSON.parse(memoryValue.value) as T;
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);

    this.inMemoryCache.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    await this.setUpstashValue(key, serialized, ttlSeconds);
  }

  async deleteKeys(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.inMemoryCache.delete(key);
    }

    if (!this.isUpstashConfigured()) {
      return;
    }

    await Promise.all(keys.map((key) => this.executeUpstash(["DEL", key])));
  }

  private async getUpstashValue(
    key: string,
  ): Promise<{ handled: boolean; value: string | null }> {
    if (!this.isUpstashConfigured()) {
      return { handled: false, value: null };
    }

    const result = await this.executeUpstash(["GET", key]);

    if (!result.handled) {
      return { handled: false, value: null };
    }

    return {
      handled: true,
      value: typeof result.value === "string" ? result.value : null,
    };
  }

  private async setUpstashValue(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.isUpstashConfigured()) {
      return;
    }

    await this.executeUpstash(["SET", key, value, "EX", ttlSeconds]);
  }

  private isUpstashConfigured(): boolean {
    return Boolean(
      this.configService.get<string>("UPSTASH_REDIS_REST_URL")?.trim() &&
      this.configService.get<string>("UPSTASH_REDIS_REST_TOKEN")?.trim(),
    );
  }

  private async executeUpstash(
    command: unknown[],
  ): Promise<{ handled: boolean; value: unknown }> {
    const url = this.configService
      .get<string>("UPSTASH_REDIS_REST_URL")
      ?.trim();
    const token = this.configService
      .get<string>("UPSTASH_REDIS_REST_TOKEN")
      ?.trim();

    if (!url || !token) {
      return { handled: false, value: null };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        throw new Error(`Upstash responded with ${response.status}`);
      }

      const payload = (await response.json()) as { result?: unknown };
      return { handled: true, value: payload.result ?? null };
    } catch (error) {
      this.logger.warn(
        `Upstash cache command failed (${String(command[0])}): ${error instanceof Error ? error.message : String(error)}`,
      );
      return { handled: false, value: null };
    }
  }
}

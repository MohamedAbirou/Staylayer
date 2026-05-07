import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

const ADMIN_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
] as const;

export class AdminSubscriptionsQueryDto {
  @IsOptional()
  @IsIn(ADMIN_SUBSCRIPTION_STATUSES)
  status?: (typeof ADMIN_SUBSCRIPTION_STATUSES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

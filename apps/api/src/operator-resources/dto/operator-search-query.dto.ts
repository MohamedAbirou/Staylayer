import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Transform } from "class-transformer";

export class OperatorSearchQueryDto {
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  q!: string;

  /**
   * Maximum results per category (tenants, sites, domains, users). Caps at
   * 20 so the global search remains responsive on large datasets.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  @Transform(({ value }: { value: unknown }) => parseInt(value as string, 10))
  limit?: number;
}

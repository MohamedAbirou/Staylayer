import { HostVariant } from "@prisma/client";
import { IsEnum } from "class-validator";

export class PreferredHostVariantDto {
  @IsEnum(HostVariant, {
    message: "variant must be either APEX or WWW",
  })
  variant!: HostVariant;
}

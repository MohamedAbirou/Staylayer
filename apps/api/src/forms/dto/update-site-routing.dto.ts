import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { FormRoutingRuleDraftDto } from "./upsert-form-definition.dto";

export class UpdateSiteRoutingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormRoutingRuleDraftDto)
  routingRules: FormRoutingRuleDraftDto[];
}

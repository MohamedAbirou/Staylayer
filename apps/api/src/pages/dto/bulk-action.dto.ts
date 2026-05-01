import {
  IsArray,
  IsString,
  ArrayMinSize,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class PageIdentifier {
  @IsString()
  slug: string;

  @IsString()
  locale: string;
}

export class BulkActionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PageIdentifier)
  pages: PageIdentifier[];
}

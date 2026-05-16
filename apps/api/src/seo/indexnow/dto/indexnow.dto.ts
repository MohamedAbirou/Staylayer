import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
} from "class-validator";

export class SubmitIndexNowDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  urls!: string[];
}

export class ToggleIndexNowDto {
  enabled!: boolean;
}

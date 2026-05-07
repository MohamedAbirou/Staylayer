import { IsEmail, IsString, MinLength } from "class-validator";
import { AuthContextDto } from "./auth-context.dto";

export class LoginDto extends AuthContextDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

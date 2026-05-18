import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class OperatorLoginDto {
  @IsEmail({}, { message: "A valid email is required" })
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(256)
  password: string;
}

import { IsEmail, IsString, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class LoginDto {
  @IsEmail({}, { message: "Must be a valid email address" })
  @Transform(({ value }: { value: string }) => (value as string).toLowerCase().trim())
  email!: string;

  @IsString()
  @MinLength(1, { message: "Password is required" })
  password!: string;
}

import { IsEmail } from "class-validator";
import { Transform } from "class-transformer";

export class ForgotPasswordDto {
  @IsEmail({}, { message: "Must be a valid email address" })
  @Transform(({ value }: { value: string }) => (value as string).toLowerCase().trim())
  email!: string;
}

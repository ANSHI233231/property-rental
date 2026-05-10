import { IsString, IsOptional, MaxLength, Matches } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: "Name is too long" })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: "Must be a valid 10-digit Indian mobile number" })
  phone?: string | null;
}

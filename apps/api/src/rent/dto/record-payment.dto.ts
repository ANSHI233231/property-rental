import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsPositive,
  IsEnum,
  IsOptional,
  MaxLength,
  Matches,
} from "class-validator";

export enum PaymentMethodDto {
  CASH = "CASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  UPI = "UPI",
  CHEQUE = "CHEQUE",
  OTHER = "OTHER",
}

/**
 * POST /payments
 * BL-10: endpoint restricted to PROPERTY_MANAGER + ADMIN; this DTO validates the shape.
 */
export class RecordPaymentDto {
  @IsString()
  @IsNotEmpty()
  rentPeriodId!: string;

  /**
   * Amount in paise. Must be a positive integer.
   * BL-11: compared to outstanding_paise inside a Serializable transaction.
   */
  @IsInt({ message: "amountPaise must be an integer" })
  @IsPositive({ message: "amountPaise must be positive" })
  amountPaise!: number;

  @IsEnum(PaymentMethodDto)
  method!: PaymentMethodDto;

  /** UPI ID, cheque number, NEFT UTR, etc. */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reference?: string;

  /** Date the tenant physically paid — YYYY-MM-DD. May differ from server-recorded time. */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "paidOn must be YYYY-MM-DD" })
  paidOn!: string;
}

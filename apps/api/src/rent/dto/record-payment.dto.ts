import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsPositive,
  IsEnum,
  IsOptional,
  MaxLength,
  Matches,
  Max,
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
   * Amount in paise. Must be a positive integer, capped at ₹10 crore (1,000,000,000 paise).
   * BL-11: compared to outstanding_paise inside a Serializable transaction.
   * M-02: upper bound guards against misclick or financial-report corruption.
   */
  @IsInt({ message: "amountPaise must be an integer" })
  @IsPositive({ message: "amountPaise must be positive" })
  @Max(1_000_000_000, { message: "amountPaise must not exceed ₹10 crore (1,000,000,000 paise)" })
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

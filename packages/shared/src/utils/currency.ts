/**
 * Indian currency helpers — Phase 2
 * All monetary values in GharSetu are stored as integer paise (1 INR = 100 paise).
 * These helpers convert for display and input.
 *
 * BL-22 / BL-23: format at the API boundary; store in UTC/paise internally.
 */

/**
 * Convert paise (integer) to rupees (float, 2 decimal places).
 * Example: 1_800_000 → 18000.00
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Convert rupees (number) to paise (integer, Math.round applied).
 * Example: 18000 → 1_800_000
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Format paise as an Indian-locale currency string.
 * Uses Intl.NumberFormat with en-IN locale for ₹X,XX,XXX grouping.
 * Example: 1_800_000 → "₹18,000"
 *
 * Note: maximumFractionDigits=0 because we store whole paise and display
 * whole rupees (no sub-rupee amounts in GharSetu rent/fees).
 */
export function formatINR(paise: number): string {
  const rupees = paiseToRupees(paise);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(rupees);
  } catch {
    // Fallback for environments where en-IN full ICU is not available
    return formatINRFallback(rupees);
  }
}

/**
 * Hand-rolled Indian digit grouping fallback.
 * Indian grouping: last 3 digits, then groups of 2.
 * Example: 1200000 → "₹12,00,000"
 */
export function formatINRFallback(rupees: number): string {
  const intPart = Math.floor(Math.abs(rupees)).toString();
  const sign = rupees < 0 ? "-" : "";

  let grouped: string;
  if (intPart.length <= 3) {
    grouped = intPart;
  } else {
    // Last 3 digits
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    // Group remaining in pairs from the right
    const pairedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    grouped = pairedRest + "," + last3;
  }

  return `${sign}₹${grouped}`;
}

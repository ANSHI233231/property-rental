import { describe, it, expect } from "vitest";
import {
  paiseToRupees,
  rupeesToPaise,
  formatINRFallback,
} from "../utils/currency.js";

describe("paiseToRupees", () => {
  it("converts 1_800_000 paise → 18000", () => {
    expect(paiseToRupees(1_800_000)).toBe(18000);
  });

  it("converts 0 paise → 0", () => {
    expect(paiseToRupees(0)).toBe(0);
  });

  it("converts 100 paise → 1 rupee", () => {
    expect(paiseToRupees(100)).toBe(1);
  });

  it("converts 12_000_000 paise → 120000", () => {
    expect(paiseToRupees(12_000_000)).toBe(120000);
  });
});

describe("rupeesToPaise", () => {
  it("converts 18000 rupees → 1_800_000 paise", () => {
    expect(rupeesToPaise(18000)).toBe(1_800_000);
  });

  it("converts 0 → 0", () => {
    expect(rupeesToPaise(0)).toBe(0);
  });

  it("rounds fractional rupees", () => {
    expect(rupeesToPaise(18000.005)).toBe(1_800_001);
  });
});

describe("formatINRFallback", () => {
  it("formats ₹18,000 correctly", () => {
    expect(formatINRFallback(18000)).toBe("₹18,000");
  });

  it("formats ₹1,20,000 correctly (Indian grouping)", () => {
    expect(formatINRFallback(120000)).toBe("₹1,20,000");
  });

  it("formats ₹12,00,000 correctly", () => {
    expect(formatINRFallback(1200000)).toBe("₹12,00,000");
  });

  it("formats ₹1,00,00,000 correctly", () => {
    expect(formatINRFallback(10000000)).toBe("₹1,00,00,000");
  });

  it("formats 0 as ₹0", () => {
    expect(formatINRFallback(0)).toBe("₹0");
  });

  it("handles 3-digit amounts without grouping", () => {
    expect(formatINRFallback(999)).toBe("₹999");
  });

  it("handles negative amounts", () => {
    expect(formatINRFallback(-18000)).toBe("-₹18,000");
  });
});

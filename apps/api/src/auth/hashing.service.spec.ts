import { Test } from "@nestjs/testing";
import { HashingService } from "./hashing.service";

describe("HashingService", () => {
  let service: HashingService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [HashingService],
    }).compile();
    service = moduleRef.get(HashingService);
  });

  it("hashPassword produces a non-empty Argon2id hash", async () => {
    const hash = await service.hashPassword("myTestPassword1");
    // Argon2id hashes start with "$argon2id$"
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash.length).toBeGreaterThan(50);
  });

  it("verifyPassword returns true for correct password", async () => {
    const plain = "correctPassword123";
    const hash = await service.hashPassword(plain);
    const result = await service.verifyPassword(plain, hash);
    expect(result).toBe(true);
  });

  it("verifyPassword returns false for wrong password", async () => {
    const hash = await service.hashPassword("correctPassword123");
    const result = await service.verifyPassword("wrongPassword456", hash);
    expect(result).toBe(false);
  });

  it("hashPassword produces different hashes for same input (salting)", async () => {
    const plain = "samePassword123";
    const hash1 = await service.hashPassword(plain);
    const hash2 = await service.hashPassword(plain);
    expect(hash1).not.toBe(hash2);
    // Both should still verify
    expect(await service.verifyPassword(plain, hash1)).toBe(true);
    expect(await service.verifyPassword(plain, hash2)).toBe(true);
  });

  it("never uses bcrypt format in output", async () => {
    const hash = await service.hashPassword("myTestPassword1");
    // bcrypt hashes start with $2b$ or $2a$
    expect(hash).not.toMatch(/^\$2[ab]\$/);
  });
});

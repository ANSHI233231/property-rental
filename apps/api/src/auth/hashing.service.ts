import { Injectable } from "@nestjs/common";
import { hash, verify, Algorithm } from "@node-rs/argon2";

/**
 * HashingService — Argon2id-only wrapper.
 * SRS §11.1: never bcrypt, never MD5, never SHA-1.
 *
 * Params per spec:
 *   memoryCost: 19456 (19 MB)
 *   timeCost:   2
 *   parallelism: 1
 *   algorithm:  Argon2id
 */
@Injectable()
export class HashingService {
  private readonly ARGON2_OPTIONS = {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    algorithm: Algorithm.Argon2id,
  } as const;

  async hashPassword(plain: string): Promise<string> {
    return hash(plain, this.ARGON2_OPTIONS);
  }

  async verifyPassword(plain: string, hashed: string): Promise<boolean> {
    return verify(hashed, plain, this.ARGON2_OPTIONS);
  }
}

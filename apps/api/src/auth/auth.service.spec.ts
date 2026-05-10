import { Test } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { HashingService } from "./hashing.service";
import { JwtTokenService } from "./jwt.service";
import { PrismaService } from "../prisma/prisma.service";

// ---------------------------------------------------------------------------
// Minimal Prisma mock for unit tests (no real DB)
// ---------------------------------------------------------------------------

const mockUser = {
  id: "test-user-id",
  email: "admin@gharsetu.local",
  name: "Test Admin",
  password_hash: "", // filled in beforeAll
  role: "ADMIN",
  is_active: true,
  failed_login_count: 0,
  locked_until: null,
  phone: null,
  created_by_user_id: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({}),
  },
  passwordResetToken: {
    updateMany: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock)),
};

describe("AuthService", () => {
  let authService: AuthService;
  let hashingService: HashingService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: "unit_test_secret_32chars_minimum_xxx",
              JWT_ACCESS_TTL: "15m",
            }),
          ],
        }),
        JwtModule.register({
          secret: "unit_test_secret_32chars_minimum_xxx",
          signOptions: { expiresIn: "15m" },
        }),
      ],
      providers: [
        AuthService,
        HashingService,
        JwtTokenService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    hashingService = moduleRef.get(HashingService);

    // Create a real Argon2id hash for the test user
    mockUser.password_hash = await hashingService.hashPassword("TestPassword123");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.update.mockResolvedValue(mockUser);
    prismaMock.refreshToken.create.mockResolvedValue({});
    prismaMock.passwordResetToken.updateMany.mockResolvedValue({});
    prismaMock.passwordResetToken.create.mockResolvedValue({});
  });

  // ---------------------------------------------------------------------------
  // login — happy path
  // ---------------------------------------------------------------------------

  describe("login — happy path", () => {
    it("TC-AUTH-LOGIN-001: returns accessToken + user object on valid credentials", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.login(
        { email: "admin@gharsetu.local", password: "TestPassword123" },
        { userAgent: "jest", ip: "127.0.0.1" },
      );

      expect(result.accessToken).toBeTruthy();
      expect(typeof result.accessToken).toBe("string");
      expect(result.refreshToken).toBeTruthy();
      expect(result.user).toMatchObject({
        id: mockUser.id,
        role: mockUser.role,
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it("TC-AUTH-LOGIN-002: user.password_hash is NOT present in the returned user object", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.login(
        { email: "admin@gharsetu.local", password: "TestPassword123" },
        {},
      );

      expect(result.user).not.toHaveProperty("password_hash");
      expect(result.user).not.toHaveProperty("failed_login_count");
      expect(result.user).not.toHaveProperty("locked_until");
    });

    it("TC-AUTH-LOGIN-003: resets failed_login_count on successful login", async () => {
      const userWithFailures = { ...mockUser, failed_login_count: 3 };
      prismaMock.user.findUnique.mockResolvedValue(userWithFailures);

      await authService.login(
        { email: "admin@gharsetu.local", password: "TestPassword123" },
        {},
      );

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failed_login_count: 0, locked_until: null }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // login — failure paths
  // ---------------------------------------------------------------------------

  describe("login — invalid credentials", () => {
    it("TC-AUTH-LOGIN-004: throws UnauthorizedException for non-existent user", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: "ghost@gharsetu.local", password: "anything" }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("TC-AUTH-LOGIN-005: throws UnauthorizedException for wrong password", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.login(
          { email: "admin@gharsetu.local", password: "WrongPassword999" },
          {},
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("TC-AUTH-LOGIN-006: error message is generic (anti-enumeration)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      try {
        await authService.login({ email: "ghost@gharsetu.local", password: "anything" }, {});
        fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        const msg = (err as UnauthorizedException).message;
        expect(msg).toBe("Invalid credentials");
        // Must not mention whether the account exists
        expect(msg.toLowerCase()).not.toContain("not found");
        expect(msg.toLowerCase()).not.toContain("no account");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Account lockout
  // ---------------------------------------------------------------------------

  describe("login — account lockout", () => {
    it("TC-AUTH-LOCK-001: increments failed_login_count on wrong password", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...mockUser, failed_login_count: 0 });

      await expect(
        authService.login(
          { email: "admin@gharsetu.local", password: "WrongPassword999" },
          {},
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failed_login_count: 1 }),
        }),
      );
    });

    it("TC-AUTH-LOCK-002: sets locked_until after 5 failed attempts", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        failed_login_count: 4, // 5th attempt will hit the limit
      });

      await expect(
        authService.login(
          { email: "admin@gharsetu.local", password: "WrongPassword999" },
          {},
        ),
      ).rejects.toThrow(UnauthorizedException);

      const updateCall = prismaMock.user.update.mock.calls[0][0] as {
        data: { failed_login_count: number; locked_until?: Date };
      };
      expect(updateCall.data.failed_login_count).toBe(5);
      expect(updateCall.data.locked_until).toBeInstanceOf(Date);
    });

    it("TC-AUTH-LOCK-003: throws locked message when account is locked", async () => {
      const lockedUser = {
        ...mockUser,
        locked_until: new Date(Date.now() + 10 * 60 * 1000), // 10 min in future
      };
      prismaMock.user.findUnique.mockResolvedValue(lockedUser);

      await expect(
        authService.login(
          { email: "admin@gharsetu.local", password: "TestPassword123" },
          {},
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("TC-AUTH-LOCK-004: allows login after lockout expires", async () => {
      // locked_until is in the PAST
      const expiredLock = {
        ...mockUser,
        locked_until: new Date(Date.now() - 1000),
      };
      prismaMock.user.findUnique.mockResolvedValue(expiredLock);

      const result = await authService.login(
        { email: "admin@gharsetu.local", password: "TestPassword123" },
        {},
      );

      expect(result.accessToken).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // forgot-password — anti-enumeration
  // ---------------------------------------------------------------------------

  describe("forgotPassword — anti-enumeration", () => {
    it("TC-AUTH-015: does not throw for non-existent email", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Must NOT throw — anti-enumeration contract (TC-AUTH-015)
      await expect(
        authService.forgotPassword("ghost@nowhere.com"),
      ).resolves.toBeUndefined();
    });

    it("TC-AUTH-015: does not throw for inactive user", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...mockUser, is_active: false });

      await expect(
        authService.forgotPassword("admin@gharsetu.local"),
      ).resolves.toBeUndefined();
    });

    it("TC-AUTH-015: creates a reset token for valid active user", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      await authService.forgotPassword("admin@gharsetu.local");

      expect(prismaMock.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: mockUser.id,
            token_hash: expect.any(String),
            expires_at: expect.any(Date),
          }),
        }),
      );

      // token_hash must be a sha256 hex string (64 chars)
      const createCall = prismaMock.passwordResetToken.create.mock.calls[0][0] as {
        data: { token_hash: string };
      };
      expect(createCall.data.token_hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

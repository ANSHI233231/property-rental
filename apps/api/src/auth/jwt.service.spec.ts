import { Test } from "@nestjs/testing";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { JwtTokenService } from "./jwt.service";

describe("JwtTokenService", () => {
  let service: JwtTokenService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule.register({
          secret: "test_secret_at_least_32_chars_long_xyz",
          signOptions: { expiresIn: "15m" },
        }),
      ],
      providers: [JwtTokenService],
    }).compile();

    service = moduleRef.get(JwtTokenService);
  });

  it("signAccessToken returns a non-empty JWT string", () => {
    const token = service.signAccessToken({ sub: "user-123", role: "ADMIN" });
    expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it("verifyAccessToken returns the correct payload", () => {
    const token = service.signAccessToken({ sub: "user-abc", role: "TENANT" });
    const payload = service.verifyAccessToken(token);
    expect(payload.sub).toBe("user-abc");
    expect(payload.role).toBe("TENANT");
  });

  it("verifyAccessToken throws UnauthorizedException for invalid token", () => {
    expect(() => service.verifyAccessToken("not.a.valid.token")).toThrow(UnauthorizedException);
  });

  it("verifyAccessToken throws UnauthorizedException for tampered token", () => {
    const token = service.signAccessToken({ sub: "user-xyz", role: "ADMIN" });
    const tampered = token.slice(0, -5) + "xxxxx";
    expect(() => service.verifyAccessToken(tampered)).toThrow(UnauthorizedException);
  });
});

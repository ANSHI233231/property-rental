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
    const token = service.signAccessToken({ sub: 1, role: 0 }); // ADMIN=0
    expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it("verifyAccessToken returns the correct payload", () => {
    const token = service.signAccessToken({ sub: 5, role: 3 }); // TENANT=3
    const payload = service.verifyAccessToken(token);
    expect(payload.sub).toBe(5);
    expect(payload.role).toBe(3);
  });

  it("verifyAccessToken throws UnauthorizedException for invalid token", () => {
    expect(() => service.verifyAccessToken("not.a.valid.token")).toThrow(UnauthorizedException);
  });

  it("verifyAccessToken throws UnauthorizedException for tampered token", () => {
    const token = service.signAccessToken({ sub: 99, role: 0 }); // ADMIN=0
    const tampered = token.slice(0, -5) + "xxxxx";
    expect(() => service.verifyAccessToken(tampered)).toThrow(UnauthorizedException);
  });
});

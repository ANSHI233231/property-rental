import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HashingService } from "../auth/hashing.service";
import type { UpdateProfileDto } from "./dto/update-profile.dto";
import type { ChangePasswordDto } from "./dto/change-password.dto";

/** Safe user shape — never includes password_hash. */
export interface SafeUser {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
  ) {}

  async findById(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.is_active) {
      throw new NotFoundException("User not found");
    }

    return this.sanitize(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SafeUser> {
    // Check phone uniqueness only if changing it
    if (dto.phone) {
      const existing = await this.prisma.user.findFirst({
        where: { phone: dto.phone, id: { not: userId } },
      });
      if (existing) {
        throw new ConflictException("Phone number already in use");
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
    });

    return this.sanitize(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.is_active) {
      throw new NotFoundException("User not found");
    }

    const currentOk = await this.hashing.verifyPassword(dto.currentPassword, user.password_hash);

    if (!currentOk) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const newHash = await this.hashing.hashPassword(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { password_hash: newHash },
      });

      // Revoke all OTHER refresh tokens (keep current session alive)
      // Note: We don't have the current session token here; the frontend
      // will continue using the current access token until it expires.
      // All refresh tokens are revoked — user will need to re-authenticate
      // when the current access token expires (15 min max).
      await tx.refreshToken.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    });
  }

  private sanitize(user: {
    id: string;
    email: string;
    phone: string | null;
    name: string;
    role: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}

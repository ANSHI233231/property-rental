import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  MethodNotAllowedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { HashingService } from "../auth/hashing.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../notifications/email.service";
import type { UpdateProfileDto } from "./dto/update-profile.dto";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { AdminCreateUserDto } from "./dto/admin-create-user.dto";
import type { AdminUpdateUserDto } from "./dto/admin-update-user.dto";

/** Safe user shape — never includes password_hash. */
export interface SafeUser {
  id: number;
  email: string;
  phone: string | null;
  name: string;
  first_name: string | null;
  last_name: string | null;
  /** Only populated for MAINTENANCE users; null otherwise. */
  specialization: string | null;
  /** Smallint role code: 0=ADMIN 1=PROPERTY_MANAGER 2=MAINTENANCE 3=TENANT */
  role: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Profile select — used by self-service endpoints (GET /users/me, PATCH /users/me).
 * Does NOT include created_by_user_id (internal admin field, not needed in
 * self-service profile and not part of the SafeUser contract).
 * Does NOT include password_hash, failed_login_count, locked_until — these are
 * never selected anywhere outside of auth-internal queries.
 */
const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  phone: true,
  name: true,
  first_name: true,
  last_name: true,
  specialization: true,
  role: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

/**
 * Admin select — used by admin list/get endpoints.
 * Includes created_by_user_id for audit/admin purposes.
 * Still never includes password_hash, failed_login_count, or locked_until.
 */
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  phone: true,
  name: true,
  first_name: true,
  last_name: true,
  specialization: true,
  role: true,
  is_active: true,
  created_by_user_id: true,
  created_at: true,
  updated_at: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  // ---------------------------------------------------------------------------
  // Self-service endpoints (Phase 1, unchanged)
  // ---------------------------------------------------------------------------

  async findById(userId: number): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_PROFILE_SELECT,
    });

    if (!user || !user.is_active) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<SafeUser> {
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
      select: USER_PROFILE_SELECT,
    });

    return updated;
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.is_active) {
      throw new NotFoundException("User not found");
    }

    const currentOk = await this.hashing.verifyPassword(dto.currentPassword, user.password_hash);

    if (!currentOk) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const newHash = await this.hashing.hashPassword(dto.newPassword);
    const changedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { password_hash: newHash },
      });

      await tx.refreshToken.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      });

      // Phase 7: audit password change event (W-04).
      await this.audit.writeLog(tx, {
        actorId: userId,
        action: "auth.password_change",
        entityType: "Auth",
        entityId: userId,
        before: null,
        after: { changedAt },
      });
    });

    // F3.1: fire-and-forget notification to all active admins.
    // Failure must NOT break the password change. Run after the transaction
    // commits so the audit row is durable even if email fails.
    const admins = await this.prisma.user.findMany({
      where: { role: 0, is_active: true },
      select: { email: true },
    });
    const adminEmails = admins.map((a) => a.email);
    void this.email
      .sendPasswordChangeNoticeToAdmins(adminEmails, user.name, user.email, changedAt)
      .catch(() => {
        /* never throw — email errors are logged inside the service. */
      });
  }

  // ---------------------------------------------------------------------------
  // Admin CRUD — Phase 2
  // ---------------------------------------------------------------------------

  /**
   * GET /users — Admin paginated list.
   * role query param accepts int code (0-3) or role-name string for backward compat.
   */
  async listUsers(role?: string, cursor?: number, limit = 20, page?: number, pageSize?: number) {
    const useOffset = page !== undefined;
    const ps = pageSize !== undefined ? Math.min(Math.max(pageSize, 1), 100) : undefined;
    const take = useOffset ? (ps ?? 10) : Math.min(limit, 100);
    const currentPage = page ?? 1;

    // Build role filter — accept either int code string ("0") or name ("ADMIN")
    const ROLE_NAME_TO_CODE: Record<string, number> = {
      ADMIN: 0, PROPERTY_MANAGER: 1, MAINTENANCE: 2, TENANT: 3,
    };
    const where: { role?: number } = {};
    if (role !== undefined) {
      const asInt = parseInt(role, 10);
      if (!isNaN(asInt)) {
        where.role = asInt;
      } else {
        const code = ROLE_NAME_TO_CODE[role.toUpperCase()];
        if (code !== undefined) where.role = code;
      }
    }

    // Explicit-branch findMany — avoids TS conditional-spread inference issue.
    const findManyPromise = useOffset
      ? this.prisma.user.findMany({
          where,
          select: USER_SAFE_SELECT,
          orderBy: { created_at: "asc" },
          skip: (currentPage - 1) * take,
          take,
        })
      : this.prisma.user.findMany({
          where,
          select: USER_SAFE_SELECT,
          orderBy: { created_at: "asc" },
          take: take + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

    const [rawItems, total] = await Promise.all([
      findManyPromise,
      this.prisma.user.count({ where }),
    ]);

    let hasMore: boolean;
    let data: typeof rawItems;
    let nextCursor: number | undefined;

    if (useOffset) {
      data = rawItems;
      hasMore = currentPage * take < total;
      nextCursor = undefined;
    } else {
      hasMore = rawItems.length > take;
      data = hasMore ? rawItems.slice(0, take) : rawItems;
      nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / take);

    return {
      data,
      meta: {
        next_cursor: nextCursor ?? null,
        has_more: hasMore,
        total,
        page: currentPage,
        page_size: take,
        total_pages: totalPages,
      },
    };
  }

  /**
   * POST /users.
   *
   * Authorization:
   *   - ADMIN (actorRole=0) may create any role.
   *   - PROPERTY_MANAGER (actorRole=1) may create MAINTENANCE or TENANT only.
   *   - Other roles → 403.
   *
   * Specialization rules:
   *   - Required when role === MAINTENANCE.
   *   - Rejected for any other role.
   *
   * `name` is auto-derived from firstName + lastName for back-compat with
   * existing queries.
   */
  async adminCreateUser(
    dto: AdminCreateUserDto,
    actorId: number,
    actorRole: number,
  ): Promise<SafeUser> {
    const ROLE_CODE: Record<string, number> = {
      ADMIN: 0, PROPERTY_MANAGER: 1, MAINTENANCE: 2, TENANT: 3,
    };
    const newRoleCode = ROLE_CODE[dto.role] ?? 3;

    // Authorization: PROPERTY_MANAGER may only create MAINTENANCE or TENANT
    if (actorRole === ROLE_CODE.PROPERTY_MANAGER) {
      if (newRoleCode !== ROLE_CODE.MAINTENANCE && newRoleCode !== ROLE_CODE.TENANT) {
        throw new ForbiddenException({
          error: {
            code: "FORBIDDEN_ROLE_CREATION",
            message: "Property Managers may only create MAINTENANCE or TENANT users",
          },
        });
      }
    } else if (actorRole !== ROLE_CODE.ADMIN) {
      throw new ForbiddenException({
        error: { code: "FORBIDDEN", message: "Only ADMIN or PROPERTY_MANAGER may create users" },
      });
    }

    // Specialization gating
    if (dto.role === "MAINTENANCE") {
      if (!dto.specialization || dto.specialization.trim().length === 0) {
        throw new BadRequestException({
          error: {
            code: "SPECIALIZATION_REQUIRED",
            message: "Specialization is required when creating a MAINTENANCE user",
          },
        });
      }
    } else if (dto.specialization !== undefined) {
      throw new BadRequestException({
        error: {
          code: "SPECIALIZATION_NOT_ALLOWED",
          message: "Specialization is only allowed when role is MAINTENANCE",
        },
      });
    }

    // Email uniqueness
    const emailExists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (emailExists) {
      throw new ConflictException({
        error: { code: "EMAIL_ALREADY_EXISTS", message: "A user with this email already exists" },
      });
    }

    // Phone uniqueness (if provided)
    if (dto.phone) {
      const phoneExists = await this.prisma.user.findFirst({ where: { phone: dto.phone } });
      if (phoneExists) {
        throw new ConflictException({
          error: { code: "PHONE_ALREADY_EXISTS", message: "A user with this phone already exists" },
        });
      }
    }

    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const passwordHash = await this.hashing.hashPassword(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone ?? null,
          name: fullName,
          first_name: firstName,
          last_name: lastName,
          specialization: dto.role === "MAINTENANCE" ? (dto.specialization as string).trim() : null,
          role: newRoleCode,
          password_hash: passwordHash,
          created_by_user_id: actorId,
        },
        select: USER_SAFE_SELECT,
      });

      // Audit: USER_CREATED
      await this.audit.writeLog(tx, {
        actorId,
        action: "user.create",
        entityType: "User",
        entityId: created.id,
        before: null,
        after: { ...created, role: created.role },
      });

      return created;
    });

    return user;
  }

  /** GET /users/:id — Admin fetch. Returns inactive users too. */
  async adminFindById(id: number): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SAFE_SELECT,
    });

    if (!user) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `User ${id} not found` },
      });
    }

    return user;
  }

  /**
   * PATCH /users/:id — Admin update.
   * Guards:
   * - Cannot demote the last ADMIN via role change (LAST_ADMIN_PROTECTED).
   * - Cannot deactivate the last ADMIN via is_active=false (LAST_ADMIN_PROTECTED).
   * - Cannot change role of a PM currently assigned to a property (PM_HAS_PROPERTY).
   *
   * Both last-admin checks run inside a Serializable transaction so that two
   * concurrent requests cannot each observe "2 admins" and both succeed.
   */
  async adminUpdateUser(
    id: number,
    dto: AdminUpdateUserDto,
    actorId: number,
  ): Promise<SafeUser> {
    const ROLE_CODE: Record<string, number> = {
      ADMIN: 0, PROPERTY_MANAGER: 1, MAINTENANCE: 2, TENANT: 3,
    };
    // ADMIN=0 PROPERTY_MANAGER=1
    const ADMIN_CODE = 0;
    const PM_CODE = 1;

    return this.prisma.$transaction(
      async (tx) => {
        // Re-fetch inside the transaction so we read the committed snapshot.
        const before = await tx.user.findUnique({
          where: { id },
          select: USER_SAFE_SELECT,
        });

        if (!before) {
          throw new NotFoundException({
            error: { code: "RESOURCE_NOT_FOUND", message: `User ${id} not found` },
          });
        }

        // Guard: cannot deactivate the last Admin via is_active=false
        if (dto.is_active === false && before.role === ADMIN_CODE && before.is_active === true) {
          const adminCount = await tx.user.count({
            where: { role: ADMIN_CODE, is_active: true },
          });
          if (adminCount <= 1) {
            throw new ConflictException({
              error: {
                code: "LAST_ADMIN_PROTECTED",
                message: "Cannot deactivate the last active Admin",
              },
            });
          }
        }

        const newRoleCode = dto.role !== undefined ? (ROLE_CODE[dto.role] ?? before.role) : undefined;

        if (newRoleCode !== undefined && newRoleCode !== before.role) {
          // Guard: cannot demote the last Admin via role change
          if (before.role === ADMIN_CODE) {
            const adminCount = await tx.user.count({
              where: { role: ADMIN_CODE, is_active: true },
            });
            if (adminCount <= 1) {
              throw new ConflictException({
                error: {
                  code: "LAST_ADMIN_PROTECTED",
                  message: "Cannot change role of the last active Admin",
                },
              });
            }
          }

          // Guard: cannot change role of a PM currently assigned to a property
          if (before.role === PM_CODE) {
            const assignedProperty = await tx.property.findFirst({
              where: { active_pm_id: id, deleted_at: null },
            });
            if (assignedProperty) {
              throw new ConflictException({
                error: {
                  code: "PM_HAS_PROPERTY",
                  message: `Cannot change role of a PROPERTY_MANAGER currently assigned to property ${assignedProperty.id}. Transfer them first.`,
                  details: { property_id: assignedProperty.id },
                },
              });
            }
          }
        }

        // Email change: enforce uniqueness within the active user set.
        if (dto.email !== undefined && dto.email !== before.email) {
          const conflict = await tx.user.findUnique({
            where: { email: dto.email },
            select: { id: true },
          });
          if (conflict && conflict.id !== id) {
            throw new ConflictException({
              error: {
                code: "EMAIL_TAKEN",
                message: "Another account already uses this email address",
              },
            });
          }
        }

        // First/last name handling — recompute `name` if either changes.
        const newFirst = dto.firstName?.trim();
        const newLast = dto.lastName?.trim();
        const effectiveFirst = newFirst ?? before.first_name ?? "";
        const effectiveLast = newLast ?? before.last_name ?? "";
        const nameChanged = newFirst !== undefined || newLast !== undefined;
        const recomputedName = `${effectiveFirst} ${effectiveLast}`.trim();

        // Specialization rules: only allowed on MAINTENANCE users.
        // - Setting requires the user's effective role to be MAINTENANCE.
        // - Setting null is always permitted (clears the field).
        const effectiveRole = newRoleCode ?? before.role;
        if (dto.specialization !== undefined && dto.specialization !== null) {
          if (effectiveRole !== ROLE_CODE.MAINTENANCE) {
            throw new BadRequestException({
              error: {
                code: "SPECIALIZATION_NOT_ALLOWED",
                message: "Specialization is only allowed when role is MAINTENANCE",
              },
            });
          }
        }

        const updated = await tx.user.update({
          where: { id },
          data: {
            ...(newFirst !== undefined ? { first_name: newFirst } : {}),
            ...(newLast !== undefined ? { last_name: newLast } : {}),
            ...(nameChanged ? { name: recomputedName } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone ?? null } : {}),
            ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
            ...(newRoleCode !== undefined ? { role: newRoleCode } : {}),
            ...(dto.email !== undefined ? { email: dto.email } : {}),
            ...(dto.specialization !== undefined
              ? { specialization: dto.specialization ?? null }
              : {}),
          },
          select: USER_SAFE_SELECT,
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "user.update",
          entityType: "User",
          entityId: id,
          before,
          after: updated,
        });

        return updated;
      },
      { isolationLevel: "Serializable" },
    );
  }

  /**
   * PATCH /users/:id/reset-password — Admin sets a new password for a user.
   *
   * Per spec:
   *   - Admin provides the new temporary password manually.
   *   - User can log in with it immediately.
   *   - No email is sent to the user (admin shares it out-of-band).
   *   - Audit entry `admin.reset_password` with actor + target.
   *   - All existing refresh tokens for the target user are revoked, forcing
   *     a fresh login (security baseline matching self-service change).
   *
   * The admin never sees the user's previous password — only sets the new one.
   */
  async adminResetPassword(
    targetUserId: number,
    newPassword: string,
    actorId: number,
  ): Promise<void> {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, is_active: true },
    });
    if (!target) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `User ${targetUserId} not found` },
      });
    }
    if (!target.is_active) {
      throw new ConflictException({
        error: {
          code: "USER_INACTIVE",
          message: "Cannot reset password of a deactivated user. Reactivate first.",
        },
      });
    }

    const newHash = await this.hashing.hashPassword(newPassword);
    const resetAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          password_hash: newHash,
          failed_login_count: 0,
          locked_until: null,
        },
      });

      await tx.refreshToken.updateMany({
        where: { user_id: targetUserId, revoked_at: null },
        data: { revoked_at: resetAt },
      });

      await this.audit.writeLog(tx, {
        actorId,
        action: "admin.reset_password",
        entityType: "User",
        entityId: targetUserId,
        before: null,
        after: { resetAt, target_user_id: targetUserId },
      });
    });
  }

  /**
   * POST /users/:id/deactivate — Admin deactivates a user.
   * Guards:
   * - Cannot deactivate a PM with an active property (PM_HAS_PROPERTY).
   * - Cannot deactivate the last Admin (LAST_ADMIN_PROTECTED).
   *
   * Runs in a Serializable transaction so concurrent deactivations cannot
   * both observe N>1 admins and both succeed (H-01 fix).
   */
  async adminDeactivateUser(id: number, actorId: number): Promise<SafeUser> {
    const ADMIN_CODE = 0;
    const PM_CODE = 1;
    return this.prisma.$transaction(
      async (tx) => {
        // Re-fetch inside the transaction.
        const user = await tx.user.findUnique({
          where: { id },
          select: USER_SAFE_SELECT,
        });

        if (!user) {
          throw new NotFoundException({
            error: { code: "RESOURCE_NOT_FOUND", message: `User ${id} not found` },
          });
        }

        if (!user.is_active) {
          throw new BadRequestException({
            error: { code: "USER_ALREADY_INACTIVE", message: "User is already inactive" },
          });
        }

        // Guard: PM with active property
        if (user.role === PM_CODE) {
          const assignedProperty = await tx.property.findFirst({
            where: { active_pm_id: id, deleted_at: null },
          });
          if (assignedProperty) {
            throw new ConflictException({
              error: {
                code: "PM_HAS_PROPERTY",
                message: `Cannot deactivate a PROPERTY_MANAGER currently assigned to property ${assignedProperty.id}. Transfer them first.`,
                details: { property_id: assignedProperty.id },
              },
            });
          }
        }

        // Guard: cannot deactivate the last Admin
        if (user.role === ADMIN_CODE) {
          const adminCount = await tx.user.count({
            where: { role: ADMIN_CODE, is_active: true },
          });
          if (adminCount <= 1) {
            throw new ConflictException({
              error: {
                code: "LAST_ADMIN_PROTECTED",
                message: "Cannot deactivate the last active Admin",
              },
            });
          }
        }

        const updated = await tx.user.update({
          where: { id },
          data: { is_active: false },
          select: USER_SAFE_SELECT,
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "user.deactivate",
          entityType: "User",
          entityId: id,
          before: user,
          after: updated,
        });

        return updated;
      },
      { isolationLevel: "Serializable" },
    );
  }

  /** POST /users/:id/activate — Admin reactivates a user. */
  async adminActivateUser(id: number, actorId: number): Promise<SafeUser> {
    const user = await this.adminFindById(id);

    if (user.is_active) {
      throw new BadRequestException({
        error: { code: "USER_ALREADY_ACTIVE", message: "User is already active" },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { is_active: true },
        select: USER_SAFE_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId,
        action: "user.activate",
        entityType: "User",
        entityId: id,
        before: user,
        after: updated,
      });

      return updated;
    });
  }

  /** DELETE /users/:id — always 405. Use deactivate. */
  deleteNotAllowed(): never {
    throw new MethodNotAllowedException({
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Users cannot be deleted. Use POST /users/:id/deactivate instead.",
      },
    });
  }
}

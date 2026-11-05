import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, Matches, Max, MaxLength, Min } from 'class-validator';
import { DEMO_MEMBER_KEYS, type DemoMemberKey } from '../../auth/demo-accounts.js';

export class DemoSignInDto {
  /** Which shared demo user to sign in as. */
  @IsIn(DEMO_MEMBER_KEYS)
  member: DemoMemberKey;
}

export class DevSignInDto {
  /**
   * Any address; the account is created on first use.
   * @example "anna@example.com"
   */
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class MailboxQueryDto {
  /** @example "anna@example.com" */
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** How many recent emails to return (newest first). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 5;
}

export class DemoRequestDto {
  /**
   * Separate demo families per namespace: members are `anna.<namespace>@example.com`, ...
   * @example "demo"
   */
  @IsOptional()
  @Matches(/^[a-z0-9]{1,20}$/, { message: 'namespace must be 1-20 lowercase letters or digits' })
  namespace?: string;
}

export class MailboxMessageDto {
  id: string;
  subject: string;
  receivedAt: string;
  to: string[];
  /** 6-digit sign-in code found in the email, if any. */
  code: string | null;
  /** `tokenHash` for POST /api/v1/auth/magic-link/verify, if the email has a magic link. */
  magicLinkTokenHash: string | null;
  /** Invitation token for POST /api/v1/invitations/{token}/accept, if the email is an invitation. */
  invitationToken: string | null;
  links: string[];
  preview: string;
}

export class MailboxDto {
  email: string;
  /** Mailpit web inbox. */
  inboxUrl: string;
  messages: MailboxMessageDto[];
}

export class DemoUserDto {
  name: string;
  email: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class DemoWorldDto {
  /** Swagger UI is authorized as the first user (Anna) automatically. */
  users: DemoUserDto[];
  groupId: string;
  movieNightId: string | null;
  collectionId: string | null;
  /** Requests worth trying next. */
  tryNext: string[];
}

import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RequestOtpDto {
  /**
   * Email address to sign in with. A new account is created automatically for new addresses.
   * @example "anna@example.com"
   */
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class VerifyOtpDto {
  /** @example "anna@example.com" */
  @IsEmail()
  @MaxLength(254)
  email: string;

  /**
   * The 6-digit code from the email.
   * @example "123456"
   */
  @Matches(/^\d{6}$/, { message: 'code must be the 6-digit code from the email' })
  code: string;
}

export class VerifyMagicLinkDto {
  /** `token_hash` query parameter of the magic link. */
  @IsString()
  @Length(10, 256)
  tokenHash: string;
}

export class RefreshSessionDto {
  @IsString()
  @Length(8, 1024)
  refreshToken: string;
}

export const SIGN_OUT_SCOPES = ['local', 'others', 'global'] as const;
export type SignOutScope = (typeof SIGN_OUT_SCOPES)[number];

export class SignOutDto {
  /**
   * `local`: this device (default). `others`: every other device. `global`: everywhere.
   * @example local
   */
  @IsOptional()
  @IsIn(SIGN_OUT_SCOPES)
  scope?: SignOutScope;
}

export class OtpRequestResponseDto {
  email: string;
  codeLength: number;
  /** Seconds until the code expires. */
  expiresInSeconds: number;
  /** Seconds until another code can be requested. */
  resendAvailableInSeconds: number;
}

export class SessionUserDto {
  id: string;
  email: string;
}

export class AuthSessionDto {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  /** Access token expiry (Unix time, seconds). */
  expiresAt: number;
  user: SessionUserDto;
  /** True until the user completes onboarding (name, favorite genres, preferences). */
  needsOnboarding: boolean;
}

export class ActiveSessionDto {
  id: string;
  current: boolean;
  device: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastActiveAt: Date;
}

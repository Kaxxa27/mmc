import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthSessionsRepository } from './auth-sessions.repository.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { OtpProtectionService } from './otp-protection.service.js';
import { TokenVerifier } from './token-verifier.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpProtectionService,
    AuthSessionsRepository,
    TokenVerifier,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [OtpProtectionService, AuthService],
})
export class AuthModule {}

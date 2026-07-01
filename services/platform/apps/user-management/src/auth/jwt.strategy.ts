import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-jwt'
import type { JwtPayload } from '../../../../src/common/auth.types'
import { extractFormattedBearerJwt } from '../../../../src/common/jwt-token-format'
import { TokenRevocationService } from '../../../../src/common/token-revocation.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly tokenRevocations: TokenRevocationService,
  ) {
    super({
      jwtFromRequest: extractFormattedBearerJwt,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret'),
    })
  }
  async validate(payload: JwtPayload) {
    if (!payload.sub) throw new UnauthorizedException()
    if (await this.tokenRevocations.isAccessTokenRevoked(payload)) {
      throw new UnauthorizedException()
    }
    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles ?? [],
      department: payload.department ?? null,
      maxSecurityLevel: payload.max_security_level ?? 1,
      sessionId: payload.sid ?? null,
    }
  }
}


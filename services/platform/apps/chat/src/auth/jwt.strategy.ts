import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-jwt'
import { extractFormattedBearerJwt } from '../../../../src/common/jwt-token-format'

export interface JwtPayload {
  sub: string
  username: string
  roles: string[]
  department?: string | null
  max_security_level?: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: extractFormattedBearerJwt,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret'),
    })
  }

  validate(payload: JwtPayload) {
    if (!payload.sub) throw new UnauthorizedException()
    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles,
      department: payload.department ?? null,
      maxSecurityLevel: payload.max_security_level ?? 1,
    }
  }
}

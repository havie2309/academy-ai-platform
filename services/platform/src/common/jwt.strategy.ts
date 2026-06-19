import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { JwtPayload } from './auth.types'

@Injectable()
export class CommonJwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret'),
    })
  }

  validate(payload: JwtPayload) {
    if (!payload.sub) throw new UnauthorizedException()
    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles ?? [],
      department: payload.department ?? null,
      maxSecurityLevel: payload.max_security_level ?? 1,
    }
  }
}

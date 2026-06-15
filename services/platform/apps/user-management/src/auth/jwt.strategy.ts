import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

export interface JwtPayload {
  sub: string
  username: string
  roles: string[]
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret',
    })
  }

  validate(payload: JwtPayload) {
    if (!payload.sub) throw new UnauthorizedException()
    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles,
    }
  }
}
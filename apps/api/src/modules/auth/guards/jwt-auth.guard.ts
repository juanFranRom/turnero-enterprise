import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser } from '../types/auth-user.type';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-access') {
  handleRequest(err: any, user: any, info: any, context: any) {
    const req = context.switchToHttp().getRequest();
    if (user) req.auth = user as AuthUser; // ✅ copia
    return super.handleRequest(err, user, info, context);
  }
}

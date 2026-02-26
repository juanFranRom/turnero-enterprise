import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AntiBruteForceModule } from '../security/anti-bruteforce/anti-bruteforce.module';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [JwtModule.register({}), AntiBruteForceModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy],
  exports: [AuthService],
})
export class AuthModule {}

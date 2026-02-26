import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { SessionsService } from './sessions.service';

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Throttler
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { TurneroThrottlerGuard } from '../common/guards/turnero-throttler.guard';

// Middleware
import { TenantMiddleware } from './tenants/middleware/tenant.middleware';

// Módulos
import { PrismaModule } from '../infrastructure/prisma/prisma.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuthModule } from './auth/auth.module';
import { ActiveSessionGuard } from '../common/guards/active-session.guard';
import { AppointmentsModule } from './appointments/appointments.module';
import { AvailabilityModule } from './availability/availability.module';
import { RedisModule } from '../infrastructure/redis/redis.module';
import { SessionsModule } from './sessions/sessions.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: seconds(60), limit: 120 },   
        { name: 'login', ttl: seconds(60), limit: 5 },     
        { name: 'burst', ttl: seconds(10), limit: 30 }, 
        { name: 'refresh', ttl: seconds(60), limit: 10 },    
        { name: 'logout', ttl: seconds(60), limit: 10 },   
        { name: 'logoutAll', ttl: seconds(60), limit: 5 },    
      ],
      storage: new ThrottlerStorageRedisService(process.env.REDIS_URL!),
    }),
    PrismaModule,
    TenantsModule,
    AuthModule,
    AppointmentsModule, 
    AvailabilityModule,
    RedisModule,
    SessionsModule,
    HealthModule
  ],
  providers: [
    ActiveSessionGuard,
    { provide: APP_GUARD, useClass: TurneroThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
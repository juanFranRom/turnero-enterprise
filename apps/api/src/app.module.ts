import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

// Throttler
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { TurneroThrottlerGuard } from './common/guards/turnero-throttler.guard';

// Middleware
import { TenantMiddleware } from './modules/tenants/middleware/tenant.middleware';

// Módulos
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AuthModule } from './modules/auth/auth.module';
import { ActiveSessionGuard } from './common/guards/active-session.guard';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { HttpMetricsMiddleware } from './common/metrics/http-metrics.middleware';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ResourcesModule } from './modules/resources/resources.module';
import { ServicesModule } from './modules/services/services.module';
import { WeeklySchedulesModule } from './modules/weekly-schedules/weekly-schedules.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ResourceServicesModule } from './modules/resource-services/resource-services.module';
import { AvailabilityOverridesModule } from './modules/availability-overrides/availability-overrides.module';

const isE2E = process.env.E2E === '1';

@Module({
  imports: [
    ...(isE2E
    ? []
    : [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'default', ttl: seconds(60), limit: 120 },
          ],
          storage: new ThrottlerStorageRedisService(process.env.REDIS_URL!),
        }),
      ]),
    PrismaModule,
    TenantsModule,
    AuthModule,
    AppointmentsModule, 
    AvailabilityModule,
    RedisModule,
    SessionsModule,
    HealthModule,
    MetricsModule,
    ResourcesModule,
    ServicesModule,
    WeeklySchedulesModule,
    LocationsModule,
    ResourceServicesModule,
    AvailabilityOverridesModule
  ],
  providers: [
    ActiveSessionGuard,
    { provide: APP_GUARD, useClass: TurneroThrottlerGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter, },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
    consumer.apply(HttpMetricsMiddleware).forRoutes('*');
  }
}
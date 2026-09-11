import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { AgreementsModule } from './agreements/agreements.module';
import { ReportsModule } from './reports/reports.module';
import { SeguimientoModule } from './seguimiento/seguimiento.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DependenciasModule } from './dependencias/dependencias.module';
import { DocumentTypesModule } from './document-types/document-types.module';
import { AppConfigModule } from './app-config/app-config.module';
import { ProcessModule } from './process/process.module';
import { DeliverablesModule } from './deliverables/deliverables.module';
import { StorageModule } from './common/storage/storage.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    AgreementsModule,
    InstitutionsModule,
    ReportsModule,
    SeguimientoModule,
    NotificationsModule,
    DependenciasModule,
    DocumentTypesModule,
    AppConfigModule,
    ProcessModule,
    DeliverablesModule,
    StorageModule,
    // En @nestjs/throttler v5/v6 TODOS los throttlers de la lista se aplican a
    // TODAS las rutas, por lo que un throttler 'login' con limit=5 acotaría todo
    // el API a 5 peticiones/15min (rompía el polling de notificaciones). Se
    // define SOLO un throttle global y login se sobrescribe en su ruta con
    // @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } }).
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 300,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

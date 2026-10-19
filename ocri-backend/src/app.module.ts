// PRIMERO: carga y centraliza el entorno (.env) antes de evaluar los módulos
// que leen variables en tiempo de importación. Ver src/config/env.ts.
import './config/env';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
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
import { CatalogsModule } from './catalogs/catalogs.module';
import { SeedDataModule } from './seed-data/seed-data.module';
import { AppConfigModule } from './app-config/app-config.module';
import { ProcessModule } from './process/process.module';
import { DeliverablesModule } from './deliverables/deliverables.module';
import { StorageModule } from './common/storage/storage.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
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
    CatalogsModule,
    SeedDataModule,
    AppConfigModule,
    ProcessModule,
    DeliverablesModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}

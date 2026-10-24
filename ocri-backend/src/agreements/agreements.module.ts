import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AgreementsService } from './agreements.service';
import { AgreementsController } from './agreements.controller';
import { FilesController } from './files.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { JWT_SECRET } from '../auth/jwt.config';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    JwtModule.register({ secret: JWT_SECRET }),
  ],
  controllers: [AgreementsController, FilesController],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}

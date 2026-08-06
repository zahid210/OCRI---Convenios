import { Module } from '@nestjs/common';
import { AgreementsService } from './agreements.service';
import { AgreementsController } from './agreements.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AgreementsController],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}

import { Module } from '@nestjs/common';
import { AgreementsService } from './agreements.service';
import { AgreementsController } from './agreements.controller';
import { FilesController } from './files.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AgreementsController, FilesController],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}

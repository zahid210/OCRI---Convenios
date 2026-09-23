import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeliverablesService } from './deliverables.service';
import { DeliverablesController } from './deliverables.controller';
import { PdfMergerService } from '../common/pdf-merger.service';

@Module({
  imports: [PrismaModule],
  controllers: [DeliverablesController],
  providers: [DeliverablesService, PdfMergerService],
})
export class DeliverablesModule {}

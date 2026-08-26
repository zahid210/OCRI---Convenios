import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { ProcessController } from './process.controller';
import { ProcessService } from './process.service';
import { PdfMergerService } from '../common/pdf-merger.service';

@Module({
  imports: [PrismaModule, AppConfigModule],
  controllers: [ProcessController],
  providers: [ProcessService, PdfMergerService],
  exports: [ProcessService],
})
export class ProcessModule {}

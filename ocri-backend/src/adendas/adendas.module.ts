import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { AdendasController } from './adendas.controller';
import { AdendasService } from './adendas.service';

@Module({
  imports: [PrismaModule, AppConfigModule],
  controllers: [AdendasController],
  providers: [AdendasService],
})
export class AdendasModule {}

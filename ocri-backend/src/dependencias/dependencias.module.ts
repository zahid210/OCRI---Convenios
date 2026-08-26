import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DependenciasController } from './dependencias.controller';
import { DependenciasService } from './dependencias.service';

@Module({
  imports: [PrismaModule],
  controllers: [DependenciasController],
  providers: [DependenciasService],
  exports: [DependenciasService],
})
export class DependenciasModule {}

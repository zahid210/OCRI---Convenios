import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DependenciasModule } from '../dependencias/dependencias.module';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';

@Module({
  imports: [PrismaModule, DependenciasModule],
  controllers: [CatalogsController],
  providers: [CatalogsService],
  exports: [CatalogsService],
})
export class CatalogsModule {}

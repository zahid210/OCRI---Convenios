import { Module } from '@nestjs/common';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { SeedDataService } from './seed-data.service';

// PrismaModule es @Global, así que PrismaService está disponible sin importarlo.
@Module({
  imports: [CatalogsModule],
  providers: [SeedDataService],
  exports: [SeedDataService],
})
export class SeedDataModule {}

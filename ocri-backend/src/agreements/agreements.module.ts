import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AgreementsService } from './agreements.service';
import { AgreementsController } from './agreements.controller';
import { FilesController } from './files.controller';
import { PrismaModule } from '../prisma/prisma.module';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET no está definido o es demasiado corto (mínimo 32 caracteres).',
  );
}

@Module({
  imports: [PrismaModule, JwtModule.register({ secret: JWT_SECRET })],
  controllers: [AgreementsController, FilesController],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}

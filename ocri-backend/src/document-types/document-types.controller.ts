import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { DocumentTypesService } from './document-types.service';
import { FilterDocumentTypesDto } from './dto/filter-document-types.dto';

@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly documentTypesService: DocumentTypesService) {}

  @Get()
  findAll(@Query() filterDto: FilterDocumentTypesDto) {
    return this.documentTypesService.findAll(filterDto.direction);
  }

  // ParseIntPipe: un id no numérico (/document-types/abc) llegaba como NaN y
  // `BigInt(NaN)` en Prisma lanzaba RangeError → 500. Ahora responde 400.
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.documentTypesService.findOne(id);
  }

  @Roles('admin')
  @Post('seed')
  seed() {
    return this.documentTypesService.seed();
  }
}

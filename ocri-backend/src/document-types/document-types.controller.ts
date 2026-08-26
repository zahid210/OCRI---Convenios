import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DocumentTypesService } from './document-types.service';

@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly documentTypesService: DocumentTypesService) {}

  @Get()
  findAll(@Query('direction') direction?: string) {
    return this.documentTypesService.findAll(direction);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentTypesService.findOne(Number(id));
  }

  @Post('seed')
  seed() {
    return this.documentTypesService.seed();
  }
}

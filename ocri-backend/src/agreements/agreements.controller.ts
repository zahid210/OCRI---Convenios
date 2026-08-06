import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { AgreementsService } from './agreements.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { FilterAgreementsDto } from './dto/filter-agreements.dto';

@Controller('agreements')
export class AgreementsController {
  constructor(private readonly agreementsService: AgreementsService) {}

  @Get()
  findAll(@Query() filters: FilterAgreementsDto) {
    return this.agreementsService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.agreementsService.findOne(id);
  }

  @Post()
  create(@Body() createAgreementDto: CreateAgreementDto) {
    return this.agreementsService.create(createAgreementDto);
  }
}

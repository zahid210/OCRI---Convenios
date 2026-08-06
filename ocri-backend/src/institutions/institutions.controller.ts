import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { FilterInstitutionsDto } from './dto/filter-institutions.dto';
import { InstitutionsService } from './institutions.service';

@UseGuards(JwtAuthGuard)
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  create(@Body() createDto: CreateInstitutionDto) {
    return this.institutionsService.create(createDto);
  }

  @Get()
  findAll(@Query() filterDto: FilterInstitutionsDto) {
    return this.institutionsService.findAll(filterDto);
  }

  @Get('countries')
  getCountries() {
    return this.institutionsService.getCountries();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.institutionsService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.institutionsService.remove(id);
  }
}

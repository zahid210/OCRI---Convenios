import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CREATOR_ROLES } from '../auth/role-sets';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { FilterInstitutionsDto } from './dto/filter-institutions.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { InstitutionsService } from './institutions.service';

@UseGuards(JwtAuthGuard)
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  // El asistente registra instituciones aliadas desde /propuestas/create.
  @Roles(...CREATOR_ROLES)
  @Post()
  create(@Body() createDto: CreateInstitutionDto) {
    return this.institutionsService.create(createDto);
  }

  @Get()
  findAll(@Query() filterDto: FilterInstitutionsDto) {
    return this.institutionsService.findAll(filterDto);
  }

  @Get('search')
  search(@Query('q') q?: string) {
    return this.institutionsService.search(q);
  }

  /** Autocompletado por nombre para el registro de propuestas (solo nombre). */
  @Get('autocomplete')
  autocomplete(@Query('q') q?: string) {
    return this.institutionsService.autocomplete(q);
  }

  @Get('countries')
  getCountries() {
    return this.institutionsService.getCountries();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.institutionsService.findOne(id);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateInstitutionDto,
  ) {
    return this.institutionsService.update(id, updateDto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.institutionsService.remove(id);
  }
}

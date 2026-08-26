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
import { Roles } from '../auth/decorators/roles.decorator';
import { DependenciasService } from './dependencias.service';
import { CreateDependenciaDto } from './dto/create-dependencia.dto';
import { UpdateDependenciaDto } from './dto/update-dependencia.dto';

@UseGuards(JwtAuthGuard)
@Controller('dependencias')
export class DependenciasController {
  constructor(private readonly dependenciasService: DependenciasService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateDependenciaDto) {
    return this.dependenciasService.create(dto);
  }

  @Get()
  findAll(
    @Query('kind') kind?: string,
    @Query('is_active') is_active?: string,
    @Query('search') search?: string,
  ) {
    return this.dependenciasService.findAll({ kind, is_active, search });
  }

  @Get('default-opinions')
  getDefaultOpinionTargets() {
    return this.dependenciasService.getDefaultOpinionTargets();
  }

  @Roles('admin')
  @Post('seed')
  seed() {
    return this.dependenciasService.seed();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.dependenciasService.findOne(id);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDependenciaDto,
  ) {
    return this.dependenciasService.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.dependenciasService.remove(id);
  }
}

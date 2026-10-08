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
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DependenciasService } from './dependencias.service';
import { CreateDependenciaDto } from './dto/create-dependencia.dto';
import { UpdateDependenciaDto } from './dto/update-dependencia.dto';

/** req.user lo inyecta el JwtAuthGuard (mismo shape que en el resto de módulos). */
interface AuthenticatedRequest {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('dependencias')
export class DependenciasController {
  constructor(private readonly dependenciasService: DependenciasService) {}

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateDependenciaDto, @Req() req: AuthenticatedRequest) {
    return this.dependenciasService.create(dto, req.user);
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
  seed(@Req() req: AuthenticatedRequest) {
    return this.dependenciasService.seed(req.user);
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
    @Req() req: AuthenticatedRequest,
  ) {
    return this.dependenciasService.update(id, dto, req.user);
  }

  @Roles('admin')
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.dependenciasService.remove(id, req.user);
  }
}

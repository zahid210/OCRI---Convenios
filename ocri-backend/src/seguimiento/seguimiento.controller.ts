import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilterSeguimientoDto } from './dto/filter-seguimiento.dto';
import { SeguimientoService } from './seguimiento.service';

@UseGuards(JwtAuthGuard)
@Controller('seguimiento')
export class SeguimientoController {
  constructor(private readonly seguimientoService: SeguimientoService) {}

  @Get()
  findAll(@Query() filter: FilterSeguimientoDto) {
    return this.seguimientoService.findAll(filter);
  }

  @Get('summary')
  summary(@Query() filter: FilterSeguimientoDto) {
    return this.seguimientoService.summary(filter);
  }
}

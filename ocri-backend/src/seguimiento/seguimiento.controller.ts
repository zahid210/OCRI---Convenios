import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilterSeguimientoDto } from './dto/filter-seguimiento.dto';
import { SeguimientoService } from './seguimiento.service';

interface AuthenticatedRequest {
  user?: { id: number; email: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('seguimiento')
export class SeguimientoController {
  constructor(private readonly seguimientoService: SeguimientoService) {}

  @Get()
  findAll(
    @Query() filter: FilterSeguimientoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.seguimientoService.findAll(filter, req.user?.role);
  }

  @Get('summary')
  summary(
    @Query() filter: FilterSeguimientoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.seguimientoService.summary(filter, req.user?.role);
  }
}

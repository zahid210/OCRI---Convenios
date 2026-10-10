import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilterReportsDto } from './dto/filter-reports.dto';
import { ReportsService } from './reports.service';

interface AuthenticatedRequest {
  user?: { id: number; email: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // El rol viaja a cada método: los reportes agregan convenios y deben respetar
  // el confinamiento de lectura del `viewer` (Fase 5 · H5.1).
  @Get('summary')
  summary(@Query() filter: FilterReportsDto, @Req() req: AuthenticatedRequest) {
    return this.reportsService.summary(filter, req.user?.role);
  }

  @Get('by-status')
  byStatus(
    @Query() filter: FilterReportsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.byStatus(filter, req.user?.role);
  }

  @Get('by-country')
  byCountry(
    @Query() filter: FilterReportsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.byCountry(filter, req.user?.role);
  }

  @Get('by-type')
  byType(@Query() filter: FilterReportsDto, @Req() req: AuthenticatedRequest) {
    return this.reportsService.byType(filter, req.user?.role);
  }

  @Get('by-institution')
  byInstitution(
    @Query() filter: FilterReportsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.byInstitution(filter, req.user?.role);
  }

  @Get('top-institutions')
  topInstitutions(
    @Query() filter: FilterReportsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.topInstitutions(filter, req.user?.role);
  }

  @Get('expiring')
  expiring(
    @Query() filter: FilterReportsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reportsService.expiring(filter, req.user?.role);
  }

  @Get('expired')
  expired(@Query() filter: FilterReportsDto, @Req() req: AuthenticatedRequest) {
    return this.reportsService.expired(filter, req.user?.role);
  }

  @Get('export')
  async export(
    @Query() filter: FilterReportsDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportXlsx(filter, req.user?.role);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte_convenios_${date}.xlsx"`,
    );
    res.send(buffer);
  }
}

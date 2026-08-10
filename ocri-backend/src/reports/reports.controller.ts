import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilterReportsDto } from './dto/filter-reports.dto';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary(@Query() filter: FilterReportsDto) {
    return this.reportsService.summary(filter);
  }

  @Get('by-status')
  byStatus(@Query() filter: FilterReportsDto) {
    return this.reportsService.byStatus(filter);
  }

  @Get('by-country')
  byCountry(@Query() filter: FilterReportsDto) {
    return this.reportsService.byCountry(filter);
  }

  @Get('by-type')
  byType(@Query() filter: FilterReportsDto) {
    return this.reportsService.byType(filter);
  }

  @Get('by-institution')
  byInstitution(@Query() filter: FilterReportsDto) {
    return this.reportsService.byInstitution(filter);
  }

  @Get('top-institutions')
  topInstitutions(@Query() filter: FilterReportsDto) {
    return this.reportsService.topInstitutions(filter);
  }

  @Get('expiring')
  expiring(@Query() filter: FilterReportsDto) {
    return this.reportsService.expiring(filter);
  }

  @Get('expired')
  expired(@Query() filter: FilterReportsDto) {
    return this.reportsService.expired(filter);
  }

  @Get('export')
  async export(@Query() filter: FilterReportsDto, @Res() res: Response) {
    const buffer = await this.reportsService.exportXlsx(filter);
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

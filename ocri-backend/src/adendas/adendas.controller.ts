import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FLOW_ROLES } from '../auth/role-sets';
import { safeMulterOptions } from '../common/uploads.config';
import type { UploadFile } from '../common/uploads.config';
import { AdendasService } from './adendas.service';
import { CreateAdendaDto } from './dto/create-adenda.dto';
import { AddAdendaOpinionsDto } from './dto/add-adenda-opinions.dto';
import { RegisterAdendaDto } from './dto/register-adenda.dto';

interface AuthenticatedRequest {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller()
export class AdendasController {
  constructor(private readonly adendasService: AdendasService) {}

  @Get('agreements/:agreementId/adendas')
  getAdendas(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adendasService.getAdendas(agreementId, req.user?.role);
  }

  @Roles(...FLOW_ROLES)
  @Post('agreements/:agreementId/adendas')
  createAdenda(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Body() dto: CreateAdendaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adendasService.createAdenda(agreementId, dto, req.user?.id);
  }

  @Roles(...FLOW_ROLES)
  @Post('adendas/:adendaId/opinions')
  addAdendaOpinions(
    @Param('adendaId', ParseIntPipe) adendaId: number,
    @Body() dto: AddAdendaOpinionsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adendasService.addAdendaOpinions(
      adendaId,
      dto.dependencia_ids,
      req.user?.id,
    );
  }

  @Roles(...FLOW_ROLES)
  @Post('adendas/:adendaId/register')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  registerAdenda(
    @Param('adendaId', ParseIntPipe) adendaId: number,
    @Body() dto: RegisterAdendaDto,
    @UploadedFile() file: UploadFile | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adendasService.registerAdenda(
      adendaId,
      dto,
      file,
      req.user?.id,
    );
  }

  @Roles(...FLOW_ROLES)
  @Post('adendas/:adendaId/cancel')
  cancelAdenda(
    @Param('adendaId', ParseIntPipe) adendaId: number,
    @Body('reason') reason: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adendasService.cancelAdenda(adendaId, reason, req.user?.id);
  }
}

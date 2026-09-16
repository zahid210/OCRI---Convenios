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
import { DeliverablesService } from './deliverables.service';
import { safeMulterOptions, UploadedFileLike } from '../common/uploads.config';
import { RequestReportDto } from './dto/request-report.dto';
import { EvaluateDeliverableDto } from './dto/evaluate-deliverable.dto';

interface AuthenticatedRequest {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('agreements')
export class DeliverablesController {
  constructor(private readonly deliverablesService: DeliverablesService) {}

  // ─── Consulta: listar entregables del convenio ─────────────────────────────

  @Get(':agreementId/deliverables')
  getDeliverables(@Param('agreementId', ParseIntPipe) agreementId: number) {
    return this.deliverablesService.getDeliverables(agreementId);
  }

  // ─── E3 · OCRI solicita el Plan de Trabajo (inicia seguimiento) ────────────

  @Roles(...FLOW_ROLES)
  @Post(':agreementId/request-workplan')
  requestWorkPlan(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.requestWorkPlan(agreementId, req.user?.id);
  }

  // ─── E3 · Remisión del Plan de Trabajo por los responsables ────────────────

  @Roles(...FLOW_ROLES)
  @Post(':agreementId/submit-workplan')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  submitWorkPlan(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @UploadedFile() file?: UploadedFileLike & { filename?: string },
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.deliverablesService.submitWorkPlan(
      agreementId,
      file!,
      req?.user?.id,
    );
  }

  // ─── E3 · OCRI solicita Informe (Semestral o Final) ────────────────────────

  @Roles(...FLOW_ROLES)
  @Post(':agreementId/request-report')
  requestReport(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Body()
    body: RequestReportDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.requestReport(
      agreementId,
      body.type,
      body.period,
      req.user?.id,
    );
  }

  // ─── E3 · Los responsables remiten Informe o corrección ────────────────────

  @Roles(...FLOW_ROLES)
  @Post('deliverables/:id/submit')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  submitDeliverable(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: UploadedFileLike & { filename?: string },
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.deliverablesService.submitDeliverable(id, file!, req?.user?.id);
  }

  // ─── E3 · OCRI revisa: registra u observa solicitando correcciones ────────

  @Roles(...FLOW_ROLES)
  @Post('deliverables/:id/evaluate')
  evaluateDeliverable(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: EvaluateDeliverableDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.evaluateDeliverable(
      id,
      body.decision,
      body.observations,
      req.user?.id,
    );
  }

  // ─── E3 · Conclusión manual del seguimiento ────────────────────────────────

  @Roles(...FLOW_ROLES)
  @Post(':agreementId/complete-monitoring')
  completeMonitoring(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.completeMonitoring(
      agreementId,
      req.user?.id,
    );
  }
}

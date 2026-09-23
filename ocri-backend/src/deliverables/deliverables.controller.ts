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
import { GenerateRequestDocumentDto } from './dto/generate-request-document.dto';

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

  // ─── E3 · La contraparte acepta la solicitud del entregable ────────────────

  @Roles(...FLOW_ROLES)
  @Post('deliverables/:id/accept-request')
  acceptRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.acceptRequest(id, req.user?.id);
  }

  // ─── E3 · Plantilla editable del oficio de solicitud ──────────────────────

  @Roles(...FLOW_ROLES)
  @Get('deliverables/:id/request-document-template')
  getRequestDocumentTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.deliverablesService.getRequestDocumentTemplate(id);
  }

  // ─── E3 · Genera/edita el oficio de solicitud (con contenido editable) ────

  @Roles(...FLOW_ROLES)
  @Post('deliverables/:id/generate-request-document')
  generateRequestDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: GenerateRequestDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.generateRequestDocument(
      id,
      req.user?.id,
      {
        replace: true,
        bodyHtml: body?.bodyHtml,
        oficio_number: body?.oficio_number,
      },
    );
  }

  // ─── E3 · OCRI evalúa (adjuntando el doc recibido): registra u observa ─────

  @Roles(...FLOW_ROLES)
  @Post('deliverables/:id/evaluate')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  evaluateDeliverable(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: EvaluateDeliverableDto,
    @UploadedFile() file?: UploadedFileLike & { filename?: string },
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.deliverablesService.evaluateDeliverable(
      id,
      body.decision,
      body.observations,
      file!,
      req?.user?.id,
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

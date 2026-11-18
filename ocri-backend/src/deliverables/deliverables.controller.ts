import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FLOW_ROLES } from '../auth/role-sets';
import { DeliverablesService } from './deliverables.service';
import { safeMulterOptions } from '../common/uploads.config';
import type { UploadFile } from '../common/uploads.config';
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
  getDeliverables(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.getDeliverables(
      agreementId,
      req.user?.role,
    );
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
    @UploadedFile() file: UploadFile | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Debe adjuntar el archivo del Plan de Trabajo.',
      );
    }
    return this.deliverablesService.submitWorkPlan(
      agreementId,
      file,
      req.user?.id,
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
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'files', maxCount: 20 },
        { name: 'file', maxCount: 1 },
      ],
      safeMulterOptions(),
    ),
  )
  submitDeliverable(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles()
    uploaded: { files?: UploadFile[]; file?: UploadFile[] } | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const allFiles = [...(uploaded?.files ?? []), ...(uploaded?.file ?? [])];
    if (allFiles.length === 0) {
      throw new BadRequestException(
        'Debe adjuntar al menos un archivo de respuesta del entregable.',
      );
    }
    return this.deliverablesService.submitDeliverable(
      id,
      allFiles,
      req.user?.id,
    );
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
  getRequestDocumentTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.getRequestDocumentTemplate(
      id,
      req.user?.role,
    );
  }

  // ─── E3 · Genera/edita el oficio de solicitud (con contenido editable) ────

  @Roles(...FLOW_ROLES)
  @Post('deliverables/:id/generate-request-document')
  generateRequestDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: GenerateRequestDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.generateRequestDocument(id, req.user?.id, {
      replace: true,
      bodyHtml: body?.bodyHtml,
      oficio_number: body?.oficio_number,
    });
  }

  // ─── E3 · Carga el oficio de solicitud ya elaborado (sin editor) ──────────

  @Roles(...FLOW_ROLES)
  @Post('deliverables/:id/cargar-solicitud')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  cargarSolicitud(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadFile | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Debe adjuntar el archivo del oficio de solicitud.',
      );
    }
    return this.deliverablesService.cargarSolicitud(id, file, req.user?.id);
  }

  // ─── E3 · OCRI revisa el entregable recibido: lo registra u observa ────────

  @Roles(...FLOW_ROLES)
  @Post('deliverables/:id/evaluate')
  evaluateDeliverable(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: EvaluateDeliverableDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.evaluateDeliverable(
      id,
      body.decision,
      body.observations,
      req.user?.id,
    );
  }

  // ─── E3 · Eliminar informe (semestral o final) ─────────────────────────────

  @Roles(...FLOW_ROLES)
  @Delete('deliverables/:id')
  deleteDeliverable(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.deleteDeliverable(id, req.user?.id);
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

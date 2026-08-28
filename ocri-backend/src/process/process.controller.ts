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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProcessService } from './process.service';
import { safeMulterOptions, UploadedFileLike } from '../common/uploads.config';

interface AuthenticatedRequest {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('process')
export class ProcessController {
  constructor(private readonly processService: ProcessService) {}

  // ─── Consulta ───────────────────────────────────────────────────────────────

  @Get(':agreementId/status')
  getProcessStatus(@Param('agreementId', ParseIntPipe) agreementId: number) {
    return this.processService.getProcessStatus(agreementId);
  }

  @Get(':agreementId/events')
  getProcessEvents(@Param('agreementId', ParseIntPipe) agreementId: number) {
    return this.processService.getProcessEvents(agreementId);
  }

  @Get(':agreementId/documents')
  getProcessDocuments(@Param('agreementId', ParseIntPipe) agreementId: number) {
    return this.processService.getProcessDocuments(agreementId);
  }

  // ─── E1 · Opiniones de dependencias ────────────────────────────────────────

  @Roles('admin', 'editor')
  @Post(':agreementId/opinion-requests')
  generateOpinionRequests(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Body()
    body: {
      dependencia_ids: number[];
      default_days?: number;
      oficio_number?: string;
      directed_to?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.generateOpinionRequests(
      agreementId,
      body.dependencia_ids,
      {
        defaultDays: body.default_days,
        oficioNumber: body.oficio_number,
        directedTo: body.directed_to,
      },
      req.user?.id,
    );
  }

  @Roles('admin', 'editor')
  @Post('opinion-requests/:id/send')
  sendOpinionRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      sent_via?: string;
      adesa_number?: string;
      oficio_number?: string;
      directed_to?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.sendOpinionRequest(id, body, req.user?.id);
  }

  @Roles('admin', 'editor')
  @Post('opinion-requests/:id/respond')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  respondOpinionRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { response_date?: string; observations?: string },
    @UploadedFile() file?: UploadedFileLike & { filename?: string },
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.processService.respondOpinionRequest(
      id,
      body,
      file,
      req?.user?.id,
    );
  }

  @Roles('admin', 'editor')
  @Post('opinion-requests/:id/validate')
  validateOpinionRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { valid: boolean; observations?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.validateOpinionRequest(id, body, req.user?.id);
  }

  @Roles('admin', 'editor')
  @Delete('opinion-requests/:id')
  deleteOpinionRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.deleteOpinionRequest(id, req.user?.id);
  }

  /** Devuelve el cuerpo editable precargado del oficio de solicitud de opinión */
  @Roles('admin', 'editor')
  @Get('opinion-requests/:id/oficio/template')
  getOficioOpinionTemplate(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.processService.getOficioOpinionTemplate(id);
  }

  /** Genera el oficio, lo adjunta automáticamente y marca la solicitud como enviada */
  @Roles('admin', 'editor')
  @Post('opinion-requests/:id/oficio/generate')
  generateOficioOpinion(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      bodyHtml: string;
      sent_via?: string;
      adesa_number?: string;
      oficio_number?: string;
      directed_to?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.generateOficioOpinion(
      id,
      {
        bodyHtml: body.bodyHtml,
        sent_via: body.sent_via,
        adesa_number: body.adesa_number,
        oficio_number: body.oficio_number,
        directed_to: body.directed_to,
      },
      req.user?.id,
    );
  }

  // ─── E1 · Expediente técnico y envío a Rectorado ───────────────────────────

  /** Genera el expediente técnico fusionando automáticamente los oficios de respuesta */
  @Roles('admin', 'editor')
  @Post(':agreementId/generate-expediente')
  generateExpediente(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.generateExpediente(agreementId, req.user?.id);
  }

  @Roles('admin', 'editor')
  @Post(':agreementId/documents')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  uploadProcessDocument(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @UploadedFile() file: UploadedFileLike & { filename?: string },
    @Body()
    body: {
      document_type_code: string;
      direction?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.uploadProcessDocument(
      agreementId,
      file,
      body,
      req.user?.id,
    );
  }

  /** OCRI concluye el expediente técnico con las opiniones recopiladas */
  @Roles('admin', 'editor')
  @Post(':agreementId/finalize-expediente')
  finalizeExpediente(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.finalizeExpediente(agreementId, req.user?.id);
  }

  /** Remite expediente técnico + propuesta + opinión a Rectorado (fin E1) */
  @Roles('admin', 'editor')
  @Post(':agreementId/send-to-rectorado')
  sendToRectorado(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.sendToRectorado(agreementId, req.user?.id);
  }

  // ─── E2 · Decisión, publicación y registro ─────────────────────────────────

  /**
   * Registra la decisión de Rectorado:
   * APPROVED = suscrito (adjunta convenio firmado) ·
   * REJECTED = no suscrito (notificación al solicitante obligatoria)
   */
  @Roles('admin', 'editor')
  @Post(':agreementId/rectorate-decision')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  rectorateDecision(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Body()
    body: {
      decision: 'APPROVED' | 'REJECTED';
      notification_message?: string;
      rectorate_oficio_number?: string;
    },
    @UploadedFile() file?: UploadedFileLike & { filename?: string },
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.processService.rectorateDecision(
      agreementId,
      body.decision,
      {
        notificationMessage: body.notification_message,
        rectorate_oficio_number: body.rectorate_oficio_number,
      },
      file,
      req?.user?.id,
    );
  }

  /** OCRI publica el convenio suscrito (evidencia opcional) */
  @Roles('admin', 'editor')
  @Post(':agreementId/publish')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  publishConvenio(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @UploadedFile() file?: UploadedFileLike & { filename?: string },
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.processService.publish(agreementId, file, req?.user?.id);
  }

  /**
   * Registro institucional del convenio: resolución, vigencia, responsables
   * y convenio firmado escaneado (obligatorio). Activa el semáforo.
   */
  @Roles('admin', 'editor')
  @Post(':agreementId/register-agreement')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  registerAgreement(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Body()
    body: {
      resolution_number?: string;
      start_date?: string;
      end_date?: string;
      drive_link?: string;
      observations?: string;
      responsables?: Array<{
        name: string;
        role?: string;
        side?: 'UNCP' | 'CONTRAPARTE';
        email?: string;
        phone?: string;
      }>;
    },
    @UploadedFile() file?: UploadedFileLike & { filename?: string },
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.processService.registerAgreement(
      agreementId,
      {
        resolution_number: body.resolution_number ?? '',
        start_date: body.start_date ?? '',
        end_date: body.end_date ?? '',
        drive_link: body.drive_link,
        observations: body.observations,
        responsables: this.parseResponsables(body.responsables),
      },
      file,
      req?.user?.id,
    );
  }

  /**
   * Por multipart los campos llegan como strings: `responsables` viaja como
   * JSON y debe parsearse de forma segura antes de llegar al servicio.
   */
  private parseResponsables(raw: unknown): Array<{
    name: string;
    role?: string;
    side?: 'UNCP' | 'CONTRAPARTE';
    email?: string;
    phone?: string;
  }> {
    type Responsable = {
      name: string;
      role?: string;
      side?: 'UNCP' | 'CONTRAPARTE';
      email?: string;
      phone?: string;
    };
    if (!raw) return [];
    if (typeof raw !== 'string') {
      return Array.isArray(raw) ? (raw as Responsable[]) : [];
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException(
        'El campo "responsables" debe ser un arreglo JSON válido.',
      );
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException(
        'El campo "responsables" debe ser un arreglo.',
      );
    }
    return parsed as Responsable[];
  }

  /** Administración de vigencia sobre convenios registrados */
  @Roles('admin', 'editor')
  @Post(':agreementId/validity')
  setValidityStatus(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Body() body: { validity: string; reason?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const allowed = ['VIGENTE', 'SUSPENDIDO', 'RESCINDIDO', 'VENCIDO'] as const;
    const validity = allowed.find((v) => v === body.validity);
    if (!validity) {
      throw new BadRequestException(
        `Vigencia inválida. Valores permitidos: ${allowed.join(', ')}`,
      );
    }
    return this.processService.setValidityStatus(
      agreementId,
      validity,
      body.reason,
      req.user?.id,
    );
  }
}

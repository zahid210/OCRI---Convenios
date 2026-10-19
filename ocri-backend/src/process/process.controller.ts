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
import { FLOW_ROLES } from '../auth/role-sets';
import { ProcessService } from './process.service';
import { safeMulterOptions } from '../common/uploads.config';
import type { UploadFile } from '../common/uploads.config';
import { GenerateOpinionRequestsDto } from './dto/generate-opinion-requests.dto';
import { SendOpinionRequestDto } from './dto/send-opinion-request.dto';
import { RespondOpinionRequestDto } from './dto/respond-opinion-request.dto';
import { ValidateOpinionRequestDto } from './dto/validate-opinion-request.dto';
import { GenerateOficioOpinionDto } from './dto/generate-oficio-opinion.dto';
import { UploadOficioOpinionDto } from './dto/upload-oficio-opinion.dto';
import { GenerateOficioRectoradoDto } from './dto/generate-oficio-rectorado.dto';
import { UploadProcessDocumentDto } from './dto/upload-process-document.dto';
import { ReplaceProcessDocumentDto } from './dto/replace-process-document.dto';
import { RectorateDecisionDto } from './dto/rectorate-decision.dto';
import { RegisterAgreementDto } from './dto/register-agreement.dto';
import { ResponsableItemDto } from './dto/register-agreement.dto';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SetValidityDto } from './dto/set-validity.dto';

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
  getProcessStatus(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.getProcessStatus(agreementId, req.user?.role);
  }

  @Get(':agreementId/events')
  getProcessEvents(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.getProcessEvents(agreementId, req.user?.role);
  }

  @Get(':agreementId/documents')
  getProcessDocuments(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.getProcessDocuments(agreementId, req.user?.role);
  }

  // ─── E1 · Opiniones de dependencias ────────────────────────────────────────

  @Roles(...FLOW_ROLES)
  @Post(':agreementId/opinion-requests')
  generateOpinionRequests(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Body()
    body: GenerateOpinionRequestsDto,
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

  @Roles(...FLOW_ROLES)
  @Post('opinion-requests/:id/send')
  sendOpinionRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: SendOpinionRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.sendOpinionRequest(id, body, req.user?.id);
  }

  @Roles(...FLOW_ROLES)
  @Post('opinion-requests/:id/respond')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  respondOpinionRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RespondOpinionRequestDto,
    @UploadedFile() file?: UploadFile,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.processService.respondOpinionRequest(
      id,
      body,
      file,
      req?.user?.id,
    );
  }

  @Roles(...FLOW_ROLES)
  @Post('opinion-requests/:id/validate')
  validateOpinionRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ValidateOpinionRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.validateOpinionRequest(id, body, req.user?.id);
  }

  @Roles(...FLOW_ROLES)
  @Post('opinion-requests/:id/cancel')
  cancelOpinionRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.cancelOpinionRequest(id, req.user?.id);
  }

  @Roles(...FLOW_ROLES)
  @Delete('opinion-requests/:id')
  deleteOpinionRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.deleteOpinionRequest(id, req.user?.id);
  }

  /** Devuelve el cuerpo editable precargado del oficio de solicitud de opinión */
  @Roles(...FLOW_ROLES)
  @Get('opinion-requests/:id/oficio/template')
  getOficioOpinionTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.getOficioOpinionTemplate(id, req.user?.role);
  }

  /** Genera el oficio, lo adjunta automáticamente y marca la solicitud como enviada */
  @Roles(...FLOW_ROLES)
  @Post('opinion-requests/:id/oficio/generate')
  generateOficioOpinion(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: GenerateOficioOpinionDto,
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

  /**
   * Adjunta un oficio de solicitud de opinión ya emitido (en papel o redactado
   * fuera del sistema) y marca la solicitud como enviada. Alternativa a
   * `oficio/generate` para quien ya tiene el oficio listo y solo necesita
   * cargarlo.
   */
  @Roles(...FLOW_ROLES)
  @Post('opinion-requests/:id/oficio/upload')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  uploadOficioOpinion(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadFile,
    @Body() body: UploadOficioOpinionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.uploadOficioOpinion(
      id,
      file,
      {
        oficio_number: body.oficio_number,
        adesa_number: body.adesa_number,
        sent_at: body.sent_at,
        sent_via: body.sent_via,
        directed_to: body.directed_to,
      },
      req.user?.id,
    );
  }

  /** Devuelve el cuerpo editable precargado del oficio de envío a Rectorado */
  @Roles(...FLOW_ROLES)
  @Get(':agreementId/oficio-rectorado/template')
  getOficioRectoradoTemplate(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.getOficioRectoradoTemplate(
      agreementId,
      req.user?.role,
    );
  }

  /** Genera el oficio a Rectorado, lo adjunta automáticamente y registra el evento */
  @Roles(...FLOW_ROLES)
  @Post(':agreementId/oficio-rectorado/generate')
  generateOficioRectorado(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Body()
    body: GenerateOficioRectoradoDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.generateOficioRectorado(
      agreementId,
      {
        bodyHtml: body.bodyHtml,
        oficio_number: body.oficio_number,
      },
      req.user?.id,
    );
  }

  // ─── E1 · Expediente técnico y envío a Rectorado ───────────────────────────

  /** Genera el expediente técnico fusionando automáticamente los oficios de respuesta */
  @Roles(...FLOW_ROLES)
  @Post(':agreementId/generate-expediente')
  generateExpediente(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.generateExpediente(agreementId, req.user?.id);
  }

  @Roles(...FLOW_ROLES)
  @Post(':agreementId/documents')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  uploadProcessDocument(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @UploadedFile() file: UploadFile,
    @Body()
    body: UploadProcessDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.uploadProcessDocument(
      agreementId,
      file,
      body,
      req.user?.id,
    );
  }

  /**
   * Reemplaza el archivo de un documento ya cargado en el trámite (traza en la
   * bitácora). No aplica a documentos generados por el sistema ni a oficios de
   * opinión, que tienen su propio flujo de corrección.
   */
  @Roles(...FLOW_ROLES)
  @Post(':agreementId/documents/:docId/replace')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  replaceProcessDocument(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Param('docId', ParseIntPipe) docId: number,
    @UploadedFile() file: UploadFile,
    @Body()
    body: ReplaceProcessDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.replaceProcessDocument(
      agreementId,
      docId,
      file,
      { direction: body.direction },
      req.user?.id,
    );
  }

  /** OCRI concluye el expediente técnico con las opiniones recopiladas */
  @Roles(...FLOW_ROLES)
  @Post(':agreementId/finalize-expediente')
  finalizeExpediente(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.finalizeExpediente(agreementId, req.user?.id);
  }

  /** Remite expediente técnico + propuesta + opinión a Rectorado (fin E1) */
  @Roles(...FLOW_ROLES)
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
  @Roles(...FLOW_ROLES)
  @Post(':agreementId/rectorate-decision')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  rectorateDecision(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Body()
    body: RectorateDecisionDto,
    @UploadedFile() file?: UploadFile,
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
  @Roles(...FLOW_ROLES)
  @Post(':agreementId/publish')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  publishConvenio(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @UploadedFile() file?: UploadFile,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.processService.publish(agreementId, file, req?.user?.id);
  }

  /**
   * Registro institucional del convenio: resolución, vigencia, responsables
   * y convenio firmado escaneado (obligatorio). Activa el semáforo.
   */
  @Roles(...FLOW_ROLES)
  @Post(':agreementId/register-agreement')
  @UseInterceptors(FileInterceptor('file', safeMulterOptions()))
  registerAgreement(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Body()
    body: RegisterAgreementDto,
    @UploadedFile() file?: UploadFile,
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
   * El ValidationPipe global ya normaliza `responsables` (string JSON de
   * multipart o arreglo de JSON) y valida cada ítem con `ResponsableItemDto`.
   * Este helper solo acepta el arreglo resultante y rechaza cualquier forma
   * inesperada con 400.
   */
  private parseResponsables(raw: unknown): ResponsableItemDto[] {
    if (raw == null) return [];
    if (!Array.isArray(raw)) {
      throw new BadRequestException(
        'El campo "responsables" debe ser un arreglo.',
      );
    }
    return raw.map((item, index) => {
      const instance = plainToInstance(ResponsableItemDto, item);
      const errors = validateSync(instance, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (errors.length > 0) {
        const detail = errors
          .map((e) => Object.values(e.constraints ?? {}).join(', '))
          .join('; ');
        throw new BadRequestException(
          `responsables[${index}] inválido: ${detail || 'estructura no válida'}`,
        );
      }
      return instance;
    });
  }

  /** Administración de vigencia sobre convenios registrados */
  @Roles(...FLOW_ROLES)
  @Post(':agreementId/validity')
  setValidityStatus(
    @Param('agreementId', ParseIntPipe) agreementId: number,
    @Body() body: SetValidityDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.processService.setValidityStatus(
      agreementId,
      body.validity,
      body.reason,
      req.user?.id,
    );
  }
}

import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  Res,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { extname, basename } from 'path';
import { Public } from '../auth/decorators/public.decorator';
import { StorageService } from '../common/storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { isRestrictedRole, isVisibleToRestricted } from '../common/visibility';
import { sanitizeDownloadName } from '../common/document-view';

/**
 * Repositorio institucional de documentos (protegido).
 *
 * Autenticación: únicamente mediante el header `Authorization: Bearer <jwt>`.
 *
 * Todos los archivos se sirven por id de documento
 * (`GET /resoluciones/by-id/:docId`): el backend resuelve la ruta interna a
 * partir de la fila `documents`, de modo que el cliente nunca manipula ni
 * conoce `file_path`. A propósito NO existe una ruta que acepte rutas
 * arbitrarias del bucket (Fase 3 · F3-1): antes, `GET /resoluciones/*` dejaba a
 * cualquier usuario autenticado leer cualquier objeto adivinando su ruta,
 * esquivando el modelo de descarga por id.
 *
 * Los bytes se transmiten a través del backend (no se redirige al bucket);
 * solo los PDF se sirven inline, el resto se descarga forzada para no ejecutar
 * contenido activo embebido.
 *
 * NOTA: no se admite el token por query string para evitar exponer el JWT
 * en la URL (logs, referrer, sharing). Los clientes deben adjuntar el header.
 */
@Controller('resoluciones')
export class FilesController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  private extractBearerToken(req: Request): string {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    if (!bearerToken) {
      throw new UnauthorizedException('Token de acceso requerido.');
    }
    return bearerToken;
  }

  private async verifyToken(
    bearerToken: string,
  ): Promise<{ role?: string; sub?: number }> {
    try {
      return await this.jwtService.verifyAsync(bearerToken);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  /**
   * Sirve los bytes del objeto desde el bucket a través del backend (sin 302).
   * OBS ignora el override Content-Disposition:inline si el objeto fue subido
   * con metadata de descarga y requiere CORS para leer bytes con fetch, así que
   * redirigir al bucket rompería la vista previa (descargaría en vez de mostrar
   * el PDF). Los PDF se sirven inline; el resto fuerza descarga.
   *
   * El nombre de descarga se sanea siempre (`sanitizeDownloadName`): nunca se
   * refleja en la cabecera un valor derivado del cliente sin filtrar.
   */
  private async pipeObject(
    res: Response,
    relPath: string,
    downloadName?: string,
  ) {
    const remote = await this.storage.getObjectStream(relPath);
    if (!remote) {
      // Mensaje genérico: no revela la ruta interna del objeto.
      throw new NotFoundException('El archivo solicitado no existe.');
    }

    res.setHeader('Content-Type', remote.contentType);
    if (downloadName) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${sanitizeDownloadName(downloadName)}"`,
      );
    } else if (extname(relPath).toLowerCase() === '.pdf') {
      res.setHeader('Content-Disposition', 'inline');
    } else {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${sanitizeDownloadName(basename(relPath))}"`,
      );
    }
    if (remote.length) {
      res.setHeader('Content-Length', String(remote.length));
    }
    return remote.stream.pipe(res);
  }

  /**
   * Descarga por id de documento. El backend resuelve la ruta interna del
   * objeto a partir de la fila `documents`, de modo que el cliente nunca
   * manipula ni conoce `file_path` (Fase 2 · H2.2 y Fase 3 · F3-1). El rol
   * restringido solo accede a documentos de convenios formalizados.
   */
  @Public()
  @Get('by-id/:docId')
  async serveById(
    @Param('docId', ParseIntPipe) docId: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const payload = await this.verifyToken(this.extractBearerToken(req));

    const doc = await this.prisma.documents.findUnique({
      where: { id: BigInt(docId) },
      select: {
        file_path: true,
        agreements: { select: { process_status: true } },
      },
    });
    if (!doc || !doc.file_path) {
      throw new NotFoundException(`Documento #${docId} no encontrado.`);
    }

    if (
      isRestrictedRole(payload.role) &&
      !isVisibleToRestricted(doc.agreements?.process_status)
    ) {
      throw new NotFoundException(`Documento #${docId} no encontrado.`);
    }

    const rawName = req.query.name;
    const downloadName =
      typeof rawName === 'string' && rawName.length > 0 ? rawName : undefined;

    return this.pipeObject(res, doc.file_path, downloadName);
  }
}

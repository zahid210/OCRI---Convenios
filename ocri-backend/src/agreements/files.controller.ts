import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  Res,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { extname, basename, normalize } from 'path';
import { Public } from '../auth/decorators/public.decorator';
import { StorageService } from '../common/storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { isRestrictedRole, isVisibleToRestricted } from '../common/visibility';

/**
 * Repositorio institucional de documentos (protegido).
 *
 * Autenticación: únicamente mediante el header `Authorization: Bearer <jwt>`.
 * Acepta rutas relativas dentro del prefijo S3 (p. ej. `2021/001-2021.pdf`) y
 * sirve el objeto desde el bucket. Los bytes se transmiten a través del backend
 * (no se redirige al bucket); solo los PDF se sirven inline, el resto se
 * descarga forzada para no ejecutar contenido activo embebido.
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

  private resolveRelativePath(rawPath: string): string {
    const decoded = (() => {
      try {
        return decodeURIComponent(rawPath);
      } catch {
        return rawPath;
      }
    })();

    // Rechaza separadores peligrosos (.., rutas absolutas) y vacíos.
    if (
      !decoded ||
      decoded.includes('..') ||
      decoded.startsWith('/') ||
      decoded.startsWith('\\')
    ) {
      throw new BadRequestException('Ruta de archivo inválida');
    }

    // Solo permite el patrón:
    // [<año>/][<código>[/opiniones/<dependencia>]]/<nombre.ext>
    // Son hasta 4 niveles de subcarpeta: `año`, `código`, `opiniones` y
    // `dependencia` son los que produce `opinionDir()` en uploads.config.ts, que
    // es justo el formato de los oficios de opinión. Con menos niveles esos
    // archivos quedaban ilegibles ("Ruta de archivo inválida") aunque estuvieran
    // correctamente subidos al bucket.
    if (
      !/^([\w.\-() º\u00A0-\u017F]+\/){0,4}[\w.\-() º\u00A0-\u017F]+$/.test(
        decoded,
      )
    ) {
      throw new BadRequestException('Ruta de archivo inválida');
    }

    const normalized = normalize(decoded);
    if (normalized.startsWith('..') || normalized.includes('..')) {
      throw new BadRequestException('Ruta de archivo inválida');
    }
    return normalized;
  }

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
   */
  private async pipeObject(
    res: Response,
    relPath: string,
    downloadName?: string,
  ) {
    const remote = await this.storage.getObjectStream(relPath);
    if (!remote) {
      throw new NotFoundException(`El archivo "${relPath}" no existe.`);
    }

    res.setHeader('Content-Type', remote.contentType);
    if (downloadName) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadName.replace(/["\\]/g, '_')}"`,
      );
    } else if (extname(relPath).toLowerCase() === '.pdf') {
      res.setHeader('Content-Disposition', 'inline');
    } else {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${basename(relPath).replace(/["\\]/g, '_')}"`,
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
   * manipula ni conoce `file_path` (Fase 2 · H2.2). El rol restringido solo
   * accede a documentos de convenios formalizados.
   *
   * Debe declararse ANTES del wildcard `@Get('*')` para que Express lo
   * resuelva primero.
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

  @Public()
  @Get('*')
  async serveFile(@Req() req: Request, @Res() res: Response) {
    const payload = await this.verifyToken(this.extractBearerToken(req));

    // El rol restringido no puede saltarse el confinamiento de Fase 2 (H2.1)
    // usando la ruta directa por `file_path`; para él solo existe la descarga
    // por id, que valida el estado del convenio.
    if (isRestrictedRole(payload.role)) {
      throw new NotFoundException('El archivo solicitado no existe.');
    }

    const relPath = this.resolveRelativePath(
      req.path.replace(/^\/(?:api\/)?resoluciones\/?/, ''),
    );

    const rawName = req.query.name;
    const downloadName =
      typeof rawName === 'string' && rawName.length > 0 ? rawName : undefined;

    return this.pipeObject(res, relPath, downloadName);
  }
}

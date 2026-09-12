import {
  Controller,
  Get,
  Req,
  Res,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { extname, basename, normalize } from 'path';
import { existsSync } from 'fs';
import { Public } from '../auth/decorators/public.decorator';
import { absUploadPath, UPLOADS_DIR } from '../common/uploads.config';
import { StorageService } from '../common/storage/storage.service';

/**
 * Repositorio institucional de documentos (protegido).
 *
 * Autenticación: únicamente mediante el header `Authorization: Bearer <jwt>`.
 * Acepta rutas relativas bajo uploads/ (p. ej. `2021/001-2021.pdf`) y sirve el
 * archivo correspondiente. La ruta se valida estrictamente para impedir path
 * traversal. Se soportan archivos anidados en subcarpetas por año y también
 * en la raíz.
 *
 * NOTA: no se admite el token por query string para evitar exponer el JWT
 * en la URL (logs, referrer, sharing). Los clientes deben adjuntar el header.
 */
@Controller('resoluciones')
export class FilesController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly storage: StorageService,
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

    // Solo permite el patrón: [<año>/][<código>[/opiniones/<dependencia>]]/<nombre.ext>
    // (hasta 3 niveles de subcarpeta) para soportar la organización por año y
    // por convenio (incluyendo las subcarpetas de opiniones por dependencia).
    if (
      !/^([\w.\-() º\u00A0-\u017F]+\/){0,3}[\w.\-() º\u00A0-\u017F]+$/.test(
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

  @Public()
  @Get('*')
  async serveFile(@Req() req: Request, @Res() res: Response) {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    if (!bearerToken) {
      throw new UnauthorizedException('Token de acceso requerido.');
    }

    try {
      await this.jwtService.verifyAsync(bearerToken);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }

    const relPath = this.resolveRelativePath(
      req.path.replace(/^\/(?:api\/)?resoluciones\/?/, ''),
    );

    const rawName = req.query.name;
    const downloadName =
      typeof rawName === 'string' && rawName.length > 0 ? rawName : undefined;

    // Modo normal: los bytes se sirven a través del backend con el JWT por
    // header. Cuando el objeto está en S3/OBS se hace streaming (sin 302):
    // OBS ignora el override Content-Disposition:inline si el objeto fue subido
    // con metadata de descarga y requiere CORS para leer bytes con fetch, así
    // que redirigir al bucket rompería la vista previa (descargaría en vez de
    // mostrar el PDF). Los PDF se sirven inline; el resto fuerza descarga.
    const remote = await this.storage.getObjectStream(relPath);
    const setDisposition = (disposition: string) =>
      res.setHeader('Content-Disposition', disposition);
    if (remote) {
      res.setHeader('Content-Type', remote.contentType);
      if (downloadName) {
        setDisposition(
          `attachment; filename="${downloadName.replace(/["\\]/g, '_')}"`,
        );
      } else if (extname(relPath).toLowerCase() === '.pdf') {
        setDisposition('inline');
      } else {
        setDisposition(
          `attachment; filename="${basename(relPath).replace(/["\\]/g, '_')}"`,
        );
      }
      if (remote.length) {
        res.setHeader('Content-Length', String(remote.length));
      }
      return remote.stream.pipe(res);
    }

    const filePath = absUploadPath(relPath);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`El archivo "${relPath}" no existe.`);
    }

    // Solo los PDF se sirven inline (vista previa del navegador); el resto se
    // descarga forzada para no ejecutar contenido activo embebido si un archivo
    // malicioso llegó a guardarse como imagen/ofimática.
    if (extname(relPath).toLowerCase() !== '.pdf') {
      const name = basename(relPath);
      setDisposition(`attachment; filename="${name.replace(/["\\]/g, '_')}"`);
    }

    return res.sendFile(relPath, { root: UPLOADS_DIR });
  }
}

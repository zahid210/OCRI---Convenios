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

    // Si el storage S3-compatible está configurado, se sirve con una URL
    // prefirmada (TTL S3_PRESIGN_TTL) vía redirección 302. El JWT se sigue
    // validando aquí: la URL prefirmada solo se emite a usuarios autenticados.
    const rawName = req.query.name;
    const downloadName =
      typeof rawName === 'string' && rawName.length > 0 ? rawName : undefined;
    const presigned = await this.storage.presignGetUrl(relPath, downloadName);

    // Modo ?url=1: devuelve la URL prefirmada como JSON en lugar de redirigir.
    // Algunos clientes (vista previa en pestaña nueva, descarga por ancla) no
    // pueden leer el cuerpo de un fetch cross-origin al bucket si este no
    // define cabeceras CORS; navegar/descargar sobre la URL del bucket no
    // necesita CORS. Los archivos locales (sin storage) responden {mode:'local'}
    // para que el frontend use la ruta blob autenticada.
    const wantsUrl = req.query.url === '1';
    if (presigned) {
      if (wantsUrl) {
        return res.json({ mode: 'presigned', url: presigned });
      }
      return res.redirect(302, presigned);
    }

    const filePath = absUploadPath(relPath);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`El archivo "${relPath}" no existe.`);
    }

    if (wantsUrl) {
      return res.json({ mode: 'local' });
    }

    // Solo los PDF se sirven inline (vista previa del navegador); el resto se
    // descarga forzada para no ejecutar contenido activo embebido si un archivo
    // malicioso llegó a guardarse como imagen/ofimática.
    if (extname(relPath).toLowerCase() !== '.pdf') {
      const name = basename(relPath);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${name.replace(/["\\]/g, '_')}"`,
      );
    }

    return res.sendFile(relPath, { root: UPLOADS_DIR });
  }
}

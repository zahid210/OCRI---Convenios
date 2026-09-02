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
import { join, normalize } from 'path';
import { existsSync } from 'fs';
import { Public } from '../auth/decorators/public.decorator';
import { UPLOADS_DIR } from '../common/uploads.config';

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
  constructor(private readonly jwtService: JwtService) {}

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

    // Solo permite el patrón: [<año>/]<nombre.ext> (máximo un nivel de subcarpeta).
    if (
      !/^[\w.\-() º\u00A0-\u017F]+(\/[\w.\-() º\u00A0-\u017F]+)?$/.test(decoded)
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
      req.path.replace(/^\/resoluciones\/?/, ''),
    );
    const filePath = join(UPLOADS_DIR, relPath);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`El archivo "${relPath}" no existe.`);
    }

    return res.sendFile(relPath, { root: UPLOADS_DIR });
  }
}

import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { Public } from '../auth/decorators/public.decorator';
import {
  sanitizeRequestedFileName,
  UPLOADS_DIR,
} from '../common/uploads.config';

/**
 * Repositorio institucional de documentos (protegido).
 *
 * Autenticación: únicamente mediante el header `Authorization: Bearer <jwt>`.
 * Se sirve con `root` fijo en /uploads y el nombre se valida estrictamente
 * (sin rutas ni separadores) para impedir path traversal.
 *
 * NOTA: no se admite el token por query string para evitar exponer el JWT
 * en la URL (logs, referrer, sharing). Los clientes deben adjuntar el header.
 */
@Controller('resoluciones')
export class FilesController {
  constructor(private readonly jwtService: JwtService) {}

  @Public()
  @Get(':filename')
  async serveFile(
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
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

    const baseName = sanitizeRequestedFileName(filename);
    const filePath = join(UPLOADS_DIR, baseName);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`El archivo "${baseName}" no existe.`);
    }

    return res.sendFile(baseName, { root: UPLOADS_DIR });
  }
}

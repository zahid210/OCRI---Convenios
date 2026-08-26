import {
  Controller,
  Get,
  Param,
  Query,
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
 * Autenticación:
 *  - Header `Authorization: Bearer <jwt>` (uso general), o
 *  - Query param `?token=<jwt>` para visores que no pueden enviar cabeceras
 *    (iframe/embed). El token nunca se almacena; solo se valida.
 *
 * El nombre de archivo se valida estrictamente (sin rutas ni separadores) y la
 * respuesta se sirve con `root` fijo en /uploads para impedir path traversal.
 */
@Controller('resoluciones')
export class FilesController {
  constructor(private readonly jwtService: JwtService) {}

  @Public()
  @Get(':filename')
  async serveFile(
    @Param('filename') filename: string,
    @Query('token') queryToken: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    const token = bearerToken ?? queryToken;
    if (!token) {
      throw new UnauthorizedException('Token de acceso requerido.');
    }

    try {
      await this.jwtService.verifyAsync(token);
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

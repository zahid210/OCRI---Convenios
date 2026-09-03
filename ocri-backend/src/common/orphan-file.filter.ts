import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { existsSync, unlinkSync } from 'fs';

/**
 * Limpia archivos huérfanos cuando un controlador con subida de archivos
 * (multer) termina en error.
 *
 * Multer escribe el archivo en disco ANTES de que el guard/validación de la
 * lógica de negocio se ejecute. Si esa lógica lanza una excepción (p. ej. la
 * solicitud de opinión no está en un estado válido), el archivo recién cargado
 * quedaba varado en `uploads/` sin nunca moverse a la carpeta del convenio.
 *
 * Este filtro, ante cualquier `HttpException`, borra el archivo subido SOLO si
 * todavía existe en su ubicación multer original. Cuando una carga se completó
 * (la lógica lo movió a la carpeta del convenio con `moveIntoAgreementDir`), esa
 * ruta original ya no existe, por lo que es seguro: solo se eliminan huérfanos
 * reales, nunca archivos ya procesados o generados por la lógica.
 */
@Catch(HttpException)
export class OrphanFileFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    this.cleanupRequestFiles(request);

    const response = ctx.getResponse<Response>();
    response.status(exception.getStatus()).json(exception.getResponse());
  }

  private cleanupRequestFiles(request: Request): void {
    const file = request.file as { path?: string } | undefined;
    if (file?.path) {
      this.unlinkIfExists(file.path);
      return;
    }

    const files = request.files as
      | Record<string, Array<{ path?: string }>>
      | Array<{ path?: string }>
      | undefined;

    if (!files) return;

    if (Array.isArray(files)) {
      for (const f of files) {
        if (f?.path) this.unlinkIfExists(f.path);
      }
      return;
    }

    for (const key of Object.keys(files)) {
      for (const f of files[key]) {
        if (f?.path) this.unlinkIfExists(f.path);
      }
    }
  }

  private unlinkIfExists(filePath: string): void {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {
      // Ignora fallos de limpieza: no debe enmascarar la excepción original.
    }
  }
}

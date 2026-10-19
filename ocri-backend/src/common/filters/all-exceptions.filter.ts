import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/** A partir de este código el error es de servidor: se registra con stack. */
const SERVER_ERROR_MIN_STATUS = 500;

/**
 * En producción no se registran los 4xx (validaciones, 401 de polling con
 * sesión vencida) para no inundar el log; en desarrollo sí ayudan a depurar.
 */
const LOG_CLIENT_ERRORS = process.env.NODE_ENV !== 'production';

/**
 * Filtro global de excepciones.
 *
 * Mantiene EXACTAMENTE la forma de error por defecto de Nest
 * (`{ statusCode, message, error? }`) para no romper a los clientes que ya la
 * consumen, y añade lo que faltaba: logging con contexto para los 5xx (con
 * stack) y para los 4xx en desarrollo (sin stack). El identificador de la
 * petición va en la cabecera `X-Request-Id` (y queda en el log), no en el
 * cuerpo, para no alterar el contrato existente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.toErrorBody(exception);
    const method = request?.method ?? '-';
    const url = request?.originalUrl ?? request?.url ?? '-';
    const requestId = this.requestId(request);
    const context = `${method} ${url} -> ${status}${requestId ? ` [${requestId}]` : ''}`;

    if (status >= SERVER_ERROR_MIN_STATUS) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${context}: ${this.describe(exception)}`, stack);
    } else if (LOG_CLIENT_ERRORS) {
      this.logger.debug(`${context}: ${this.describe(exception)}`);
    }

    if (response && !response.headersSent) {
      response.status(status).json(body);
    }
  }

  private toErrorBody(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { status, body: { statusCode: status, message: res } };
      }
      const obj = res as Record<string, unknown>;
      return {
        status,
        body: {
          statusCode: status,
          message:
            (obj.message as string | string[] | undefined) ?? exception.message,
          error: obj.error as string | undefined,
        },
      };
    }

    // Error no controlado: no se filtra al cliente el mensaje interno.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno del servidor',
      },
    };
  }

  private describe(exception: unknown): string {
    if (exception instanceof Error) return exception.message;
    return String(exception);
  }

  private requestId(request?: Request): string | undefined {
    const header = request?.headers?.['x-request-id'];
    return Array.isArray(header) ? header[0] : header;
  }
}

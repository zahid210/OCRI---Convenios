import { Controller, Post, Req } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CatalogsService } from './catalogs.service';

/** req.user lo inyecta el JwtAuthGuard. */
interface AuthenticatedRequest {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  /**
   * Siembra todos los catálogos base de una sola vez. Solo admin; idempotente.
   */
  @Roles('admin')
  @Post('seed')
  seed(@Req() req: AuthenticatedRequest) {
    return this.catalogsService.seedAll(req.user);
  }
}

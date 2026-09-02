import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

interface AcknowledgeBody {
  keys: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.findAll(req.user?.id);
  }

  @Post('acknowledge')
  acknowledge(@Body() body: AcknowledgeBody, @Req() req: AuthenticatedRequest) {
    return this.notificationsService.acknowledge(
      req.user?.id ?? 0,
      body?.keys ?? [],
    );
  }

  @Post('read-all')
  readAll(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.readAll(req.user?.id ?? 0);
  }

  @Post('reset-read')
  resetRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.resetRead(req.user?.id ?? 0);
  }
}

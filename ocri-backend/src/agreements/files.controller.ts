import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { Public } from '../auth/decorators/public.decorator';

@Controller('resoluciones')
export class FilesController {
  @Public()
  @Get(':filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const decodedFileName = decodeURIComponent(filename);
    const filePath = join(process.cwd(), 'uploads', decodedFileName);

    if (!existsSync(filePath)) {
      throw new NotFoundException(`El archivo "${decodedFileName}" no existe.`);
    }

    return res.sendFile(filePath);
  }
}

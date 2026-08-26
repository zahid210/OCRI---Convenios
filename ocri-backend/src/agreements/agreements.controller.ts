import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AgreementsService } from './agreements.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementDto } from './dto/update-agreement.dto';
import { FilterAgreementsDto } from './dto/filter-agreements.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { safeMulterOptions, UploadedFileLike } from '../common/uploads.config';

@Controller('agreements')
export class AgreementsController {
  constructor(private readonly agreementsService: AgreementsService) {}

  @Get('lookups/institutions')
  getInstitutions() {
    return this.agreementsService.getInstitutionsLookup();
  }

  @Get('lookups/types')
  getAgreementTypes() {
    return this.agreementsService.getAgreementTypesLookup();
  }

  @Get()
  findAll(@Query() filters: FilterAgreementsDto) {
    return this.agreementsService.findAll(filters);
  }

  @Get('search')
  searchAgreements(@Query('q') q?: string) {
    return this.agreementsService.search(q);
  }

  /** Semáforo de convenios registrados y vigentes */
  @Get('expiration-tracking')
  getExpirationTracking() {
    return this.agreementsService.getExpirationTracking();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.agreementsService.findOne(id);
  }

  /**
   * E1 · OCRI registra la solicitud de propuesta recibida de Rectorado.
   * Adjuntos: oficio_solicitud (Oficio de Solicitud) y propuesta (Propuesta de Convenio).
   */
  @Roles('admin', 'editor')
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'oficio_solicitud', maxCount: 1 },
        { name: 'propuesta', maxCount: 1 },
      ],
      safeMulterOptions(),
    ),
  )
  create(
    @Body() createAgreementDto: CreateAgreementDto,
    @UploadedFiles()
    files?: {
      oficio_solicitud?: UploadedFileLike[];
      propuesta?: UploadedFileLike[];
    },
  ) {
    return this.agreementsService.create(createAgreementDto, files);
  }

  @Roles('admin', 'editor')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAgreementDto: UpdateAgreementDto,
  ) {
    return this.agreementsService.update(id, updateAgreementDto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.agreementsService.remove(id);
  }

  @Roles('admin')
  @Delete('documents/:docId')
  removeAgreementDocument(@Param('docId', ParseIntPipe) docId: number) {
    return this.agreementsService.removeAgreementDocument(docId);
  }
}

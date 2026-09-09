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
import { FLOW_ROLES, CREATOR_ROLES } from '../auth/role-sets';
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
   * Adjuntos opcionales: dictamen (Dictamen) y documentos_origen (Documentos de Origen, múltiples).
   */
  @Roles(...CREATOR_ROLES)
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'dictamen', maxCount: 1 },
        { name: 'documentos_origen', maxCount: 20 },
      ],
      safeMulterOptions(),
    ),
  )
  create(
    @Body() createAgreementDto: CreateAgreementDto,
    @UploadedFiles()
    files?: {
      dictamen?: UploadedFileLike[];
      documentos_origen?: UploadedFileLike[];
    },
  ) {
    return this.agreementsService.create(createAgreementDto, files);
  }

  @Roles(...FLOW_ROLES)
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

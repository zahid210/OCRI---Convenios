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
  UploadedFile,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AgreementsService } from './agreements.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementDto } from './dto/update-agreement.dto';
import { FilterAgreementsDto } from './dto/filter-agreements.dto';
import { UpdateSituationDto } from './dto/update-situation.dto';
import { UpdateEnvioDto } from './dto/update-envio.dto';
import { ActivateAgreementDto } from './dto/activate-agreement.dto';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
const multerStorage = diskStorage({
  destination: './uploads',
  filename: (
    _req: unknown,
    file: MulterFile,
    callback: (error: Error | null, filename: string) => void,
  ) => {
    callback(null, file.originalname);
  },
});

const multerOptions = {
  storage: multerStorage,
};
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

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

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.agreementsService.findOne(id);
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'dictamen', maxCount: 1 },
        { name: 'document', maxCount: 1 },
      ],
      multerOptions,
    ),
  )
  create(
    @Body() createAgreementDto: CreateAgreementDto,
    @UploadedFiles()
    files?: {
      dictamen?: MulterFile[];
      document?: MulterFile[];
    },
  ) {
    return this.agreementsService.create(createAgreementDto, files);
  }

  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'dictamen', maxCount: 1 },
        { name: 'document', maxCount: 1 },
      ],
      multerOptions,
    ),
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAgreementDto: UpdateAgreementDto,
    @UploadedFiles()
    files?: {
      dictamen?: MulterFile[];
      document?: MulterFile[];
    },
  ) {
    return this.agreementsService.update(id, updateAgreementDto, files);
  }

  @Patch(':id/situation')
  updateSituation(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSituationDto: UpdateSituationDto,
  ) {
    return this.agreementsService.updateSituation(id, updateSituationDto);
  }

  @Post(':id/roadmap/init')
  initRoadmap(@Param('id', ParseIntPipe) id: number) {
    return this.agreementsService.initRoadmap(id);
  }

  @Post('roadmap/:itemId/documents')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  uploadRoadmapDoc(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query('type') type: 'entrada' | 'salida',
    @UploadedFile() file: MulterFile,
  ) {
    return this.agreementsService.uploadRoadmapDocument(itemId, file, type);
  }

  @Delete('roadmap/documents/:docId')
  deleteRoadmapDoc(@Param('docId', ParseIntPipe) docId: number) {
    return this.agreementsService.deleteRoadmapDocument(docId);
  }

  @Patch('roadmap/:itemId/envio')
  updateRoadmapEnvio(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() updateEnvioDto: UpdateEnvioDto,
  ) {
    return this.agreementsService.updateRoadmapEnvio(itemId, updateEnvioDto);
  }

  @Patch(':id/activate')
  activateAgreement(
    @Param('id', ParseIntPipe) id: number,
    @Body() activateDto: ActivateAgreementDto,
  ) {
    return this.agreementsService.activateAgreement(id, activateDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.agreementsService.remove(id);
  }

  @Delete('documents/:docId')
  removeAgreementDocument(@Param('docId', ParseIntPipe) docId: number) {
    return this.agreementsService.removeAgreementDocument(docId);
  }
}

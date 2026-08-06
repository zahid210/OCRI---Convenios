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
    FileFieldsInterceptor([
      { name: 'dictamen', maxCount: 1 },
      { name: 'document', maxCount: 1 },
    ]),
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
    FileFieldsInterceptor([
      { name: 'dictamen', maxCount: 1 },
      { name: 'document', maxCount: 1 },
    ]),
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

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.agreementsService.remove(id);
  }
}

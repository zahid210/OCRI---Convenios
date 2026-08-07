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
import { diskStorage } from 'multer';
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

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.agreementsService.remove(id);
  }
}

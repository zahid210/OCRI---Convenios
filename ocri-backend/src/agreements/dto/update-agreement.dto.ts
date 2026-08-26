import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { CreateAgreementDto } from './create-agreement.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateAgreementDto extends PartialType(CreateAgreementDto) {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsNumber({}, { message: 'institution_id debe ser un número' })
  institution_id?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsNumber({}, { message: 'agreement_type_id debe ser un número' })
  agreement_type_id?: number;

  @IsOptional()
  @IsString()
  @Transform(trim)
  observations?: string;
}

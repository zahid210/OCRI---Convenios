import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ValidateOpinionRequestDto {
  // Los multipart envían "true"/"false" como string; el JSON como booleano.
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean({ message: 'valid debe ser un booleano' })
  valid: boolean;

  @IsOptional()
  @IsString()
  observations?: string;
}

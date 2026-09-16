import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ValidateOpinionRequestDto {
  // Los multipart envían "true"/"false" como string; el JSON como booleano.
  // Cualquier otro valor se deja intacto para que @IsBoolean lo rechace.
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'valid debe ser un booleano' })
  valid: boolean;

  @IsOptional()
  @IsString()
  observations?: string;
}

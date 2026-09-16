import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateOficioOpinionDto {
  @IsString()
  @IsNotEmpty({ message: 'bodyHtml es requerido' })
  @MaxLength(200_000, { message: 'bodyHtml excede el tamaño permitido' })
  bodyHtml: string;

  @IsOptional()
  @IsString()
  sent_via?: string;

  @IsOptional()
  @IsString()
  adesa_number?: string;

  @IsOptional()
  @IsString()
  oficio_number?: string;

  @IsOptional()
  @IsString()
  directed_to?: string;
}

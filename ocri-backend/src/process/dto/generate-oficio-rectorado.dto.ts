import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateOficioRectoradoDto {
  @IsString()
  @IsNotEmpty({ message: 'bodyHtml es requerido' })
  @MaxLength(200_000, { message: 'bodyHtml excede el tamaño permitido' })
  bodyHtml: string;

  @IsOptional()
  @IsString()
  oficio_number?: string;
}

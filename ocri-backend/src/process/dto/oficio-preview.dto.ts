import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class OficioPreviewDto {
  @IsString()
  @IsNotEmpty({ message: 'bodyHtml es requerido' })
  @MaxLength(200_000, { message: 'bodyHtml excede el tamaño permitido' })
  bodyHtml: string;
}

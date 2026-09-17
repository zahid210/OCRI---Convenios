import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_OFICIO_HTML_LENGTH } from '../../common/sanitize-oficio-html';

export class OficioPreviewDto {
  @IsString()
  @IsNotEmpty({ message: 'bodyHtml es requerido' })
  @MaxLength(MAX_OFICIO_HTML_LENGTH, {
    message: 'bodyHtml excede el tamaño permitido',
  })
  bodyHtml: string;
}

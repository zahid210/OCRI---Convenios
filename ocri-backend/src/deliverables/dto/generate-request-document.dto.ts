import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_OFICIO_HTML_LENGTH } from '../../common/sanitize-oficio-html';

export class GenerateRequestDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_OFICIO_HTML_LENGTH, {
    message: `El contenido del oficio no puede superar los ${MAX_OFICIO_HTML_LENGTH} caracteres`,
  })
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  oficio_number?: string;
}

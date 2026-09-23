import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateRequestDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000000, {
    message: 'El contenido del oficio no puede superar los 5 000 000 caracteres',
  })
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  oficio_number?: string;
}
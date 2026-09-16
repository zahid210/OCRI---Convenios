import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UploadProcessDocumentDto {
  @IsString()
  @IsNotEmpty({ message: 'document_type_code es requerido' })
  document_type_code: string;

  @IsOptional()
  @IsString()
  direction?: string;
}

import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateInstitutionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El país no puede estar vacío' })
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El tipo no puede estar vacío' })
  type?: string;
}

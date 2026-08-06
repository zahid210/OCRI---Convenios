import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateInstitutionDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  @MaxLength(255)
  name: string;

  @IsNotEmpty({ message: 'El país es obligatorio' })
  @IsString()
  @MaxLength(100)
  country: string;

  @IsNotEmpty({ message: 'El tipo es obligatorio' })
  @IsString()
  type: string;
}

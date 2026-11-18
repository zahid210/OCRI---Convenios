import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RegisterAdendaDto {
  @IsString()
  @IsNotEmpty({ message: 'El N° de resolución de la adenda es obligatorio.' })
  @MaxLength(255)
  resolution_number!: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La nueva fecha de fin debe tener formato YYYY-MM-DD.' },
  )
  new_end_date?: string;

  @IsOptional()
  @IsString()
  responsables_json?: string;
}

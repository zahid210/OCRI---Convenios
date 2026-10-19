import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';

/**
 * Un responsable del convenio. Se valida estructuralmente para que una entrada
 * mal formada devuelva 400 en lugar de fallar más adelante con un 500.
 */
export class ResponsableItemDto {
  @IsString()
  @MaxLength(255, { message: 'name no debe exceder 255 caracteres' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'role no debe exceder 150 caracteres' })
  role?: string;

  @IsOptional()
  @IsIn(['UNCP', 'CONTRAPARTE'], {
    message: 'side debe ser UNCP o CONTRAPARTE',
  })
  side?: 'UNCP' | 'CONTRAPARTE';

  @IsOptional()
  @IsEmail({}, { message: 'email debe ser un correo válido' })
  @MaxLength(255, { message: 'email no debe exceder 255 caracteres' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'phone no debe exceder 50 caracteres' })
  phone?: string;
}

/**
 * Registro institucional del convenio. Viene por multipart, por lo que
 * `responsables` viaja como string JSON; `parseResponsables` (controller)
 * se encarga de convertirlo y luego se valida con `class-validator`.
 */
export class RegisterAgreementDto {
  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'resolution_number no debe exceder 255 caracteres',
  })
  resolution_number?: string;

  @IsOptional()
  @IsDateString({}, { message: 'start_date debe tener formato YYYY-MM-DD' })
  start_date?: string;

  @IsOptional()
  @IsDateString({}, { message: 'end_date debe tener formato YYYY-MM-DD' })
  end_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'drive_link no debe exceder 500 caracteres' })
  drive_link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'observations no debe exceder 5000 caracteres' })
  observations?: string;

  // Por multipart el campo llega como string JSON; en JSON puro, como arreglo.
  // El transform normaliza ambos a un arreglo antes de validar cada ítem.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    let parsed: unknown = value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      try {
        parsed = JSON.parse(trimmed) as unknown;
      } catch {
        return value;
      }
    }
    // Convertir cada ítem a instancia para que la validación anidada funcione
    // (el `@Transform` propio desplaza al `@Type`, así que se hace aquí).
    if (Array.isArray(parsed)) {
      return parsed.map((item) => plainToInstance(ResponsableItemDto, item));
    }
    return parsed;
  })
  @IsArray({ message: 'responsables debe ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => ResponsableItemDto)
  responsables?: ResponsableItemDto[];
}

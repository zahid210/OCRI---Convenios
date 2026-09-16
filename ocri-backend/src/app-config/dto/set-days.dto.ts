import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Días pedidos en PATCH /config/*-days. Límite a 1 año para evitar y/o abusos. */
export class SetDaysDto {
  @Type(() => Number)
  @IsInt({ message: 'days debe ser un número entero' })
  @Min(1, { message: 'days debe ser al menos 1' })
  @Max(365, { message: 'days no puede superar 365' })
  days: number;
}

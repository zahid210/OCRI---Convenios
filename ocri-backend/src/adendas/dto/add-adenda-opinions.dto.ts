import { ArrayMinSize, IsArray, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class AddAdendaOpinionsDto {
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Debe seleccionar al menos una dependencia.',
  })
  @Type(() => Number)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  dependencia_ids!: number[];
}

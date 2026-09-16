import { IsArray, IsString } from 'class-validator';

export class AcknowledgeNotificationsDto {
  @IsArray({ message: 'keys debe ser un arreglo' })
  @IsString({ each: true, message: 'cada key debe ser un string' })
  keys: string[];
}

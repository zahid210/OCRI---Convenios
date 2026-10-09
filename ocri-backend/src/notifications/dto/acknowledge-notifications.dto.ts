import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

/**
 * Cuerpo de POST /notifications/acknowledge.
 *
 * Auditaría: antes se validaba el tipo de cada key pero no su tamaño ni el
 * largo del arreglo: un cliente podía mandar miles de claves (10k → ~1.3s de
 * procesamiento) y las claves >120 chars se descartaban en silencio. Ahora
 * todo llega acotado y con error explícito.
 */
export class AcknowledgeNotificationsDto {
  @IsArray({ message: 'keys debe ser un arreglo' })
  @ArrayMaxSize(200, { message: 'keys no debe exceder los 200 elementos' })
  @IsString({ each: true, message: 'cada key debe ser un string' })
  @MaxLength(120, {
    each: true,
    message: 'cada key no debe exceder los 120 caracteres',
  })
  keys: string[];
}

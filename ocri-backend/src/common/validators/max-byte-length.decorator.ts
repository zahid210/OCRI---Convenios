import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Longitud máxima medida en BYTES UTF-8 (no en caracteres).
 *
 * Necesario para contraseñas: bcrypt solo procesa los primeros 72 bytes, de
 * modo que un límite en caracteres permitiría contraseñas que la aplicación
 * cree distintas y no lo son. Con esto el contrato de longitud coincide con lo
 * que realmente hace el hash.
 */
export function MaxByteLength(
  max: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'maxByteLength',
      target: object.constructor,
      propertyName,
      constraints: [max],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string') return false;
          const [limit] = args.constraints as [number];
          return Buffer.byteLength(value, 'utf8') <= limit;
        },
      },
    });
  };
}

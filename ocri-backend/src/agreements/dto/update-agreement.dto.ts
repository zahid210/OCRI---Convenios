import { PartialType } from '@nestjs/mapped-types';
import { CreateAgreementDto } from './create-agreement.dto';

/**
 * Todos los campos pasan a opcionales, pero conservan las validaciones de
 * formato/longitud de `CreateAgreementDto` (PartialType solo añade
 * `@IsOptional`). No se redefine ningún campo aquí: hacerlo sombrearía los
 * decoradores heredados (era el caso de `observations`, que perdía su
 * `@MaxLength`).
 */
export class UpdateAgreementDto extends PartialType(CreateAgreementDto) {}

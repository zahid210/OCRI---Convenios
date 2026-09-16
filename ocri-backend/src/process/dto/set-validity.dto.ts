import { IsIn, IsOptional, IsString } from 'class-validator';

const VALIDITY_OPTIONS = [
  'VIGENTE',
  'SUSPENDIDO',
  'RESCINDIDO',
  'VENCIDO',
] as const;

export class SetValidityDto {
  @IsIn(VALIDITY_OPTIONS, {
    message: `validity debe ser uno de: ${VALIDITY_OPTIONS.join(', ')}`,
  })
  validity: (typeof VALIDITY_OPTIONS)[number];

  @IsOptional()
  @IsString()
  reason?: string;
}

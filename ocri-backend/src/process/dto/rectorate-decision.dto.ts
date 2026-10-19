import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RectorateDecisionDto {
  @IsIn(['APPROVED', 'REJECTED'], {
    message: 'decision debe ser APPROVED o REJECTED',
  })
  decision: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(2000, {
    message: 'notification_message no debe exceder 2000 caracteres',
  })
  notification_message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, {
    message: 'rectorate_oficio_number no debe exceder 80 caracteres',
  })
  rectorate_oficio_number?: string;
}

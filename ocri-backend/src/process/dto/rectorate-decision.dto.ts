import { IsIn, IsOptional, IsString } from 'class-validator';

export class RectorateDecisionDto {
  @IsIn(['APPROVED', 'REJECTED'], {
    message: 'decision debe ser APPROVED o REJECTED',
  })
  decision: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  notification_message?: string;

  @IsOptional()
  @IsString()
  rectorate_oficio_number?: string;
}

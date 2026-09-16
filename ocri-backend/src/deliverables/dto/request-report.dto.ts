import { IsIn, IsOptional, IsString } from 'class-validator';

export class RequestReportDto {
  @IsIn(['INFORME_SEMESTRAL', 'INFORME_FINAL'], {
    message: 'type debe ser INFORME_SEMESTRAL o INFORME_FINAL',
  })
  type: 'INFORME_SEMESTRAL' | 'INFORME_FINAL';

  @IsOptional()
  @IsString()
  period?: string;
}

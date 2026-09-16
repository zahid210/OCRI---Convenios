import { IsIn, IsOptional, IsString } from 'class-validator';

export class EvaluateDeliverableDto {
  @IsIn(['APPROVED', 'OBSERVED'], {
    message: 'decision debe ser APPROVED o OBSERVED',
  })
  decision: 'APPROVED' | 'OBSERVED';

  @IsOptional()
  @IsString()
  observations?: string;
}

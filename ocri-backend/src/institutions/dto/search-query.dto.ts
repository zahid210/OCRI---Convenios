import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Query `?q=` de los endpoints de búsqueda liviana (`/search`, `/autocomplete`).
 * Acota el término para que un valor desproporcionado no llegue al `contains`
 * del motor (B8-4). El mínimo (2 caracteres) se aplica en el servicio, porque
 * `search` acepta 1 y `autocomplete` exige 2.
 */
export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

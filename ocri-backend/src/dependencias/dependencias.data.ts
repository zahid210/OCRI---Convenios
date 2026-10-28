// -----------------------------------------------------------------------------
// Catálogo canónico de dependencias (fuente única de verdad).
//
// Lo consumen DependenciasService.seed() (app) y scripts/seed-catalogs.ts.
// Únicamente contiene las dependencias oficiales requeridas:
// VRI, VRAC, CEPRE, VRAD, CEID, OAJ.
// -----------------------------------------------------------------------------

export const DEPENDENCIAS_SEED: Array<{
  code: string;
  name: string;
}> = [
  {
    code: 'CEID',
    name: 'Centro de Idiomas - CEID',
  },
  {
    code: 'CEPRE',
    name: 'CEPRE',
  },
  {
    code: 'OAJ',
    name: 'Asesoría Legal',
  },
  {
    code: 'VRAC',
    name: 'Vicerrectorado Académico',
  },
  {
    code: 'VRAD',
    name: 'Vicerrectorado Administrativo',
  },
  {
    code: 'VRI',
    name: 'Vicerrectorado de Investigación',
  },
];

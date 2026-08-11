<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Agreement;
use App\Models\Institution;
use App\Models\AgreementType;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class Convenios2024Seeder extends Seeder
{
    public function run()
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        $tipos = [
            'marco' => AgreementType::firstOrCreate(['name' => 'Convenio Marco']),
            'especifico' => AgreementType::firstOrCreate(['name' => 'Convenio Específico']),
            'memorando' => AgreementType::firstOrCreate(['name' => 'Memorando de Entendimiento']),
        ];
        
        // Estructura: [0: Código, 1: Institución, 2: Tipo de Institución, 3: Nombre del convenio, 4: Fecha Inicio, 5: Fecha Fin, 6: País]
        $datos = [
            ['001-2024', 'COMUNIDAD CAMPESINA DE HUARI', 'Comunidades', 'CONVENIO MARCO DE COOPERACION INTERINSTITUCIONAL', '2024-01-08', '2026-01-08', 'Perú'],
            ['002-2024', 'UNIVERSIDAD NACIONAL DE SAN MARTÍN', 'Universidad Nacional', 'CONVENIO MARCO DE COOPERACION INTERINSTITUCIONAL', '2024-01-08', '2027-01-08', 'Perú'],
            ['003-2024', 'MUNICIPALIDAD DISTRITAL DE MAZAMARI', 'Sector Público', 'CONVENIO MARCO DE COOPERACION INTERINSTITUCIONAL', '2024-01-23', '2027-01-23', 'Perú'],
            ['004-2024', 'GRUPO ASEZ - IGLESIA DE DIOS', 'Otros', 'CONVENIO MARCO ENTRE LA UNCP Y EL GRUPO DE UNIVERSITARIOS DE LA IGLESIA DE DIOS', '2024-01-24', '2029-01-24', 'Perú'],
            ['005-2024', 'COMUNIDAD CAMPESINA SANTA ROSA DE TOLDOPAMPA', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-02-10', '2027-02-10', 'Perú'],
            ['006-2024', 'COMUNIDAD CAMPESINA DE SAN JUAN DE ONDORES', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-02-21', '2027-02-21', 'Perú'],
            ['007-2024', 'COMUNIDADES NATIVAS DE PICHANAKI - ACECONAP', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LAS COMUNIDADES', '2024-02-29', '2026-02-29', 'Perú'],
            ['008-2024', 'ASOCIACIÓN NACIÓN PUMPUSH - JUNÍN', 'Otros', 'CONVENIO MARCO ENTRE LA UNCP Y LA ASOCIACIÓN', '2024-02-05', '2027-02-05', 'Perú'],
            ['009-2024', 'CENTRO DE ESTUDIOS PERUANO-CHINO', 'Otros', 'CONVENIO MARCO DE COOPERACION ACADEMICA', '2024-03-22', '2027-03-22', 'Perú'],
            ['010-2024', 'MUNICIPALIDAD CENTRO POBLADO VILLA TINQUERCCASA', 'Sector Público', 'CONVENIO MARCO ENTRE LA UNCP Y LA MUNICIPALIDAD CP', '2024-03-20', '2027-03-20', 'Perú'],
            ['011-2024', 'COMUNIDAD CAMPESINA YAURINGA-CONCEPCIÓN', 'Comunidades', 'CONVENIO MARCO DE COOPERACION INTERINSTITUCIONAL', '2024-04-18', '2026-04-18', 'Perú'],
            ['012-2024', 'COMUNIDAD DE HUANUCO - CONCEPCION', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-04-19', '2026-04-19', 'Perú'],
            ['013-2024', 'COMUNIDAD DE SANTA ROSA DE RUNATULLO', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-04-19', '2026-04-19', 'Perú'],
            ['014-2024', 'COMUNIDAD DE CAÑA ANDAMAYO', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-04-19', '2026-04-19', 'Perú'],
            ['015-2024', 'COMUNIDAD DE PUNCO - CONCEPCIÓN', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-04-19', '2026-04-19', 'Perú'],
            ['016-2024', 'COMUNIDAD DE HUATA - CONCEPCIÓN', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-04-19', '2026-04-19', 'Perú'],
            ['017-2024', 'COMUNIDAD DE UYO - CONCEPCION', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-04-19', '2026-04-19', 'Perú'],
            ['018-2024', 'COMUNIDAD DE ANTACALLA - CONCEPCIÓN', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-05-10', '2026-05-10', 'Perú'],
            ['019-2024', 'COMUNIDAD UNIÓN TORREO DE PACAYBAMBA', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-05-10', '2026-05-10', 'Perú'],
            ['020-2024', 'COMUNIDAD DE TALHUIS', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-04-19', '2026-04-19', 'Perú'],
            ['021-2024', 'COMUNIDAD DE PUCACOCHA', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-04-19', '2026-04-19', 'Perú'],
            ['022-2024', 'COMUNIDAD SAN JOSÉ DE CHALLHUA', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-05-10', '2026-05-10', 'Perú'],
            ['023-2024', 'UNIVERSIDAD FEDERAL DE MINAS GERAIS (UFMG)', 'Universidad Internacional', 'CONVENIO DE INTERCAMBIO ACADÉMICO', '2024-07-05', '2029-07-05', 'Brasil'],
            ['024-2024', 'MUNICIPALIDAD DISTRITAL DE ANCO - HUANCAVELICA', 'Sector Público', 'CONVENIO MARCO ENTRE LA UNCP Y LA MUNICIPALIDAD', '2024-03-20', '2027-03-20', 'Perú'],
            ['025-2024', 'SAIS PACHACUTEC', 'Empresa Nacional', 'CONVENIO ESPECÍFICO ENTRE LA UNCP Y LA SAIS PACHACUTEC', '2024-05-29', '2027-05-29', 'Perú'],
            ['026-2024', 'COMUNIDAD CAMPESINA DE ACO', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-05-22', '2026-05-22', 'Perú'],
            ['027-2024', 'CLINICA DENTAL PREMIUM EIRL', 'Empresa Nacional', 'CONVENIO DE SERVICIOS ODONTOLOGICOS', '2024-05-22', '2026-05-22', 'Perú'],
            ['028-2024', 'COMUNIDAD CAMPESINA DE HUAMANCACA GRANDE', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-05-22', '2026-05-22', 'Perú'],
            ['029-2024', 'MUNICIPALIDAD DISTRITAL DE SAPALLANGA', 'Sector Público', 'CONVENIO MARCO ENTRE LA UNCP Y LA MUNICIPALIDAD', '2024-06-05', '2029-06-05', 'Perú'],
            ['030-2024', 'MUNICIPALIDAD DISTRITAL DE SAPALLANGA', 'Sector Público', 'CONVENIO ESPECÍFICO ENTRE FACULTAD DE ZOOTECNIA Y MUNICIPALIDAD', '2024-06-05', '2027-06-05', 'Perú'],
            ['031-2024', 'ESSALUD', 'Salud', 'ALIANZA DE INTERVENCIÓN - PROGRAMA REFORMA DE VIDA', '2024-06-19', '2025-06-19', 'Perú'],
            ['032-2024', 'COMUNIDAD DE HUANCAMACHAY', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-06-21', '2026-06-21', 'Perú'],
            ['033-2024', 'BALDE K S.A.C.', 'Empresa Nacional', 'CONVENIO DE COOPERACIÓN INTERINSTITUCIONAL', '2024-06-30', '2025-06-30', 'Perú'],
            ['034-2024', 'COMUNIDAD DE SAN ANTONIO', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-07-15', '2026-07-15', 'Perú'],
            ['035-2024', 'EGIS VILLE ET TRANSPORTS SUCURSAL DEL PERÚ', 'Empresa Internacional', 'CONVENIO DE COOPERACIÓN Y TRANSFERENCIA', '2024-07-15', '2029-07-15', 'Francia'],
            ['036-2024', 'MUNICIPALIDAD DISTRITAL DE LLAYLLA', 'Sector Público', 'CONVENIO MARCO ENTRE LA MUNICIPALIDAD Y LA UNCP', '2024-01-23', '2029-01-23', 'Perú'],
            ['037-2024', 'MUNICIPALIDAD DISTRITAL DE RIO NEGRO', 'Sector Público', 'CONVENIO MARCO ENTRE LA MUNICIPALIDAD Y LA UNCP', '2024-06-01', '2027-06-01', 'Perú'],
            ['038-2024', 'MUNICIPALIDAD DISTRITAL DE RIO TAMBO', 'Sector Público', 'CONVENIO MARCO ENTRE LA MUNICIPALIDAD Y LA UNCP', '2024-06-01', '2027-06-01', 'Perú'],
            ['039-2024', 'MUNICIPALIDAD DISTRITAL DE ACOBAMBILLA', 'Sector Público', 'CONVENIO MARCO ENTRE LA UNCP Y LA MUNICIPALIDAD', '2024-07-24', '2026-07-24', 'Perú'],
            ['040-2024', 'EMPRESA COMUNAL SMELTER S.A.', 'Empresa Nacional', 'CONVENIO ESPECÍFICO ENTRE FACULTAD DE TRABAJO SOCIAL Y ECOSEM', '2024-08-09', '2025-08-09', 'Perú'],
            ['041-2024', 'I.E.P. NUESTRA SEÑORA DE FÁTIMA', 'Educación', 'CONVENIO ESPECIFICO ENTRE FACULTAD DE TRABAJO SOCIAL Y LA I.E.P.', '2024-08-09', '2027-08-09', 'Perú'],
            ['042-2024', 'CENTRO DE SALUD DE HUAYUCACHI', 'Salud', 'CONVENIO ESPECIFICO ENTRE FACULTAD DE TRABAJO SOCIAL Y CENTRO DE SALUD', '2024-08-09', '2027-08-09', 'Perú'],
            ['043-2024', 'IESTP SANTIAGO ANTUNEZ DE MAYOLO', 'Educación', 'CONVENIO ESPECIFICO ENTRE FACULTAD DE ZOOTECNIA Y EL IESTP', '2024-08-12', '2027-08-12', 'Perú'],
            ['044-2024', 'UNIVERSIDAD PERUANA LOS ANDES - UPLA', 'Universidad Privada', 'CONVENIO ESPECIFICO PARA CONGRESO DE DEFENSORÍAS', '2024-08-23', '2024-11-23', 'Perú'],
            ['045-2024', 'GOBIERNO REGIONAL DE JUNIN', 'Sector Público', 'CONVENIO ESPECIFICO GORE JUNIN - PROYECTO CIENCIAS SOCIALES', '2024-08-22', '2026-08-22', 'Perú'],
            ['046-2024', 'GOBIERNO REGIONAL DE JUNIN', 'Sector Público', 'CONVENIO ESPECIFICO GORE JUNIN - PROYECTO ECONOMÍA', '2024-08-22', '2026-08-22', 'Perú'],
            ['047-2024', 'EMPRESA ELECTROCENTRO S.A.', 'Empresa Nacional', 'CONVENIO ESPECIFICO ENTRE FIEE Y ELECTROCENTRO', '2024-09-04', '2024-09-04', 'Perú'],
            ['048-2024', 'CORPORACIÓN UNIVERSITARIA REMINGTON', 'Universidad Internacional', 'ACUERDO MARCO DE COOPERACIÓN ACADÉMICA', '2024-09-05', '2029-09-05', 'Colombia'],
            ['049-2024', 'UNIVERSIDAD NACIONAL AUTONOMA DE HUANTA', 'Universidad Nacional', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2024-09-06', '2029-09-06', 'Perú'],
            ['050-2024', 'COMUNIDAD CAMPESINA DE HUAYHUAY', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-09-24', '2027-09-24', 'Perú'],
            ['051-2024', 'GRUPO DESARROLLO RURAL SOSTENIBLE', 'Otros', 'CONVENIO MARCO ENTRE LA UNCP Y EL GRUPO DE INTERES', '2024-09-26', '2029-09-26', 'Perú'],
            ['052-2024', 'EESP TEODORO PEÑALOZA', 'Educación', 'CONVENIO ESPECIFICO ENTRE FACULTAD DE TRABAJO SOCIAL Y EL EESP', '2024-10-02', '2027-10-02', 'Perú'],
            ['053-2024', 'UNIVERSIDAD HISU DE HEBEI', 'Universidad Internacional', 'CONVENIO ESPECIFICO DE COOPERACION', '2024-10-04', '2027-10-04', 'China'],
            ['054-2024', 'MUNICIPALIDAD DISTRITAL DE HUASICANCHA', 'Sector Público', 'CONVENIO MARCO ENTRE LA UNCP Y LA MUNICIPALIDAD', '2024-10-09', '2026-10-09', 'Perú'],
            ['055-2024', 'MUNICIPALIDAD DISTRITAL DE AHUAC', 'Sector Público', 'CONVENIO MARCO ENTRE LA UNCP Y LA MUNICIPALIDAD', '2024-10-21', '2027-10-09', 'Perú'],
            ['056-2024', 'COMUNIDAD CAMPESINA DE SAÑO', 'Comunidades', 'CONVENIO MARCO ENTRE LA UNCP Y LA COMUNIDAD', '2024-10-21', '2026-10-21', 'Perú'],
            ['057-2024', 'HACIENDA ROMA OQUORS S.A.C.', 'Empresa Nacional', 'CONVENIO ESPECIFICO DE COOPERACIÓN INTERINSTITUCIONAL', '2024-11-11', '2027-11-11', 'Perú'],
            ['058-2024', 'MUNICIPALIDAD DISTRITAL DE MARCAPOMACOCHA', 'Sector Público', 'CONVENIO TRIPARTITO MUNICIPALIDAD, UNCP Y SAIS PACHACUTEC', '2024-12-30', '2026-12-30', 'Perú'],
        ];

        foreach ($datos as $fila) {
            $nombreInstitucion = strtoupper($fila[1]);
            $tipoOriginal = $fila[2];
            $pais = $fila[6];

            $tipoEstandarizado = match ($tipoOriginal) {
                'Municipalidad', 'Sector Público', 'Gobierno Regional' => 'Sector Público',
                'Salud' => 'Salud',
                'Institución Educativa' => 'Educación',
                'Universidad Nacional' => 'Universidad Nacional',
                'Universidad Privada' => 'Universidad Privada',
                'Universidad Internacional' => 'Universidad Internacional',
                'Empresa Nacional' => 'Empresa Nacional',
                'Empresa Internacional' => 'Empresa Internacional',
                'Comunidad Campesina', 'Comunidad Nativa' => 'Comunidades',
                default => 'Otros',
            };

            $institucion = Institution::firstOrCreate(
                ['name' => $nombreInstitucion],
                ['country' => $pais, 'type' => $tipoEstandarizado]
            );

            $nombreLargo = strtoupper($fila[3]);
            if (str_contains($nombreLargo, 'MEMORANDO')) {
                $tipoId = $tipos['memorando']->id;
            } elseif (str_contains($nombreLargo, 'ESPECIFICO') || str_contains($nombreLargo, 'ESPECÍFICO')) {
                $tipoId = $tipos['especifico']->id;
            } else {
                $tipoId = $tipos['marco']->id;
            }

            $agreement = Agreement::firstOrCreate(
                ['resolution_number' => $fila[0]],
                [
                'title' => $fila[0],
                'name' => $fila[3],
                'resolution_number' => $fila[0],
                'institution_id' => $institucion->id,
                'agreement_type_id' => $tipoId, 
                'start_date' => $fila[4],
                'end_date' => $fila[5],
                'status' => 'Vigente'
            ]);

            $codigo = $fila[0];
            $anio = substr($codigo, -4); 
            $rutaRelativa = "convenios/{$anio}/{$codigo}.pdf"; 

            if (Storage::disk('public')->exists($rutaRelativa)) {
                $agreement->documents()->firstOrCreate(
                    ['file_path' => $rutaRelativa],
                    [
                    'name' => 'Doc - ' . ($agreement->resolution_number ?? $agreement->title),
                    'file_path' => $rutaRelativa,
                    'extension' => 'pdf'
                ]);
            }
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');
    }
}
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Agreement;
use App\Models\Institution;
use App\Models\AgreementType;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class Convenios2022Seeder extends Seeder
{
    public function run()
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        
        $tipos = [
            'marco' => AgreementType::firstOrCreate(['name' => 'Convenio Marco']),
            'especifico' => AgreementType::firstOrCreate(['name' => 'Convenio Específico']),
            'memorando' => AgreementType::firstOrCreate(['name' => 'Memorando de Entendimiento']),
        ];
        
        $datos = [
            ['001-2022', 'RED NACIONAL DE CATI EN PERÚ', 'Sector Público', 'ADENDA N° 2 AL CONVENIO DE COLABORACIÓN PARA EL ESTABLECIMIENTO DE UN CENTRO DE APOYO A LA TECNOLOGÍA Y LA INNOVACIÓN (CATI)', '2022-01-10', null, 'Perú'],
            ['002-2022', 'INSTITUCION EDUCATIVA UNIÓN LATINO INNOVA', 'Educación', 'CONVENIO ESPECÍFICO ENTRE LA FACULTAD DE TRABAJO SOCIAL Y LA INSTITUCION EDUCATIVA UNIÓN LATINO INNOVA', '2022-01-14', '2025-01-14', 'Perú'],
            ['003-2022', 'DESCOCENTRO', 'Otros', 'CONVENIO DE ASOCIACIÓN PARA LA EJECUCIÓN DE PROYECTO ENTRE LA UNCP Y DESCOCENTRO', null, null, 'Perú'],
            ['004-2022', 'OSITRAN', 'Sector Público', 'ADENDA N° 1 AL CONVENIO DE PRÁCTICAS PREPROFESIONALES N° 013-2021-OSITRAN', '2022-01-01', '2022-03-31', 'Perú'],
            ['005-2022', 'MUNICIPALIDAD PROVINCIAL DE SATIPO', 'Sector Público', 'CONVENIO MARCO DE COOPERCIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA MUNICIPALIDAD PROVINCIAL DE SATIPO', '2022-03-25', '2025-03-25', 'Perú'],
            ['006-2022', 'ENGIE ENERGÍA PERÚ', 'Empresa Nacional', 'CONVENIO DE COOPERACIÓN INTERINSTITUCIONAL - BECAS ENGIE, MUJERES CON ENERGÍA', '2022-03-11', '2025-12-11', 'Perú'],
            ['007-2022', 'FUNDACIÓN SER MAESTRO', 'Otros', 'CONVENIO MARCO DE COOPERACIÓN ACADÉMICA ENTRE LA UNCP Y LA FUNDACIÓN SER MAESTRO', '2022-05-06', '2023-05-06', 'Perú'],
            ['008-2022', 'MUNICIPALIDAD DISTRITAL DE SAN PEDRO DE CAJAS', 'Sector Público', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA MUNICIPALIDAD DISTRITAL DE SAN PEDRO DE CAJAS', '2022-01-16', '2024-01-16', 'Perú'],
            ['009-2022', 'COMUNIDAD CAMPESINA DE YAROCA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA COMUNIDAD CAMPESINA DE YAROCA', '2022-01-16', '2024-01-16', 'Perú'],
            ['010-2022', 'COMUNIDAD CAMPESINA DE URAUCHOC', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA COMUNIDAD CAMPESINA DE URAUCHOC', '2022-01-16', '2024-01-16', 'Perú'],
            ['011-2022', 'INSTITUCIÓN EDUCATIVA INDUSTRIAL N° 32', 'Educación', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA INSTITUCIÓN EDUCATIVA INDUSTRIAL N° 32', '2022-01-16', '2024-01-16', 'Perú'],
            ['012-2022', 'COMUNIDAD CAMPESINA DE PALCAMAYO', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA COMUNIDAD CAMPESINA DE PALCAMAYO', '2022-01-15', '2024-01-15', 'Perú'],
            ['013-2022', 'COMUNIDAD CAMPESINA ERAHUAY', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA COMUNIDAD CAMPESINA ERAHUAY', '2022-01-15', '2024-01-15', 'Perú'],
            ['014-2022', 'COMUNIDAD CAMPESINA HUAYLAHUICHAN', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA COMUNIDAD CAMPESINA HUAYLAHUICHAN', '2022-01-15', '2024-01-15', 'Perú'],
            ['015-2022', 'COMUNIDAD CAMPESINA SAN CRISTOBAL DE PACCHAC', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA COMUNIDAD CAMPESINA SAN CRISTOBAL DE PACCHAC', '2022-01-15', '2024-01-15', 'Perú'],
            ['016-2022', 'COMUNIDAD CAMPESINA DE YURACMAYO', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA COMUNIDAD CAMPESINA DE YURACMAYO', '2022-01-15', '2024-01-15', 'Perú'],
            ['017-2022', 'COMUNIDAD CAMPESINA DE SAN ANTONIO DE ATAQUERO', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA COMUNIDAD CAMPESINA DE SAN ANTONIO DE ATAQUERO', '2022-01-15', '2024-01-15', 'Perú'],
            ['018-2022', 'COMUNIDAD CAMPESINA DE TUPIN', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA COMUNIDAD CAMPESINA DE TUPIN', '2022-01-15', '2024-01-15', 'Perú'],
            ['019-2022', 'COMUNIDAD CAMPESINA DE NINATAMBO', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA COMUNIDAD CAMPESINA DE NINATAMBO', '2022-01-15', '2024-01-15', 'Perú'],
            ['020-2022', 'COMUNIDAD CAMPESINA DE COCHAS', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA COMUNIDAD CAMPESINA DE COCHAS', '2022-01-15', '2024-01-15', 'Perú'],
            ['021-2022', 'MUNICIPALIDAD DISTRITAL DE CHUPURO', 'Sector Público', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA MUNICIPALIDAD DISTRITAL DE CHUPURO Y LA UNCP', '2022-02-28', '2024-02-28', 'Perú'],
            ['022-2022', 'MUNICIPALIDAD DISTRITAL DE CARHUACALLANGA', 'Sector Público', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA MUNICIPALIDAD DISTRITAL DE CARHUACALLANGA Y LA UNCP', '2022-03-28', '2024-03-28', 'Perú'],
            ['023-2022', 'INSTITUTO DE EDUCACIÓN SUPERIOR TECNOLÓGICO PÚBLICO ASHANINKA', 'Educación', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y EL IESTP ASHANINKA', '2022-05-02', '2025-05-02', 'Perú'],
            ['024-2022', 'SOCIEDAD DE BENEFICENCIA DE HUANCAYO', 'Otros', 'CONVENIO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNCP Y LA SOCIEDAD DE BENEFICENCIA DE HUANCAYO', '2022-05-15', '2025-05-15', 'Perú'],
            ['025-2022', 'SEGURO SOCIAL DE SALUD - ESSALUD', 'Salud', 'CONVENIO MARCO ENTRE EL SEGURO SOCIAL DE SALUD - ESSALUD Y LA UNCP', '2022-07-04', '2025-07-04', 'Perú'],
            ['026-2022', 'PODER JUDICIAL - CORTE SUPERIOR DE JUSTICIA DE JUNÍN', 'Sector Público', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE EL PODER JUDICIAL Y LA UNCP', '2022-08-02', '2027-08-02', 'Perú'],
            ['027-2022', 'HOSPITAL DOMINGO OLAVEGOYA DE JAUJA', 'Salud', 'ADENDA N° 001 A LA RENOVACIÓN DE CONVENIO ESPECÍFICO DE COOPERACIÓN DOCENTE - ASISTENCIAL', '2022-06-03', '2025-06-03', 'Perú'],
            ['028-2022', 'RED DE SALUD DEL VALLE DEL MANTARO', 'Salud', 'PRIMERA ADENDA AL CONVENIO N° 002-MINSA', '2022-06-03', '2025-06-03', 'Perú'],
            ['029-2022', 'RED ASISTENCIAL JUNIN', 'Salud', 'CONVENIO ESPECÍFICO ENTRE LA RED ASISTENCIAL JUNIN Y LA FACULTAD DE ENFERMERÍA DE LA UNCP', '2022-09-12', '2025-07-04', 'Perú'],
            ['030-2022', 'UNIVERSIDAD NACIONAL JOSÉ MARÍA ARGUEDAS', 'Universidad Nacional', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL ENTRE LA UNAJMA Y LA UNCP', '2022-08-27', '2026-08-27', 'Perú'],
            ['031-2022', 'EMPRESA SIERRA POLI SAC', 'Empresa Nacional', 'CONVENIO ESPECÍFICO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-03-07', '2026-03-07', 'Perú'],
            ['032-2022', 'COMUNIDAD CAMPESINA DE CULLHUAS', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-07-04', '2024-07-04', 'Perú'],
            ['033-2022', 'MUNICIPALIDAD DE CHACAPAMPA', 'Sector Público', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-06-10', '2024-06-10', 'Perú'],
            ['034-2022', 'MINISTERIO DE SALUD, GOBIERNO REGIONAL DE JUNÍN', 'Salud', 'CONVENIO MARCO DE COOPERACIÓN DOCENTE ASISTENCIAL', '2022-08-24', '2026-08-24', 'Perú'],
            ['035-2022', 'MINISTERIO DE SALUD, GOBIERNO REGIONAL DE HUANCAVELICA', 'Salud', 'CONVENIO MARCO DE COOPERACIÓN DOCENTE ASISTENCIAL', '2022-10-11', '2026-10-11', 'Perú'],
            ['036-2022', 'MUNICIPALIDAD DISTRITAL DE CHUPURO', 'Sector Público', 'CONVENIO MARCO DE COLABORACIÓN', '2022-10-01', '2023-04-01', 'Perú'],
            ['037-2022', 'UNIVERSIDAD PERUANA LOS ANDES - UPLA', 'Universidad Privada', 'CONVENIO ESPECÍFICO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-09-01', '2025-09-01', 'Perú'],
            ['038-2022', 'RDJ INGENIEROS SAC', 'Empresa Nacional', 'CONVENIO ESPECÍFICO PARA EJECUCIÓN DE PROYECTO', '2022-10-01', null, 'Perú'],
            ['039-2022', 'LECKER PREMIUM BIER SAC', 'Empresa Nacional', 'CONVENIO ESPECÍFICO PARA EJECUCIÓN DE PROYECTO', '2022-10-01', null, 'Perú'],
            ['040-2022', 'UNIDAD EJECUTORA N°118', 'Sector Público', 'CONVENIO DE COOPERACIÓN INSTITUCIONAL', '2022-07-07', '2023-09-01', 'Perú'],
            ['041-2022', 'MINISTERIO DE SALUD, GOBIERNO REGIONAL DEL CALLAO', 'Salud', 'CONVENIO MARCO DE COOPERACIÓN DOCENTE ASISTENCIAL', '2022-11-08', '2026-11-08', 'Perú'],
            ['042-2022', 'INSTITUCIÓN EDUCATIVA SEIS DE AGOSTO', 'Educación', 'CONVENIO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-02-15', '2023-02-15', 'Perú'],
            ['043-2022', 'UNIVERSIDAD AUTÓNOMA METROPOLITANA', 'Universidad Internacional', 'CONVENIO ESPECÍFICO DE MOVILIDAD ALUMNADO', '2022-12-05', '2026-12-05', 'México'],
            ['044-2022', 'UNIVERSIDAD AUTÓNOMA METROPOLITANA', 'Universidad Internacional', 'CONVENIO GENERAL DE COOPERACIÓN', '2022-12-05', '2026-12-05', 'México'],
            ['045-2022', 'INSTITUCIÓN EDUCATIVA SALESIANO DON BOSCO', 'Educación', 'CONVENIO ESPECÍFICO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-08-24', '2025-12-31', 'Perú'],
            ['046-2022', 'CAJA RURAL DE AHORRO Y CRÉDITO DEL CENTRO', 'Empresa Nacional', 'CONVENIO DE PRESTAMOS PERSONALES', '2022-10-24', '2025-10-24', 'Perú'],
            ['047-2022', 'UNIVERSIDAD NACIONAL AMAZÓNICA DE MADRE DE DIOS', 'Universidad Nacional', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-07-04', '2027-07-04', 'Perú'],
            ['048-2022', 'UNIVERSIDAD NACIONAL DE FRONTERA', 'Universidad Nacional', 'CONVENIO ESPECÍFICO DE COOPERACIÓN', '2022-10-25', '2025-10-25', 'Perú'],
            ['049-2022', 'UNIVERSIDAD NACIONAL DE FRONTERA', 'Universidad Nacional', 'CONVENIO MARCO COOPERACIÓN INTERINSTITUCIONAL', '2022-09-06', '2027-09-06', 'Perú'],
            ['050-2022', 'OSITRAN', 'Sector Público', 'ADENDA N°03 AL CONVENIO DE PRÁCTICAS', '2022-09-30', null, 'Perú'],
            ['051-2022', 'RED ASISTENCIAL JUNÍN', 'Salud', 'CONVENIO ESPECÍFICO - FACULTAD DE ADMINISTRACIÓN', '2022-09-13', '2025-07-04', 'Perú'],
            ['052-2022', 'RED ASISTENCIAL JUNÍN', 'Salud', 'CONVENIO ESPECÍFICO - FACULTAD DE MEDICINA HUMANA', '2022-08-01', '2025-07-04', 'Perú'],
            ['053-2022', 'RED ASISTENCIAL JUNÍN', 'Salud', 'CONVENIO ESPECÍFICO - FACULTAD DE TRABAJO SOCIAL', '2022-07-13', '2025-07-04', 'Perú'],
            ['054-2022', 'DIRECCIÓN REGIONAL DE AGRICULTURA JUNÍN', 'Sector Público', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-11-30', '2025-11-30', 'Perú'],
            ['055-2022', 'EMPRESA MISKY FOOD S.A.C.', 'Empresa Nacional', 'CONVENIO ESPECÍFICO PARA LA EJECUCIÓN DEL PROYECTO', '2022-10-26', null, 'Perú'],
            ['056-2022', 'UNIVERSIDAD NACIONAL DE JAÉN', 'Universidad Nacional', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-12-29', '2027-12-29', 'Perú'],
            ['057-2022', 'COMUNIDAD CAMPESINA DE CHONGOS ALTO', 'Comunidades', 'CONVENIO ESPECÍFICO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-12-28', '2027-12-28', 'Perú'],
            ['058-2022', 'INSTITUCIÓN EDUCATIVA JOSÉ CARLOS MARIÁTEGUI', 'Educación', 'CONVENIO ESPECÍFICO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-12-01', '2025-12-01', 'Perú'],
            ['059-2022', 'EMPRESA UEA COMPAÑÍA MINERA MARMOLES SCRL', 'Empresa Nacional', 'CONVENIO DE COOPERACIÓN TÉCNICA INTERINSTITUCIONAL', '2022-11-01', '2024-11-01', 'Perú'],
            ['060-2022', 'COMUNIDAD NATIVA DE TEORIA', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-12-23', '2024-12-23', 'Perú'],
            ['061-2022', 'INSTITUTO NACIONAL DE INVESTIGACIÓN EN GLACIARES', 'Sector Público', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTIUCIONAL', '2022-07-10', '2027-07-10', 'Perú'],
            ['062-2022', 'RED DE SALUD DE CHANCHAMAYO', 'Salud', 'CONVENIO ESPECÍFICO DE COOPERACIÓN DOCENTE ASISTENCIAL', '2022-07-01', '2025-07-01', 'Perú'],
            ['063-2022', 'HOSPITAL DANIEL ALCIDES CARRION', 'Salud', 'CONVENIO ESPECÍFICO DE COOPERACIÓN DOCENTE ASISTENCIAL', '2022-09-21', '2025-09-21', 'Perú'],
            ['064-2022', 'RED DE SALUD DE SATIPO', 'Salud', 'CONVENIO ESPECÍFICO DE COOPERACIÓN DOCENTE ASISTENCIAL', '2022-10-28', '2025-10-28', 'Perú'],
            ['065-2022', 'COMUNIDAD CAMPESINA DE HUAMANCACA GRANDE', 'Comunidades', 'CONVENIO MARCO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-03-14', '2024-03-14', 'Perú'],
            ['066-2022', 'MINISTERIO DE ENERGÌA Y MINAS', 'Sector Público', 'CONVENIO MARCO DE LA COLABORACIÒN INTERINSTITUCIONAL', '2022-08-03', '2025-08-03', 'Perú'],
            ['067-2022', 'INDECOPI', 'Sector Público', 'CONVENIO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-10-01', '2025-10-01', 'Perú'],
            ['068-2022', 'UNIVERSIDAD DEL PACÍFICO', 'Universidad Privada', 'CONVENIO ESPECÍFICO DE COOPERACIÓN ACADÉMICA', '2022-11-02', '2027-11-02', 'Perú'],
            ['069-2022', 'COMUNIDAD MUNICIPAL DEL NORTE DEL VRAEM', 'Comunidades', 'CONVENIO DE COOPERACIÓN INTERINSTITUCIONAL', '2022-09-01', '2024-09-01', 'Perú'],
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
                'Otros' => match (true) {
                    str_contains($nombreInstitucion, 'COMUNIDAD') => 'Comunidades',
                    default => 'Otros',
                },
                default => 'Otros',
            };

            $institucion = Institution::firstOrCreate(
                ['name' => $nombreInstitucion],
                ['country' => $pais, 'type' => $tipoEstandarizado]
            );

            $nombreLargo = strtoupper($fila[3]);
            if (str_contains($nombreLargo, 'MEMORANDO')) {
                $tipoId = $tipos['memorando']->id;
            } elseif (str_contains($nombreLargo, 'ESPECIFICO') || str_contains($nombreLargo, 'ADENDA') || str_contains($nombreLargo, 'CONTRATO')) {
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
# PlanINT

Planeador personal y laboral. La versión 11.8.35 corrige eliminación de actividades y recordatorios, conserva excepciones de recurrencia y añade bloqueos de disponibilidad para comida y feriados.

## Publicación y acceso

- Sitio: https://adriancarrillo1102-bot.github.io/planint/
- GitHub Pages: rama `main`, carpeta raíz, HTTPS obligatorio.
- Backend existente: Supabase `planint-dev`.
- Auth Site URL y Redirect URL: la dirección del sitio, con `/` final.
- Render no participa en PlanINT.

La configuración del cliente contiene solamente URL y clave pública. Las tablas existentes tienen RLS por `user_id`; no se usa una clave administrativa en el navegador. Un proyecto Supabase pausado debe reanudarse antes de utilizar Auth o datos.

## Persistencia

`save()` y `saveBaselines()` entregan cambios a una única frontera de persistencia. `src/data/cloud-repository.js` traduce las entidades del Core a las tablas relacionales existentes. `planint_commit_changes` guarda cada lote dentro de una transacción, con los permisos del usuario y las políticas RLS vigentes.

Solo se envían registros nuevos, modificados o eliminados por el cliente. Se compara cada registro con su versión leída; un conflicto conserva los cambios locales y ofrece reintentar, descargar una copia o cargar la nube. Los reintentos idénticos no duplican registros. Un error revierte el lote completo.

Los cambios pendientes se conservan en `localStorage` bajo una clave por cuenta y pestaña, cuya identidad se conserva en `sessionStorage` al recargar. Otra pestaña no puede confirmar ni borrar esa cola. Se reintentan al recuperar conexión o volver a la misma pestaña. El indicador solo dice **Guardado en la nube** después de recibir confirmación. El cierre de sesión espera el guardado; salir con cambios pendientes muestra un aviso del navegador. Conviene guardar o descargar la copia antes de cerrar una pestaña con pendientes; una pestaña nueva tiene otra cola. No se garantiza una escritura antes de que el servidor la confirme.

Una sesión actualiza sus datos al volver a primer plano y cada 30 segundos, sin reemplazar cambios pendientes ni un modal abierto. Para ver cambios en otro dispositivo se debe usar la misma cuenta y la misma dirección. Las pestañas de versiones anteriores deben recargarse tras el despliegue.

## Importación de actividades

En Importaciones, elegir la carga general para respetar Ámbito, Tipo Origen y Origen de cada fila. La primera hoja es la fuente de actividades; la hoja Origenes de la plantilla es una referencia. Los orígenes faltantes se crean al confirmar.

Para actividades nuevas, dejar ID Actividad vacío. Para actualizar, usar el ID obtenido al exportar desde PlanINT. Una segunda carga del archivo original sin IDs se detecta como posible duplicado y no genera copias. Las filas repetidas dentro del mismo archivo también se detectan.

Usar prioridades Alta/Media/Baja y urgencias Baja/Media/Alta/Crítica. La urgencia predeterminada es Media. Por compatibilidad, Normal se convierte a Media y Urgente a Alta. Las fechas pueden ser celdas de fecha Excel, AAAA-MM-DD o DD/MM/AAAA. No se desplazan fechas vencidas ni se programan automáticamente las actividades. Fase, Categoría y Dependencia se conservan como texto, sin crear hitos ni relaciones adicionales.

Revisar la vista previa antes de confirmar. El mensaje de éxito solo aparece después de que Supabase confirma el guardado. Si la conexión falla, reintentar la sincronización desde el aviso de pendientes, sin repetir la carga.

## Pruebas

### Bloqueos y eliminación (11.8.35)

En Calendario → Bloqueos y feriados, crear un bloqueo laboral o personal, por horario o día completo. Puede ser único, diario o semanal, con fecha final opcional. También se administra desde Configuración y desde Editar disponibilidad. En Calendario se muestra en violeta; no es una actividad de Banco ni de Semana, pero sí reduce sus indicadores de disponibilidad.

La opción «Este bloqueo representa la pausa de comida ya descontada» sustituye la parte correspondiente de la pausa genérica para evitar doble descuento. Los intervalos superpuestos se descuentan una sola vez y se recortan al horario base. Un feriado laboral no elimina disponibilidad personal. Los turnos y bloqueos que cruzan medianoche se calculan por fecha local. La pausa genérica antigua, que no tiene hora, sigue siendo un descuento de capacidad; los bloqueos explícitos sí impiden programar en su intervalo.

Las actividades ya programadas no se mueven ni se eliminan al bloquear un horario. Se señalan sus conflictos en Calendario y Semana. Las nuevas ocurrencias automáticas sobre un bloqueo no se generan; al liberar el horario pueden volver a generarse dentro del horizonte existente.

En una actividad recurrente, Eliminar permite elegir una ocurrencia o toda la serie. Una ocurrencia eliminada deja una excepción persistente. La eliminación de toda la serie incluye su historial y requiere elegir esa opción expresamente. El borrado usa el mismo lote transaccional que el guardado, con comprobación de concurrencia y referencias.

En la ficha de una actividad, «Convertir en bloqueo» permite reemplazar la planificación pendiente desde una fecha. Conserva las ocurrencias realizadas y anteriores y cierra la regla original. La conversión no se ejecuta automáticamente al actualizar la aplicación. Las actividades únicas con historial previo no pueden convertirse destructivamente.

Los bloqueos se guardan en `planint_availability_profiles.time_blocks`, bajo las políticas de propietario existentes; las excepciones en `planint_activities.recurrence_exclusions`. La migración es aditiva y no transforma ni elimina registros existentes. Los respaldos incluyen ambos campos. La restauración solo declara éxito tras confirmar Supabase.

Para pruebas de interfaz aisladas, ejecutar `node tests/make-browser-fixture.cjs`, servir esta carpeta únicamente en localhost y abrir `/tests/browser-fixture.html`. El botón «Ejecutar controles QA» usa datos sintéticos y una frontera de nube simulada; nunca abrir el fixture como aplicación real. Los archivos de fixture generados no se incluyen en el despliegue. Las pruebas SQL `tests/blocks-database.sql` verifican la frontera real con RLS y revierten toda la transacción.

Ejecutar con Node.js:

```sh
node --test tests/*.test.cjs
```

Las pruebas comprueban mapeo contra el esquema real, relaciones, recurrencia, hábitos, identidad estable, escrituras mínimas, recuperación de errores y guardados superpuestos. `tests/cloud-database.sql` prueba inserción, edición, conflictos, reintentos, propiedad y rollback en una transacción que termina con `ROLLBACK`, usando una cuenta ya inicializada. No ejecutar las pruebas SQL en paralelo con modificaciones de esa cuenta.

Las migraciones de `supabase/migrations/` corresponden a las operaciones aplicadas a la base existente. Requieren las tablas PlanINT previamente instaladas; no son un instalador de una base vacía. `schema-inspection.json` documenta columnas y relaciones, sin datos de usuarios.

## Rollback

Se puede revertir el commit de la interfaz a 11.8.32; la función SQL adicional es compatible con esa versión y no necesita eliminarse. La interfaz anterior volvería a guardar creaciones/ediciones únicamente en el navegador. Antes de revertir, esperar los guardados o descargar los pendientes. El rollback de código no elimina datos guardados en Supabase.

## Límites de validación

Las pruebas de código y base no sustituyen una prueba real en Android. La comprobación final es crear una actividad, esperar el guardado, abrirla desde otra sesión y editarla. Los permisos y el esquema preexistentes no se han rediseñado en esta corrección.


### Corrección de actividades terminadas · V11.8.36
En Historial, abre la actividad y elige **Corregir realización** para cambiar fecha, hora real inicial, hora real final o comentarios. Se recalcula la duración real sin alterar el horario planeado. Si el cierre fue accidental, usa **Reabrir actividad**: conserva checklist y programación y elimina el cierre de los totales realizados. Una fecha planeada pasada queda como no realizada. Los cambios afectan únicamente esa ocurrencia y conservan el cierre anterior en `completion_history`, protegido por las políticas existentes de cada cuenta. Las horas finales anteriores al inicio se interpretan como el día siguiente, igual que en el cierre original. El guardado espera confirmación de Supabase; ante un fallo se conserva el cambio pendiente y el mismo botón permite reintentar sin duplicar el historial.


### Calendario y Resumen por periodo · V11.8.37
- Al reprogramar se retiran los compromisos activos o vencidos anteriores. La vista también evita duplicados de versiones previas sin borrar el historial.
- Los cierres del Banco aparecen en su fecha y horas reales y consumen tiempo. Los cierres históricos sin programación se proyectan desde sus datos de realización; si solo hay hora de cierre y duración, esa hora se usa como fin. No se crean actividades ni programaciones ficticias en la base.
- Resumen abre en la semana actual (lunes a domingo), permite navegar semanas, meses y años y elegir una fecha. Los indicadores y la gráfica corresponden al periodo seleccionado. Las actividades del Banco sin fecha quedan fuera.
- La gráfica distribuye minutos por proyecto, gestión y ámbito. El denominador son las horas disponibles de todo el periodo, después de pausas y bloqueos; General usa la unión de disponibilidad Laboral y Personal. Por defecto incluye horas planeadas pendientes y realizadas; Solo realizadas usa las horas y fechas reales del cierre. El tiempo fuera de disponibilidad se separa y la sobreasignación se muestra sin ocultarla. Sin asignación (ocio) significa ausencia de registros y no ocio confirmado.
- Descargar reporte exporta PNG, SVG o HTML autónomo con gráfica y tabla completa. El HTML permite Imprimir / guardar como PDF, sin depender de internet ni bibliotecas externas. El reporte usa el periodo, ámbito y medición seleccionados.

- En Calendario, vistas Día y Semana: doble clic sobre una franja de 30 minutos abre Nueva actividad o Desde el Banco. La programación conserva fecha y hora seleccionadas y valida cruces, disponibilidad y bloqueos. En táctil se usa un toque, y con teclado Enter. Los días pasados no permiten nuevas programaciones. Crear una actividad y cancelar después su programación la conserva pendiente en el Banco.

- Colores del calendario: gris planeada, verde terminada, rojo no realizada, amarillo no planeada y naranja reprogramada. Una reprogramada que vuelve a vencer pasa a rojo y al cerrarla pasa a verde. Mes y Año incluyen marcadores de estos estados.
- Copiar actividad abre una ficha independiente y editable (incluye estructura, notas, responsabilidad y checklist). Se seleccionan nueva fecha y hora y después se revisa el horario con el validador existente. La copia empieza pendiente; al confirmar la programación queda agendada. No copia cierres ni historial ni genera una nueva serie recurrente; el checklist se reinicia. Si se cancela la revisión de horario, la copia permanece pendiente en el Banco. Los fallos de sincronización se reintentan sobre la misma copia.


### Recordatorios en agenda · V11.8.38
Los recordatorios activos aparecen en Calendario (Día, Semana, Mes y Año), en las tarjetas de Hoy y Semana y en el Resumen del periodo. Las listas muestran hora, ámbito y nota y abren el editor existente. Los que tienen hora también tienen un marcador puntual de campana en la agenda; los simultáneos se agrupan y los que no tienen hora permanecen en la lista sin inventar un horario. Se respetan los filtros Laboral/Personal/General y los inactivos permanecen en Administración. Los recordatorios no son actividades, no reservan duración, no reducen disponibilidad ni cambian las métricas de ejecución o la línea base. Guardar una edición actualiza las vistas de inmediato. Sin cambios de esquema ni migraciones de datos.

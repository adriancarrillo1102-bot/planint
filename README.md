# PlanINT

Planeador personal y laboral. La versión 11.8.33 conserva la interfaz y el Core de 11.8.32 y completa el guardado remoto.

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

## Verificación

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

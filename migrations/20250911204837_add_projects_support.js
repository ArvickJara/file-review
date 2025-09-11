// migrations/XXXX_add_projects_support.js
exports.up = async function (knex) {
    // 1) Crear tabla de proyectos
    await knex.schema.createTable('proyectos', (table) => {
        table.string('id').primary();
        table.string('nombre'); // OPCIONAL - se extrae del TDR/expediente
        table.text('descripcion'); // OPCIONAL
        table.string('codigo_proyecto'); // OPCIONAL - se extrae automáticamente
        table.string('entidad_ejecutora'); // OPCIONAL
        table.decimal('monto_referencial', 15, 2); // OPCIONAL
        table.enum('estado', ['creado', 'procesando', 'activo', 'completado', 'archivado']).defaultTo('creado');
        table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
        table.timestamp('fecha_modificacion').defaultTo(knex.fn.now());

        // Campos para datos extraídos automáticamente
        table.boolean('datos_extraidos').defaultTo(false);
        table.text('datos_extraidos_raw'); // JSON con todos los datos extraídos

        // Índices
        table.index(['estado']);
        table.index(['fecha_creacion']);
        table.index(['codigo_proyecto']); // No unique porque puede ser null inicialmente
    });

    // 2) Agregar proyecto_id a expedientes existentes
    await knex.schema.table('expedientes', (table) => {
        table.string('proyecto_id')
            .references('id')
            .inTable('proyectos')
            .onDelete('CASCADE');

        table.index(['proyecto_id']);
        table.index(['proyecto_id', 'tipo']);
    });

    // 3) Agregar proyecto_id a tdr_documentos
    await knex.schema.table('tdr_documentos', (table) => {
        table.string('proyecto_id')
            .references('id')
            .inTable('proyectos')
            .onDelete('CASCADE');

        table.index(['proyecto_id']);
        table.index(['proyecto_id', 'estado']);
    });

    // 4) Agregar proyecto_id a expedientes_tecnicos
    await knex.schema.table('expedientes_tecnicos', (table) => {
        table.string('proyecto_id')
            .references('id')
            .inTable('proyectos')
            .onDelete('CASCADE');

        table.index(['proyecto_id']);
    });
};

exports.down = async function (knex) {
    // Remover columnas en orden inverso
    await knex.schema.table('expedientes_tecnicos', (table) => {
        table.dropColumn('proyecto_id');
    });

    await knex.schema.table('tdr_documentos', (table) => {
        table.dropColumn('proyecto_id');
    });

    await knex.schema.table('expedientes', (table) => {
        table.dropColumn('proyecto_id');
    });

    await knex.schema.dropTableIfExists('proyectos');
};
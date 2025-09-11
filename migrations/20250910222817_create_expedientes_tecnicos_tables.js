// migrations/XXXX_create_expedientes_tecnicos_tables.js
exports.up = function (knex) {
    return Promise.all([
        // Tabla para TDRs
        knex.schema.createTable('tdr_documentos', function (table) {
            table.string('id').primary();
            table.string('nombre').notNullable();
            table.string('ruta_archivo').notNullable();
            table.text('contenido_texto', 'longtext');
            table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
            table.enum('estado', ['activo', 'inactivo']).defaultTo('activo');
        }),

        // Tabla para expedientes técnicos
        knex.schema.createTable('expedientes_tecnicos', function (table) {
            table.string('id').primary();
            table.string('tdr_id').references('id').inTable('tdr_documentos');
            table.integer('total_tomos');
            table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
            table.enum('estado', ['pendiente', 'evaluado', 'archivado']).defaultTo('pendiente');
        }),

        // Tabla para análisis de cada tomo
        knex.schema.createTable('analisis_tomos', function (table) {
            table.string('id').primary();
            table.string('expediente_id').references('id').inTable('expedientes_tecnicos').onDelete('CASCADE');
            table.string('tdr_id').references('id').inTable('tdr_documentos');
            table.integer('tomo_numero');
            table.string('nombre_archivo');
            table.string('ruta_archivo');
            table.text('contenido_analisis', 'longtext');
            table.timestamp('fecha_analisis').defaultTo(knex.fn.now());
            table.string('modelo_ia');
        })
    ]);
};

exports.down = function (knex) {
    return Promise.all([
        knex.schema.dropTableIfExists('analisis_tomos'),
        knex.schema.dropTableIfExists('expedientes_tecnicos'),
        knex.schema.dropTableIfExists('tdr_documentos')
    ]);
};
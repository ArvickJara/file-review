/** @type {import('knex').Knex.Migration} */
exports.up = async function up(knex) {
    // 1. Tabla principal de Proyectos/Expedientes
    await knex.schema.createTable('proyectos', (table) => {
        table.string('id').primary(); // ID único generado por ti
        table.string('nombre').notNullable();
        table.enum('tipo', ['expediente_tecnico', 'TDR']).notNullable();
        table.enum('estado', ['pendiente', 'en_progreso', 'evaluado', 'archivado', 'activo']).defaultTo('pendiente');
        table.string('codigo_proyecto').unique();
        table.string('entidad_ejecutora');
        table.decimal('monto_referencial', 15, 2);
        table.text('descripcion');
        table.boolean('datos_extraidos').defaultTo(false);
        table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
        table.index(['tipo', 'estado']);
    });

    // 2. Tabla para los documentos individuales (tomos o archivos únicos)
    await knex.schema.createTable('documentos', (table) => {
        table.string('id').primary(); // ID único generado por ti
        table.string('proyecto_id').references('id').inTable('proyectos').onDelete('CASCADE').notNullable();
        table.string('nombre_archivo').notNullable();
        table.string('ruta_archivo').notNullable();
        table.integer('orden').comment('Para numerar los tomos, ej: 1, 2, 3...');
        table.enum('estado', ['pendiente', 'procesando', 'analizado', 'error']).defaultTo('pendiente');
        table.timestamp('fecha_subida').defaultTo(knex.fn.now());
        table.index(['proyecto_id']);
    });

    // 3. Tabla para los resultados del análisis de cada documento
    await knex.schema.createTable('analisis', (table) => {
        table.increments('id').primary();
        table.string('documento_id').references('id').inTable('documentos').onDelete('CASCADE').notNullable().unique(); // Un análisis por documento
        table.text('contenido', 'longtext').notNullable();
        table.string('modelo_ia');
        table.timestamp('fecha_analisis').defaultTo(knex.fn.now());
    });
};

exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('analisis');
    await knex.schema.dropTableIfExists('documentos');
    await knex.schema.dropTableIfExists('proyectos');
};
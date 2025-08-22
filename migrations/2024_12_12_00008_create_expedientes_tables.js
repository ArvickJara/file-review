exports.up = function (knex) {
  return Promise.all([
    // Tabla principal de expedientes
    knex.schema.createTable('expedientes', function (table) {
      table.string('id').primary();
      table.string('nombre').notNullable();
      table.string('ruta_archivo').notNullable();
      table.enum('tipo', ['expediente_tecnico', 'costos_presupuestos']).notNullable();
      table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
      table.enum('estado', ['pendiente', 'evaluado', 'archivado']).defaultTo('pendiente');
      table.integer('usuario_id').unsigned().references('id').inTable('usuarios');
    }),

    // Tabla para los análisis de expedientes
    knex.schema.createTable('analisis_expedientes', function (table) {
      table.increments('id').primary();
      table.string('expediente_id').references('id').inTable('expedientes').onDelete('CASCADE');
      table.text('contenido', 'longtext').notNullable();
      table.timestamp('fecha_analisis').defaultTo(knex.fn.now());
      table.string('modelo_ia');
    })
  ]);
};

exports.down = function (knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('analisis_expedientes'),
    knex.schema.dropTableIfExists('expedientes')
  ]);
};
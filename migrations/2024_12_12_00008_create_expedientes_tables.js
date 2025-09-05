// 2024_12_12_00008_create_expedientes_tables.js
/** @type {import('knex').Knex.Migration} */
exports.up = async function up(knex) {
  // 1) Tabla principal: expedientes
  await knex.schema.createTable('expedientes', (table) => {
    table.string('id').primary();                           // tú generas el ID (Date.now().toString())
    table.string('nombre').notNullable();                   // nombre que muestras en UI
    table.string('ruta_archivo').notNullable();             // archivo guardado en /public/uploads
    table.enum('tipo', ['expediente_tecnico', 'costos_presupuestos']).notNullable();
    table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
    table.enum('estado', ['pendiente', 'evaluado', 'archivado']).defaultTo('pendiente');

    // Índices
    table.index(['fecha_creacion']);
    table.index(['tipo', 'estado']);
  });

  // 2) Tabla de análisis por expediente
  await knex.schema.createTable('analisis_expedientes', (table) => {
    table.increments('id').primary();
    table.string('expediente_id')
      .references('id')
      .inTable('expedientes')
      .onDelete('CASCADE')
      .notNullable();

    // En MySQL, usa LONGTEXT para textos largos
    table.text('contenido', 'longtext').notNullable();      // informe en texto devuelto por la IA

    table.timestamp('fecha_analisis').defaultTo(knex.fn.now());
    table.string('modelo_ia');
    table.index(['expediente_id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('analisis_expedientes');
  await knex.schema.dropTableIfExists('expedientes');
};

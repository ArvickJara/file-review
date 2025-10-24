exports.up = function (knex) {
    return knex.schema.createTable('analisis', function (table) {
        table.increments('id').primary();
        table.string('documento_id').notNullable();
        table.text('contenido').notNullable();
        table.string('modelo_ia');
        table.string('tipo_analisis');
        table.timestamp('fecha_analisis').defaultTo(knex.fn.now());

        table.foreign('documento_id').references('documentos.id').onDelete('CASCADE');
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('analisis');
}; 
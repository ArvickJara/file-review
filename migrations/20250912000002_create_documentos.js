exports.up = function (knex) {
    return knex.schema.createTable('documentos', function (table) {
        table.string('id').primary();
        table.string('proyecto_id').notNullable();
        table.string('nombre_archivo').notNullable();
        table.string('ruta_archivo').notNullable();
        table.string('estado').defaultTo('pendiente');
        table.timestamp('fecha_subida').defaultTo(knex.fn.now());

        table.foreign('proyecto_id').references('proyecto.id').onDelete('CASCADE');
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('documentos');
};
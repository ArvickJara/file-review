exports.up = function (knex) {
    return knex.schema.createTable('proyecto', function (table) {
        table.string('id').primary();
        table.string('nombre').notNullable().unique();
        table.string('cui').unique();
        table.integer('numero_entregables').notNullable();
        table.text('descripcion');
        table.boolean('datos_extraidos').defaultTo(false);
        table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('proyecto');
};
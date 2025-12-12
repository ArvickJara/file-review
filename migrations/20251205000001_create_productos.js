exports.up = function (knex) {
    return knex.schema.createTable('tdr_producto', function (table) {
        table.increments('id').primary();
        table.integer('entregable_id').unsigned().notNullable();
        table.string('nombre_producto').notNullable();
        table.text('descripcion');
        table.integer('orden').defaultTo(1);
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.foreign('entregable_id').references('tdr_entregable.id').onDelete('CASCADE');
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('tdr_producto');
};

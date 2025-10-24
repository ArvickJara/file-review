exports.up = function (knex) {
    return knex.schema.createTable('tdr_entregable', function (table) {
        table.increments('id').primary();
        table.string('proyecto_id').notNullable();
        table.string('nombre_entregable').notNullable();
        table.integer('plazo_dias');
        table.decimal('porcentaje_pago', 5, 2);
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.foreign('proyecto_id').references('proyecto.id').onDelete('CASCADE');
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('tdr_entregable');
};
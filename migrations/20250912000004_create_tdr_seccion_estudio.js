exports.up = function (knex) {
    return knex.schema.createTable('tdr_seccion_estudio', function (table) {
        table.increments('id').primary();
        +       table.integer('entregable_id').unsigned().notNullable();  // ← Agregar .unsigned()
        table.string('nombre').notNullable();
        table.integer('orden').notNullable();
        table.boolean('es_estudio_completo').defaultTo(false);
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.foreign('entregable_id').references('tdr_entregable.id').onDelete('CASCADE');
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('tdr_seccion_estudio');
};
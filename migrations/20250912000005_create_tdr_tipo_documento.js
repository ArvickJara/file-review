exports.up = function (knex) {
    return knex.schema.createTable('tdr_tipo_documento', function (table) {
        table.increments('id').primary();
        table.integer('seccion_estudio_id').unsigned().notNullable();
        table.string('nombre_tipo_documento').notNullable();
        table.integer('orden').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.foreign('seccion_estudio_id').references('tdr_seccion_estudio.id').onDelete('CASCADE');
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('tdr_tipo_documento');
};
// 20250912000006_create_tdr_contenido_minimo.js
exports.up = function (knex) {
    return knex.schema.createTable('tdr_contenido_minimo', function (table) {
        table.increments('id').primary();
        +       table.integer('tipo_documento_id').unsigned().notNullable();
        table.string('nombre_requisito').notNullable();
        table.text('descripcion_completa').notNullable();
        table.boolean('es_obligatorio').defaultTo(true);
        table.integer('orden').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.foreign('tipo_documento_id').references('tdr_tipo_documento.id').onDelete('CASCADE');
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('tdr_contenido_minimo');
};
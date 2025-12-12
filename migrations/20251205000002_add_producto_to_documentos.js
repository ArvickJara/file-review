exports.up = function (knex) {
    return knex.schema.alterTable('documentos', function (table) {
        // Agregar relación con producto
        table.integer('producto_id').unsigned().nullable();
        table.foreign('producto_id').references('tdr_producto.id').onDelete('SET NULL');
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('documentos', function (table) {
        table.dropForeign('producto_id');
        table.dropColumn('producto_id');
    });
};

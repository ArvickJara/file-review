exports.up = function (knex) {
    return knex.schema.alterTable('proyecto', function (table) {
        table.text('estructura_minimos_json', 'longtext').nullable().after('descripcion');
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('proyecto', function (table) {
        table.dropColumn('estructura_minimos_json');
    });
};

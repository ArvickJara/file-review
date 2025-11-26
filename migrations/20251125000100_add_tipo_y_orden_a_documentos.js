exports.up = async function (knex) {
    await knex.schema.table('documentos', function (table) {
        table.string('tipo_documento').notNullable().defaultTo('otro');
        table.integer('orden').unsigned().nullable();
    });

    // Marcar documentos existentes (los actuales provienen del TDR) con tipo tdr
    await knex('documentos').update({ tipo_documento: 'tdr', orden: 0 });
};

exports.down = async function (knex) {
    await knex.schema.table('documentos', function (table) {
        table.dropColumn('orden');
        table.dropColumn('tipo_documento');
    });
};

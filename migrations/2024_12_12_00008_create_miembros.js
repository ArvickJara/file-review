exports.up = function (knex) {
  return knex.schema.createTable('miembros', function (table) {
    table.increments('id').primary().unsigned();
    table.string('cargo', 100).notNullable();
    table.string('nombres', 100).notNullable();
    table.string('apellidos', 100).notNullable();
    table.text('imagen_url').nullable();
    table.boolean('activo').defaultTo(true);
    table.integer('orden').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('miembros');
};

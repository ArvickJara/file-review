// createDatabase.js

require('dotenv').config();
const knex = require('knex');

const knexConfig = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  }
};

const db = knex(knexConfig);

db.raw(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`)
  .then(() => {
    console.log(`Base de datos "${process.env.DB_NAME}" creada o ya existe`);
  })
  .catch((err) => {
    console.error('Error creando la base de datos:', err);
  })
  .finally(() => {
    db.destroy();
  });
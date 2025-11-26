const knex = require('knex');

const config = {
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'eval_db'
    },
    pool: { min: 2, max: 10 }
};

module.exports = knex(config);
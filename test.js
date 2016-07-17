var {Pool, Client} = require('pg');
var {co, parseUrl} = require('./utils');

var {DATABASE_URL='postgres://test:test@localhost:5432/dev'} = process.env;

var pool = new Pool(parseUrl(DATABASE_URL));

co(function*(){
	try{
		
		var q1 = yield pool.query(`CREATE TABLE IF NOT EXISTS "user" (
			id      SERIAL PRIMARY KEY,
			email   TEXT UNIQUE NOT NULL,
			password TEXT
		)`);
		// var q2 =  yield pool.query(`INSERT INTO "user" (email) VALUES
		//    ('john'),
		//    ('bob@go.com'),
		//    ('ok');
		// `);
		// var q22 =  yield pool.query(`INSERT INTO "user" (email) VALUES
		//    ('john');
		// `);
		var q3 = yield pool.query(`SELECT id, email FROM "user" WHERE email=$1 LIMIT 10`, ['john']);
		console.log(q3.rows);
		// for (let row of q3.rows)
		// 	console.log(row);

		var q4 = yield pool.query(`DELETE FROM "user"`);
		// var q5 = yield pool.query(`DROP TABLE IF EXISTS "user"`);

	} catch(e) {
		console.log(e);
	}
})



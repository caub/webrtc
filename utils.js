const crypto = require('crypto');

module.exports = {
	
	co(gen) { // coroutine, equivalent to https://github.com/tj/co
		var it = gen();
		return Promise.resolve().then(function pump(v) {
				const {done, value} = it.next(v);
				if(done) return value;
				return Promise.resolve(value).then(pump, it.throw.bind(it));
		});
	},

	pbkdf2: password => new Promise(r=>{
		crypto.pbkdf2(password, 'salty salt', 10, 512, 'sha512', (err, h)=>r(hash));
	}),

	// scrypt or bcrypt should be used for serious apps
	md5: password => crypto.createHash('md5').update(password+'salty salto').digest('hex'),

	parseUrl(dburl) {
		const [,user,password,host,port,database] = dburl.match(/postgres:\/\/(\w+):(\w+)@([\w.-]+):(\d+)\/(\w+)/);
		return {user, password, host, database};
	}


};
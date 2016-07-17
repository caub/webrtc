var url = require('url');
var {Server: WebSocketServer} = require('ws');
var express = require('express');
var passport = require('passport');
var LocalStrategy   = require('passport-local').Strategy;
var GoogleStrategy = require('passport-google-oauth20').Strategy;
// var {googleAuth} = require('./config.json');
var sessionParser = require('express-session')({ 
	secret: 'keyboard cat', 
	resave: false, 
	saveUninitialized: false,
	//cookie: { domain:'localhost'},
});
var {md5, pbkdf2, parseUrl} = require('./utils');
var {Pool} = require('pg');
var {PORT=3000, DATABASE_URL='postgres://test:test@localhost:5432/dev'} = process.env;


// var https = require('https'); // http one is created by default by express
// var fs = require('fs');
// var options = {
// 	key: fs.readFileSync('private.key'),
// 	cert: fs.readFileSync('certificate.crt')
// };

var pool = new Pool(parseUrl(DATABASE_URL));

var app = express();

app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(sessionParser);
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({usernameField: 'email'},
	function(email, password, done) {
		// console.log('authing', email, password);
		pool.query(`SELECT id, email FROM "user" WHERE email=$1 AND password=$2 LIMIT 1`, [email, md5(password)])
		.then(res=>{
			done(null, res.rows[0])
		});
	}
));

app.post('/auth', function(req, res){
	const {email, password} = req.body;
	const {pathname} = url.parse(req.headers.referer||'/');
	if (!password) 
		return res.redirect(401, pathname+'?err=emptypassword');
	if (!email) 
		return res.redirect(401, pathname+'?err=emptyemail');
	pool.query(`INSERT INTO "user" (email, password) VALUES ($1, $2)`, [email, md5(password)])
	.then(_=>res.redirect(pathname+'?welcome'))
	.catch(err=>res.redirect(401, pathname+'?err='+err))
});

// passport.use(new GoogleStrategy({
// 		clientID: googleAuth.clientID,
// 		clientSecret: googleAuth.clientSecret,
// 		callbackURL: googleAuth.callbackURL
// 	},
// 	function(accessToken, refreshToken, details, profile, cb) {
// 		if (profile.emails.length===0) throw new Error('missing emails');
// 		return cb(null, profile.emails[0].value);
// 	}
// ));

app.get('/logout', (req, res)=>{
	req.logout();
	res.redirect(req.headers.referer||'/');
});

app.post('/login', function(req, res, next) {
	passport.authenticate('local', function(err, user, info) {
		if (err) return next(err);
		const {pathname} = url.parse(req.headers.referer||'/');
		if (!user) return res.redirect(pathname+'?err=wrong credentials');
		req.logIn(user, function(err) {
			if (err) return next(err);
			return res.redirect(pathname);
		});
	})(req, res, next);
});



// app.get('/auth/google',
// 	passport.authenticate('google', { scope: ['email'] })
// );

// app.get('/auth/google/callback', 
// 	passport.authenticate('google', { failureRedirect: '/auth?failure=google' }),
// 	function(req, res) {
// 		res.redirect('/');
// });


passport.serializeUser(function(user, cb) {
	cb(null, user);
});

passport.deserializeUser(function(email, cb) {
	cb(null, email);
});

app.use(express.static('.'));

var server = app.listen(PORT, function(){ // should use a port > 1024 ofc
	console.log('Listening on ' + this.address().port)
});
// https.createServer(options, app).listen(443); // just tests, should use nginx actually

var wss = new WebSocketServer({server});

let counter=0; // global connections counter, to ensure unique identifiers
const rooms = {}; // there's wss.clients, but we want to have connections by 'room'/url


wss.on('connection', function(ws){
	var location = url.parse(ws.upgradeReq.url, true);
	// you might use location.query.access_token to authenticate or share sessions
	// or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
	sessionParser(ws.upgradeReq, {}, function(){
		const {passport: p} = ws.upgradeReq.session;
		if (!p) return;
		let clients=rooms[location.path]=rooms[location.path]||new Map();
		const id=counter++;
		clients.set(ws, id);
		ws.on('message', m=>clients.forEach((_,c)=>c.send(m)));
		ws.on('close', _=> {
			clients.delete(ws);
			broadcast()
		});
		const broadcast = () => {
			const users = [...clients.values()];
			clients.forEach((i, c)=> c.send(JSON.stringify({type:'join', id:i, users})));
		};
		broadcast()
	});

});


app.get(['/', '/:room'], (req, res)=>{
	const {err} = req.query;
	res.send(
		req.user?
`
<link rel="icon" href="data:;base64,iVBORw0KGgo=">
<link href="/style.css" rel="stylesheet" type="text/css">
room: ${req.params.room}, user: ${JSON.stringify(req.user)} <a href="/logout">sign out</a>
<div id="app"></div>
<script src="//webrtc.github.io/adapter/adapter-latest.js"></script>
<script src="/client.js"></script>
`:
`<form action="/login" method="post">
	<input name="email" placeholder="email/username" required>
	<input name="password" placeholder="password" required>
	<input type="submit" value="sign in">
	<input type="submit" formaction="/auth" value="sign up">
</form>${err?'error: '+err:''}` // <a href="/auth/google">sign in with google</a>
	)
})



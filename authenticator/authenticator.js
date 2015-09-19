var http = require('http');
var querystring = require('querystring');

var decoratedCallback = function(fn, fncontext) {
	return function() {
		fn.apply(fncontext, arguments);
	}
};

if (typeof String.prototype.startsWith != 'function') {
	String.prototype.startsWith = function(str) {
		return this.slice(0, str.length) == str;
	};
}

if (typeof String.prototype.endsWith != 'function') {
	String.prototype.endsWith = function(str) {
		return this.slice(-str.length) == str;
	};
}

function Authenticator(properties) {

	this.tokens = [];
	this.profiles = [];
	this.server = null;
	this.port = properties.port;

	this.toString = function() {
		return "AuthenticatorService { port: " + this.port + " }";
	}

	this.init = function() {
		this.server = http.createServer(decoratedCallback(this.handleRequest, this));
		this.server.listen(this.port, decoratedCallback(function() {
			console.log(this.toString(), "listening: port", this.port);
		}, this));
	}

	this.respond = function(response, code, payload) {
		response.writeHead(code, {
			'Content-Type' : 'application/json',
			'Access-Control-Allow-Origin' : '*'
		});
		payload.status = code;
		response.end(JSON.stringify(payload));
		if (payload != undefined && payload != null && payload.message != undefined)
			console.log("server response", code, payload.message)
		else
			console.log("server response", code);
	}

	this.handleRequest = function(request, response) {
		var resource = request.url.toString();
		if (resource.startsWith("/"))
			resource = resource.substring(1);
		var fullpath = resource.split("/");

		if (fullpath[0] == "v1" && fullpath.length == 2) {
			if (request.method != "POST") {
				this.respond(response, 400, {
					message : 'Unsupported v1 request method'
				});
				return;
			}
			
			console.log("object request", fullpath);

			var payload = "";
			request.on("data", decoratedCallback(function(chunk) {
				payload += chunk.toString();
			}, this));

			request.on("end", decoratedCallback(function() {
				var data = querystring.parse(payload);
				console.log("object body", data);
				var command = fullpath[1];
				if (command == "authenticate") {
					if (data.token == undefined || data.token == null || data.username == undefined || data.username == null
							|| data.password == undefined || data.password == null) {
						this.respond(response, 498, {
							message : 'Invalid request'
						});
						return;
					}
					console.log("authentication request", data.token);

					if (this.profiles[data.username] == undefined || this.profiles[data.username] == null) {
						this.profiles[data.username] = {
							username : data.username,
							password : data.password
						}
					}

					var profile = this.profiles[data.username];
					if (data.username != profile.username || data.password != profile.password) {
						this.respond(response, 498, {
							message : 'Incorrect username + password'
						});
					} else {
						this.tokens[data.token] = {
							username : data.username,
							secret : data.password
						};

						this.respond(response, 200, {
							username : this.tokens[data.token].username,
							token : data.token,
							secret : this.tokens[data.token].secret
						});
					}
				} else if (command == "validate") {
					var profile = this.tokens[data.token];
					if (profile == undefined || profile == null) {
						this.respond(response, 498, {
							message : 'Token invalid'
						});
						return;
					}

					if (data.secret == profile.secret) {
						this.respond(response, 200, {
							username : profile.username,
							token : data.token
						});
					} else
						this.respond(response, 498, {
							message : 'Secret mismatch'
						});
				} else
					this.respond(response, 400, {
						message : 'Unsupported v1 command'
					});
			}, this));
		} else
			this.respond(response, 400, {
				message : 'Unsupported authentication scheme'
			});
	}
}

var server = new Authenticator({
	port : 8081
});
server.init();
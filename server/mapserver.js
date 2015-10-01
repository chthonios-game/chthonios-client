var Common = require("./common.js");
var fs = require('fs');
var http = require('http');

function MapService(properties) {

	this.server = null;
	this.port = properties.port;

	this.toString = function() {
		return "MapService { port: " + this.port + " }";
	}

	this.init = function() {
		this.server = http.createServer(Common.decoratedCallback(this.handleRequest, this));
		this.server.listen(this.port, Common.decoratedCallback(function() {
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
		console.log(this.toString(), "incoming map object request", fullpath);

		var mapname = fullpath[0];
		if (mapname != null && mapname.length != 0) {
			var wd = "data/world/" + mapname + "/";
			if (!fs.existsSync(wd)) {
				this.respond(response, 400, {
					message : "no such world"
				});
				return;
			}

			var obj = wd + fullpath[1];
			if (!fs.existsSync(obj)) {
				this.respond(response, 400, {
					message : "no such object type"
				});
				return;
			}

			if (fullpath.length == 3)
				obj += "/" + fulllpath[2];

			fs.readFile(obj, {
				encoding : 'utf-8'
			}, Common.decoratedCallback(function(e, data) {
				if (e) {
					this.respond(response, 500, {
						message : "distributed i/o block transfer error"
					});
					return;
				}

				this.respond(response, 200, {
					payload : data
				});
				return;
			}, this));
		} else
			this.respond(response, 501, {});
	}

}

module.exports = {
	MapService : MapService
}
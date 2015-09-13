var Common = require("./common.js");

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

	this.handleRequest = function(request, response) {
		var resource = request.url.toString();
		if (resource.startsWith("/"))
			resource = resource.substring(1);
		var fullpath = resource.split("/");

		response.writeHead(501, {
			'Content-Type' : 'application/json'
		});
		response.end(JSON.stringify({
			message : 'not implemented',
			fullpath : fullpath
		}));
	}

}

module.exports = {
	MapService : MapService
}
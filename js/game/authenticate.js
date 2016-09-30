function authenticator() {
	this.fetcher = null;
	this.token = null;

	this.generateUUID = function() {
		var d = new Date().getTime();
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = (d + Math.random() * 16) % 16 | 0;
			d = Math.floor(d / 16);
			return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
		});
	},

	this.requestToken = function(callback) {
		if (this.token == undefined || this.token == null)
			this.token = this.generateUUID();
		this.showAuthenticator(decoratedCallback(function() {
			var username = document.getElementById("username").value;
			var password = document.getElementById("password").value;
			if (this.fetcher != null)
				return;
			var cb = decoratedCallback(function(result) {
				if (result.status == "200")
					callback(result);
				else {
					if (result.message != undefined && result.message != null)
						window.alert(result.message);
					else
						window.alert("A problem occured communicating with the log-in server.\n" + result.status);
				}
			}, this);
			this.performAuthenticationRequest(username, password, cb);
		}, this));
	}

	this.performAuthenticationRequest = function(un, pw, cb) {
		this.fetcher = new XMLHttpRequest();

		this.fetcher.onreadystatechange = decoratedCallback(function() {
			if (this.fetcher.readyState == 4) {
				var result = {
					status : this.fetcher.status
				};
				if (this.fetcher.status == 200)
					result = JSON.parse(this.fetcher.responseText);
				this.fetcher = null;
				cb(result);
			}
		}, this);

		this.fetcher.open("POST", "http://localhost:8081/v1/authenticate", true);
		this.fetcher.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		this.fetcher.send("token=" + this.token + "&username=" + un + "&password=" + pw);
	}

	this.showAuthenticator = function(callback) {
		var button = document.getElementById("authenticate");
		button.onclick = callback;
	};

}
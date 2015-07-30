NodeGame
==============

Rough attempt at a node.js client/server game

Uses the javascript [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) for the clientside, and the [ws](https://github.com/websockets/ws) library for creating WebSockets on the serverside.

The client queues messages to send to the server, and sends them if the connection is open.  
The server responds with the exact same message back to the client.  
The client prints the message to the console.  
var restify = require('restify');
var builder = require('botbuilder');

require('dotenv').config();

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

var inMemoryStorage = new builder.MemoryBotStorage();

// This is a dinner reservation bot that uses a waterfall technique to prompt users for input.
var bot = new builder.UniversalBot(connector, [
    function (session) {
        session.send("Welcome to the reduce waste bot.");
        builder.Prompts.text(session, "First tell me your name");
    },
    function (session, results) {
        session.dialogData.name = results.response;
        // Process request and display reservation details
        session.send(`Understood,  ${session.dialogData.name}, let's get started!`);
        session.endDialog();
    }
]).set('storage', inMemoryStorage); // Register in-memory storage 
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


// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var bot = new builder.UniversalBot(connector, [
    function (session) {
        session.beginDialog('greetings');
    }
]).set('storage', inMemoryStorage);

bot.dialog('greetings', [
    function (session) {
        session.send("Hi! Hope you're doing well today. My goal is to help you reduce your waste at home.");
        session.send("To do so, each time you take out the trash, please take a picture of it. I'll estimate its volume and weight and then add it to your total waste.:wastebasket:");
        session.send("Let's start now! Please take a picture of your trash bag :point_down:");
    }
]);
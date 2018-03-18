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
        session.beginDialog('greetings', session.dialogData.name);
    },
    function (session, results) {
        // Process request and display reservation details
        session.send(`Well, let's get started %s, please send me a picture of your trash`, session.userData.name);
    },
    function (session, results) {
        var msg = session.message;
        if (msg.attachments && msg.attachments.length > 0) {
         // Echo back attachment
         var attachment = msg.attachments[0];
            session.send({
                text: "You sent:",
                attachments: [
                    {
                        contentType: attachment.contentType,
                        contentUrl: attachment.contentUrl,
                        name: attachment.name
                    }
                ]
            });
        } else {
            // Echo back users text
            session.send("You said: %s", session.message.text);
        }
        session.endDialog("Thanks, see you later");
    }
]).set('storage', inMemoryStorage); // Register in-memory storage 


bot.dialog('greetings', [
    function (session) {
        session.beginDialog('askName');
    },
    function (session, results) {
        session.userData.name = results.response;
        session.endDialog('Hello %s!', results.response);
    }
]);
bot.dialog('askName', [
    function (session) {
        builder.Prompts.text(session, 'Hi! What is your name?');
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
]);

bot.dialog('help', function (session, args, next) {
    session.endDialog("This is a bot that can help you reduce your waste");
})
.triggerAction({
    matches: /^help$/i,
    onSelectAction: (session, args, next) => {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        session.beginDialog(args.action, args);
    }
});
var restify = require('restify');
var builder = require('botbuilder');
var needle = require('needle');
var imageAnalysis = require('./imageanalysis');

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
    function (session,results) {
        builder.Prompts.attachment(session, `Well, let's get started, please send me a picture of your trash`);
    },
    function (session,results) {
        console.log('attachement requested');
        if (hasImageAttachment(session)) {
            var stream = getImageStreamFromMessage(session.message);
            session.send("got the image in the attachment");
            imageAnalysis
            .getCaptionFromStream(stream)
            .then(function (caption) { handleSuccessResponse(session, caption); })
            .catch(function (error) { handleErrorResponse(session, error); });
          } else {
            var imageUrl = parseAnchorTag(session.message.text) || (validUrl.isUri(session.message.text) ? session.message.text : null);
            if (imageUrl) {
                session.send("got the image in the URL");
              } else {
                session.send('Did you upload an image? I\'m more of a visual person. Try sending me an image or an image URL');
            }
        }
    }

]).set('storage', inMemoryStorage); // Register in-memory storage 


bot.dialog('greetings', [
    function (session) {
        builder.Prompts.text(session, 'Hi! What is your name?');
    },
    function (session, results) {
        session.userData.name = results.response;
        session.endDialog('Hello %s!', results.response);
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

function hasImageAttachment(session) {
    console.log("check attachment");
    return session.message.attachments.length > 0 &&
        session.message.attachments[0].contentType.indexOf('image') !== -1;
}

function getImageStreamFromMessage(message) {
    var headers = {};
    var attachment = message.attachments[0];
    if (checkRequiresToken(message)) {
        // The Skype attachment URLs are secured by JwtToken,
        // you should set the JwtToken of your bot as the authorization header for the GET request your bot initiates to fetch the image.
        // https://github.com/Microsoft/BotBuilder/issues/662
        connector.getAccessToken(function (error, token) {
            var tok = token;
            headers['Authorization'] = 'Bearer ' + token;
            headers['Content-Type'] = 'application/octet-stream';

            return needle.get(attachment.contentUrl, { headers: headers });
        });
    }

    headers['Content-Type'] = attachment.contentType;
    return needle.get(attachment.contentUrl, { headers: headers });
}

function checkRequiresToken(message) {
    return message.source === 'skype' || message.source === 'msteams';
}

/**
 * Gets the href value in an anchor element.
 * Skype transforms raw urls to html. Here we extract the href value from the url
 * @param {string} input Anchor Tag
 * @return {string} Url matched or null
 */
function parseAnchorTag(input) {
    var match = input.match('^<a href=\"([^\"]*)\">[^<]*</a>$');
    if (match && match[1]) {
        return match[1];
    }

    return null;
}

//=========================================================
// Response Handling
//=========================================================
function handleSuccessResponse(session, caption) {
    if (caption) {
        session.send('I think it\'s ' + caption);
    }
    else {
        session.send('Couldn\'t find a caption for this one');
    }

}

function handleErrorResponse(session, error) {
    var clientErrorMessage = 'Oops! Something went wrong. Try again later.';
    if (error.message && error.message.indexOf('Access denied') > -1) {
        clientErrorMessage += "\n" + error.message;
    }

    console.error(error);
    session.send(clientErrorMessage);
}
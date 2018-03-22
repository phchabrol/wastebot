var restify = require('restify');
var builder = require('botbuilder');
var needle = require('needle');
var imageAnalysis = require('./imageanalysis');
var azure = require('botbuilder-azure'); 
var utilities = require('./utilities.js');

require('dotenv').config();

//set up cosmos DB connector
var documentDbOptions = {
    host: process.env.DOCUMENTDB_URI, 
    masterKey: process.env.DOCUMENTDB_KEY, 
    database: 'botdoc',   
    collection: 'botdata'
};

var docDbClient = new azure.DocumentDbClient(documentDbOptions);

var cosmosStorage = new azure.AzureBotStorage({ gzipData: false }, docDbClient);

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

var user_records = {"records":[]};


// Start the dialog design to 
var bot = new builder.UniversalBot(connector, [
    function (session) {
        session.beginDialog('greetings', session.dialogData.name);

        
    },
    function (session,results) {
        builder.Prompts.attachment(session, `Please send me a picture of your trash`);
    },
    function (session,results) {
        console.log('attachement requested');
        if (hasImageAttachment(session)) {
            var stream = getImageStreamFromMessage(session.message);
            imageAnalysis
            .getCaptionFromStream(stream)
            .then(function (caption) { handleSuccessResponse(session, caption); })
            .catch(function (error) { handleErrorResponse(session, error); });

            session.save();

          } else {
            var imageUrl = parseAnchorTag(session.message.text) || (validUrl.isUri(session.message.text) ? session.message.text : null);
            if (imageUrl) {
                session.send("got the image in the URL");
              } else {
                session.send('Did you upload an image? I\'m more of a visual person. Try sending me an image or an image URL');
            }
        }
    }

]).set('storage', cosmosStorage); // Register Cosmos DB storage

bot.dialog('greetings', [
    function (session) {
        var userName = session.message.address.user.id;
        session.endDialog('Hello, welcome here,'+userName+' .I\'ll analyse your pictures of trash. Now, let\'s get started!');
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
//=========================================================
// Response Handling
//=========================================================
function handleSuccessResponse(session, caption) {
    var record = 
        {
            "record_id": utilities.getUniqueID(),
            "record_date": new Date(),
            "trash":false,
            "trash_type_detected" : caption["trashType"],
            "trash_volume_detected" : caption["volume"],
            "trash_analysis" : ""
        };
    if (caption["flagTrash"]=="Yes") {
        var display ="";
        display=" "+caption["volume"]+" bag of "+caption["trashType"]+" trash";
        record.trash = true;
        record.trash_analysis = display;
        session.send('I think it\'s a' + display);
    }
    else {
        session.send('I don\'t think this is trash');
    }
    user_records.records.push(record);
    session.userData.user_records = user_records;
}

function handleErrorResponse(session, error) {
    var clientErrorMessage = 'Oops! Something went wrong. Try again later.';
    if (error.message && error.message.indexOf('Access denied') > -1) {
        clientErrorMessage += "\n" + error.message;
    }

    console.error(error);
    session.send(clientErrorMessage);
}
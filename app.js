var restify = require('restify');
var builder = require('botbuilder');
var needle = require('needle');
var imageAnalysis = require('./imageanalysis');
var azure = require('botbuilder-azure'); 
var utilities = require('./utilities.js');
var mongoose = require('mongoose');
var User = require('./models/user');
var TrashRecord = require('./models/record');

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

// install mongoose DB
//Set up default mongoose connection
var mongoDB = process.env.MONGODB_URI;
mongoose.connect(mongoDB);
// Get Mongoose to use the global promise library
mongoose.Promise = global.Promise;
//Get the default connection
var db = mongoose.connection;

//Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));


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

// Start the dialog design 
var bot = new builder.UniversalBot(connector, [
    function (session) {
        session.beginDialog('greetings', session.dialogData.name);
        createUser(session, function(results){
            session.userData.userId = results._id;
            console.log(results._id);
        });
    },
    function (session,results) {
        builder.Prompts.attachment(session, `Please send me a picture of your trash`);
    },
    function (session,results,next) {
        session.beginDialog('imageanalysis', session);
    }
]).set('storage', cosmosStorage); // Register Cosmos DB storage

bot.dialog('greetings', [
    function (session) {
        session.endDialog('I\'ll analyse your pictures of trash. Now, let\'s get started!');
    }
]).reloadAction('startOver', 'Ok, starting over.', {
    matches: /^restart$/i
});;;

bot.dialog('imageanalysis', [
    function (session, args) {
        if(hasImageAttachment(session)) {
            var stream = getImageStreamFromMessage(session.message);
            imageAnalysis
            .getCaptionFromStream(stream)
            .then(function (caption) { 
                handleSuccessResponse(session, caption, function(results) {
                    session.send(results)
                    session.userData.usercaption = caption;
                    createTrashRecord(session,  session.userData, function(resultsRecord){
                        console.log(resultsRecord);
                    });
                    builder.Prompts.choice(session, "Do you want to upload a new picture?", "Yes|No",{ listStyle: 3 });
                });
            })
            .catch(function (error) { 
                session.send(handleErrorResponse(session, error)); 
            });
        }
    },
    function (session, results){
        if(results.response.entity=="Yes"){
            session.send('Ok let\'s upload a new picture');
            session.replaceDialog("imageanalysis", { reprompt: true }); 
        } else{           
            checkCount(session, function(results){
                session.send("You recordeded %s picture since you started to use me.", results);
                session.endDialog('Please come back anytime. I\'ll be here. Waiting for you.');

              });
              
        }
    }
]).reloadAction('startOver', 'Ok, starting over.', {
    matches: /^restart$/i
});;

bot.dialog('help', function (session, args, next) {
    session.endDialog("This is a bot that can help you reduce your waste");
})
.triggerAction({
    matches: /^help$/i,
    onSelectAction: (session, args, next) => {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        session.beginDialog(args.twi, args);
    }
});

function createTrashRecord(session, data, callback){
    TrashRecord.create({ 
        record_date: new Date(),
        user: data.userId,
        trash_detected: data.usercaption["flagTrash"],
        trash_type_detected: data.usercaption["trashType"],
        volume_detected:data.usercaption["volume"]
    }, function (err) {
        if (err) return handleErrorDB(err);
        // saved!
      });
      return callback("records added");
};

function createUser(session, callback){
    var user = new User({ 
        user_name: session.message.address.user.name,
        date_of_creation: new Date()
    }, function (err) {
        if (err) return handleErrorDB(err);
        // saved!
      });
      return callback(user);
}

function checkCount(session, callback){
    TrashRecord.count({
        "user": session.userData.userId  
    }, function(err, count){
        if (err) return handleErrorDB(err);
        return callback(count);
    });
}

function hasImageAttachment(session) {
     return session.message.attachments.length > 0 &&
        session.message.attachments[0].contentType.indexOf('image') !== -1;
}

function getImageStreamFromMessage(message) {
    var headers = {};
    var attachment = message.attachments[0];
    if (checkRequiresToken(message)) {
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
function handleSuccessResponse(session, caption, callback) {
    var display ="";   
    if (caption["flagTrash"]=="Yes") {
        display = 'I think it\'s a '+caption["volume"]+" bag of "+caption["trashType"]+" trash";
    }
    else {
        display = 'I don\'t think this is trash';
    }
    return callback(display);
}

function handleErrorResponse(session, error) {
    var clientErrorMessage = 'Oops! Something went wrong. Try again later.';

    if (error.message && error.message.indexOf('Access denied') > -1) {
        clientErrorMessage += "\n" + error.message;
    }
    return clientErrorMessage;
}

//=========================================================
// Error Handling
//=========================================================
function handleErrorDB(error) {
    console.log(error);
}
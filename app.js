var restify = require('restify');
var builder = require('botbuilder');
var needle = require('needle');
var imageAnalysis = require('./imageanalysis');
var azure = require('botbuilder-azure'); 
var utilities = require('./utilities.js');
var http = require('http');
var request = require('request');


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

// Initialize the Botanalytics middleware
var BotanalyticsMiddleware = require('botanalytics-microsoftbotframework-middleware').BotanalyticsMiddleware({
    token: process.env.BOTANALYTICS_TOKEN
  });
  

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

var inMemoryStorage = new builder.MemoryBotStorage();

var userId = "";

// Start the dialog design 
var bot = new builder.UniversalBot(connector, [
    function (session) {
        session.beginDialog('greetings', session.dialogData.name);
        createUser(session, function(results){
            userId=results.id
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
                    createTrashRecord(session, session.userData, function(resultsRecord){
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
            computeTotalVolume(session, function(results){
                session.endDialog("Alright, please be aware that %s L of trash were produced since you started to use me.", results);
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

// Use the middleware
bot.use(
    {
      receive: BotanalyticsMiddleware.receive,
      send: BotanalyticsMiddleware.send
    }
  );

function createTrashRecord(session, data, callback){
    var apiUrl = process.env.WASTEDATA_API_ENDPOINT + "Records";
    var record_data = JSON.stringify({
        record_date: new Date(),
        trash_detected: data.usercaption["flagTrash"],
        trash_type_detected: data.usercaption["trashType"],
        volume_detected: data.usercaption["volume"],
        userbotId: userId
    });
    request.post({
        headers: {'content-type' : 'application/json'},
        url:apiUrl ,
        body: record_data  
        }, function(error, response, body){
        });   
      return callback("record added");
};

function createUser(session, callback){
    var apiUrl = process.env.WASTEDATA_API_ENDPOINT + "UserBots";
    var user_data = JSON.stringify({
        user_name: session.message.address.user.name,
        creation_date: new Date()
    });
    request.post({
        headers: {'content-type' : 'application/json'},
        url:apiUrl  ,
        body:  user_data  
        }, function(error, response, body){
        var output = JSON.parse(body);
        return callback(output);
        });
}

  
function computeTotalVolume(session, callback){
    var apiUrl = process.env.WASTEDATA_API_ENDPOINT + "UserBots/"+userId+"/records";
    request.get({
        headers: {'content-type' : 'application/json'},
        url:apiUrl  ,
        }, function(error, response, body){
        var output = JSON.parse(body);
        console.log(output)
        var total= 0;
        
        for (i = 0; i < output.length; i++) {  //loop through the array
            total += output[i].volume_detected;  //Do the math!
        } 
        console.log("total: %s", total)
        return callback(total);
        });
}

function checkCount(session, callback){
    return callback("wait for me to plug to the right stuff.");
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
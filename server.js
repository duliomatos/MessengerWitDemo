// init project
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var app = express();

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));
app.use(bodyParser.json());

app.get('/', function(req, res) {
  res.status(200).send('Ready');
});


// Webhook validation - just send back a validation token
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});

// Webhook itself, will receive calls from messenger platform
app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
      pageEntry.messaging.forEach(function(messagingEvent) {
        if (messagingEvent.message) {
          receivedMessage(messagingEvent);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've 
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

// Implement the call to send a message to the user
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

// What to do when you receive a message from the user
function receivedMessage(event) {
  var senderID = event.sender.id;
  var messageText = event.message.text;
  console.log(messageText);
  
  var sessionId = (new Date()).toISOString();
  witProcessMessage(sessionId, messageText, function (body) {
    console.log(typeof(body));
    if ((body.confidence > 0.3)
        && (body.entities.location !== undefined)
        && (body.entities.location.length > 0 )) {
      sendTextMessage(senderID, 'Detected this location in the message: ' + body.entities.location[0].value)
    } else {
      sendTextMessage(senderID, messageText);
    }
    
  });
}

function witProcessMessage(sessionId, message, callback) {
  var qs = 'session_id=' + encodeURIComponent(sessionId);
  if (message) {
    qs += '&q=' + encodeURIComponent(message);
  }
  request({
    headers: {
      'Authorization': 'Bearer ' + process.env.WIT_ACCESS_TOKEN,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    url: 'https://api.wit.ai/converse?' + qs,
    method: 'POST',
    json: {}
  }, function(error, response, body) {
    console.log("WIT RESPONSE: ", body);
    callback(body);
  });
}

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
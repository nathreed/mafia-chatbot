/*
This file contains functions that help with communication with slack
 */
const https = require("https");
const qs = require("querystring");
const botToken = require("./secrets")["bot-token"];

const events = require("./events");

module.exports = {
    dmUser: dmUser,
    channelMsg: channelMsg
};

//DM a specific user
//callback will be called with the first reply from the user
function dmUser(userID, message, cb) {
    //First, open a DM channel with the user

    //Setup request options
    const requestData = qs.stringify({
       token: botToken,
       users: userID
    });

    const options = {
        hostname: "slack.com",
        path: "/api/conversations.open?"+requestData
    };

    https.get(options, function(res) {
        let fullData = "";
        res.on("data", function(data) {
            fullData += data;
        });

        res.on("end", function() {
            //extract the conversation ID
            let convID = JSON.parse(fullData).channel.id;
            //Setup call to the slack API to send the message
            const msgReqData = qs.stringify({
                token: botToken,
                channel: convID,
                text: message
            });

            const msgReqOptions = {
                hostname: "slack.com",
                path: "/api/chat.postMessage?"+msgReqData
            };

            https.get(msgReqOptions, function(res) {
                //We don't really care about the info we get back (we will just assume message send sucess for now)

                //debug only
                res.on("data", function(data) {
                    console.log("recv data:", data);
                });

                res.on("end", function() {
                    //The request is finished, we can register a callback for the user reply so that we can send it back to our callback
                    let cbUUID = events.registerCallbackUserChannelReply(userID, convID, function(reply) {
                        //Deregister the callback so that we only get the first reply, not any otherss
                        events.deregisterCallback(cbUUID);
                        cb(reply);
                    })
                })
            });
        });

        res.on("error", function(err) {
            console.log("Error with request to open conversation:", err);
        });
    })
}

//Send a message to the entire channel
function channelMsg(channelID, message) {
    //Much simpler than user dm code, we just use the chat.postMessage endpoint

    const msgReqData = qs.stringify({
        token: botToken,
        channel: channelID,
        text: message
    });

    const msgReqOptions = {
        hostname: "slack.com",
        path: "/api/chat.postMessage?"+msgReqData
    };

    https.get(msgReqOptions); //no need for a callback, we don't really care about whether the message got sent correctly or not
}


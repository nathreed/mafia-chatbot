/*
This file contains functions that help with communication with slack
 */
const https = require("https");
const qs = require("querystring");
const botToken = require("./secrets")["bot-token"];

const events = require("./events");

module.exports = {
    setDefaultChannelID: setDefaultChannelID,
    dmUser: dmUser,
    groupMessage: groupMessage,
    channelMsg: channelMsg,
    getDefaultChannelID: getDefaultChannelID
};

let defaultChannelID;

function setDefaultChannelID(id) {
    defaultChannelID = id;
}

function getDefaultChannelID() {
    return defaultChannelID;
}

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
                    let cbUUID = events.registerCallbackUserChannelReply(userID, convID, function (reply) {
                        //Deregister the callback so that we only get the first reply, not any others
                        events.deregisterCallback(cbUUID);
                        if(cb){cb(reply);}
                    });
                })
            });
        });

        res.on("error", function(err) {
            console.log("Error with request to open conversation:", err);
        });
    })
}

//Starts a group message with the people in userArr
//Callback gets called every time *any* user in the group message channel replies to the channel
//This way, we can easily tally the votes/kill mentions/etc
//The callback also is given the UUID for cb registration as its second parameter, that way it can cancel notifications for any further replies
function groupMessage(userArr, message, cb) {
    //First transform the userArr into a comma separated list of userids for the slack api
    let userList = "";
    for(let i=0; i<userArr.length; i++) {
        userList += ","+userArr[i];
    }
    //Take the first comma off the userList
    userList.slice(0,1);


    //Now setup a call to slack api for creating conversation with these users
    const reqData = qs.stringify({
        token: botToken,
        users: userList
    });

    const options = {
        hostname: "slack.com",
        path: "/api/conversations.open?"+reqData
    };

    https.get(options, function(res) {
        let fullData = "";
        res.on("data", function(data) {
            fullData += data;
        });

        res.on("end", function() {
            //We have all the data, grab the conversation ID and send the message
            console.log(fullData);
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
                res.on("end", function() {
                    //register callback with the events system here
                    let cbUUID = events.registerCallbackChannelReply(convID, function(reply) {
                        cb(reply, convID, cbUUID);
                    });
                })
            });

        });

        res.on("error", function(err) {
            console.log("ERROR setting up group message:", err);
        })
    });
}

//Send a message to the entire channel
function channelMsg(channelID, message) {
    //Much simpler than user dm code, we just use the chat.postMessage endpoint
    if(channelID === undefined) {
        channelID = defaultChannelID;
    }

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

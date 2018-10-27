/*
The main purpose of the code in this file is to manage event handling throughout the application
Callbacks for specific events can be registered, with options such as only triggering for a given user, channel, etc
 */

module.exports = {
    registerCallbackUserChannelReply: registerCallbackUserChannelReply,
    deregisterCallback: deregisterCallback,
    executeCallbacks: executeCallbacks
};

const uuid = require("uuid");

//Main callback registry
//Array of objects of the form {criteria: {CRITERIA_OBJ}, cb: <function>}
//stuff that can be in a CRITERIA_OBJ: channel, userID, eventType
//All present keys will be compared and all must match for the CB to be triggered
//Event types use the same types as slack API
let eventsCallbackRegistry = {};

function registerCallbackUserChannelReply(userID, channelID, cb) {
    const criteria = {
        channel: channelID,
        user: userID,
        type: "message"
    };

    const cbReg = {
        criteria: criteria,
        cb: cb,
        uuid: uuid.v4()
    };

    eventsCallbackRegistry[cbReg.uuid] = cbReg;

    return cbReg.uuid;
}

function deregisterCallback(uuid) {
    //Simply set the entry to undefined so it acts like it was never set
    eventsCallbackRegistry[uuid] = undefined;
}

function executeCallbacks(eventData) {
    //Go over all the callbacks in the registry and determine if they should be called
    Object.keys(eventsCallbackRegistry).forEach(function (key) {
        let regCriteria = eventsCallbackRegistry[key].criteria;

        let allMatch = true;

        //Check if the criterion exists before we check its value
        if(regCriteria.channel) {
            if(regCriteria.channel !== eventData.channel) {
                allMatch = false;
            }
        }

        if(regCriteria.user) {
            if(regCriteria.user !== eventData.user) {
                allMatch = false;
            }
        }

        if(regCriteria.type) {
            if(regCriteria.type !== eventData.type) {
                allMatch = false;
            }
        }

        if(allMatch) {
            //All the criteria match, execute the callback
            //They can have the entire event data and do what they want with it
            eventsCallbackRegistry[key].cb(eventData);
        }
    })
}
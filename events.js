/*
The main purpose of the code in this file is to manage event handling throughout the application
Callbacks for specific events can be registered, with options such as only triggering for a given user, channel, etc
 */

module.exports = {
    registerCallbackUserChannelReply: registerCallbackUserChannelReply,
    registerCallbackChannelReply: registerCallbackChannelReply,
    deregisterCallback: deregisterCallback,
    executeCallbacks: executeCallbacks
};

const uuid = require("uuid");

//Main callback registry
//Dictionary, keyed with UUID string, of objects of the form {criteria: {CRITERIA_OBJ}, cb: <function>, uuid: uuid_string}
//stuff that can be in a CRITERIA_OBJ: channel, userID, eventType
//All present keys will be compared and all must match for the CB to be triggered
//Event types use the same types as slack API
let eventsCallbackRegistry = {};

//This function is for registering a callback for when a specific user replies to a specific channel
//Returns the UUID of the registered callback so it can be unregistered later
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

//This function is for registering a callback for when any user replies to a specific channel
function registerCallbackChannelReply(channelID, cb) {
    const criteria = {
        channel: channelID,
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
    //Remove the callback with the given UUID from the dictionary.
    delete eventsCallbackRegistry[uuid];
}

function executeCallbacks(eventData) {
    //Go over all the callbacks in the registry and determine if they should be called
    //console.log("CALLBACKS REGISTRATION ARRAY:", JSON.stringify(eventsCallbackRegistry, null, 4));
    for(let key in eventsCallbackRegistry) {
        //Double check that the events callback registry has the key property (no reason why it shouldn't, this just fixes IntelliJ inspection warning)
        if(eventsCallbackRegistry.hasOwnProperty(key)) {
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
        }

    }
}
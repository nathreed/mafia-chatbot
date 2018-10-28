const express = require("express");
const https = require("https");
const qs = require("querystring");

const app = express();

const port = 8080;

const botToken = require("./secrets")["bot-token"];

const events = require("./events");
const Messaging = require("./messaging");
const Game = require("./game");

app.use(express.json());
app.use(express.urlencoded());

app.post("/events", function(req, res) {
    console.log("received event:", req.body);
    //Check if this is a verification message, ie if it has a challenge
    if(req.body.challenge) {
        res.send(req.body.challenge);
    } else {
        //Just regular event, dispatch
        res.send(null);
        events.executeCallbacks(req.body.event);
    }


});

//Function gets called when we get a start game command from slack
app.post("/cmd/startgame", function (req,res) {
	console.log("startgame command");
	res.send("startgame");
    console.log(req.body);



    /*
    IDEAS
    - use other slack API to get list of all users currently in the channel
    - pass this list to game management code
    - game management code will assign roles and call back out to code that uses slack API to DM them
    - also need to message entire channel that the game has started, rn it will only send replies to the user that did the command

    - need to think about timing and how that works (? - do we even want a timing feature?)
     */

    let channelID = req.body["channel_id"];
    //Set this channel ID as the default channel ID that the game is running in
    Messaging.setDefaultChannelID(channelID);

    //Step 1: Grab list of every user in the chat so we can check if they are active

    const encodedData = qs.stringify({
        token: botToken,
        channel: channelID,
    });

    const options = {
        hostname: "slack.com",
        path: "/api/conversations.members?"+encodedData
    };

    //console.log("about to send request to", options.path);

    https.get(options, function(res) {
        let fullData = "";
        res.on("data", function(data) {
            fullData += data;
        });

        res.on("error", function(err) {
            console.log("Error with request to list people in the channel:", err);
        });

        res.on("end", function() {
            //We have all the data, now do stuff with it
            console.log(botToken);
            console.log(fullData);
            let usersData = JSON.parse(fullData);
            identifyActiveUsers(usersData.members, function(activeUsers) {
                console.log("the following users are active:", activeUsers);
                //Assign roles for the game from the list of active users
                Game.assignRoles(activeUsers);
            });
        });
    });
});

//Takes the list of all users we got from slack and calls the callback with a list of only the active ones.
function identifyActiveUsers(allUsers, cb) {
    let userPromises = [];
    for(let i=0; i<allUsers.length; i++) {
        //Setup a promise for fetching the data
        userPromises.push(new Promise(function (resolve, reject) {
            const requestData = qs.stringify({
                token: botToken,
                user: allUsers[i]
            });

            const options = {
                hostname: "slack.com",
                path: "/api/users.getPresence?"+requestData
            };

            https.get(options, function(res) {
                let fullData = "";
                res.on("data", function(data) {
                    fullData += data;
                });

                res.on("end", function() {
                    resolve({user: allUsers[i], data: JSON.parse(fullData)});
                });

                res.on("error", function(err) {
                    reject(err);
                });

            });

        }));
    }

    let activeUsers = [];
    Promise.all(userPromises).then(function(result) {
        //console.log("result from promise:", result);

        for(let i=0; i<result.length; i++) {
            if(result[i].data["presence"] === "active") {
                activeUsers.push(result[i].user);
            }
        }

    }).then(function() {
        cb(activeUsers);
    });

}

//Function gets called when we get a getrules comamnd from slack
app.post("/cmd/getrules", function (req,res) {
	console.log("getrules command");
	res.send("setrules");
});

//Function gets called when we get an accuse command from slack
app.post("/cmd/accuse", function (req, res) {
	console.log("accuse command");
	console.log(req.body);

	res.send(null);
	//Need to extract username from body and resolve to actual user ID
    //remove the @ to get the username, then we can resolve

    let accusedName = req.body.text.slice(1,req.body.text.length);;
    console.log("ACCUSED NAME IS:", accusedName);
    //Setup request to users.list endpoint so we can return all the users and associate the name to an ID
    const reqData = qs.stringify({
        token: botToken,
        limit: 100 //we probably won't ever have that many people playing anyway...
    });

    const options = {
        hostname: "slack.com",
        path: "/api/users.list?"+reqData
    };


    //console.log("making get request for username resolution");
    https.get(options, function(res) {
        let fullData = "";
        res.on("data", function(data) {
            fullData += data;
        });

        res.on("end", function() {
            //We have all the data, go through it and find the relevant thing
            let parsedData = JSON.parse(fullData);
            //console.log("PARSED DATA:"+JSON.stringify(parsedData, null, 4));

            for(let i=0; i<parsedData.members.length; i++) {
                //console.log("checking", parsedData.members[i]);
                if(parsedData.members[i].name === accusedName) {
                    Game.registerAccusation(parsedData.members[i].id, req.body.user_id);
                    break;
                }
            }

        });

        res.on("error", function(err) {
           console.log("Error with request to users.list to resolve username to ID:", err);
        });
    });


});

app.post("/cmd/endgame", function(req, res) {
    console.log("end game command");
    res.send("end game");
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
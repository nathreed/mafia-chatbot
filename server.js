const express = require("express");
const https = require("https");
const qs = require("querystring");

const app = express();

const port = 8080;

const botToken = require("./secrets")["bot-token"];

app.use(express.json());
app.use(express.urlencoded());

app.post("/events", function(req, res) {
    console.log(req.body);
    //Slack events url verification code
    //res.send(req.body.challenge);

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

    //Step 1: Grab list of every user in the chat so we can check if they are active

    const encodedData = qs.stringify({
        token: botToken,
        channel: channelID,
    });

    const options = {
        hostname: "slack.com",
        path: "/api/conversations.members?"+encodedData
    };

    console.log("about to send request to", options.path);



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
        });
    });



});

//Function gets called when we get a getrules comamnd from slack
app.post("/cmd/getrules", function (req,res) {
	console.log("getrules command");
	res.send("setrules");
});

//Function gets called when we get an accuse command from slack
app.post("/cmd/accuse", function (req, res) {
	console.log("accuse command");
	res.send("accuse");
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
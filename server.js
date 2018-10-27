const express = require("express");

const app = express();

const port = 8080;

app.use(express.json());
app.use(express.urlencoded());

app.post("/events", function(req, res) {
    console.log(req.body);
    res.send(req.body.challenge);
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
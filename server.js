const express = require("express");

const app = express();

const port = 8080;

//Function gets called when we get a start game command from slack
app.post("/cmd/startgame", function (req,res) {
	console.log("startgame command");
	res.send("startgame")
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
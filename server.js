const express = require("express");

const app = express();

const port = 8080;

//Function gets called when we get a start game command from slack
app.get("/cmd/startgame", (req, res) => {
	console.log("startgame command");
	res.statusCode(200);
});

//Function gets called when we get a getrules comamnd from slack
app.get("/cmd/getrules", (req, res) => {
	console.log("getrules command");
	res.statusCode(200);
});

//Function gets called when we get an accuse command from slack
app.get("/cmd/accuse", (req,res) => {
	console.log("accuse command");
	res.statusCode(200);
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
/*
Main game logic lives in this file
 */

const Messaging = require("./messaging");

module.exports = {
    debugAssignRoles: debugAssignRoles,
    doctorVote: doctorVote,
    registerAccusation: registerAccusation
};

/*
gameState object is laid out like this:
- there is a dictionary called players that is keyed with the userid and values are objects that contain role, alive status, etc
- Other info about the game state as needed
 */
let gameState = {players: {}, running: false, savedThisTurn: "", mafiaAttemptThisTurn: "", accusedThisTurn: []};

// Give array of userids in array of strings that aren't prettyprint-able
function assignRoles(userArray){
    // Only run if enough players
    if(userArray.length < 5){
        console.log("Not enough players");
        //Alert users
        //undefined for channel ID uses default channel ID, which is going to be the one that the game is in
        //We do this because we don't want to mess with Slack API channel ids in the main game logic here
        Messaging.channelMsg(undefined, "Sorry, there are not enough active users in this channel to play Mafia.");
        return;
    }

    // For low number players, specify player counts
    let mafiaNumber;
    switch(userArray.length){
        case 5: // 1 Mafia, 1 Doctor, 1 Investigator, 2 Villagers
            mafiaNumber = 1;
            break;
        case 6: // 1 Mafia, 1 Doctor, 1 Investigator, 3 Villagers
            mafiaNumber = 1;
            break;
        default: // 1/3 total Mafia, 1 Doctor, 1 Investigator, the rest Villagers
            mafiaNumber = Math.floor(userArray.length/3);
    }

    // Prune array one at a time
    let assigningUser;

    // Assigning Mafia
    for(let i = 0; i < mafiaNumber; i++){
        assigningUser = removeElement(userArray);
        setRole(assigningUser, 'mafia');
        console.log(assigningUser + " is Mafia.");
    }

    // Assigning Doctor
    assigningUser = removeElement(userArray);
    setRole(assigningUser, 'doctor');
    console.log(assigningUser + " is the Doctor.");

    // Assigning Investigator
    assigningUser = removeElement(userArray);
    setRole(assigningUser, 'detective');
    console.log(assigningUser + " is the Detective.");

    // Assign rest to villager
    while(userArray.length > 0){
        assigningUser = removeElement(userArray);
        setRole(assigningUser, 'villager');
        console.log(assigningUser + " is a Villager.");
    }
}

function debugAssignRoles(userArray) {
    //Make nathan the mafia
    setRole("UDR58191C", "mafia");
    //Remove nathan object from array
    userArray.splice(userArray.indexOf("UDR58191C"), 1);


    let assigningUser;

    // Assign rest to villager
    while(userArray.length > 0) {
        assigningUser = removeElement(userArray);
        setRole(assigningUser, 'villager');
        console.log(assigningUser + " is a Villager.");
    }

}

//This function registers an accusation on the given user. Also notifies the chat that they have been accused and who did it
//Accusation counts as a second if the user has already been accused
function registerAccusation(userID, accuserID) {
    console.log("REGISTER ACCUSATION:", userID, accuserID);
    //condition will be true if anything exists in the accusation array, ie if they have been accused this turn
    //if not accused, condition will be false
    if(alreadyAccused(userID)) {
        //second

        //Check that the accuser ID isn't the same as the original accuser ID, so that the accuser cannot second their own accusation
        //console.log("already accused value:", alreadyAccused(userID));
        if(alreadyAccused(userID) !== accuserID) {
            //Register a second
            Messaging.channelMsg(undefined, "<@"+accuserID+"> has seconded the accusation on <@"+userID+">!");
            //begin voting process
            console.log("voting process begin!");
        } else {
            console.log("CANNOT SECOND OWN ACCUSATION!");
        }

    } else {
        //Regular accusation
        gameState.accusedThisTurn.push({accuserID: accuserID, userID: userID});
        Messaging.channelMsg(undefined, "<@"+accuserID+"> has accused <@"+userID+">! Second by using /accuse on this person as well!");
    }
}

//This function checks the accusation information to see if a user has been already accused
//If so, it returns their accuser's ID, otherwise it returns undefined
function alreadyAccused(userID) {
    for(let i=0; i<gameState.accusedThisTurn.length; i++) {
        if(gameState.accusedThisTurn[i].userID === userID) {
            return gameState.accusedThisTurn[i].accuserID;
        }
    }
    return undefined;
}

function setRole(userID, role) {
    /*
    {
        players: {

            "nreed7": {role: "mafia", alive: true}
        },
        running: true
    }
     */
    //If the player doesn't exist in the game state array, add them
    gameState.players[userID] = {};
    //First set the role in the gameState object for our internal state keeping
    gameState.players[userID].role = role;
    //Everybody starts out alive, so make them alive as well
    gameState.players[userID].alive = true;

    //Next DM the user that they have been selected for the role
    //No callback, we don't care about their reply to this message
    Messaging.dmUser(userID, "You have been selected for the " + role + " role.");
}

// The nighttime loop
function daytime(){
    let votingPromises = [];
    votingPromises.push(new Promise((result) => doctorVote(result)));
    votingPromises.push(new Promise((result) => mafiaVote(result)));
    votingPromises.push(new Promise((result) => detectiveVote(result)));
}


// Called to get the doctor's vote
function doctorVote() {
    let userID = Object.keys(gameState.players).find(key => gameState[key] === 'doctor'); // Lookup by key: https://stackoverflow.com/a/28191966/3196151

    // Only get the vote if alive
    if(gameState.players[userID].alive){
        Messaging.dmUser(userID, "Who do you want to save tonight?", doctorPromptCallback);
    } else {
        gameState.savedThisTurn = undefined;
    }
}

// Helper function for the doctor prompting callback
function doctorPromptCallback(reply) {
    // If they @mentioned someone
    let mentions = reply.text.match(/<@(.*?)>/); // Match the first @mention
    if(mentions !== null) {
        if(!doctorSaveAttempt(mentions[1])){ // If unsuccessful in first save attempt
            Messaging.dmUser(reply.user, "Please @mention your choice, you can only pick one living person and not the same person two turns in a row.", doctorPromptCallback);
        }
    }
}

// Helper for doctor selecting person to save
function doctorSaveAttempt(userID) {
    // If the same person was saved last time or they're dead
    if(userID !== gameState.savedThisTurn && gameState.players[userID].alive){
        console.log("Doctor succeeded in selecting " + userID + " to save.");
        gameState.savedThisTurn = userID;
        return true;
    } else {
        // Failing, saved twice
        console.log("Doctor tried to save " + userID + " twice in a row, failing.");
        return false;
    }
}

// When the town votes on a person to kill
function lynchPerson(userID){
    console.log("Lynching " + userID);
    let name = "<@" + userID + ">";
    gameState.players[userID].alive = false;

    // Alert the channel of their death and alliance
    if(gameState.players[userID].role === 'mafia'){
        Messaging.channelMsg(undefined, "The vote passed and " + name + " is brought to the gallows and hanged until dead. In their final breaths they reveal that they were part of the Mafia.");
    } else {
        Messaging.channelMsg(undefined, "The vote passed and " + name + " is brought to the gallows and hanged until dead. However, they were not part of the Mafia.");
    }
}


// Helper to sample a randomly selected array element
function removeElement(array){
    return array.splice(Math.floor(Math.random() * array.length), 1)[0]; // Cut out one element and store it
}
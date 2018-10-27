/*
Main game logic lives in this file
 */

const Messaging = require("./messaging");

module.exports = {
    debugAssignRoles: debugAssignRoles
};

/*
gameState object is laid out like this:
- there is a dictionary called players that is keyed with the userid and values are objects that contain role, alive status, etc
- Other info about the game state as needed
 */
let gameState = {players: {}, running: false, savedThisTurn: "", mafiaAttemptThisTurn: ""};

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

// Called to get the doctor's vote
function doctorVote(userID) {
    // Only get the vote if alive
    if(gameState.players[userID].alive){

    } else {

    }
}

// Doctor selecting person to save
function doctorSaveAttempt(userID) {
    console.log("Doctor tries to save " + userID);

    // If the same person was saved last time, fail and retry
    if(userID !== gameState.savedThisTurn){
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
    gameState.players[userID].alive = false;

    // Alert the channel of their death and alliance
    if(gameState.players[userID].role === 'mafia'){
        Messaging.channelMsg(undefined, "The vote passed and " + getName(userID) + " is brought to the gallows and hanged until dead. In their final breaths they reveal that they were part of the Mafia.");
    } else {
        Messaging.channelMsg(undefined, "The vote passed and " + getName(userID) + " is brought to the gallows and hanged until dead. However, they were not part of the Mafia.");
    }
}


// Helper to sample a randomly selected array element
function removeElement(array){
    return array.splice(Math.floor(Math.random() * array.length), 1)[0]; // Cut out one element and store it
}
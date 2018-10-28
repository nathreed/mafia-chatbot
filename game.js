/*
Main game logic lives in this file
 */

const Messaging = require("./messaging");
const Events = require("./events");

module.exports = {
    debugAssignRoles: debugAssignRoles,
    assignRoles: assignRoles,
    registerAccusation: registerAccusation,
    startMafiaGroup: startMafiaGroup
};
/*

After roles get assigned, we start a loop
- Nighttime (self contained function)
- Begin day (results of nighttime - game loss/win, deaths, saves, etc)
- Daytime main - villager voting. Voting ends when they kill 1 person or after 3 tries without killing someone
- Announce game end if applicable
- rinse and repeat

 */

/*
gameState object is laid out like this:
- there is a dictionary called players that is keyed with the userid and values are objects that contain role, alive status, etc
- Other info about the game state as needed
 */
let gameState = {players: {}, running: false, savedThisTurn: "", mafiaAttemptThisTurn: "", accusedThisTurn: [], playerVotesThisTurn: {}, mafiaVotesThisTurn: {}, mafiaChannelID: ""};
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

    startMafiaGroup().then(function() {
        //summon the devil
        gameFlow();
    });


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

    startMafiaGroup();

    //start the unholy control flow loop
    gameFlow();

}

let votingResolvedPromise;
async function gameFlow() {
    Messaging.channelMsg(undefined, "The game has started!");
    while(1) {
         console.log("NEW DAY ITERATION!!!!");
         let results = await nighttime().then(function() {
             if(checkGameOver()) {
                 //game did end
                 console.log("CHECK GAME OVER INDICATED THAT GAME SHOULD END 1");
                return Promise.reject();
             } else {
                 //game did not end
                 return Promise.resolve();
             }
         }, function() {
             console.log("FAILURE CALLBACK ON NIGHTTIME!!");
             return Promise.reject();
         }).then(startVillagerVoting, function() {
             //failure callback for previous
             //means the game actually did end and we should NOT be having villager voting
             //game exit
             console.log("REJECT PROMISE CHAIN?????");
             return Promise.reject();
         }).then(function() {
             //villager vote end successfully
             if(checkGameOver()) {
                 //game ended, return false
                 console.log("GAME ENDED");
                 return false;
             } else {
                 //game is NOT over
                 //do nothing
                 console.log("GAME CONTINUING");
                 return true;
             }
         }, function() {
             //villager vote never happened (game over chained from previous)
             console.log("GAME ENDING 2");
             return false;
         });

         if(!results) {
             break;
         }
    }
}

function checkGameOver() {
    //We need to figure out if the game has been won
    //Check if the mafia are at >=50% or at 0%
    let mafiaUsers = getUsersFromRole("mafia");
    let aliveUsers = aliveCount();

    if(mafiaUsers.length / aliveUsers >= 0.5) {
        //Mafia win
        Messaging.channelMsg(undefined, "The game has ended and the Mafia won! Better luck next time...");
        gameCleanup();
        return true;
    } else if(mafiaUsers.length === 0) {
        //Villagers win
        Messaging.channelMsg(undefined, "The game has ended. The villagers were triumphant and killed all the Mafia!");
        gameCleanup();
        return true;
    }
}

function gameCleanup() {
    console.log("GAMECLEANUP called.");
    Messaging.closeConversation(gameState.mafiaChannelID);
    gameState.mafiaChannelID = "";
    gameState.mafiaAttemptThisTurn = "";
    gameState.savedThisTurn = "";
    gameState.mafiaVotesThisTurn = {};

}

function aliveCount() {
    let aliveCount = 0;
    for(let p in gameState.players) {
        if(p.alive) {
            aliveCount++;
        }
    }
    return aliveCount;
}

//This function registers an accusation on the given user. Also notifies the chat that they have been accused and who did it
//Accusation counts as a second if the user has already been accused
function registerAccusation(userID, accuserID) {
    console.log("REGISTER ACCUSATION:", userID, accuserID);
    // if voting is ongoing, accusations cannot be made while voting
    if(votingTimeout) {
        return;
    }
    //Cannot accuse a dead user
    if(gameState.players[userID].alive === false) {
        return;
    }
    //And dead people cannot accuse
    if(gameState.players[accuserID].alive === false) {
        return;
    }

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
            votingResolvedPromise = startVillagerVoting(userID);
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

//This function manages the voting process for who to kill
//The voting process gets started when there is an accusation and a second
let votingTimeout;
let callbackUUID;
let votingUserID;
function startVillagerVoting(userID) {

    return new Promise(function (resolve, reject) {
        Messaging.channelMsg(undefined, "The voting process on <@"+ userID+ "> has started! Write 'yes' to vote to kill and write 'no' to vote against killing.");
        //Set a timeout to stop the voting, 45 second voting period for now
        votingTimeout = setTimeout(function() {stopVillagerVoting(resolve)}, 45000);
        votingUserID = userID;
        //Register callback for villager votes
        callbackUUID = Events.registerCallbackChannelReply(Messaging.getDefaultChannelID(), villagerVoteCallback);
    });


}

//This function is called whenever anyone says anything in the chat during the voting period.
//Its responsibility is to determine which messages are kill votes and tally them accordingly
function villagerVoteCallback(eventData) {
    if(eventData.text === "yes") {
        //Yes vote
        console.log("RECEIVED YES VOTE FROM USER:", eventData.user);
        //dead people can't vote
        if(gameState.players[eventData.user].alive) {
            gameState.playerVotesThisTurn[eventData.user] = "yes";
        }


    } else if(eventData.text === "no") {
        //No vote
        console.log("RECEIVED NO VOTE FROM USER:", eventData.user);
        //dead people can't vote
        if(gameState.players[eventData.user].alive) {
            gameState.playerVotesThisTurn[eventData.user] = "no";
        }

    }
    //Now that vote has been recorded, check if everyone has voted
    console.log("THERE ARE THIS MANY PLAYERS:", Object.keys(gameState.players).length);
    //Determine the number of players that are alive
    let aliveCount = aliveCount();
    console.log("THIS MANY PLAYERS ARE ALIVE:", aliveCount);
    if(Object.keys(gameState.playerVotesThisTurn).length === aliveCount) {
        //All players have submitted some kind of vote, check if they are all yes
        let allYes = true;
        for(let key in gameState.playerVotesThisTurn) {
            if(gameState.playerVotesThisTurn[key] === "no" || gameState.playerVotesThisTurn[key] === undefined) {
                allYes = false;
                console.log("EVERYONE HAS VOTED BUT SOMEONE VOTED NO!");
                break;
            }
        }

        if(allYes) {
            console.log("EVERYONE HAS VOTED AND THEY ALL VOTED YES!!!");
            //Everyone has voted AND they all voted yes
            //End the voting early
            //First kill the timeout
            clearTimeout(votingTimeout);
            //Next cancel this callback so we don't get more updates
            //Next call the stopVillagerVoting function which will compute the results of the voting
            stopVillagerVoting();
        }
    }
}

function stopVillagerVoting(resolve) {
    Events.deregisterCallback(callbackUUID);
    callbackUUID = "";
    clearTimeout(votingTimeout); //clear the timeout if it didn't get cleared already
    Messaging.channelMsg(undefined, "The voting process on <@"+ votingUserID+ "> has stopped.");
    //COMPUTE RESULTS AND THEN CLEAR VOTES FOR THIS TURN!

    //Step 1: compute results
    let yesCount = 0;
    let noCount = 0;

    for(let i=0; i<Object.keys(gameState.playerVotesThisTurn).length; i++) {
        let key = Object.keys(gameState.playerVotesThisTurn)[i];
        if(gameState.playerVotesThisTurn[key] === "no") {
            noCount++;
        } else {
            yesCount++;
        }
    }

    /*console.log("VOTES DICT:", JSON.stringify(gameState.playerVotesThisTurn, null, 4));
    console.log("TALLYING VOTES, YES COUNT IS:", yesCount);
    console.log("NO COUNT IS:", noCount);*/
    if(yesCount > noCount) {
        //Voted to kill
        let deadID = votingUserID;
        //Cleanup before we leave
        votingUserID = "";
        votingTimeout = undefined;
        gameState.playerVotesThisTurn = {};
        lynchPerson(deadID);
    } else if(noCount > yesCount) {
        //Voted not to kill
        Messaging.channelMsg(undefined, "<@"+votingUserID+"> was found not guilty.");
    } else {
        //Tie, person doesn't die
        Messaging.channelMsg(undefined, "<@"+votingUserID+"> was found not guilty because the vote was tied.");
    }
    //Cleanup before we leave
    votingUserID = "";
    votingTimeout = undefined;
    gameState.playerVotesThisTurn = {};
    //So that prior accusations reset properly.
    gameState.accusedThisTurn = [];
    //This resolves the promise that was started when voting was started
    resolve();
}

// Making a group with all of the Mafia in them
function startMafiaGroup() {

    return new Promise(function(resolve, reject) {
        // Get all Mafia members
        let mafiaMembers = getUsersFromRole('mafia');
        console.log("IDENTIFIED ALL MAFIA MEMBERS:", mafiaMembers);

        // Make a group for them
        console.log("Making a mafia groupchat with: " + mafiaMembers);
        Messaging.groupMessage(mafiaMembers, "Hello Mafia, get to know each other. The others are not aware of this channel, you will need to come back here to vote on who to kill.", function(reply, convID){
            console.log("Making mafia group, storing convID:" + convID + ".");
            gameState.mafiaChannelID = convID;
            resolve();
        });
    });

}

function setRole(userID, role) {
    /*
    {
        players: {

            "nreed7": {role: "mafia", alive: true}
        },
        running: true,
        ...
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

// The nighttime activities function, with a callback
function nighttime(){
    // Make a "set" of vote promises, so that once everyone who does stuff in the night is done, can move on, resolve on each one
    let votingPromises = [];
    votingPromises.push(new Promise((resolve) => doctorVote(resolve)).then(()=>{console.log("DOCTOR Resolved."); return Promise.resolve();}));
    votingPromises.push(new Promise((resolve) => mafiaVote(resolve)).then(()=>{console.log("MAFIA Resolved."); return Promise.resolve();}));
    votingPromises.push(new Promise((resolve) => detectiveVote(resolve)).then(()=>{console.log("DETECTIVE Resolved."); return Promise.resolve();}));

    return Promise.all(votingPromises).then(function() {
        console.log("Made it through all of the promises for doctors, etc.");
        if(gameState.mafiaAttemptThisTurn === gameState.savedThisTurn){
            // Kill person
            mafiaKillsPerson(gameState.mafiaAttemptThisTurn);
        } else if(gameState.mafiaAttemptThisTurn !== undefined) {
            // Attempted killing
            Messaging.channelMsg(undefined, "During the night the mafia attempted to kill <@" + gameState.mafiaAttemptThisTurn + ">, yet thankfully the doctor saved them.");
            gameState.mafiaAttemptThisTurn = undefined;
        } else {
            // No attempted killing, ie. Mafia didn't nominate anyone
            Messaging.channelMsg(undefined, "Nothing happened during the night, the mafia must have taken a nap.");
        }
        return Promise.resolve();
    });
}

// Called to get the doctor's vote
let doctorResolve;
function doctorVote(resolve) {
    doctorResolve = resolve;
    let userID = getUsersFromRole('doctor')[0];

    // Only get the vote if alive
    if(gameState.players[userID].alive){
        console.log("Doctor alive, prompting for patient.");
        Messaging.dmUser(userID, "Who do you want to save tonight?", doctorPromptCallback);
    } else {
        console.log("Doctor is dead, resolving anyways.");
        gameState.savedThisTurn = undefined;
        resolve();
    }
}

// Helper function for the doctor prompting callback
function doctorPromptCallback(reply) {
     // If they @mentioned someone
    let mentions = reply.text.match(/<@(.*?)>/); // Match the first @mention
    if (mentions !== null) {
        if (!doctorSaveAttempt(mentions[1])) { // If unsuccessful in first save attempt
            console.log("Invalid input for doctor save, prompting again.");
            Messaging.dmUser(reply.user, "Please @mention your choice, you can only pick one living person and not the same person two turns in a row.", doctorPromptCallback);
        } else {
            Messaging.dmUser(reply.user, "You saved <@" + mentions[1] + ">.");
            doctorResolve();
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

// Detective "Voting" for the person to investigate. Still need safety checks because could be non player
let detectiveResolve;
function detectiveVote(resolve) {
    detectiveResolve = resolve;
    let userID = getUsersFromRole('detective')[0];

    // Only get the vote if alive
    if(gameState.players[userID].alive){
        console.log("Detective alive, prompting for suspect.");
        Messaging.dmUser(userID, "Who do you want to investigate tonight?", detectivePromptCallback);
    } else {
        console.log("Detective is dead, resolving anyways.");
        gameState.savedThisTurn = undefined;
        resolve();
    }
}

// Callback for detective prompting
function detectivePromptCallback(reply) {
    // If they @mentioned someone
    let mentions = reply.text.match(/<@(.*?)>/); // Match the first @mention
    if (mentions !== null && gameState.players[mentions[1]] !== undefined && gameState.players[mentions[1]].alive) {
        if(gameState.players[mentions[1]].role === 'mafia'){
            Messaging.dmUser(reply.user, "<@" + mentions[1] + "> is a member of the mafia.");
        } else {
            Messaging.dmUser(reply.user, "<@" + mentions[1] + "> is not a member of the mafia.");
        }
        console.log("Detective investigated " + mentions[1] + " who is a " + gameState.players[mentions[1]].role);
        detectiveResolve();
    } else {
        console.log("Invalid input for detective investigate, prompting again.");
        Messaging.dmUser(reply.user, "Please @mention your choice, you can only pick one living person and not the same person two turns in a row.", detectivePromptCallback);
    }
}

// Mafia voting (special since using group channel, and consensus, and everything
let mafiaVoteTimeout;
let mafiaCallbackUUID;
let mafiaResolve;
function mafiaVote(resolve) {
    console.log("Mafia voting, channel id " + gameState.mafiaChannelID + ".");

    // Message the channel
    Messaging.channelMsg(gameState.mafiaChannelID, "<!channel> please vote on who to kill. @mention people to nominate them, once everyone has reached a consensus or the timer has run out the majority nominee will be killed.");
    mafiaVoteTimeout = setTimeout(function() {mafiaVoteTimerCallback()}, 45000);

    // Trying to make callback
    mafiaCallbackUUID = Events.registerCallbackChannelReply(gameState.mafiaChannelID, mafiaVoteCallback);
    mafiaResolve = resolve;
}

function mafiaVoteCallback(eventData) {
    console.log("MAFIA CALLBACK.");
    // If the user @ mentions a player (and only that player)
    let userID = parseAtMention(eventData.text);
    if(userID !== undefined){
        // The mentions[1] userID is a valid username, storing it as this mafioso's vote
        gameState.mafiaVotesThisTurn[eventData.user] = userID;

        // Check if all mafia have voted for same person (last voted for)
        let allSame = true;
        for(let userIDiterating in gameState.players){
            // If mafia and alive and not voting for the same person
            if(gameState.players[userIDiterating].role === 'mafia' && gameState.players[userIDiterating].alive && gameState.mafiaVotesThisTurn[userIDiterating] !== userID){
                allSame = false;
                break;
            }
        }
        // If consensus reached, just kill the person and break the timeouts or whatever

        if(allSame){
            console.log("Consensus Reached");
            gameState.mafiaAttemptThisTurn = userID;

            // Clean up the mess
            wipeMafiaVoteTemporaries();
        }
    }
}

function mafiaVoteTimerCallback() {
    // No actual easy way to check if no votes
    if(Object.keys(gameState.mafiaVotesThisTurn).length === 0){
        Messaging.channelMsg(gameState.mafiaChannelID, "Times up and nobody to kill, guess you took this round off.");

        // There isn't a nominee, so reflect that
        gameState.mafiaAttemptThisTurn = "";
    } else {
        // Get the user most voted for, kill them
        let mafiaVoteValues = Object.values(gameState.mafiaVotesThisTurn);

        // Code to get the most occurring victim: https://stackoverflow.com/a/1053865/3196151
        let modeMap = {};
        let maxEl = mafiaVoteValues[0], maxCount = 1;
        for(let i = 0; i < mafiaVoteValues.length; i++)
        {
            let el = mafiaVoteValues[i];
            if(modeMap[el] == null)
                modeMap[el] = 1;
            else
                modeMap[el]++;
            if(modeMap[el] > maxCount)
            {
                maxEl = el;
                maxCount = modeMap[el];
            }
        }

        // Kill them and let them know the final selection
        Messaging.channelMsg(gameState.mafiaChannelID, "The votes are in, <@" + maxEl + "> is set to be killed.");
        gameState.mafiaAttemptThisTurn = maxEl;
    }

    // All done (will resolve the promise) either way
    wipeMafiaVoteTemporaries();
}

function wipeMafiaVoteTemporaries() {
    // Clear and wipe down everything
    gameState.mafiaVotesThisTurn = {};
    clearTimeout(mafiaVoteTimeout);
    mafiaVoteTimeout = undefined;
    Events.deregisterCallback(mafiaCallbackUUID);
    mafiaCallbackUUID = "";

    // Resolve that promise made by the original call
    mafiaResolve();
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

// When the mafia kills someone
function mafiaKillsPerson(userID){
    console.log("Mafia is killing " + userID);
    let name = "<@" + userID + ">";
    gameState.players[userID].alive = false;

    // Alert the channel of their death, don't reveal alliance
    Messaging.channelMsg(undefined, "During the night the mafia killed " + name + ".");
}

// Takes in a roll and returns userID for those with that roll, even if dead
function getUsersFromRole(role) {
    let matchingUserIDs = [];
    for(let userID in gameState.players){
        //console.log("CHECKING USERID", userID, "role:", gameState.players[userID].role)
        if(gameState.players[userID].role === role){
            matchingUserIDs.push(userID);
        }
    }
    return matchingUserIDs;
}

// Check if the a string matches a user @mention
function parseAtMention(messageText, onlyMention) {
    // Match a @mention in the text (only one and nothing else in string if onlyMention == true)
    let mentions;
    if(onlyMention === true){
        mentions = messageText.match(/^\s*<@(.*?)>\s*$/);
    } else {
        mentions = messageText.match(/<@(.*?)>/);
    }

    // Only return if it's a mention, of a valid player, who's alive
    if (mentions !== null && gameState.players[mentions[1]] !== undefined && gameState.players[mentions[1]].alive) {
        return mentions[1];
    } else {
        return undefined;
    }
}

// Helper to sample a randomly selected array element
function removeElement(array){
    return array.splice(Math.floor(Math.random() * array.length), 1)[0]; // Cut out one element and store it
}
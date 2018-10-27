// Give array of userids in array of strings that aren't prettyprint-able
function assignRoles(userArray){
    // Only run if enough players
    if(userArray.length < 5){
        console.log("Not enough players");
        //TODO alert users that there aren't enough players
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


// Helper to sample a randomly selected array element
function removeElement(array){
    return array.splice(Math.floor(Math.random() * array.length), 1)[0]; // Cut out one element and store it
}
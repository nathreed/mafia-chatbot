## General Game Ideas

### Commands triggered from channel
1. /startgame command - takes all users in the channel and makes a game with them, DMing each user their role. Options: timed and untimed modes
1. /getrules command - prints rules out to the channel
1. /accuse - accuse a user of being the mafia. Puts a message in the channel that has a button that, when clicked, registers a "second" on the accusation
1. /endgame command - ends a game if there is one currently going


For the individual DMs with the roles, Mafia, doctors, etc, they get DMs asking who they want to pick and they @-mention a person

Voting occurs in the following way: the bot puts a message in the channel and counts the first "yes" or "no" from each person as their vote

or have the voting occur via slack app buttons if we can do that


### Endpoints for commands
- /startgame -> /cmd/startgame
- /getrules -> /cmd/getrules
- /accuse -> /cmd/accuse
- /endgame -> /cmd/endgame


#### Mafia Consenus

Once it is time for the mafia to decide who to kill, a countdown starts in their group channel.
They must arrive at a consensus by the end of the countdown. Mafia members indicate who they want to 
kill by using `kill @person-mention` in the chat. If 100% of mafia members vote for the same person, the voting ends
immediately. At the end of the countdown, the person to kill is determined as follows:
- if there was at least 1 kill mention, the person with the most kill mentions dies
- if there were no kill mentions, nobody dies

Mafia members can change their vote on who to kill by submitting a new kill mention - only the most recent kill mention
for each mafia member is saved and used in the final consideration.
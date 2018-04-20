#!/usr/bin/env bash

# requries httpie because life is too short for curl

GAME_ID=$(http GET localhost:3000/new -b | sed -e "s/\"//g")
PLAYER_ID=$(http GET localhost:3000/connect -b | sed -e "s/\"//g")

echo "gameId: $GAME_ID"
echo "playerId: $PLAYER_ID"

http POST localhost:3000/join gameId=$GAME_ID playerId=$PLAYER_ID faction=GREEN playerMat=industrial -o /dev/null
http POST localhost:3000/start gameId=$GAME_ID -o /dev/null

http GET localhost:3000/running -o /dev/null

http POST localhost:3000/action gameId=$GAME_ID playerId=$PLAYER_ID -b
http POST localhost:3000/action gameId=$GAME_ID playerId=$PLAYER_ID action=trade -b
http POST localhost:3000/option gameId=$GAME_ID playerId=$PLAYER_ID option=2 -b

http POST localhost:3000/action gameId=$GAME_ID playerId=$PLAYER_ID action=move -b

EXPORTED_STATE=$(http GET localhost:3000/export/$GAME_ID -b | sed -r 's/^"//' | sed -r 's/"$//')
echo $EXPORTED_STATE



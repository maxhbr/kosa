import * as fs from "fs";
import http = require("http");
import { Socket } from "net";
import net = require("net");
import * as querystring from "querystring";
import * as _ from "ramda";
import * as express from "express";
import * as bodyParser from "body-parser";
import { v4 } from "uuid";
import {
    availableBottomActions,
    availableOptionsForAction,
    availableTopActions,
} from "../game_engine/src/Availability";
import { EventLogSerializer } from "../game_engine/src/Events/EventLogSerializer";
import { Game } from "../game_engine/src/Game";
import { UUID } from "../game_engine/src/UUID";
import { GameInfo } from "../game_engine/src/GameInfo";
import { Option } from "../game_engine/src/Options/Option";
import { Player } from "../game_engine/src/Player";
import { PlayerFactory } from "../game_engine/src/PlayerFactory";
import { PlayerId } from "../game_engine/src/PlayerId";
import { PlayerMat } from "../game_engine/src/PlayerMat";
import ErrnoException = NodeJS.ErrnoException;

const helpMessage = fs.readFileSync("./helpMessage.txt");

type GameUUID = UUID;
type PlayerUUID = UUID;

const clients = new Map<string, Socket>();
const waitingGames: Map<GameUUID, Player[]> = new Map();
const runningGames: Map<GameUUID, Game> = new Map();
const finishedGames: GameUUID[] = [];

const broadcast = (message: string, allClients: Map<string, Socket>): void => {
    for (const [uuid, socket] of allClients) {
        socket.write(infoMsg(message) + "\n\n");
    }
};

const infoMsg = (message: string) => `\n\x1b[33;01m${message}\x1b[0m\n`;
const errorMsg = (message: string) => `\n\x1b[31;01m${message}\x1b[0m\n`;
const successMsg = (message: string) => `\n\x1b[32;01m${message}\x1b[0m\n`;

enum Command {
    WAITING = "WAITING",
    RUNNING = "RUNNING",
    FINISHED = "FINISHED",
    NEW = "NEW",
    JOIN = "JOIN",
    START = "START",
    STATS = "STATS",
    STOP = "STOP",
    ACTION = "ACTION",
    OPTION = "OPTION",
    SU = "SU",
    SG = "SG",
    EXPORT = "EXPORT",
    IMPORT = "IMPORT",
}

// temp hack
const hackyOptions: Map<PlayerUUID, Option[]> = new Map();

if (!fs.existsSync("./finished")) {
    fs.mkdirSync("./finished");
}

const server = net.createServer((socket) => {
    let playerUuid = v4();
    clients.set(playerUuid, socket);
    broadcast(`${playerUuid} joined the server ...`, clients);

    socket.on("end", () => {
        clients.delete(playerUuid);
        broadcast(`${playerUuid} left the server ...`, clients);
    });

    socket.on("data", (data) => {
        const request = data.toString().trim().replace(/  +/, " ");

        if (request.toUpperCase() === Command.WAITING) {
            /**
             * SHOW WAITING GAMES
             */
            socket.write(JSON.stringify(Array.from(waitingGames.entries())) + "\n\n");
        } else if (request.toUpperCase() === Command.RUNNING) {
            /**
             * SHOW RUNNING GAMES
             */
            socket.write(JSON.stringify(Array.from(runningGames.entries())) + "\n\n");
        } else if (request.toUpperCase() === Command.FINISHED) {
            /**
             * SHOW FINISHED GAMES
             */
            socket.write(JSON.stringify(Array.from(finishedGames.entries())) + "\n\n");
        } else if (request.toUpperCase() === Command.NEW) {
            /**
             * START A NEW GAME
             */
            const gameId = v4();
            waitingGames.set(gameId, []);
            broadcast(`${playerUuid} opened a new game ${gameId} ...`, clients);
        } else if (request.toUpperCase().startsWith(Command.SU)) {
            /**
             * SWITCH TO ANOTHER USER/PLAYER
             */
            const matches = request.split(" ");
            const newPlayerUuid: PlayerUUID = matches[1];
            if (newPlayerUuid === undefined) {
                socket.write(errorMsg("SU <playerId>"));
            } else {
                clients.delete(playerUuid);
                clients.set(newPlayerUuid, socket);
                broadcast(infoMsg(`${playerUuid} is now ${newPlayerUuid}`), clients);
                playerUuid = newPlayerUuid;
            }
        } else if (request.toUpperCase().startsWith(Command.SG)) {
            /**
             * SWITCH NAME OF CURRENT GAME
             */
            const matches = request.split(" ");
            const gameId = matches[1];
            const newGameId = matches[2];
            const runningGame = runningGames.get(gameId) as Game;
            const waitingGame = waitingGames.get(gameId) as Player[];

            if (runningGame !== undefined) {
                runningGames.set(newGameId, runningGame);
                runningGames.delete(gameId);
                broadcast(`${playerUuid} changed game ${gameId} to ${newGameId} ...`, clients);
            } else if (waitingGame !== undefined) {
                waitingGames.set(newGameId, waitingGame);
                waitingGames.delete(gameId);
                broadcast(`${playerUuid} changed game ${gameId} to ${newGameId} ...`, clients);
            } else {
                socket.write(errorMsg("SG <gameId> <newGameId>"));
            }
        } else if (request.toUpperCase().startsWith(Command.JOIN)) {
            /**
             * JOIN AN EXISTING GAME
             */

            const matches = request.split(" ");

            try {
                const gameId = matches[1];
                const faction = matches[2].toUpperCase();
                const playerMat = matches[3].toLowerCase();
                const player = PlayerFactory.createFromString(
                    faction,
                    playerUuid,
                    PlayerMat.createFromString(playerMat, playerUuid),
                );
                waitingGames.get(gameId).push(player);

                broadcast(
                    `${playerUuid} joined game ${gameId} (${waitingGames.get(gameId).length} player(s)) ...`,
                    clients,
                );
            } catch (error) {
                socket.write(errorMsg(`JOIN <gameId> <faction> <playerMat>\n\n${error.message}\n`));
            }
        } else if (request.toUpperCase().startsWith(Command.START)) {
            /**
             * START A GAME
             */

            const matches = request.split(" ");
            const gameId = matches[1];
            if (gameId === undefined) {
                socket.write(errorMsg("START <gameId>\n"));
            } else {
                try {
                    const game = new Game(waitingGames.get(gameId) as Player[]);
                    waitingGames.delete(gameId);
                    runningGames.set(gameId, game);

                    broadcast(`${playerUuid} started game ${gameId} ...`, clients);
                } catch (error) {
                    socket.write(errorMsg(`Something went wrong:\n\n${error.message}\n\n`));
                }
            }
        } else if (request.toUpperCase().startsWith(Command.STOP)) {
            /**
             * STOP A GAME
             */

            const matches = request.split(" ");
            const gameId = matches[1];
            if (gameId === undefined || !runningGames.has(gameId)) {
                socket.write(errorMsg(`STOP <gameId>\n`));
            } else {
                finishedGames.push(gameId);
                const game = runningGames.get(gameId) as Game;
                fs.writeFile(
                    `./finished/${gameId}`,
                    EventLogSerializer.serialize(game.log),
                    (err: ErrnoException) => err
                        ? socket.write(errorMsg(`Failed to serialize ${gameId}\n\n`))
                        : socket.write(successMsg(`Stopped and saved game to finished/${gameId}\n\n`)),
                );
                runningGames.delete(gameId);
            }
        } else if (request.toUpperCase().startsWith(Command.ACTION)) {
            /**
             * SHOW AVAILABLE ACTIONS / SHOW OPTIONS FOR ACTION
             *
             * ACTION <gameId> <playerId>
             * ACTION <gameId> <playerId> <action>
             */
            const matches = request.split(" ");
            if (matches.length < 3) {
                socket.write(errorMsg("ACTION <gameId> <playerId>\n"));
                socket.write(errorMsg("ACTION <gameId> <playerId> TRADE|BOLSTER|MOVE|PRODUCE\n"));
            } else {
                const gameId = matches[1];
                const game = runningGames.get(gameId);

                const playerId = matches[2];
                const currentPlayer = _.find(
                    (player: Player) => playerId === player.playerId,
                    GameInfo.players(game.log),
                );

                if (currentPlayer === undefined) {
                    socket.write(errorMsg("Player not found ...\n"));
                }

                if (matches.length === 3) {
                    socket.write(
                        JSON.stringify(
                            availableTopActions(game.log, currentPlayer).concat(
                                availableBottomActions(game.log, currentPlayer),
                            ),
                        ) + "\n\n",
                    );
                } else if (matches.length === 4) {
                    const action = matches[3].toUpperCase();
                    const options = availableOptionsForAction(action, game.log, currentPlayer);
                    hackyOptions.set(playerId, options);
                    for (const index in options) {
                        socket.write(`[${index}]\n    ` + JSON.stringify(options[index]) + "\n");
                    }
                    socket.write("\n\n");
                }
            }
        } else if (request.toUpperCase().startsWith(Command.OPTION)) {
            /**
             * TAKE A SPECIFIC ACTION
             *
             * OPTION <gameId> <playerId> <option>
             */
            const matches = request.split(" ");
            if (matches.length < 4) {
                socket.write(errorMsg("OPTION <gameId> <playerId> <option>\n\n"));
            } else {
                const gameId = matches[1];
                const game = runningGames.get(gameId) as Game;

                const playerId = matches[2];
                try {
                    const currentPlayer = _.find(
                        (player: Player) => playerId === player.playerId,
                        GameInfo.players(game.log),
                    ) as Player;

                    const optionIndex = parseInt(matches[3], 10);
                    if (optionIndex === undefined) {
                        socket.write(errorMsg("Option doesn't exist ....\n\n"));
                    }
                    game.actionFromOption(currentPlayer, hackyOptions.get(playerId)[optionIndex]);

                    if (GameInfo.gameOver(game.log)) {
                        broadcast(successMsg(`Game ${gameId} is over ...`), clients);
                        finishedGames.push(gameId);
                        runningGames.delete(gameId);

                        fs.writeFile(
                            `./finished/${gameId}`,
                            EventLogSerializer.serialize(game.log),
                            (err: ErrnoException) => err
                                ? socket.write(errorMsg(`Failed to serialize ${gameId}\n\n`))
                                : socket.write(successMsg(`Saved game to finished/${gameId}\n\n`)),
                        );
                    }
                } catch (error) {
                    socket.write(errorMsg(`Something went wrong ...\n\n${error.message}\n\n`));
                }
            }
        } else if (request.toUpperCase().startsWith(Command.IMPORT)) {
            /**
             * IMPORT GAME STATE AND ADD TO WAITING
             *
             * IMPORT <gameId> <serializedEvents>
             */
            const matches = request.split(" ");
            const gameId = matches[1];
            const serializedEventLog = matches[2];
            if (gameId === undefined || serializedEventLog === undefined) {
                socket.write(errorMsg(`IMPORT <gameId> <serializedEvents>\n\n`))
            } else {
                try {
                    const log = EventLogSerializer.deserialize(serializedEventLog);
                    runningGames.set(gameId, new Game(GameInfo.players(log), log));
                    broadcast(infoMsg(`${playerUuid} imported ${gameId}`), clients);
                } catch (e) {
                    socket.write(`Unable to import game state\n\n${e.message}\n\n`);
                }
            }

        } else if (request.toUpperCase().startsWith(Command.EXPORT)) {
            /**
             * EXPORT GAME STATE
             *
             * EXPORT <gameId>
             */

            const matches = request.split(" ");
            const gameId = matches[1];
            if (gameId === undefined) {
                socket.write(errorMsg(`EXPORT <gameId>\n`));
            } else {
                try {
                    const game = runningGames.get(gameId) as Game;
                    socket.write(EventLogSerializer.serialize(game.log) + "\n\n");
                } catch (e) {
                    socket.write(`Unable to export game state\n\n${e.message}\n\n`);
                }
            }

        } else if (request.toUpperCase().startsWith(Command.STATS)) {
            /**
             * SHOW STATS
             *
             * STATS <gameId>
             */

            const matches = request.split(" ");
            const gameId = matches[1];
            if (gameId === undefined) {
                socket.write(errorMsg(`STATS <gameId>\n`));
            } else {
                try {
                    const game = runningGames.get(gameId) as Game;
                    socket.write(JSON.stringify(GameInfo.stats(game.log)) + "\n\n");
                } catch (e) {
                    socket.write(`Unable to export stats\n\n${e.message}\n\n`);
                }
            }
        } else {
            socket.write(helpMessage);
        }
    });
});

const hostname = process.argv[2] ? process.argv[2] : "0.0.0.0";
const port = process.argv[3] ? parseInt(process.argv[3], 10) : 1337;
server.listen(port, hostname);

const mapToJson = (x: any) => JSON.parse(JSON.stringify([...x]));

const app = express();
app.use(bodyParser.json());

app.get("/waiting", (req, res) => {
    res.json(mapToJson(waitingGames));
});

app.get("/running", (req, res) => {
    res.json(mapToJson(runningGames));
});

app.get("/finished", (req, res) => {
    res.json(mapToJson(finishedGames));
});

app.get("/new", (req, res) => {
    const gameId = v4();
    waitingGames.set(gameId, []);
    res.json(gameId);
});

app.get("/connect", (req, res) => {
    res.json(v4());
});

app.post("/join", (req, res) => {
    try {
        const gameId = req.body.gameId;
        const playerId = req.body.playerId;
        const faction = req.body.faction.toUpperCase();
        const playerMat = req.body.playerMat.toLowerCase();
        const player = PlayerFactory.createFromString(
            faction,
            playerId,
            PlayerMat.createFromString(playerMat, playerId),
        );
        waitingGames.get(gameId).push(player);
        res.json("OK");
    } catch (e) {
        res.json({message: e.message});
    }
});

app.post("/start", (req, res) => {
    try {
        const gameId = req.body.gameId;
        const game = new Game(waitingGames.get(gameId) as Player[]);
        waitingGames.delete(gameId);
        runningGames.set(gameId, game);
        res.json("OK");
    } catch (e) {
        res.json({message: e.message});
    }
});

app.post("/stop", (req, res) => {
    try {
        const gameId = req.body.gameId;
        const game = runningGames.get(gameId) as Game;
        finishedGames.push(gameId);
        fs.writeFile(
            `./finished/${gameId}`,
            EventLogSerializer.serialize(game.log),
            (err: ErrnoException) => err,
        );
        runningGames.delete(gameId);
    } catch (e) {
        res.json({message: e.message});
    }
});

app.post("/action", (req, res) => {
    try {
        const gameId = req.body.gameId;
        const game = runningGames.get(gameId) as Game;

        const playerId = req.body.playerId;
        const currentPlayer = _.find(
            (player: Player) => playerId === player.playerId,
            GameInfo.players(game.log),
        ) as Player;

        if (!req.body.action) {
            res.json(
                availableTopActions(game.log, currentPlayer).concat(
                    availableBottomActions(game.log, currentPlayer),
                ),
            );
        } else {
            const action = req.body.action.toUpperCase();
            const options = availableOptionsForAction(action, game.log, currentPlayer);
            hackyOptions.set(playerId, options);
            res.json(options);
        }
    } catch (e) {
        res.json({message: e.message});
    }
});

app.post("/option", (req, res) => {
    try {
        const gameId = req.body.gameId;
        const game = runningGames.get(gameId) as Game;

        const playerId = req.body.playerId;
        const currentPlayer = _.find(
            (player: Player) => playerId === player.playerId,
            GameInfo.players(game.log),
        ) as Player;

        const optionIndex = parseInt(req.body.option, 10);
        game.actionFromOption(currentPlayer, hackyOptions.get(playerId)[optionIndex]);

        if (GameInfo.gameOver(game.log)) {
            finishedGames.push(gameId);
            runningGames.delete(gameId);

            fs.writeFile(
                `./finished/${gameId}`,
                EventLogSerializer.serialize(game.log),
                (err: ErrnoException) => err,
            );
            res.status(418);
            res.json("GAME OVER")
        } else {
            res.json("OK")
        }
    } catch (e) {
        res.json({message: e.message});
    }
});

app.get("/export/:gameId", (req, res) => {
    try {
        const gameId = req.params.gameId;
        if (gameId === undefined) {
            // todo
        } else {
            try {
                const game = runningGames.get(gameId) as Game;
                res.json(EventLogSerializer.serialize(game.log));
            } catch (e) {
                res.json({message: "error"});
            }
        }
    } catch (e) {
        res.json({message: e.message});
    }
});

app.post("/import", (req, res) => {
    const gameId = req.body.gameId;
    const serializedEventLog = req.body.log;
    try {
        const log = EventLogSerializer.deserialize(serializedEventLog);
        runningGames.set(gameId, new Game(GameInfo.players(log), log));
    } catch (e) {
        res.json({message: e.message});
    }
});

app.get("/stats/:gameId", (req, res) => {
    const gameId = req.params.gameId;
    if (gameId === undefined) {
        res.json({message: "error"});
    } else {
        try {
            const game = runningGames.get(gameId) as Game;
            res.json(GameInfo.stats(game.log));
        } catch (e) {
            res.json({message: e.message});
        }
    }
});

app.get("/load", (req, res) => {
    if (runningGames.has(req.query.gameId)) {
        const game = runningGames.get(req.query.gameId) as Game;
        const players = GameInfo.players(game.log);
        let stats = GameInfo.stats(game.log);
        stats.log = game.log.log;
        res.json(stats);
    } else {
        res.json({message: "error"});
    }
});

app.use((req, res) => {
    res.send(404);
});

app.use(express.static("public"));

app.listen(3000);

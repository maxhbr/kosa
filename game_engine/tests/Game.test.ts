import { BottomAction } from "../src/BottomAction";
import { Building } from "../src/Building";
import { BuildingType } from "../src/BuildingType";
import { BuildEvent } from "../src/Events/BuildEvent";
import { CoinEvent } from "../src/Events/CoinEvent";
import { DeployEvent } from "../src/Events/DeployEvent";
import { EnlistEvent } from "../src/Events/EnlistEvent";
import { EventLog } from "../src/Events/EventLog";
import { GainResourceEvent } from "../src/Events/GainResourceEvent";
import { PassEvent } from "../src/Events/PassEvent";
import { PopularityEvent } from "../src/Events/PopularityEvent";
import { PowerEvent } from "../src/Events/PowerEvent";
import { SpendResourceEvent } from "../src/Events/SpendResourceEvent";
import { StarEvent } from "../src/Events/StarEvent";
import { UpgradeEvent } from "../src/Events/UpgradeEvent";
import { Field } from "../src/Field";
import { Game } from "../src/Game";
import { Player } from "../src/Player";
import { PlayerFactory } from "../src/PlayerFactory";
import { PlayerId } from "../src/PlayerId";
import { PlayerMat } from "../src/PlayerMat";
import { RecruitReward } from "../src/RecruitReward";
import { Resource } from "../src/Resource";
import { ResourceType } from "../src/ResourceType";
import { Star } from "../src/Star";
import { TopAction } from "../src/TopAction";
import { Character } from "../src/Units/Character";
import { Mech } from "../src/Units/Mech";
import { Worker } from "../src/Units/Worker";

let game: Game;

const blackIndustrialPlayerId = new PlayerId(1);
const greenAgriculturalPlayerId = new PlayerId(2);

const blackIndustrialPlayer = PlayerFactory.black(
    blackIndustrialPlayerId,
    PlayerMat.industrial(blackIndustrialPlayerId),
);
const greenAgriculturalPlayer = PlayerFactory.green(
    greenAgriculturalPlayerId,
    PlayerMat.agricultural(greenAgriculturalPlayerId),
);

beforeEach(() => {
    game = new Game(new EventLog(), [blackIndustrialPlayer, greenAgriculturalPlayer]);
});

test("Black player has two more power after bolstering power", () => {
    expect(game.bolsterPower(blackIndustrialPlayer).power(blackIndustrialPlayer)).toBe(3);
});

test("Player has one more combat card after bolstering combat cards", () => {
    expect(game.combatCards(blackIndustrialPlayer).length).toBe(4);
    expect(game.bolsterCombatCards(blackIndustrialPlayer).combatCards(blackIndustrialPlayer).length).toBe(5);
});

test("Player pays one coin for bolster", () => {
    expect(game.coins(blackIndustrialPlayer)).toBe(4);
    expect(game.bolsterPower(blackIndustrialPlayer).coins(blackIndustrialPlayer)).toBe(3);
});

test("Player cannot bolster without coins", () => {
    game.log.add(new CoinEvent(blackIndustrialPlayer.playerId, -4));
    expect(() => game.bolsterPower(blackIndustrialPlayer)).toThrowError(
        /1 coin\(s\) required, but only 0 coin\(s\) available./,
    );
});

test("Black character starts on black with two adjacent workers", () => {
    expect(game.unitLocation(blackIndustrialPlayer, Character.CHARACTER)).toBe(Field.black);
    expect(game.unitLocation(blackIndustrialPlayer, Worker.WORKER_1)).toBe(Field.m6);
    expect(game.unitLocation(blackIndustrialPlayer, Worker.WORKER_2)).toBe(Field.t8);
});

test("Black character can move from base to encounter on v6 in 2 moves (3 turns)", () => {
    game.move(blackIndustrialPlayer, Character.CHARACTER, Field.m6);
    expect(game.unitLocation(blackIndustrialPlayer, Character.CHARACTER)).toBe(Field.m6);
    game.produce(greenAgriculturalPlayer);

    game.produce(blackIndustrialPlayer);
    game.bolsterPower(greenAgriculturalPlayer);

    game.move(blackIndustrialPlayer, Character.CHARACTER, Field.v6);
    expect(game.unitLocation(blackIndustrialPlayer, Character.CHARACTER)).toBe(Field.v6);
});

test("Player cannot move a mech which has not been deployed", () => {
    const expectedError = /MECH_1 has not been deployed yet./;
    expect(() => game.move(blackIndustrialPlayer, Mech.MECH_1, Field.black)).toThrowError(expectedError);
});

test("Black character cannot move to another homebase", () => {
    const expectedError = /CHARACTER is not allowed to move from black:HOMEBASE to green:HOMEBASE./;
    expect(() => game.move(blackIndustrialPlayer, Character.CHARACTER, Field.green)).toThrowError(expectedError);
});

test("Player can gain one coin", () => {
    expect(game.coins(blackIndustrialPlayer)).toBe(4);
    expect(game.gainCoins(blackIndustrialPlayer).coins(blackIndustrialPlayer)).toBe(5);
});

test("Calculate resources", () => {
    game.log
        .add(
            new GainResourceEvent(blackIndustrialPlayerId, [
                new Resource(Field.black, ResourceType.FOOD),
                new Resource(Field.black, ResourceType.FOOD),
                new Resource(Field.black, ResourceType.FOOD),
                new Resource(Field.black, ResourceType.FOOD),
                new Resource(Field.black, ResourceType.FOOD),
            ]),
        )
        .add(
            new SpendResourceEvent(blackIndustrialPlayerId, [
                new Resource(Field.black, ResourceType.FOOD),
                new Resource(Field.black, ResourceType.FOOD),
                new Resource(Field.black, ResourceType.FOOD),
            ]),
        );
    expect(game.resources(blackIndustrialPlayer).food).toBe(2);
});

test("Trade requires coins", () => {
    const expectedError = /1 coin.s. required, but only 0 coin.s. available./;
    game.log.add(new CoinEvent(blackIndustrialPlayerId, -4));
    expect(() =>
        game.tradeResources(blackIndustrialPlayer, Worker.WORKER_1, ResourceType.FOOD, ResourceType.FOOD),
    ).toThrowError(expectedError);
});

test("Trade requires a deployed worker", () => {
    const expectedError = /WORKER_3 has not been deployed yet./;
    expect(() =>
        game.tradeResources(blackIndustrialPlayer, Worker.WORKER_3, ResourceType.FOOD, ResourceType.FOOD),
    ).toThrowError(expectedError);
});

test("Player has two more resources after tradeResources", () => {
    const res = game
        .tradeResources(blackIndustrialPlayer, Worker.WORKER_1, ResourceType.WOOD, ResourceType.METAL)
        .resources(blackIndustrialPlayer);
    expect(res.food).toBe(0);
    expect(res.wood).toBe(1);
    expect(res.metal).toBe(1);
    expect(res.oil).toBe(0);
    expect(game.coins(blackIndustrialPlayer)).toBe(3);
});

test("Cannot build the same building twice", () => {
    const res = [
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
    ];
    game.log.add(new GainResourceEvent(blackIndustrialPlayerId, res));

    const expectedError = /Building MILL has already been built./;
    expect(() => {
        game
            .build(blackIndustrialPlayer, Worker.WORKER_1, BuildingType.MILL, res)
            .bolsterPower(greenAgriculturalPlayer)
            .produce(blackIndustrialPlayer)
            .gainCoins(greenAgriculturalPlayer)
            .build(blackIndustrialPlayer, Worker.WORKER_1, BuildingType.MILL, res);
    }).toThrowError(expectedError);
});

test("Cannot build on a location that already has a building", () => {
    const resources1 = [
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
    ];
    const resources2 = [
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
    ];
    game.log.add(new GainResourceEvent(blackIndustrialPlayerId, resources1));
    game.log.add(new GainResourceEvent(blackIndustrialPlayerId, resources2));

    expect(() => {
        game
            .build(blackIndustrialPlayer, Worker.WORKER_1, BuildingType.MILL, resources1)
            .bolsterPower(greenAgriculturalPlayer)
            .bolsterPower(blackIndustrialPlayer)
            .produce(greenAgriculturalPlayer)
            .build(blackIndustrialPlayer, Worker.WORKER_1, BuildingType.ARMORY, resources2);
    }).toThrowError(/m6.MOUNTAIN already has another building./);
});

test("Cannot build without enough wood", () => {
    const expectedError = /Not enough resources of type WOOD; 3 required, but only 0 available./;
    expect(() => game.build(blackIndustrialPlayer, Worker.WORKER_1, BuildingType.ARMORY, [])).toThrowError(
        expectedError,
    );
});

test("Accepts only exact wood", () => {
    const expectedError = /Not enough resources of type WOOD; 3 required, but only 0 available./;
    expect(() => game.build(blackIndustrialPlayer, Worker.WORKER_1, BuildingType.ARMORY, [])).toThrowError(
        expectedError,
    );
});

test("Player can build a mill", () => {
    const res = [
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
    ];
    game.log.add(new GainResourceEvent(blackIndustrialPlayerId, res));
    game.build(blackIndustrialPlayer, Worker.WORKER_1, BuildingType.MILL, res);

    expect(game.resources(blackIndustrialPlayer).countByType(ResourceType.WOOD)).toBe(0);
    expect(game.buildings(blackIndustrialPlayer).pop()).toEqual(new Building(BuildingType.MILL, Field.m6));
});

test("Building uses specific resources", () => {
    const resources1 = [
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.m6, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
    ];
    const resources2 = [new Resource(Field.m6, ResourceType.WOOD), new Resource(Field.black, ResourceType.WOOD)];
    game.log.add(new GainResourceEvent(blackIndustrialPlayerId, resources1.concat(resources2)));
    expect(game.availableResources(blackIndustrialPlayer)).toEqual(resources1.concat(resources2));

    game.build(blackIndustrialPlayer, Worker.WORKER_1, BuildingType.MILL, resources1);
    expect(game.availableResources(blackIndustrialPlayer)).toEqual(resources2);
});

test("Paying resources requires exact match", () => {
    const resources1 = [
        new Resource(Field.black, ResourceType.WOOD),
        new Resource(Field.m6, ResourceType.WOOD),
        new Resource(Field.black, ResourceType.WOOD),
    ];
    const resources2 = [
        new Resource(Field.t8, ResourceType.WOOD),
        new Resource(Field.t8, ResourceType.WOOD),
        new Resource(Field.t8, ResourceType.WOOD),
    ];

    game.log.add(new GainResourceEvent(blackIndustrialPlayerId, resources1));

    const expectedError =
        "The provided resources (t8:TUNDRA:WOOD, t8:TUNDRA:WOOD, t8:TUNDRA:WOOD) " +
        "are not among your available resources (black:HOMEBASE:WOOD, m6:MOUNTAIN:WOOD, black:HOMEBASE:WOOD).";
    expect(() => game.build(blackIndustrialPlayer, Worker.WORKER_1, BuildingType.MILL, resources2)).toThrowError(
        expectedError,
    );
});

test("Can trade for popularity", () => {
    expect(game.tradePopularity(blackIndustrialPlayer).popularity(blackIndustrialPlayer)).toBe(3);
});

test("Black cannot take the same top action twice", () => {
    expect(() =>
        game
            .produce(blackIndustrialPlayer)
            .produce(greenAgriculturalPlayer)
            .produce(blackIndustrialPlayer),
    ).toThrowError("Cannot use actions from the same column.");
});

test("Black cannot take bottom action from the same column as last turn's top action", () => {
    expect(() =>
        game
            .produce(blackIndustrialPlayer)
            .produce(greenAgriculturalPlayer)
            .deploy(blackIndustrialPlayer, Worker.WORKER_1, Mech.MECH_1, []),
    ).toThrowError("Cannot use actions from the same column.");
});

test("Black cannot take top action from the same column as last turn's bottom action", () => {
    const res = [
        new Resource(Field.m6, ResourceType.METAL),
        new Resource(Field.m6, ResourceType.METAL),
        new Resource(Field.m6, ResourceType.METAL),
        new Resource(Field.m6, ResourceType.METAL),
    ];
    game.log.add(new GainResourceEvent(blackIndustrialPlayerId, res));

    game.deploy(blackIndustrialPlayer, Worker.WORKER_1, Mech.MECH_1, res).produce(greenAgriculturalPlayer);
    expect(() => game.produce(blackIndustrialPlayer)).toThrowError("Cannot use actions from the same column.");
});

test("Top action and bottom action have to match", () => {
    expect(() =>
        game.produce(blackIndustrialPlayer).enlist(blackIndustrialPlayer, BottomAction.BUILD, RecruitReward.COINS, []),
    ).toThrowError("Cannot use this bottom action with the last top action.");
});

test("Player with industrial (1) map starts before agricultural (7)", () => {
    expect(() => game.produce(greenAgriculturalPlayer)).toThrowError("You are not the starting player.");
});

test("Player cannot play out of order", () => {
    expect(() => game.gainCoins(blackIndustrialPlayer).bolsterPower(blackIndustrialPlayer)).toThrowError(
        "It is not your turn yet.",
    );
});

test("Players can take all available top actions at the start of the game", () => {
    expect(game.availableTopActions(blackIndustrialPlayer).length).toBe(4);
});

test("Black player controls three territories at the start", () => {
    expect(game.territories(blackIndustrialPlayer)).toEqual([Field.black, Field.m6, Field.t8]);
});

test("Black player controls three units at the start", () => {
    const units = game.units(blackIndustrialPlayer);
    expect(units.has(Character.CHARACTER)).toBeTruthy();
    expect(units.has(Worker.WORKER_1)).toBeTruthy();
    expect(units.has(Worker.WORKER_2)).toBeTruthy();
});

test("Players don't have available actions when it's not their turn", () => {
    game.bolsterPower(blackIndustrialPlayer);
    expect(game.availableTopActions(blackIndustrialPlayer).length).toBe(0);
});

test("Players have three available actions on their second turn", () => {
    game.bolsterPower(blackIndustrialPlayer).bolsterPower(greenAgriculturalPlayer);
    expect(game.availableTopActions(blackIndustrialPlayer).length).toBe(3);
});

test("Players have no bottom costs available on their first turn", () => {
    expect(game.availableBottomActions(blackIndustrialPlayer).length).toBe(0);
});

test("Players can take all bottom actions if they have enough resources", () => {
    mockResourcesAndCoinsForPlayer(blackIndustrialPlayer);
    expect(game.availableBottomActions(blackIndustrialPlayer).length).toBe(4);
});

test("Players can only take the bottom actions they can afford", () => {
    addResourcesForPlayer(blackIndustrialPlayer, ResourceType.METAL, 4);
    expect(game.availableBottomActions(blackIndustrialPlayer).pop()).toEqual(BottomAction.DEPLOY);
});

test.skip("Black producing at starting position will get 1 oil and 1 metal", () => {
    game.produce(blackIndustrialPlayer);
    expect(game.availableResources(blackIndustrialPlayer)).toEqual([
        new Resource(Field.m6, ResourceType.METAL),
        new Resource(Field.t8, ResourceType.OIL),
    ]);
});

test.skip("Producing with 8 workers costs 1 popularity, 1 coins, 1 power", () => {
    game.log
        .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_3, Field.t8))
        .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_4, Field.t8))
        .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_5, Field.t8))
        .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_6, Field.t8))
        .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_7, Field.t8))
        .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_8, Field.t8));

    game.produce(blackIndustrialPlayer);
    expect(game.availableResources(blackIndustrialPlayer)).toEqual([
        new Resource(Field.m6, ResourceType.METAL),
        new Resource(Field.t8, ResourceType.OIL),
        new Resource(Field.t8, ResourceType.OIL),
        new Resource(Field.t8, ResourceType.OIL),
        new Resource(Field.t8, ResourceType.OIL),
        new Resource(Field.t8, ResourceType.OIL),
        new Resource(Field.t8, ResourceType.OIL),
        new Resource(Field.t8, ResourceType.OIL),
    ]);
    expect(game.power(blackIndustrialPlayer)).toBe(0);
    expect(game.popularity(blackIndustrialPlayer)).toBe(1);
    expect(game.coins(blackIndustrialPlayer)).toBe(3);
});

test("Player only has resources on controlled territories", () => {
    game.log.add(
        new GainResourceEvent(blackIndustrialPlayerId, [
            new Resource(Field.m6, ResourceType.METAL),
            new Resource(Field.white, ResourceType.METAL),
        ]),
    );
    expect(game.resources(blackIndustrialPlayer).metal).toEqual(1);
});

test("Calculate player score", () => {
    const score = game.score();
    expect(score.get(blackIndustrialPlayer)).toBe(8);
    expect(score.get(greenAgriculturalPlayer)).toBe(11);
});

test("Calculate player score with max popularity", () => {
    game.log
        .add(new StarEvent(blackIndustrialPlayerId, Star.FIRST_COMBAT_WIN))
        .add(new StarEvent(blackIndustrialPlayerId, Star.SECOND_COMBAT_WIN))
        .add(new PopularityEvent(blackIndustrialPlayerId, 16));
    addResourcesForPlayer(blackIndustrialPlayer, ResourceType.METAL, 11);
    expect(game.score().get(blackIndustrialPlayer)).toBe(37);
});

test("Player automatically passes when no other option is available", () => {
    game.bolsterPower(blackIndustrialPlayer);
    expect(game.log.log.pop()).toBeInstanceOf(PassEvent);
});

test("Player does not pass automatically when bottom action is available", () => {
    mockResourcesAndCoinsForPlayer(blackIndustrialPlayer);
    game.bolsterPower(blackIndustrialPlayer);
    expect(game.log.log.pop()).not.toBeInstanceOf(PassEvent);
});

test("Player does automatically pass after bottom action", () => {
    mockResourcesAndCoinsForPlayer(blackIndustrialPlayer);
    game.build(blackIndustrialPlayer, Worker.WORKER_1, BuildingType.ARMORY, resources(Field.m6, ResourceType.WOOD, 4));
    expect(game.log.log.pop()).toBeInstanceOf(PassEvent);
});

test("Players get a star for having maximum power", () => {
    game.log.add(new PowerEvent(blackIndustrialPlayerId, 13));
    game.bolsterPower(blackIndustrialPlayer);
    expect(game.stars(blackIndustrialPlayer).pop()).toBe(Star.MAX_POWER);
});

describe("Players get stars when conditions are met", () => {
    test("Players get a star for having maximum power", () => {
        game.log.add(new PowerEvent(blackIndustrialPlayerId, 13));
        game.bolsterPower(blackIndustrialPlayer);
        expect(game.stars(blackIndustrialPlayer)).toContain(Star.MAX_POWER);
    });

    test("Players get a star for having maximum popularity", () => {
        game.log.add(new PopularityEvent(blackIndustrialPlayerId, 15));
        game.tradePopularity(blackIndustrialPlayer);
        expect(game.stars(blackIndustrialPlayer)).toContain(Star.MAX_POPULARITY);
    });

    test("Players get a star for deploying all workers", () => {
        game.log
            .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_3, Field.black))
            .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_4, Field.black))
            .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_5, Field.black))
            .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_6, Field.black))
            .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_7, Field.black))
            .add(new DeployEvent(blackIndustrialPlayerId, Worker.WORKER_8, Field.black));
        game.tradePopularity(blackIndustrialPlayer);
        expect(game.stars(blackIndustrialPlayer)).toContain(Star.ALL_WORKERS);
    });

    test("Players get a star for deploying all mechs", () => {
        mockResourcesAndCoinsForPlayer(blackIndustrialPlayer);
        game.log
            .add(new DeployEvent(blackIndustrialPlayerId, Mech.MECH_1, Field.black))
            .add(new DeployEvent(blackIndustrialPlayerId, Mech.MECH_2, Field.black))
            .add(new DeployEvent(blackIndustrialPlayerId, Mech.MECH_3, Field.black));
        game.gainCoins(blackIndustrialPlayer);
        expect(game.stars(blackIndustrialPlayer)).toEqual([]);

        game.log.add(new DeployEvent(blackIndustrialPlayerId, Mech.MECH_4, Field.black));
        game.build(
            blackIndustrialPlayer,
            Worker.WORKER_1,
            BuildingType.MINE,
            resources(Field.m6, ResourceType.WOOD, 4),
        );
        expect(game.stars(blackIndustrialPlayer)).toContain(Star.ALL_MECHS);
    });

    test("Players get a star for enlisting all recruiters", () => {
        game.log
            .add(new EnlistEvent(blackIndustrialPlayerId, RecruitReward.COINS, BottomAction.ENLIST))
            .add(new EnlistEvent(blackIndustrialPlayerId, RecruitReward.COMBAT_CARDS, BottomAction.DEPLOY))
            .add(new EnlistEvent(blackIndustrialPlayerId, RecruitReward.POPULARITY, BottomAction.UPGRADE))
            .add(new EnlistEvent(blackIndustrialPlayerId, RecruitReward.POWER, BottomAction.BUILD));
        game.gainCoins(blackIndustrialPlayer);
        expect(game.stars(blackIndustrialPlayer)).toContain(Star.ALL_RECRUITS);
    });

    test("Players get a star for building all buildings", () => {
        game.log
            .add(new BuildEvent(blackIndustrialPlayerId, workerLocation(blackIndustrialPlayer), BuildingType.ARMORY))
            .add(new BuildEvent(blackIndustrialPlayerId, workerLocation(blackIndustrialPlayer), BuildingType.MILL))
            .add(new BuildEvent(blackIndustrialPlayerId, workerLocation(blackIndustrialPlayer), BuildingType.MINE))
            .add(new BuildEvent(blackIndustrialPlayerId, workerLocation(blackIndustrialPlayer), BuildingType.MONUMENT));
        game.gainCoins(blackIndustrialPlayer);
        expect(game.stars(blackIndustrialPlayer)).toContain(Star.ALL_BUILDINGS);
    });

    test("Players get a star for unlocking all upgrades", () => {
        game.log
            .add(new UpgradeEvent(blackIndustrialPlayerId, TopAction.BOLSTER, BottomAction.ENLIST))
            .add(new UpgradeEvent(blackIndustrialPlayerId, TopAction.BOLSTER, BottomAction.ENLIST))
            .add(new UpgradeEvent(blackIndustrialPlayerId, TopAction.BOLSTER, BottomAction.ENLIST))
            .add(new UpgradeEvent(blackIndustrialPlayerId, TopAction.BOLSTER, BottomAction.ENLIST))
            .add(new UpgradeEvent(blackIndustrialPlayerId, TopAction.BOLSTER, BottomAction.ENLIST))
            .add(new UpgradeEvent(blackIndustrialPlayerId, TopAction.BOLSTER, BottomAction.ENLIST));
        game.gainCoins(blackIndustrialPlayer);
        expect(game.stars(blackIndustrialPlayer)).toContain(Star.ALL_UPGRADES);
    });

    test.skip("Players get stars for the first two combat wins", () => {
        expect(game.stars(blackIndustrialPlayer)).toEqual([Star.FIRST_COMBAT_WIN, Star.SECOND_COMBAT_WIN]);
    });

    test.skip("Players get a star for completing an objective", () => {
        expect(game.stars(blackIndustrialPlayer)).toEqual([Star.FIRST_COMBAT_WIN, Star.SECOND_COMBAT_WIN]);
    });
});

test.skip("Upgrade makes a top action more powerful and a bottom action cheaper", () => {
    mockResourcesAndCoinsForPlayer(blackIndustrialPlayer);
    game.upgrade(
        blackIndustrialPlayer,
        TopAction.BOLSTER,
        BottomAction.BUILD,
        resources(Field.t8, ResourceType.METAL, 4),
    );
});

test.skip("Cannot deploy the same mech twice", () => {
    mockResourcesAndCoinsForPlayer(blackIndustrialPlayer);

    expect(() =>
        game
            .deploy(blackIndustrialPlayer, Worker.WORKER_1, Mech.MECH_1, resources(Field.t8, ResourceType.METAL, 4))
            .bolsterPower(greenAgriculturalPlayer)
            .bolsterPower(blackIndustrialPlayer)
            .tradePopularity(greenAgriculturalPlayer)
            .deploy(blackIndustrialPlayer, Worker.WORKER_1, Mech.MECH_1, resources(Field.t8, ResourceType.METAL, 4)),
    ).toThrowError("Mech already deployed.");
});

test.skip("Buildings cannot be placed on home territories", () => fail());
test.skip("Buildings cannot be placed on lakes", () => fail());
test.skip("Cannot move the same unit multiple times", () => fail());

const resources = (location: Field, resourceType: ResourceType, count: number = 10): Resource[] => {
    const res: Resource[] = [];
    for (let i = 0; i < count; ++i) {
        res.push(new Resource(location, resourceType));
    }
    return res;
};

const workerLocation = (player: Player) => game.unitLocation(player, Worker.WORKER_1);

const addResourcesForPlayer = (player: Player, resourceType: ResourceType, count: number) => {
    game.log.add(new GainResourceEvent(player.playerId, resources(workerLocation(player), resourceType, count)));
};

const mockResourcesAndCoinsForPlayer = (player: Player) => {
    const location = workerLocation(player);
    game.log
        .add(new GainResourceEvent(player.playerId, resources(location, ResourceType.METAL)))
        .add(new GainResourceEvent(player.playerId, resources(location, ResourceType.WOOD)))
        .add(new GainResourceEvent(player.playerId, resources(location, ResourceType.OIL)))
        .add(new GainResourceEvent(player.playerId, resources(location, ResourceType.FOOD)))
        .add(new CoinEvent(player.playerId, 10));
};
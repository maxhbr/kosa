import {Unit} from "./Unit";

export class UnitNotDeployedError extends Error {
    constructor(unit: Unit) {
        super(`${unit.name} has not been deployed yet.`);
    }
}

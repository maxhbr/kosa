import {Building} from "../Building";
import {Field} from "../Field";
import {Event} from "./Event";

export class BuildEvent implements Event {
    constructor(public readonly location: Field, public readonly building: Building) {}
}
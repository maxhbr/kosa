"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Field_1 = require("../src/Field");
const GameMap_1 = require("../src/GameMap");
test("Factory is connected to three non-lake fields", () => {
    expect(GameMap_1.GameMap.isReachable(Field_1.Field.F, Field_1.Field.w3)).toBeTruthy();
    expect(GameMap_1.GameMap.isReachable(Field_1.Field.F, Field_1.Field.t5)).toBeTruthy();
    expect(GameMap_1.GameMap.isReachable(Field_1.Field.F, Field_1.Field.m4)).toBeTruthy();
});
test("Cannot walk from t3 to v1 without river-walk", () => {
    expect(GameMap_1.GameMap.isReachable(Field_1.Field.t3, Field_1.Field.v1)).toBeFalsy();
});
test("Can walk from t3 to w3", () => {
    expect(GameMap_1.GameMap.isReachable(Field_1.Field.t3, Field_1.Field.w3)).toBeTruthy();
});
test("Cannot walk from t3 to l2", () => {
    expect(GameMap_1.GameMap.isReachable(Field_1.Field.t3, Field_1.Field.l2)).toBeFalsy();
});
test("Can walk from green to t2 with distance 2", () => {
    expect(GameMap_1.GameMap.isReachable(Field_1.Field.green, Field_1.Field.t2, 2)).toBeTruthy();
});

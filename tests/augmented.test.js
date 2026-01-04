const Q = require("../q");

describe("Q mutation killers", () => {
    describe("Sample 1: inspect reports pending before resolution", () => {
        test("deferred.inspect returns pending instead of throwing", () => {
            /**
             * Sample 1
             * q.js:588:13
             * -           if (!resolvedPromise) {
             * +           if (resolvedPromise) {
             */
            const deferred = Q.defer();
            expect(deferred.promise.inspect()).toEqual({ state: "pending" });
        });
    });

});
const Q = require("../q");

describe("Q mutation killers", () => {

    describe("Sample 2: long stack traces walk promise chain", () => {
        test("stack includes previous event separator when enabled", async () => {
            /**
             * Sample 2
             * q.js:388:31
             * -           for (var p = promise; !!p; p = p.source) {
             * +           for (var p = promise; false; p = p.source) {
             */
            const previousLongStack = Q.longStackSupport;
            Q.longStackSupport = true;
            let captured;

            try {
                captured = await Q.delay(0)
                    .then(function first() {
                        return Q.delay(0).then(function second() {
                            throw new Error("boom");
                        });
                    })
                    .then(
                        null,
                        function (error) {
                            return error;
                        }
                    );
            } finally {
                Q.longStackSupport = previousLongStack;
            }

            expect(captured).toBeInstanceOf(Error);
            expect(captured.stack).toEqual(
                expect.stringContaining("From previous event:")
            );
        });
    });

});
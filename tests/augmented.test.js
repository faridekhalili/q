const Q = require("../q");

describe("Q mutation killers", () => {

    describe("Sample 10: custom inspect is preserved", () => {
        test("Promise respects provided inspect implementation", () => {
            /**
             * Sample 10
             * q.js:796:9
             * -       if (inspect === void 0) {
             * +       if (inspect !== void 0) {
             */
            const inspect = jest.fn(() => ({ state: "custom" }));
            const promise = Q.makePromise(
                {
                    when: function () {
                        return void 0;
                    }
                },
                void 0,
                inspect
            );

            expect(promise.inspect()).toEqual({ state: "custom" });
            expect(inspect).toHaveBeenCalled();
        });
    });
    
});
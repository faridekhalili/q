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

    describe("Sample 4: MessageChannel scheduling branch is used", () => {
        test("falls back to MessageChannel when process/setImmediate are absent", async () => {
            /**
             * Sample 4
             * q.js:210:16
             * -       } else if (typeof MessageChannel !== "undefined") {
             * +       } else if (false) {
             */
            const realProcess = global.process;
            const realSetImmediate = global.setImmediate;
            const realSetTimeout = global.setTimeout;
            const realMessageChannel = global.MessageChannel;
            const qPath = require.resolve("../q");
            const { MessageChannel: RealMessageChannel } = require("worker_threads");
            const setTimeoutMock = jest.fn((fn, ms) => realSetTimeout(fn, ms));
            let QMessage;
            let lastChannel = null;
            let postMessageCalls = 0;

            // Simulate non-Node environment so MessageChannel branch is chosen
            global.process = undefined;
            global.setImmediate = undefined;
            global.MessageChannel = function WrappedChannel() {
                lastChannel = new RealMessageChannel();
                this.port1 = lastChannel.port1;
                const realPost = lastChannel.port2.postMessage.bind(lastChannel.port2);
                this.port2 = lastChannel.port2;
                this.port2.postMessage = function (msg) {
                    postMessageCalls++;
                    return realPost(msg);
                };
            };
            global.setTimeout = setTimeoutMock;

            try {
                delete require.cache[qPath];
                await new Promise((resolve, reject) => {
                    jest.isolateModules(() => {
                        QMessage = require("../q");
                    });

                    QMessage.nextTick(() => {});
                    QMessage.nextTick(() => {});

                    realSetTimeout(() => {
                        try {
                            expect(postMessageCalls).toBeGreaterThan(0);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }, 20);
                });
            } finally {
                delete require.cache[qPath];
                global.process = realProcess;
                global.setImmediate = realSetImmediate;
                global.setTimeout = realSetTimeout;
                global.MessageChannel = realMessageChannel;
                if (lastChannel) {
                    lastChannel.port1.close();
                    lastChannel.port2.close();
                    lastChannel = null;
                }
            }
        });
    });

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

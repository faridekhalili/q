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

    describe("Sample 3: unhandled rejection emits process event", () => {
        test("emits process 'unhandledRejection' with reason and promise", async () => {
            /**
             * Sample 3
             * q.js:1100:44
             * -           if (typeof process === "object" && typeof process.emit === "function") {
             * +           if (typeof process === "object" && typeof process.emit !== "function") {
             */
            Q.resetUnhandledRejections();
            const reason = new Error("boom");
            const promise = Q.reject(reason);
            const emitSpy = jest.spyOn(process, "emit");

            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error("process.emit was not invoked"));
                }, 50);

                setImmediate(() => {
                    try {
                        expect(emitSpy).toHaveBeenCalledWith(
                            "unhandledRejection",
                            reason,
                            promise
                        );
                        resolve();
                    } catch (error) {
                        reject(error);
                    } finally {
                        clearTimeout(timer);
                    }
                });
            }).finally(() => {
                emitSpy.mockRestore();
            });

            Q.resetUnhandledRejections();
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

    describe("Sample 7: Q.all waits for pending promises", () => {
        test("does not resolve until all pending promises settle", async () => {
            /**
             * Sample 7
             * q.js:1592:20
             * -               } else {
             * -                   ++pendingCount;
             * -                   when(
             * -                       promise,
             * -                       function (value) {
             * -                           promises[index] = value;
             * -                           if (--pendingCount === 0) {
             * -                               deferred.resolve(promises);
             * -                           }
             * -                       },
             * -                       deferred.reject,
             * -                       function (progress) {
             * -                           deferred.notify({ index: index, value: progress });
             * -                       }
             * -                   );
             * -               }
             * +               } else {}
             */
            const deferred = Q.defer();
            const resultsPromise = Q.all([Q(1), deferred.promise]);
            let resolved = false;

            resultsPromise.then(() => {
                resolved = true;
            });

            await Promise.resolve();
            expect(resolved).toBe(false);

            deferred.resolve(2);
            await expect(resultsPromise).resolves.toEqual([1, 2]);
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

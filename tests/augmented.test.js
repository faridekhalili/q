const Q = require("../q");

describe("Q mutation killers", () => {

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

});
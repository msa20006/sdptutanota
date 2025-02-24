import { isMailAddress } from "../misc/FormatValidator";
import { log } from "./DesktopLog";
const SOCKET_PATH = "/tmp/tutadb.sock";
/**
 * this is used to control our administration tool
 */
export class Socketeer {
    _server = null;
    _connection = null;
    _delayHandler;
    _net;
    constructor(net, app, delayHandler = setTimeout) {
        this._net = net;
        this._delayHandler = delayHandler;
        app.on("will-quit", () => {
            if (this._server || this._connection) {
                if (this._connection) {
                    this._connection.end();
                }
                if (this._server) {
                    this._server.close();
                }
            }
        });
    }
    attach(wm) {
        this.startClient(async (msg) => {
            const mailAddress = JSON.parse(msg);
            if (typeof mailAddress === "string" && isMailAddress(mailAddress, false)) {
                const targetWindow = await wm.getLastFocused(false);
                targetWindow.desktopFacade.openCustomer(mailAddress);
            }
        });
    }
    startServer() {
        log.debug("opening admin socket");
        if (this._server) {
            return;
        }
        const server = (this._server = this._net
            .createServer((c) => {
            log.debug("got connection");
            this._connection = c;
            c.on("data", () => {
                console.warn("Data was pushed through admin socket, aborting connection");
                c.destroy();
            }).on("end", () => {
                this._connection = null;
            });
        })
            .on("listening", () => {
            log.debug("Socketeer: server is listening");
        })
            .on("error", (e) => {
            log.warn("Socketeer: server error", e);
            // @ts-ignore Should be name or message instead?
            if (e.code === "EADDRINUSE") {
                this._delayHandler(() => {
                    try {
                        server.close();
                        server.listen(SOCKET_PATH);
                    }
                    catch (e) {
                        log.error("Socketeer: restart error: ", e);
                    }
                }, 1000);
            }
        })
            .on("close", () => {
            log.debug("Socketeer: server is closed");
            this._server = null;
        }));
        this._server.listen(SOCKET_PATH);
    }
    sendSocketMessage(msg) {
        if (this._connection) {
            this._connection.write(JSON.stringify(msg), "utf8");
        }
    }
    startClient(ondata) {
        if (this._connection) {
            return;
        }
        this._connection = this._net
            .createConnection(SOCKET_PATH)
            .on("connect", () => {
            log.debug("socket connected");
        })
            .on("close", (hadError) => {
            if (hadError) {
                this._tryReconnect(ondata);
            }
        })
            .on("end", () => {
            log.debug("socket disconnected");
            this._tryReconnect(ondata);
        })
            .on("error", (e) => {
            // @ts-ignore Should be name or message instead?
            if (e.code !== "ENOENT") {
                console.error("Unexpected Socket Error:", e);
            }
        })
            .on("data", ondata);
    }
    _tryReconnect(ondata) {
        this._connection = null;
        this._delayHandler(() => {
            this.startClient(ondata);
        }, 1000);
    }
}
//# sourceMappingURL=Socketeer.js.map
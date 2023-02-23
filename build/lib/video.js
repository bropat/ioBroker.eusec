"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ffmpegRTMPToHls = exports.ffmpegStreamToHls = exports.ffmpegPreviewImage = exports.StreamOutput = exports.StreamInput = void 0;
const net_1 = __importDefault(require("net"));
const path_1 = __importDefault(require("path"));
const fluent_ffmpeg_1 = __importDefault(require("@bropat/fluent-ffmpeg"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const eufy_security_client_1 = require("eufy-security-client");
const os_1 = require("os");
const fs_extra_1 = __importDefault(require("fs-extra"));
const utils_1 = require("./utils");
class UniversalStream {
    constructor(namespace, onSocket) {
        let sockpath = "";
        const unique_sock_id = (0, utils_1.lowestUnusedNumber)([...UniversalStream.socks], 1);
        UniversalStream.socks.add(unique_sock_id);
        this.sock_id = unique_sock_id;
        if (process.platform === "win32") {
            const pipePrefix = "\\\\.\\pipe\\";
            const pipeName = `node-webrtc.${namespace}.${unique_sock_id}.sock`;
            sockpath = path_1.default.join(pipePrefix, pipeName);
            this.url = sockpath;
        }
        else {
            const pipeName = `${namespace}.${unique_sock_id}.sock`;
            sockpath = path_1.default.join((0, os_1.tmpdir)(), pipeName);
            this.url = "unix:" + sockpath;
            try {
                if (fs_extra_1.default.existsSync(sockpath))
                    fs_extra_1.default.unlinkSync(sockpath);
            }
            catch (error) {
            }
        }
        this.server = net_1.default.createServer(onSocket);
        this.server.listen(sockpath);
    }
    close() {
        if (this.server)
            this.server.close();
        UniversalStream.socks.delete(this.sock_id);
    }
}
UniversalStream.socks = new Set();
const StreamInput = function (namespace, stream) {
    return new UniversalStream(namespace, (socket) => stream.pipe(socket, { end: true }));
};
exports.StreamInput = StreamInput;
const StreamOutput = function (namespace, stream) {
    return new UniversalStream(namespace, (socket) => socket.pipe(stream, { end: true }));
};
exports.StreamOutput = StreamOutput;
const ffmpegPreviewImage = (config, input, output, log, skip_seconds = 2.0) => {
    return new Promise((resolve, reject) => {
        try {
            if (ffmpeg_static_1.default) {
                fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
                (0, fluent_ffmpeg_1.default)()
                    .withProcessOptions({
                    detached: true
                })
                    .addOptions([
                    `-ss ${skip_seconds}`,
                    "-frames:v 1"
                ])
                    .input(input)
                    .inputFormat("hls")
                    .outputFormat("image2")
                    .output(output)
                    .on("error", function (err, stdout, stderr) {
                    log.error(`ffmpegPreviewImage(): An error occurred: ${err.message}`);
                    log.error(`ffmpegPreviewImage(): ffmpeg output:\n${stdout}`);
                    log.error(`ffmpegPreviewImage(): ffmpeg stderr:\n${stderr}`);
                    reject(err);
                })
                    .on("end", () => {
                    log.debug("ffmpegPreviewImage(): Preview image generated!");
                    resolve();
                })
                    .run();
            }
            else {
                reject(new Error("ffmpeg binary not found"));
            }
        }
        catch (error) {
            log.error(`ffmpegPreviewImage(): Error: ${error}`);
            reject(error);
        }
    });
};
exports.ffmpegPreviewImage = ffmpegPreviewImage;
const ffmpegStreamToHls = (config, namespace, metadata, videoStream, audioStream, output, log) => {
    return new Promise((resolve, reject) => {
        try {
            if (ffmpeg_static_1.default) {
                fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
                videoStream.on("error", (error) => {
                    log.error("ffmpegStreamToHls(): Videostream Error", error);
                });
                audioStream.on("error", (error) => {
                    log.error("ffmpegStreamToHls(): Audiostream Error", error);
                });
                //TODO: For debugging purposes
                /*const outputFile = path.resolve(__dirname, "../../test-stream.dump");
                videoStream.pipe(fse.createWriteStream(outputFile)).on("finish", () => {
                    log.debug("videoStream dump finished!");
                    log.info("Manually test the output by running# ffplay output/test-stream.dump");
                });*/
                const uVideoStream = (0, exports.StreamInput)(namespace, videoStream);
                const uAudioStream = (0, exports.StreamInput)(namespace, audioStream);
                let videoFormat = "h264";
                let audioFormat = "";
                const options = [
                    "-hls_init_time 0",
                    "-hls_time 2",
                    "-hls_segment_type mpegts",
                    //"-start_number 1",
                    "-sc_threshold 0",
                    `-g ${metadata.videoFPS}`,
                    "-fflags genpts+nobuffer+flush_packets",
                    //"-flush_packets 1",
                    "-hls_playlist_type event"
                    //"-hls_flags split_by_time"
                ];
                switch (metadata.videoCodec) {
                    case eufy_security_client_1.VideoCodec.H264:
                        videoFormat = "h264";
                        break;
                    case eufy_security_client_1.VideoCodec.H265:
                        videoFormat = "hevc";
                        break;
                }
                switch (metadata.audioCodec) {
                    case eufy_security_client_1.AudioCodec.AAC:
                        audioFormat = "aac";
                        break;
                }
                const command = (0, fluent_ffmpeg_1.default)()
                    .withProcessOptions({
                    detached: true
                })
                    .input(uVideoStream.url)
                    .inputFormat(videoFormat)
                    .inputFps(metadata.videoFPS);
                if (audioFormat !== "") {
                    command.input(uAudioStream.url)
                        .inputFormat(audioFormat)
                        .videoCodec("copy")
                        .audioCodec("copy");
                    options.push("-absf aac_adtstoasc");
                }
                else {
                    log.warn(`ffmpegStreamToHls(): Not support audio codec or unknown audio codec (${eufy_security_client_1.AudioCodec[metadata.audioCodec]})`);
                }
                command.output(output)
                    .addOptions(options)
                    .on("error", function (err, stdout, stderr) {
                    log.error(`ffmpegStreamToHls(): An error occurred: ${err.message}`);
                    log.error(`ffmpegStreamToHls(): ffmpeg output:\n${stdout}`);
                    log.error(`ffmpegStreamToHls(): ffmpeg stderr:\n${stderr}`);
                    uVideoStream.close();
                    uAudioStream.close();
                    reject(err);
                })
                    .on("end", () => {
                    log.debug("ffmpegStreamToHls(): Processing finished!");
                    uVideoStream.close();
                    uAudioStream.close();
                    resolve();
                });
                command.run();
            }
            else {
                reject(new Error("ffmpeg binary not found"));
            }
        }
        catch (error) {
            log.error(`ffmpegStreamToHls(): Error: ${error}`);
            reject(error);
        }
    });
};
exports.ffmpegStreamToHls = ffmpegStreamToHls;
const ffmpegRTMPToHls = (config, rtmp_url, output, log) => {
    let resolveCb;
    let ffmpegCommand;
    const rtmpPromise = new Promise((resolve, reject) => {
        resolveCb = resolve;
        try {
            if (ffmpeg_static_1.default) {
                fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
                ffmpegCommand = (0, fluent_ffmpeg_1.default)(rtmp_url)
                    .withProcessOptions({
                    detached: true
                })
                    .videoCodec("copy")
                    .audioCodec("copy")
                    .output(output)
                    .addOptions([
                    "-hls_init_time 0",
                    "-hls_time 2",
                    "-hls_segment_type mpegts",
                    "-absf aac_adtstoasc",
                    //"-start_number 1",
                    "-sc_threshold 0",
                    "-g 15",
                    "-fflags genpts+nobuffer+flush_packets",
                    //"-flush_packets 1",
                    "-hls_playlist_type event"
                ])
                    .on("error", function (err, stdout, stderr) {
                    log.error(`ffmpegRTMPToHls(): An error occurred: ${err.message}`);
                    log.error(`ffmpegRTMPToHls(): ffmpeg output:\n${stdout}`);
                    log.error(`ffmpegRTMPToHls(): ffmpeg stderr:\n${stderr}`);
                    reject(err);
                })
                    .on("end", () => {
                    log.debug("ffmpegRTMPToHls(): Processing finished!");
                    resolve();
                });
                ffmpegCommand.run();
            }
            else {
                reject(new Error("ffmpeg binary not found"));
            }
        }
        catch (error) {
            log.error(`ffmpegRTMPToHls(): Error: ${error}`);
            reject(error);
        }
    });
    rtmpPromise.stop = () => {
        ffmpegCommand.removeAllListeners();
        //ffmpegCommand.kill("SIGINT");
        ffmpegCommand.quit();
        resolveCb();
    };
    return rtmpPromise;
};
exports.ffmpegRTMPToHls = ffmpegRTMPToHls;
//# sourceMappingURL=video.js.map
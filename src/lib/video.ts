import net from "net";
import path from "path";
import ffmpeg from "@bropat/fluent-ffmpeg";
import pathToFfmpeg from "ffmpeg-static";
import { Readable } from "stream";
import { StreamMetadata, AudioCodec, VideoCodec } from "eufy-security-client";
import { tmpdir } from "os";
import fse from "fs-extra";

import { ioBrokerLogger } from "./log";
import { lowestUnusedNumber } from "./utils";
import { StoppablePromise } from "./types";

class UniversalStream {

    public url: string;
    private static socks = new Set<number>();
    private server: net.Server;
    private sock_id: number;

    constructor (namespace: string, onSocket: ((socket: net.Socket) => void) | undefined) {
        let sockpath = "";

        const unique_sock_id = lowestUnusedNumber([...UniversalStream.socks], 1);
        UniversalStream.socks.add(unique_sock_id);
        this.sock_id = unique_sock_id;

        if (process.platform === "win32") {
            const pipePrefix = "\\\\.\\pipe\\";
            const pipeName = `node-webrtc.${namespace}.${unique_sock_id}.sock`;

            sockpath = path.join(pipePrefix, pipeName);
            this.url = sockpath;
        }
        else {
            const pipeName = `${namespace}.${unique_sock_id}.sock`;
            sockpath = path.join(tmpdir(), pipeName);
            this.url = "unix:" + sockpath;

            try {
                if (fse.existsSync(sockpath))
                    fse.unlinkSync(sockpath);
            } catch(error) {
            }
        }

        this.server = net.createServer(onSocket);
        this.server.listen(sockpath);
    }

    public close(): void {
        if (this.server)
            this.server.close();
        UniversalStream.socks.delete(this.sock_id);
    }

}

export const StreamInput = function(namespace: string, stream: NodeJS.ReadableStream): UniversalStream {
    return new UniversalStream(namespace, (socket: net.Socket) => stream.pipe(socket, { end: true }))
}

export const StreamOutput = function(namespace: string, stream: NodeJS.WritableStream): UniversalStream {
    return new UniversalStream(namespace, (socket: net.Socket) => socket.pipe(stream, { end: true }))
}

export const ffmpegPreviewImage = (config: ioBroker.AdapterConfig, input:string, output: string, log: ioBrokerLogger, skip_seconds = 2.0): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            if (pathToFfmpeg) {
                ffmpeg.setFfmpegPath(pathToFfmpeg);

                ffmpeg()
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
                    .on("error", function(err, stdout, stderr) {
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
            } else {
                reject(new Error("ffmpeg binary not found"));
            }
        } catch (error) {
            log.error(`ffmpegPreviewImage(): Error: ${error}`);
            reject(error);
        }
    });
}

export const ffmpegStreamToHls = (config: ioBroker.AdapterConfig, namespace: string, metadata: StreamMetadata, videoStream: Readable, audioStream: Readable, output: string, log: ioBrokerLogger): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            if (pathToFfmpeg) {
                ffmpeg.setFfmpegPath(pathToFfmpeg);

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

                const uVideoStream = StreamInput(namespace, videoStream);
                const uAudioStream = StreamInput(namespace, audioStream);

                let videoFormat = "h264";
                let audioFormat = "";
                const options: string[] = [
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

                switch(metadata.videoCodec) {
                    case VideoCodec.H264:
                        videoFormat = "h264";
                        break;
                    case VideoCodec.H265:
                        videoFormat = "hevc";
                        break;
                }

                switch(metadata.audioCodec) {
                    case AudioCodec.AAC:
                        audioFormat = "aac";
                        break;
                }

                const command = ffmpeg()
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
                } else {
                    log.warn(`ffmpegStreamToHls(): Not support audio codec or unknown audio codec (${AudioCodec[metadata.audioCodec]})`);
                }
                command.output(output)
                    .addOptions(options)
                    .on("error", function(err, stdout, stderr) {
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
            } else {
                reject(new Error("ffmpeg binary not found"));
            }
        } catch (error) {
            log.error(`ffmpegStreamToHls(): Error: ${error}`);
            reject(error);
        }
    });
}

export const ffmpegRTMPToHls = (config: ioBroker.AdapterConfig, rtmp_url: string, output: string, log: ioBrokerLogger): StoppablePromise => {
    let resolveCb: () => void;
    let ffmpegCommand: ffmpeg.FfmpegCommand;

    const rtmpPromise = new Promise((resolve, reject) => {
        resolveCb = resolve;
        try {
            if (pathToFfmpeg) {
                ffmpeg.setFfmpegPath(pathToFfmpeg);

                ffmpegCommand = ffmpeg(rtmp_url)
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
                    .on("error", function(err, stdout, stderr) {
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
            } else {
                reject(new Error("ffmpeg binary not found"));
            }
        } catch (error) {
            log.error(`ffmpegRTMPToHls(): Error: ${error}`);
            reject(error);
        }
    }) as StoppablePromise;

    rtmpPromise.stop = () => {
        ffmpegCommand.removeAllListeners();
        //ffmpegCommand.kill("SIGINT");
        ffmpegCommand.quit();
        resolveCb();
    };

    return rtmpPromise;
}
import net from "net";
import path from "path";
import ffmpeg from "@bropat/fluent-ffmpeg";
import pathToFfmpeg from "ffmpeg-for-homebridge";
import { Readable } from "stream";
import { StreamMetadata, AudioCodec, VideoCodec } from "eufy-security-client";
import { tmpdir } from "os";
import fse from "fs-extra";

import stream from "node:stream";
import {pipeline as streamPipeline} from "node:stream/promises";

import { ioBrokerLogger } from "./log";
import { getShortUrl, lowestUnusedNumber } from "./utils";

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
        this.server.on("error", () => {});
    }

    public close(): void {
        if (this.server)
            this.server.close();
        UniversalStream.socks.delete(this.sock_id);
    }

}

export const StreamInput = function(namespace: string, stream: NodeJS.ReadableStream): UniversalStream {
    return new UniversalStream(namespace, (socket: net.Socket) => stream.pipe(socket, { end: true }).on("error", (_error) => {
        //TODO: log error
    }));
}

export const StreamOutput = function(namespace: string, stream: NodeJS.WritableStream): UniversalStream {
    return new UniversalStream(namespace, (socket: net.Socket) => socket.pipe(stream, { end: true }).on("error", (_error) => {
        //TODO: log error
    }));
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

export const ffmpegStreamToGo2rtc = (config: ioBroker.AdapterConfig, namespace: string, camera: string, metadata: StreamMetadata, videoStream: Readable, audioStream: Readable, log: ioBrokerLogger): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            if (pathToFfmpeg) {
                ffmpeg.setFfmpegPath(pathToFfmpeg);

                videoStream.on("error", (error) => {
                    log.error("ffmpegStreamToGo2rtc(): Videostream Error", error);
                });

                audioStream.on("error", (error) => {
                    log.error("ffmpegStreamToGo2rtc(): Audiostream Error", error);
                });

                //TODO: For debugging purposes
                /*const outputVFile = path.resolve(__dirname, "../../video-stream.dump");
                videoStream.pipe(fse.createWriteStream(outputVFile)).on("finish", () => {
                    log.debug("videoStream dump finished!");
                    log.info("Manually test the output by running# ffplay output/video-stream.dump");
                });
                const outputAFile = path.resolve(__dirname, "../../audio-stream.dump");
                audioStream.pipe(fse.createWriteStream(outputAFile)).on("finish", () => {
                    log.debug("audioStream dump finished!");
                    log.info("Manually test the output by running# ffplay output/audio-stream.dump");
                });*/

                const uVideoStream = StreamInput(namespace, videoStream);
                const uAudioStream = StreamInput(namespace, audioStream);

                let videoFormat = "h264";
                let audioFormat = "";
                const options: string[] = [
                    "-rtsp_transport tcp",
                    "-sc_threshold 0",
                    "-fflags genpts+nobuffer+flush_packets",
                    //"-rtpflags latm",
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
                    .inputFormat(videoFormat);
                if (metadata.videoFPS > 0 ) {
                    options.push(`-g ${metadata.videoFPS}`);
                    command.inputFps(metadata.videoFPS);
                }
                command.videoCodec("copy");
                if (audioFormat !== "") {
                    command.input(uAudioStream.url)
                        .inputFormat(audioFormat)
                        //.audioCodec("copy");
                        //.audioCodec("aac");
                        .audioCodec("opus");
                } else {
                    log.warn(`ffmpegStreamToGo2rtc(): Not support audio codec or unknown audio codec (${AudioCodec[metadata.audioCodec]})`);
                }
                command.output(`rtsp://localhost:${config.go2rtc_rtsp_port}/${camera}`)
                    .outputFormat("rtsp")
                    .addOptions(options)
                    .on("start", (commandline) => {
                        log.debug(`ffmpegStreamToGo2rtc(): commandline: ${commandline}`);
                    })
                    .on("error", function(err, stdout, stderr) {
                        log.error(`ffmpegStreamToGo2rtc(): An error occurred: ${err.message}`);
                        log.error(`ffmpegStreamToGo2rtc(): ffmpeg output:\n${stdout}`);
                        log.error(`ffmpegStreamToGo2rtc(): ffmpeg stderr:\n${stderr}`);
                        uVideoStream.close();
                        uAudioStream.close();
                        reject(err);
                    })
                    .on("end", () => {
                        log.debug("ffmpegStreamToGo2rtc(): Processing finished!");
                        uVideoStream.close();
                        uAudioStream.close();
                        resolve();
                    });
                command.run();
            } else {
                reject(new Error("ffmpeg binary not found"));
            }
        } catch (error) {
            log.error(`ffmpegStreamToGo2rtc(): Error: ${error}`);
            reject(error);
        }
    });
}

export const streamToGo2rtc = async (camera: string, videoStream: Readable, audioStream: Readable, log: ioBrokerLogger, config: ioBroker.AdapterConfig, namespace: string, metadata: StreamMetadata): Promise<Array<PromiseSettledResult<void>>> => {
    const { default: got } = await import("got");
    const api = got.extend({
        hooks: {
            beforeError: [
                error => {
                    const { response, options } = error;
                    const { method, url, prefixUrl } = options;
                    const shortUrl = getShortUrl(typeof url === "string" ? new URL(url) : url === undefined ? new URL("") : url, typeof prefixUrl === "string" ? prefixUrl : prefixUrl.toString());
                    const body = response?.body ? response.body : error.message;
                    error.message = `${error.message} | method: ${method} url: ${shortUrl}`;
                    if (response?.body) {
                        error.message = `${error.message} body: ${body}`;
                    }
                    return error;
                }
            ],
        }
    });
    videoStream.on("error", (error) => {
        log.error("streamToGo2rtc(): Videostream Error", error);
    });

    audioStream.on("error", (error) => {
        log.error("streamToGo2rtc(): Audiostream Error", error);
    });
    return Promise.allSettled([
        streamPipeline(
            videoStream,
            api.stream.post(`http://localhost:1984/api/stream?dst=${camera}`).on("error", (error: any) => {
                if (!(error.response?.body as string)?.startsWith("EOF")) {
                    log.error(`streamToGo2rtc(): Got Videostream Error: ${error.message}`);
                }
            }),
            new stream.PassThrough()
        ),
        //TODO: Tested with go2rtc 1.8.5 but not working - no audio; When the error in go2rtc is fixed, reactivate this part and remove the ffmpeg part
        /*streamPipeline(
            audioStream,
            api.stream.post(`http://localhost:1984/api/stream?dst=${camera}`).on("error", (error: any) => {
                if (!(error.response?.body as string)?.startsWith("EOF")) {
                    log.error(`streamToGo2rtc(): Got Audiostream Error: ${error.message}`);
                }
            }),
            new stream.PassThrough()
        )*/
        new Promise<void>((resolve, reject) => {
            try {
                if (pathToFfmpeg) {
                    ffmpeg.setFfmpegPath(pathToFfmpeg);

                    const uAudioStream = StreamInput(namespace, audioStream);

                    let audioFormat = "";
                    const options: string[] = [
                        "-rtsp_transport tcp",
                        "-fflags genpts+nobuffer+flush_packets",
                        //"-rtpflags latm",
                        //"-compression_level 5",
                        "-application lowdelay",
                    ];

                    switch(metadata.audioCodec) {
                        case AudioCodec.AAC:
                            audioFormat = "aac";
                            break;
                    }

                    const command = ffmpeg()
                        .withProcessOptions({
                            detached: true
                        });

                    if (audioFormat !== "") {
                        command.input(uAudioStream.url)
                            .inputFormat(audioFormat)
                            .audioCodec("opus");
                    } else {
                        log.warn(`streamToGo2rtc(): ffmpeg - Not support audio codec or unknown audio codec (${AudioCodec[metadata.audioCodec]})`);
                    }
                    command.output(`rtsp://localhost:${config.go2rtc_rtsp_port}/${camera}`)
                        .outputFormat("rtsp")
                        .addOptions(options)
                        .on("start", (commandline) => {
                            log.debug(`streamToGo2rtc(): ffmpeg - commandline: ${commandline}`);
                        })
                        .on("error", function(err, stdout, stderr) {
                            log.error(`streamToGo2rtc(): ffmpeg - An error occurred: ${err.message}`);
                            log.error(`streamToGo2rtc(): ffmpeg output:\n${stdout}`);
                            log.error(`streamToGo2rtc(): ffmpeg stderr:\n${stderr}`);
                            uAudioStream.close();
                            reject(err);
                        })
                        .on("end", (stdout, stderr) => {
                            log.debug(`streamToGo2rtc(): ffmpeg output:\n${stdout}`);
                            log.debug(`streamToGo2rtc(): ffmpeg stderr:\n${stderr}`);
                            log.debug("streamToGo2rtc(): Processing finished!");
                            uAudioStream.close();
                            resolve();
                        });
                    command.run();
                } else {
                    reject(new Error("ffmpeg binary not found"));
                }
            } catch (error) {
                log.error(`streamToGo2rtc(): Audio Error: ${error}`);
                reject(error);
            }
        })
    ]);
}
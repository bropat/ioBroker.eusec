import net from "net";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import pathToFfmpeg from "ffmpeg-static";
import { Readable } from "stream";
import { StreamMetadata, AudioCodec, VideoCodec } from "eufy-security-client";
import { tmpdir } from "os";
import fse from "fs-extra";

import { ioBrokerLogger } from "./log";
import { lowestUnusedNumber } from "./utils";

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
            sockpath = `${tmpdir()}${path.sep}${namespace}.${(unique_sock_id)}.sock`;
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

export const ffmpegPreviewImage = (input:string, output: string, log: ioBrokerLogger): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            ffmpeg.setFfmpegPath(pathToFfmpeg);

            ffmpeg()
                .addOptions([
                    "-ss 2.0",
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
        } catch (error) {
            log.error(`ffmpegPreviewImage(): Error: ${error}`);
            reject(error);
        }
    });
}

export const ffmpegStreamToHls = (namespace: string, metadata: StreamMetadata, videoStream: Readable, audioStream: Readable, output: string, log: ioBrokerLogger): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            ffmpeg.setFfmpegPath(pathToFfmpeg);

            const uVideoStream = StreamInput(namespace, videoStream);
            const uAudioStream = StreamInput(namespace, audioStream);

            let videoFormat = "h264";
            let audioFormat = "aac";
            const options: string[] = [
                "-strict -2",
                "-crf 21",
                "-pix_fmt yuv420p",
                "-hls_time 4",
                "-start_number 1",
                "-sc_threshold 0",
                `-g ${metadata.videoFPS}`,
                "-preset veryfast",
                //"-hls_flags single_file",
                "-hls_playlist_type event",
                //"-hls_segment_filename stream_%v/data%06d.ts",
                //"-use_localtime_mkdir 1"
            ];

            switch(metadata.videoCodec) {
                case VideoCodec.H264:
                    videoFormat = "h264";
                    options.push("-profile:v baseline");
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

            ffmpeg()
                .input(uVideoStream.url)
                .inputFormat(videoFormat)
                .inputFps(metadata.videoFPS)
                .input(uAudioStream.url)
                .inputFormat(audioFormat)
                .output(output)
                .size(`${metadata.videoWidth}x${metadata.videoHeight}`)
                .addOptions(options)
                .on("error", function(err, stdout, stderr) {
                    log.error(`ffmpegStreamToHls(): An error occurred: ${err.message}`);
                    log.error(`ffmpegStreamToHls(): ffmpeg output:\n${stdout}`);
                    log.error(`ffmpegStreamToHls(): ffmpeg stderr:\n${stderr}`);
                    reject(err);
                })
                .on("end", () => {
                    log.debug("ffmpegStreamToHls(): Processing finished!");
                    uVideoStream.close();
                    uAudioStream.close();
                    resolve();
                })
                .run();
        } catch (error) {
            log.error(`ffmpegStreamToHls(): Error: ${error}`);
            reject(error);
        }
    });
}

export const ffmpegRTMPToHls = (rtmp_url: string, output: string, log: ioBrokerLogger): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            ffmpeg.setFfmpegPath(pathToFfmpeg);

            ffmpeg(rtmp_url, { timeout: 30 })
                .addOptions([
                    "-c:v libx264",
                    "-c:a aac",
                    "-profile:v baseline",
                    "-strict -2",
                    "-crf 21",
                    "-pix_fmt yuv420p",
                    "-hls_time 4",
                    "-start_number 1",
                    "-sc_threshold 0",
                    "-g 15",
                    "-preset veryfast",
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
                })
                .run();
        } catch (error) {
            log.error(`ffmpegRTMPToHls(): Error: ${error}`);
            reject(error);
        }
    });
}
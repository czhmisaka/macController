/*
 * @Date: 2025-05-10 14:06:43
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-10 16:20:48
 * @FilePath: /指令控制电脑/server-control/src/video-utils.ts
 */
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { PassThrough } from 'stream';
import { getDisplayScaling } from './screen-utils';
import systeminformation from 'systeminformation';
import { execSync } from 'child_process';

// 设置ffmpeg路径
if (!ffmpegStatic) throw new Error('ffmpeg-static not found');
console.log('ffmpegStatic', ffmpegStatic)
ffmpeg.setFfmpegPath(ffmpegStatic as string);

interface VideoStreamOptions {
    fps?: number;
    quality?: number;
    resolution?: string;
}

interface AVFoundationDevice {
    index: string;
    name: string;
    type: 'video' | 'audio';
}

export class VideoStreamer {
    private command: ffmpeg.FfmpegCommand | null = null;
    private outputStream: PassThrough;
    private isStreaming: boolean = false;
    private options: Required<VideoStreamOptions>;

    private async listAVFoundationDevices(): Promise<AVFoundationDevice[]> {
        try {
            const output = execSync(`${ffmpegStatic as string} -f avfoundation -list_devices true -i "" -hide_banner 2>&1 || true`).toString();
            const lines = output.split('\n');
            const devices: AVFoundationDevice[] = [];
            let currentType: 'video' | 'audio' | null = null;

            for (const line of lines) {
                if (line.includes('AVFoundation video devices:')) {
                    currentType = 'video';
                } else if (line.includes('AVFoundation audio devices:')) {
                    currentType = 'audio';
                } else if (currentType && line.match(/\[.*\] \[(\d+)\] (.*)/)) {
                    const matches = line.match(/\[.*\] \[(\d+)\] (.*)/);
                    if (matches && matches[1] && matches[2]) {
                        devices.push({
                            index: matches[1],
                            name: matches[2].trim(),
                            type: currentType
                        });
                    }
                }
            }
            return devices;
        } catch (error) {
            throw new Error(`获取AVFoundation设备列表失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    constructor(options: VideoStreamOptions = {}) {
        this.outputStream = new PassThrough();
        this.options = {
            fps: options.fps ?? 30,
            quality: options.quality ?? 23, // CRF值，越小质量越高
            resolution: options.resolution ?? 'native'
        };
    }

    async startStream(): Promise<PassThrough> {
        if (this.isStreaming) {
            return this.outputStream;
        }

        // 检查avfoundation是否可用
        // try {
        //     const ffmpegVersion = execSync(`${ffmpegStatic as string} -version`).toString();
        //     if (!ffmpegVersion.includes('--enable-avfoundation')) {
        //         throw new Error('ffmpeg未编译avfoundation支持');
        //     }
        // } catch (error) {
        //     throw new Error(`ffmpeg检查失败: ${error instanceof Error ? error.message : String(error)}`);
        // }

        // 获取屏幕分辨率
        const displays = await systeminformation.graphics();
        const mainDisplay = displays.displays.find(d => d.main);
        if (!mainDisplay) throw new Error('未找到主显示器');

        const { resolutionX: width, resolutionY: height } = mainDisplay;
        const scaling = getDisplayScaling();

        // 计算逻辑分辨率
        if (!width || !height) {
            throw new Error('无法获取屏幕尺寸');
        }
        const logicalWidth = Math.floor(width / scaling.scaleX);
        const logicalHeight = Math.floor(height / scaling.scaleY);

        // 获取可用视频设备
        const devices = await this.listAVFoundationDevices();
        const videoDevices = devices.filter((d: AVFoundationDevice) => d.type === 'video');
        if (videoDevices.length === 0) {
            throw new Error('未找到可用的视频捕获设备');
        }

        // 检查是否有足够的视频设备
        if (videoDevices.length < 2) {
            throw new Error(`需要至少2个视频设备，当前找到${videoDevices.length}个`);
        }

        // 使用第二个视频设备(索引1)
        const device = videoDevices[1].index;
        let lastError: Error | null = null;
        console.log('所有视频设备:', videoDevices);
        console.log(`使用avfoundation视频设备: ${device} (${videoDevices[1].name})`);
        this.command = ffmpeg()
            .input(`${device}:none`)
            .inputFormat('avfoundation')
            .inputOptions([
                '-capture_cursor 1',
                '-capture_mouse_clicks 1',
                '-pix_fmt uyvy422',
                '-framerate 15',
                '-probesize 32',
                '-analyzeduration 0'
            ])
            .videoCodec('libx264')
            .outputOptions([
                '-preset ultrafast',
                '-tune zerolatency',
                `-crf ${this.options.quality}`,
                '-f h264',
                '-movflags frag_keyframe+empty_moov',
                '-g 30',  // 关键帧间隔
                '-bufsize 1000k',  // 缓冲区大小
                '-maxrate 1500k'   // 最大比特率
            ])
            .size(`${logicalWidth}x${logicalHeight}`)
            .fps(this.options.fps)
            .on('start', () => {
                console.log(`视频流已启动 (设备索引: ${device})`);
                this.isStreaming = true;
                if (this.command) {
                    console.log('FFmpeg命令:', this.command._getArguments().join(' '));
                } else {
                    console.error('FFmpeg命令未初始化');
                }
            })
            .on('error', (err: Error) => {
                console.error(`视频流错误 (设备索引: ${device}):`, err);
                console.error('FFmpeg stderr:', err.message);
                this.isStreaming = false;
                lastError = err;
            })
            .on('end', () => {
                console.log(`视频流已结束 (设备索引: ${device})`);
                this.isStreaming = false;
            })
            .on('stderr', (line: string) => {
                console.log('FFmpeg stderr:', line);
            });
        console.log('FFmpeg命令配置完成，准备启动...');
        // 测试命令是否有效
        await new Promise((resolve, reject) => {
            console.log('开始测试FFmpeg命令...');
            const testCommand = this.command!.clone();
            testCommand
                .output('null')
                .on('start', () => console.log('测试命令已启动'))
                .on('end', () => {
                    console.log('测试命令成功完成');
                    resolve(null);
                })
                .on('error', (err) => {
                    console.error('测试命令失败:', err);
                    reject(err);
                })
                .run();
        });
        if (!this.command) {
            throw lastError || new Error('无法找到可用的视频捕获设备。请检查: \n' +
                '1. 系统是否支持avfoundation\n' +
                '2. 是否有屏幕录制权限\n' +
                '3. 尝试重启电脑');
        }

        console.log('启动FFmpeg视频流...');
        this.command.run();

        this.command.pipe(this.outputStream, { end: true });
        return this.outputStream;
    }

    stopStream(): void {
        if (this.isStreaming && this.command) {
            this.command.kill('SIGKILL');
            this.isStreaming = false;
        }
    }

    isStreamingActive(): boolean {
        return this.isStreaming;
    }
}

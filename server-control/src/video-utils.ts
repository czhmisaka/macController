/*
 * @Date: 2025-05-10 14:06:43
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-15 18:19:12
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
    device?: string;
}

interface AVFoundationDevice {
    index: string;
    name: string;
    type: 'video' | 'audio';
}

export class VideoStreamer {
    private command: ffmpeg.FfmpegCommand | null = null;
    private isStreaming: boolean = false;
    private options: Required<VideoStreamOptions>;

    private async listAVFoundationDevices(): Promise<AVFoundationDevice[]> {
        try {
            const output = execSync(`${ffmpegStatic as string} -f avfoundation -list_devices true -i "" -hide_banner 2>&1 || true`).toString();
            console.log('毛病开始', output, '毛病')
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
        this.options = {
            fps: options.fps ?? 30,
            quality: options.quality ?? 23,
            resolution: options.resolution ?? 'native',
            device: options.device ?? '0'
        };
    }
    async start(stream: PassThrough): Promise<void> {
        if (this.isStreaming) {
            return;
        }

        const displays = await systeminformation.graphics();
        const mainDisplay = displays.displays.find(d => d.main);
        if (!mainDisplay) throw new Error('未找到主显示器');

        const { resolutionX: width, resolutionY: height } = mainDisplay;
        const scaling = getDisplayScaling();

        if (!width || !height) {
            throw new Error('无法获取屏幕尺寸');
        }
        const logicalWidth = Math.floor(width / scaling.scaleX);
        const logicalHeight = Math.floor(height / scaling.scaleY);

        const devices = await this.listAVFoundationDevices();
        const videoDevices = devices.filter((d: AVFoundationDevice) => d.type === 'video');
        if (videoDevices.length === 0) {
            throw new Error('未找到可用的视频捕获设备');
        }

        if (videoDevices.length < 2) {
            throw new Error(`需要至少2个视频设备，当前找到${videoDevices.length}个`);
        }

        const device = this.options.device || videoDevices[1].index;
        let lastError: Error | null = null;
        console.log('所有视频设备:', videoDevices);
        console.log(`使用avfoundation视频设备: ${device} (${videoDevices[1].name})`);

        this.command = ffmpeg()
            .input(`${device}:1`)
            .inputFormat('avfoundation')
            .inputOptions([
                '-framerate 15'
            ])
            .videoCodec('libx264')
            .outputOptions([
                '-r 15',
                '-filter:v format=yuv420p,scale=1512:982',
                '-preset ultrafast',
                '-tune zerolatency',
                `-crf ${this.options.quality}`,
                '-f mp4',
                '-movflags faststart',
                '-g 30',
                '-bufsize 1000k',
                '-maxrate 1500k'
            ])
            .fps(this.options.fps)
            .on('start', () => {
                console.log(`视频流已启动 (设备索引: ${device})`);
                this.isStreaming = true;
                if (this.command) {
                    console.log('FFmpeg命令:', this.command._getArguments().join(' '));
                }
            })
            .on('progress', (progress) => {
                console.log('FFmpeg进度:', progress);
                console.log('当前帧:', progress.frames);
            })
            .on('error', (err: Error) => {
                console.error(`视频流错误 (设备索引: ${device}):`, err);
                this.isStreaming = false;
                lastError = err;

                const stderr = (err as any).stderr || '';
                if (stderr.includes('Input/output error')) {
                    console.error('设备可能被占用或不可用');
                } else if (stderr.includes('Invalid argument')) {
                    console.error('FFmpeg参数配置错误');
                } else if (stderr.includes('Configuration of video device failed')) {
                    console.error('视频设备配置失败，尝试简化配置...');
                    // 自动重试简化配置
                    this.command = null;
                    this.start(stream).catch(e => console.error('重试失败:', e));
                }
                console.error('FFmpeg错误详情:', stderr);
            })
            .on('end', () => {
                console.log(`视频流已结束 (设备索引: ${device})`);
                this.isStreaming = false;
            })
            .on('stderr', (line: string) => {
                console.log('FFmpeg stderr:', line);
            });

        if (!this.command) {
            throw lastError || new Error('无法找到可用的视频捕获设备');
        }

        // 设置输出流
        this.command.output(stream, { end: true });

        console.log('FFmpeg命令配置完成，准备启动...');
        console.log('启动FFmpeg视频流...');
        this.command.run();
    }

    stop(): void {
        if (this.isStreaming && this.command) {
            this.command.kill('SIGKILL');
            this.isStreaming = false;
        }
    }

    isStreamingActive(): boolean {
        return this.isStreaming;
    }
}

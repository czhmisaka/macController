/*
 * @Date: 2025-05-08 23:24:28
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-08 23:24:42
 * @FilePath: /指令控制电脑/server-control/src/types/robotjs.d.ts
 */
declare module 'robotjs' {
    interface ScreenSize {
        width: number;
        height: number;
    }

    interface Display {
        id: number;
        bounds: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        dpi?: {
            x: number;
            y: number;
        };
        isPrimary: boolean;
    }

    function getDisplays(): Display[];
    function getScreenSize(): ScreenSize;
    function moveMouse(x: number, y: number): void;
    function typeString(text: string): void;
    interface Screen {
        capture(x?: number, y?: number, width?: number, height?: number): {
            width: number;
            height: number;
            image: Buffer;
            byteWidth: number;
            bitsPerPixel: number;
            bytesPerPixel: number;
        };
    }

    const screen: Screen;
}

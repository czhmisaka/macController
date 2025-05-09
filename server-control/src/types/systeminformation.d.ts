/*
 * @Date: 2025-05-08 23:25:19
 * @LastEditors: CZH
 * @LastEditTime: 2025-05-08 23:36:58
 * @FilePath: /指令控制电脑/server-control/src/types/systeminformation.d.ts
 */
declare module 'systeminformation' {
    interface GraphicsDisplayData {
        vendor: string;
        model: string;
        main: boolean;
        builtin: boolean;
        connection: string;
        resolutionX: number;
        resolutionY: number;
        currentRefreshRate: number;
        pixeldepth: number;
        sizeX?: number;
        sizeY?: number;
    }

    interface GraphicsData {
        controllers: Array<{
            vendor: string;
            model: string;
            bus: string;
            vram: number;
        }>;
        displays: GraphicsDisplayData[];
    }

    function graphics(): Promise<GraphicsData>;
}

declare module 'systeminformation' {
    interface CpuCurrentLoadData {
        avgLoad: number;
        currentLoad: number;
        currentLoadUser: number;
        currentLoadSystem: number;
        currentLoadNice: number;
        currentLoadIdle: number;
        currentLoadIrq: number;
        cores: Array<{
            load: number;
            loadUser: number;
            loadSystem: number;
            loadNice: number;
            loadIdle: number;
            loadIrq: number;
        }>;
    }

    interface MemoryData {
        total: number;
        free: number;
        used: number;
        active: number;
        available: number;
        buffcache: number;
        swaptotal: number;
        swapused: number;
        swapfree: number;
    }

    interface FsSizeData {
        fs: string;
        type: string;
        size: number;
        used: number;
        available: number;
        use: number;
        mount: string;
    }

    interface NetworkStatsData {
        iface: string;
        operstate: string;
        rx_bytes: number;
        tx_bytes: number;
        rx_dropped: number;
        tx_dropped: number;
        rx_errors: number;
        tx_errors: number;
    }

    interface ProcessData {
        pid: number;
        name: string;
        pcpu: number;
        pmem: number;
        priority: number;
        mem_vsz: number;
        mem_rss: number;
        state: string;
        command: string;
    }

    interface ProcessesData {
        all: number;
        running: number;
        blocked: number;
        sleeping: number;
        unknown: number;
        list: ProcessData[];
    }

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

    function currentLoad(): Promise<CpuCurrentLoadData>;
    function mem(): Promise<MemoryData>;
    function fsSize(): Promise<FsSizeData[]>;
    function networkStats(): Promise<NetworkStatsData[]>;
    function processes(): Promise<ProcessesData>;
    function graphics(): Promise<GraphicsData>;
}
